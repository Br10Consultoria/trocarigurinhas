import { and, asc, desc, eq, gt, like, lte, or } from "drizzle-orm";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  activityLogs,
  adminTwoFactorSessions,
  championships,
  figurinhas,
  InsertUser,
  reservas,
  twoFactorBackupCodes,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

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
    await tx.insert(reservas).values({ figurinhaId, reservedByUserId, ownerId, expiresAt, status: "active" });
    return expiresAt;
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
