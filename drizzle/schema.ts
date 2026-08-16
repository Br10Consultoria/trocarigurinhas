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

export const relations = undefined;
