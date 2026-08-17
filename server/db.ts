import { and, asc, desc, eq, gt, inArray, like, lte, or } from "drizzle-orm";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  activityLogs,
  adminTwoFactorSessions,
  championships,
  figurinhas,
  InsertUser,
    negotiations,
    notifications,
    reservas,
  twoFactorBackupCodes,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { publishNotificationEvent } from "./notificationStream";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const userToken = user.userToken && user.userToken !== "pending" ? user.userToken : nanoid(32);
  const values: InsertUser = {
    openId: user.openId,
    userToken,
    name: user.name,
    email: user.email,
    phone: user.phone,
    whatsapp: user.whatsapp,
    loginMethod: user.loginMethod,
    role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
    lastSignedIn: user.lastSignedIn ?? new Date(),
  };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "phone", "whatsapp", "loginMethod"] as const) {
    if (user[field] !== undefined) updateSet[field] = user[field] ?? null;
  }
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) updateSet.role = values.role;

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function updateUserProfile(userId: number, input: { name?: string; phone?: string; whatsapp?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(input).where(eq(users.id, userId));
}

function hashAdminSessionToken(sessionToken: string) {
  return createHash("sha256").update(sessionToken).digest("hex");
}

export async function createAdminTwoFactorSession(userId: number, sessionToken: string, expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000)) {
  const db = await getDb();
  if (!db || !sessionToken) throw new Error("Database not available");
  const sessionHash = hashAdminSessionToken(sessionToken);
  await db.insert(adminTwoFactorSessions).values({ userId, sessionHash, expiresAt }).onDuplicateKeyUpdate({ set: { userId, expiresAt } });
}

export async function hasValidAdminTwoFactorSession(userId: number, sessionToken: string) {
  const db = await getDb();
  if (!db || !sessionToken) return false;
  const sessionHash = hashAdminSessionToken(sessionToken);
  const rows = await db.select({ id: adminTwoFactorSessions.id }).from(adminTwoFactorSessions).where(and(
    eq(adminTwoFactorSessions.userId, userId),
    eq(adminTwoFactorSessions.sessionHash, sessionHash),
    gt(adminTwoFactorSessions.expiresAt, new Date()),
  )).limit(1);
  return Boolean(rows[0]);
}

export async function revokeAdminTwoFactorSession(userId: number, sessionToken: string) {
  const db = await getDb();
  if (!db || !sessionToken) return;
  await db.delete(adminTwoFactorSessions).where(and(
    eq(adminTwoFactorSessions.userId, userId),
    eq(adminTwoFactorSessions.sessionHash, hashAdminSessionToken(sessionToken)),
  ));
}

export async function updateUserTwoFactor(userId: number, secret: string | null, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ twoFactorSecret: secret, twoFactorEnabled: enabled }).where(eq(users.id, userId));
}

export async function saveTwoFactorBackupCodes(userId: number, codes: string[]) {
  const db = await getDb();
  if (!db || codes.length === 0) return;
  await db.insert(twoFactorBackupCodes).values(codes.map((code) => ({ userId, code, used: false })));
}

export async function useTwoFactorBackupCode(userId: number, code: string) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(twoFactorBackupCodes).where(and(
    eq(twoFactorBackupCodes.userId, userId),
    eq(twoFactorBackupCodes.code, code),
    eq(twoFactorBackupCodes.used, false),
  )).limit(1);
  const row = rows[0];
  if (!row) return false;
  await db.update(twoFactorBackupCodes).set({ used: true }).where(eq(twoFactorBackupCodes.id, row.id));
  return true;
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, email: users.email, whatsapp: users.whatsapp, role: users.role, twoFactorEnabled: users.twoFactorEnabled, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt));
}

export async function listAllFigurinhasForAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ card: figurinhas, owner: users, championship: championships })
    .from(figurinhas)
    .leftJoin(users, eq(figurinhas.userId, users.id))
    .leftJoin(championships, eq(figurinhas.championshipId, championships.id))
    .orderBy(desc(figurinhas.createdAt));
}

export async function listActiveReservasForAdmin() {
  const db = await getDb();
  if (!db) return [];
  await expireOldReservas();
  return db.select({ reservation: reservas, card: figurinhas, owner: users, championship: championships })
    .from(reservas)
    .leftJoin(figurinhas, eq(reservas.figurinhaId, figurinhas.id))
    .leftJoin(users, eq(reservas.ownerId, users.id))
    .leftJoin(championships, eq(figurinhas.championshipId, championships.id))
    .where(eq(reservas.status, "active"))
    .orderBy(reservas.expiresAt);
}

