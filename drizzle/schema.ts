import {
  boolean,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 128 }).notNull().unique(),
    name: varchar("name", { length: 160 }),
    email: varchar("email", { length: 320 }).unique(),
    phone: varchar("phone", { length: 24 }),
    whatsapp: varchar("whatsapp", { length: 24 }),
    userToken: varchar("userToken", { length: 64 }).notNull().unique().default("pending"),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "admin"]).notNull().default("user"),
    twoFactorEnabled: boolean("twoFactorEnabled").notNull().default(false),
    twoFactorSecret: text("twoFactorSecret"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
    lastSignedIn: timestamp("lastSignedIn").notNull().defaultNow(),
  },
  (table) => ({ emailIdx: index("users_email_idx").on(table.email) }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const championships = mysqlTable("championships", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  year: int("year"),
  description: text("description"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

export type Championship = typeof championships.$inferSelect;
export type InsertChampionship = typeof championships.$inferInsert;

export const figurinhas = mysqlTable(
  "figurinhas",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    championshipId: int("championshipId").notNull(),
    cardNumber: varchar("cardNumber", { length: 48 }).notNull(),
    playerName: varchar("playerName", { length: 180 }).notNull(),
    type: mysqlEnum("type", ["duplicate", "needed"]).notNull(),
    condition: mysqlEnum("condition", ["mint", "good", "fair", "poor"]).notNull().default("good"),
    price: decimal("price", { precision: 10, scale: 2 }),
    notes: text("notes"),
    status: mysqlEnum("status", ["available", "reserved", "traded"]).notNull().default("available"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdx: index("figurinhas_user_idx").on(table.userId),
    championshipIdx: index("figurinhas_championship_idx").on(table.championshipId),
    statusIdx: index("figurinhas_status_idx").on(table.status),
  }),
);

export type Figurinha = typeof figurinhas.$inferSelect;
export type InsertFigurinha = typeof figurinhas.$inferInsert;

export const reservas = mysqlTable(
  "reservas",
  {
    id: int("id").autoincrement().primaryKey(),
    figurinhaId: int("figurinhaId").notNull(),
    reservedByUserId: int("reservedByUserId").notNull(),
    ownerId: int("ownerId").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    status: mysqlEnum("status", ["active", "completed", "expired", "cancelled"]).notNull().default("active"),
    proposalStatus: mysqlEnum("proposalStatus", ["pending", "accepted"]).notNull().default("pending"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    cardIdx: index("reservas_card_idx").on(table.figurinhaId),
    requesterIdx: index("reservas_requester_idx").on(table.reservedByUserId),
    expirationIdx: index("reservas_expiration_idx").on(table.expiresAt),
    statusIdx: index("reservas_status_idx").on(table.status),
  }),
);

export type Reserva = typeof reservas.$inferSelect;
export type InsertReserva = typeof reservas.$inferInsert;

export const negotiations = mysqlTable(
  "negotiations",
  {
    id: int("id").autoincrement().primaryKey(),
    reservaId: int("reservaId").notNull().unique(),
    figurinhaId: int("figurinhaId").notNull(),
    sellerId: int("sellerId").notNull(),
    buyerId: int("buyerId").notNull(),
    type: mysqlEnum("type", ["trade", "purchase"]).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }),
    status: mysqlEnum("status", ["completed"]).notNull().default("completed"),
    completedAt: timestamp("completedAt").notNull().defaultNow(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    buyerIdx: index("negotiations_buyer_idx").on(table.buyerId),
    sellerIdx: index("negotiations_seller_idx").on(table.sellerId),
    completedAtIdx: index("negotiations_completed_at_idx").on(table.completedAt),
  }),
);

export type Negotiation = typeof negotiations.$inferSelect;
export type InsertNegotiation = typeof negotiations.$inferInsert;

export const twoFactorBackupCodes = mysqlTable(
  "twoFactorBackupCodes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    code: varchar("code", { length: 32 }).notNull(),
    used: boolean("used").notNull().default(false),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({ userIdx: index("two_factor_codes_user_idx").on(table.userId) }),
);

export const adminTwoFactorSessions = mysqlTable(
  "adminTwoFactorSessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    sessionHash: varchar("sessionHash", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("admin_2fa_sessions_user_idx").on(table.userId),
    expiresIdx: index("admin_2fa_sessions_expires_idx").on(table.expiresAt),
  }),
);

export const activityLogs = mysqlTable(
  "activityLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId"),
    action: varchar("action", { length: 100 }).notNull(),
    description: text("description"),
    entityType: varchar("entityType", { length: 50 }),
    entityId: int("entityId"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({ userIdx: index("activity_logs_user_idx").on(table.userId) }),
);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    kind: mysqlEnum("kind", ["trade_accepted", "trade_completed", "system_notice"]).notNull(),
    category: mysqlEnum("category", ["trade", "purchase", "system"]).notNull().default("system"),
    title: varchar("title", { length: 180 }).notNull(),
    message: text("message").notNull(),
    reservationId: int("reservationId"),
    negotiationId: int("negotiationId"),
    isRead: boolean("isRead").notNull().default(false),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("notifications_user_idx").on(table.userId),
    unreadIdx: index("notifications_unread_idx").on(table.userId, table.isRead),
    categoryIdx: index("notifications_category_idx").on(table.userId, table.category),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
  }),
);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export const relations = undefined;