export async function countPlatformEntities() {
  const db = await getDb();
  if (!db) return { users: 0, cards: 0, reservations: 0 };
  const [userRows, cardRows, reservationRows] = await Promise.all([
    db.select({ id: users.id }).from(users),
    db.select({ id: figurinhas.id }).from(figurinhas),
    db.select({ id: reservas.id }).from(reservas).where(eq(reservas.status, "active")),
  ]);
  return { users: userRows.length, cards: cardRows.length, reservations: reservationRows.length };
}

export async function addFigurinha(input: typeof figurinhas.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(figurinhas).values(input);
}

export async function deleteFigurinha(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(figurinhas).where(eq(figurinhas.id, id));
}

export async function getUserFigurinhas(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ card: figurinhas, championship: championships }).from(figurinhas).leftJoin(championships, eq(figurinhas.championshipId, championships.id)).where(eq(figurinhas.userId, userId)).orderBy(desc(figurinhas.createdAt));
}

export type MarketplaceFilters = {
  championshipId?: number;
  type?: "duplicate" | "needed";
  condition?: "mint" | "good" | "fair" | "poor";
  search?: string;
  sort?: "newest" | "cardNumber" | "playerName";
};

export function normalizeMarketplaceFilters(input: MarketplaceFilters = {}): MarketplaceFilters {
  return {
    championshipId: input.championshipId,
    type: input.type,
    condition: input.condition,
    search: input.search?.trim().slice(0, 80) || undefined,
    sort: input.sort ?? "newest",
  };
}

export async function getMarketplaceFigurinhas(filtersInput: MarketplaceFilters = {}) {
  const db = await getDb();
  filtersInput = normalizeMarketplaceFilters(filtersInput);
  if (!db) return [];
  const filters = [eq(figurinhas.status, "available")];
  if (filtersInput.championshipId) filters.push(eq(figurinhas.championshipId, filtersInput.championshipId));
  if (filtersInput.type) filters.push(eq(figurinhas.type, filtersInput.type));
  if (filtersInput.condition) filters.push(eq(figurinhas.condition, filtersInput.condition));
  const search = filtersInput.search;
  if (search) {
    const pattern = `%${search}%`;
    filters.push(or(
      like(figurinhas.cardNumber, pattern),
      like(figurinhas.playerName, pattern),
      like(figurinhas.notes, pattern),
      like(championships.name, pattern),
    )!);
  }

  const orderBy = filtersInput.sort === "cardNumber"
    ? asc(figurinhas.cardNumber)
    : filtersInput.sort === "playerName"
      ? asc(figurinhas.playerName)
      : desc(figurinhas.createdAt);

  return db.select({ card: figurinhas, owner: users, championship: championships })
    .from(figurinhas)
    .leftJoin(users, eq(figurinhas.userId, users.id))
    .leftJoin(championships, eq(figurinhas.championshipId, championships.id))
    .where(and(...filters))
    .orderBy(orderBy);
}

export async function getFigurinhaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({ card: figurinhas, owner: users, championship: championships })
    .from(figurinhas)
    .leftJoin(users, eq(figurinhas.userId, users.id))
    .leftJoin(championships, eq(figurinhas.championshipId, championships.id))
    .where(eq(figurinhas.id, id)).limit(1);
  return result[0];
}

export async function updateFigurinhaStatus(id: number, status: "available" | "reserved" | "traded") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(figurinhas).set({ status }).where(eq(figurinhas.id, id));
}

export async function createReserva(figurinhaId: number, reservedByUserId: number, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return db.transaction(async (tx) => {
    const available = await tx.select({ id: figurinhas.id }).from(figurinhas).where(and(eq(figurinhas.id, figurinhaId), eq(figurinhas.status, "available"))).limit(1);
    if (!available[0]) throw new Error("FIGURINHA_UNAVAILABLE");
    await tx.update(figurinhas).set({ status: "reserved" }).where(eq(figurinhas.id, figurinhaId));
    const inserted = await tx.insert(reservas).values({ figurinhaId, reservedByUserId, ownerId, expiresAt, status: "active" });
    const insertId = Number((inserted as { insertId?: number }).insertId ?? 0);
    const created = insertId > 0
      ? { id: insertId }
      : (await tx.select({ id: reservas.id }).from(reservas).where(and(eq(reservas.figurinhaId, figurinhaId), eq(reservas.reservedByUserId, reservedByUserId), eq(reservas.ownerId, ownerId), eq(reservas.status, "active"))).orderBy(desc(reservas.id)).limit(1))[0];
    if (!created) throw new Error("RESERVA_NOT_CREATED");
    return { reservationId: created.id, expiresAt };
  });
}

export async function expireOldReservas() {
  const db = await getDb();
  if (!db) return 0;
  const expired = await db.select().from(reservas).where(and(eq(reservas.status, "active"), lte(reservas.expiresAt, new Date())));
  for (const reserva of expired) {
    await db.update(reservas).set({ status: "expired" }).where(eq(reservas.id, reserva.id));
    await db.update(figurinhas).set({ status: "available" }).where(eq(figurinhas.id, reserva.figurinhaId));
  }
  return expired.length;
}

export async function listReservasForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  await expireOldReservas();
  return db.select({ reservation: reservas, card: figurinhas, owner: users, championship: championships })
    .from(reservas)
    .leftJoin(figurinhas, eq(reservas.figurinhaId, figurinhas.id))
    .leftJoin(users, eq(reservas.ownerId, users.id))
    .leftJoin(championships, eq(figurinhas.championshipId, championships.id))
    .where(and(eq(reservas.reservedByUserId, userId), eq(reservas.status, "active")))
    .orderBy(desc(reservas.createdAt));
}

export async function getReservaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  await expireOldReservas();
  const result = await db.select({ reservation: reservas, card: figurinhas, owner: users, requester: users })
    .from(reservas)
    .leftJoin(figurinhas, eq(reservas.figurinhaId, figurinhas.id))
    .leftJoin(users, eq(reservas.ownerId, users.id))
    .where(eq(reservas.id, id)).limit(1);
  return result[0];
}

export async function setReservaStatus(id: number, status: "completed" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const row = await db.select().from(reservas).where(eq(reservas.id, id)).limit(1);
  if (!row[0]) return;
  await db.update(reservas).set({ status }).where(eq(reservas.id, id));
  await db.update(figurinhas).set({ status: status === "completed" ? "traded" : "available" }).where(eq(figurinhas.id, row[0].figurinhaId));
}

export async function setReservaProposalStatus(id: number, proposalStatus: "pending" | "accepted") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reservas).set({ proposalStatus }).where(eq(reservas.id, id));
}

export async function completeReserva(reservaId: number, type: "trade" | "purchase", amount?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(reservas).where(eq(reservas.id, reservaId)).limit(1);
    const reserva = rows[0];
    if (!reserva) throw new Error("RESERVA_NOT_FOUND");
    const existing = await tx.select().from(negotiations).where(eq(negotiations.reservaId, reservaId)).limit(1);
    if (existing[0]) return existing[0];
    if (reserva.status !== "active") throw new Error("RESERVA_NOT_ACTIVE");
    await tx.update(reservas).set({ status: "completed" }).where(eq(reservas.id, reservaId));
    await tx.update(figurinhas).set({ status: "traded" }).where(eq(figurinhas.id, reserva.figurinhaId));
    await tx.insert(negotiations).values({
      reservaId,
      figurinhaId: reserva.figurinhaId,
      sellerId: reserva.ownerId,
      buyerId: reserva.reservedByUserId,
      type,
      amount: amount === undefined ? undefined : amount.toFixed(2),
      status: "completed",
    });
    const created = await tx.select().from(negotiations).where(eq(negotiations.reservaId, reservaId)).limit(1);
    return created[0];
  });
}

export async function getNegotiationHistoryForUser(userId: number, type?: "trade" | "purchase") {
  const db = await getDb();
  if (!db) return [];
  const filters = [or(eq(negotiations.sellerId, userId), eq(negotiations.buyerId, userId))!];
  if (type) filters.push(eq(negotiations.type, type));
  const rows = await db.select({ negotiation: negotiations, card: figurinhas, championship: championships })
    .from(negotiations)
    .leftJoin(figurinhas, eq(negotiations.figurinhaId, figurinhas.id))
    .leftJoin(championships, eq(figurinhas.championshipId, championships.id))
    .where(and(...filters))
    .orderBy(desc(negotiations.completedAt));
  const userIds = Array.from(new Set(rows.flatMap(({ negotiation }) => [negotiation.sellerId, negotiation.buyerId])));
  const relatedUsers = userIds.length ? await db.select({ id: users.id, name: users.name, whatsapp: users.whatsapp }).from(users).where(inArray(users.id, userIds)) : [];
  const usersById = new Map(relatedUsers.map((item) => [item.id, item]));
  return rows.map((row) => ({
    ...row,
    seller: usersById.get(row.negotiation.sellerId) ?? null,
    buyer: usersById.get(row.negotiation.buyerId) ?? null,
    perspective: row.negotiation.sellerId === userId ? "seller" as const : "buyer" as const,
  }));
}

export async function getAllChampionships() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(championships).orderBy(desc(championships.year), championships.name);
}

export async function addChampionship(input: typeof championships.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(championships).values(input);
}

export async function logActivity(userId: number | null, action: string, description?: string, entityType?: string, entityId?: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values({ userId, action, description, entityType, entityId });
}


export type NotificationKind = "trade_accepted" | "trade_completed" | "system_notice";
export type NotificationCategory = "trade" | "purchase" | "system";

export async function createNotification(input: {
  userId: number;
  kind: NotificationKind;
  category: NotificationCategory;
  title: string;
  message: string;
  reservationId?: number;
  negotiationId?: number;
}) {
  const db = await getDb();
  if (!db) return undefined;
  const identityFilter = input.reservationId !== undefined
    ? eq(notifications.reservationId, input.reservationId)
    : input.negotiationId !== undefined
      ? eq(notifications.negotiationId, input.negotiationId)
      : undefined;
  if (identityFilter) {
    const existing = await db.select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, input.userId), eq(notifications.kind, input.kind), identityFilter))
      .limit(1);
    if (existing[0]) return existing[0];
  }
  const inserted = await db.insert(notifications).values({
    userId: input.userId,
    kind: input.kind,
    category: input.category,
    title: input.title,
    message: input.message,
    reservationId: input.reservationId,
    negotiationId: input.negotiationId,
  });
  const created = { id: Number((inserted as { insertId?: number }).insertId ?? 0) };
  publishNotificationEvent(input.userId, {
    id: created.id > 0 ? created.id : undefined,
    kind: input.kind,
    category: input.category,
    title: input.title,
    message: input.message,
  });
  return created;
}

export async function createReservationAcceptedNotifications(reservationId: number) {
  const result = await getReservaById(reservationId);
  if (!result?.card || !result.owner) return;
  const cardLabel = `${result.card.cardNumber} · ${result.card.playerName}`;
  return createNotification({
    userId: result.reservation.ownerId,
    kind: "trade_accepted",
    category: "trade",
    title: "Reserva aceita",
    message: `Um colecionador enviou uma proposta para ${cardLabel}. Aceite ou recuse a proposta e combine a troca pelo WhatsApp.`,
    reservationId,
  });
}

export async function createNegotiationCompletedNotifications(reservationId: number, negotiationId: number, category: "trade" | "purchase") {
  const result = await getReservaById(reservationId);
  if (!result?.card) return;
  const cardLabel = `${result.card.cardNumber} · ${result.card.playerName}`;
  const recipients = [result.reservation.ownerId, result.reservation.reservedByUserId];
  const isPurchase = category === "purchase";
  await Promise.all(recipients.map((userId) => createNotification({
    userId,
    kind: "trade_completed",
    category,
    title: isPurchase ? "Compra finalizada" : "Troca finalizada",
    message: `${isPurchase ? "A compra" : "A troca"} de ${cardLabel} foi marcada como concluída.`,
    reservationId,
    negotiationId,
  })));
}

export async function getNotificationsForUser(userId: number, limit = 30, category?: NotificationCategory) {
  const db = await getDb();
  if (!db) return [];
  const filters = [eq(notifications.userId, userId)];
  if (category) filters.push(eq(notifications.category, category));
  const rows = await db.select({ notification: notifications, reservationStatus: reservas.status, proposalStatus: reservas.proposalStatus, reservationOwnerId: reservas.ownerId })
    .from(notifications)
    .leftJoin(reservas, eq(notifications.reservationId, reservas.id))
    .where(and(...filters))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.min(Math.max(limit, 1), 50));
  return rows.map(({ notification, reservationStatus, proposalStatus, reservationOwnerId }) => ({
    ...notification,
    actionAvailable: notification.kind === "trade_accepted"
      && notification.category === "trade"
      && notification.reservationId !== null
      && notification.userId === reservationOwnerId
      && reservationStatus === "active"
      && proposalStatus === "pending",
  }));
}

export async function getUnreadNotificationCount(userId: number, category?: NotificationCategory) {
  const db = await getDb();
  if (!db) return 0;
  const filters = [eq(notifications.userId, userId), eq(notifications.isRead, false)];
  if (category) filters.push(eq(notifications.category, category));
  const rows = await db.select({ id: notifications.id })
    .from(notifications)
    .where(and(...filters));
  return rows.length;
}

export async function getUnreadNotificationCounts(userId: number) {
  const [all, trade, purchase, system] = await Promise.all([
    getUnreadNotificationCount(userId),
    getUnreadNotificationCount(userId, "trade"),
    getUnreadNotificationCount(userId, "purchase"),
    getUnreadNotificationCount(userId, "system"),
  ]);
  return { all, trade, purchase, system };
}

export async function markNotificationAsRead(userId: number, notificationId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsAsRead(userId: number, category?: NotificationCategory) {
  const db = await getDb();
  if (!db) return;
  const filters = [eq(notifications.userId, userId), eq(notifications.isRead, false)];
  if (category) filters.push(eq(notifications.category, category));
  await db.update(notifications)
    .set({ isRead: true })
    .where(and(...filters));
}
