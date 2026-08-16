import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { admin2FAProcedure, adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import * as db from "./db";
import * as twoFactor from "./twoFactor";

const secretKey = () => process.env.JWT_SECRET ?? "troca-figurinhas-local-secret";

function getRequestSessionToken(req: { headers: { cookie?: string; authorization?: string } }) {
  const cookieToken = parseCookie(req.headers.cookie ?? "")[COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const authorization = req.headers.authorization;
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.user?.role === "admin") {
        await db.revokeAdminTwoFactorSession(ctx.user.id, getRequestSessionToken(ctx.req));
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    updateProfile: protectedProcedure.input(z.object({
      name: z.string().trim().min(2).max(160),
      phone: z.string().trim().min(8).max(24),
      whatsapp: z.string().trim().min(8).max(24),
    })).mutation(async ({ ctx, input }) => {
      await db.updateUserProfile(ctx.user!.id, input);
      await db.logActivity(ctx.user!.id, "PROFILE_UPDATED", "Perfil atualizado");
      return { success: true };
    }),
    getToken: protectedProcedure.query(({ ctx }) => ({ token: ctx.user!.userToken })),
  }),

  twoFa: router({
    status: protectedProcedure.query(({ ctx }) => ({
      required: ctx.user!.role === "admin",
      enabled: ctx.user!.twoFactorEnabled,
    })),
    sessionStatus: protectedProcedure.query(async ({ ctx }) => ({
      required: ctx.user!.role === "admin" && ctx.user!.twoFactorEnabled,
      verified: ctx.user!.role !== "admin" || !ctx.user!.twoFactorEnabled
        ? true
        : await db.hasValidAdminTwoFactorSession(ctx.user!.id, getRequestSessionToken(ctx.req)),
    })),
    setup: adminProcedure.mutation(async ({ ctx }) => {
      const { secret, otpauthUrl } = twoFactor.generateTwoFactorSecret(ctx.user!.email ?? ctx.user!.name ?? "admin");
      return { secret, otpauthUrl, backupCodes: twoFactor.generateBackupCodes() };
    }),
    enable: adminProcedure.input(z.object({
      secret: z.string().min(16),
      token: z.string().length(6),
      backupCodes: z.array(z.string()).min(1).max(12),
    })).mutation(async ({ ctx, input }) => {
      if (!twoFactor.verifyTwoFactorToken(input.secret, input.token)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Código 2FA inválido ou expirado." });
      }
      await db.updateUserTwoFactor(ctx.user!.id, twoFactor.encryptSecret(input.secret, secretKey()), true);
      await db.saveTwoFactorBackupCodes(ctx.user!.id, input.backupCodes);
      await db.logActivity(ctx.user!.id, "2FA_ENABLED", "2FA ativado para a conta administrativa");
      return { success: true };
    }),
    verify: adminProcedure.input(z.object({ token: z.string().length(6).optional(), backupCode: z.string().min(8).optional() }).refine((value) => Boolean(value.token || value.backupCode), { message: "Informe um token ou código de recuperação." })).mutation(async ({ ctx, input }) => {
      const encrypted = ctx.user!.twoFactorSecret;
      if (!encrypted) throw new TRPCError({ code: "BAD_REQUEST", message: "Configure o 2FA primeiro." });
      const verified = input.backupCode
        ? await db.useTwoFactorBackupCode(ctx.user!.id, input.backupCode)
        : input.token ? twoFactor.verifyTwoFactorToken(twoFactor.decryptSecret(encrypted, secretKey()), input.token) : false;
      if (!verified) throw new TRPCError({ code: "UNAUTHORIZED", message: "Não foi possível validar o segundo fator." });
      const sessionToken = getRequestSessionToken(ctx.req);
      if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão de login não encontrada." });
      await db.createAdminTwoFactorSession(ctx.user!.id, sessionToken);
      return { success: true };
    }),
    disable: adminProcedure.input(z.object({ token: z.string().length(6) })).mutation(async ({ ctx, input }) => {
      const encrypted = ctx.user!.twoFactorSecret;
      if (!encrypted || !twoFactor.verifyTwoFactorToken(twoFactor.decryptSecret(encrypted, secretKey()), input.token)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Código 2FA inválido." });
      }
      await db.updateUserTwoFactor(ctx.user!.id, null, false);
      await db.logActivity(ctx.user!.id, "2FA_DISABLED", "2FA desativado");
      return { success: true };
    }),
  }),

  championships: router({
    getAll: protectedProcedure.query(() => db.getAllChampionships()),
    add: admin2FAProcedure.input(z.object({ name: z.string().trim().min(2).max(180), year: z.number().int().min(1900).max(2100).optional(), description: z.string().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      await db.addChampionship(input);
      await db.logActivity(ctx.user!.id, "CHAMPIONSHIP_CREATED", input.name, "championship");
      return { success: true };
    }),
  }),

  figurinhas: router({
    add: protectedProcedure.input(z.object({
      championshipId: z.number().int().positive(),
      cardNumber: z.string().trim().min(1).max(48),
      playerName: z.string().trim().min(1).max(180),
      type: z.enum(["duplicate", "needed"]),
      condition: z.enum(["mint", "good", "fair", "poor"]).default("good"),
      price: z.number().nonnegative().max(999999).optional(),
      notes: z.string().max(1000).optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.addFigurinha({
        userId: ctx.user!.id,
        championshipId: input.championshipId,
        cardNumber: input.cardNumber,
        playerName: input.playerName,
        type: input.type,
        condition: input.condition,
        price: input.price === undefined ? undefined : input.price.toFixed(2),
        notes: input.notes,
        status: "available",
      });
      await db.logActivity(ctx.user!.id, "CARD_CREATED", `${input.cardNumber} · ${input.playerName}`, "figurinha");
      return { success: true };
    }),
    mine: protectedProcedure.query(({ ctx }) => db.getUserFigurinhas(ctx.user!.id)),
    list: protectedProcedure.input(z.object({
      championshipId: z.number().int().positive().optional(),
      type: z.enum(["duplicate", "needed"]).optional(),
      condition: z.enum(["mint", "good", "fair", "poor"]).optional(),
      search: z.string().trim().max(80).optional(),
      sort: z.enum(["newest", "cardNumber", "playerName"]).optional(),
    }).optional()).query(({ input }) => db.getMarketplaceFigurinhas(input ?? {})),
    byId: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => db.getFigurinhaById(input.id)),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const card = await db.getFigurinhaById(input.id);
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Figurinha não encontrada." });
      if (card.card.userId !== ctx.user!.id && ctx.user!.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      if (card.card.status === "reserved") throw new TRPCError({ code: "CONFLICT", message: "Figurinha reservada não pode ser removida." });
      await db.deleteFigurinha(input.id);
      await db.logActivity(ctx.user!.id, "CARD_DELETED", `Figurinha ${input.id} removida`, "figurinha", input.id);
      return { success: true };
    }),
  }),

  reservas: router({
    create: protectedProcedure.input(z.object({ figurinhaId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const card = await db.getFigurinhaById(input.figurinhaId);
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Figurinha não encontrada." });
      if (card.card.userId === ctx.user!.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode reservar a própria figurinha." });
      try {
        const expiresAt = await db.createReserva(input.figurinhaId, ctx.user!.id, card.card.userId);
        await db.logActivity(ctx.user!.id, "RESERVATION_CREATED", `Reserva da figurinha ${input.figurinhaId}`, "reserva", input.figurinhaId);
        return { success: true, expiresAt };
      } catch (error) {
        if (error instanceof Error && error.message === "FIGURINHA_UNAVAILABLE") throw new TRPCError({ code: "CONFLICT", message: "Esta figurinha já foi reservada por outra pessoa." });
        throw error;
      }
    }),
    mine: protectedProcedure.query(({ ctx }) => db.listReservasForUser(ctx.user!.id)),
    status: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const result = await db.getReservaById(input.id);
      if (!result) throw new TRPCError({ code: "NOT_FOUND" });
      if (result.reservation.reservedByUserId !== ctx.user!.id && result.reservation.ownerId !== ctx.user!.id && ctx.user!.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return result;
    }),
    cancel: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await db.getReservaById(input.id);
      if (!result) throw new TRPCError({ code: "NOT_FOUND" });
      if (result.reservation.reservedByUserId !== ctx.user!.id && ctx.user!.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await db.setReservaStatus(input.id, "cancelled");
      await db.logActivity(ctx.user!.id, "RESERVATION_CANCELLED", `Reserva ${input.id} cancelada`, "reserva", input.id);
      return { success: true };
    }),
    complete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await db.getReservaById(input.id);
      if (!result) throw new TRPCError({ code: "NOT_FOUND" });
      if (result.reservation.reservedByUserId !== ctx.user!.id && result.reservation.ownerId !== ctx.user!.id && ctx.user!.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await db.setReservaStatus(input.id, "completed");
      await db.logActivity(ctx.user!.id, "RESERVATION_COMPLETED", `Reserva ${input.id} concluída`, "reserva", input.id);
      return { success: true };
    }),
  }),

  admin: router({
    stats: admin2FAProcedure.query(() => db.countPlatformEntities()),
    users: admin2FAProcedure.query(() => db.listUsers()),
    cards: admin2FAProcedure.query(() => db.listAllFigurinhasForAdmin()),
    reservations: admin2FAProcedure.query(() => db.listActiveReservasForAdmin()),
    removeCard: admin2FAProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const card = await db.getFigurinhaById(input.id);
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Figurinha não encontrada." });
      if (card.card.status === "reserved") throw new TRPCError({ code: "CONFLICT", message: "Figurinha reservada não pode ser removida." });
      await db.deleteFigurinha(input.id);
      await db.logActivity(ctx.user!.id, "ADMIN_CARD_DELETED", `Figurinha ${input.id} removida`, "figurinha", input.id);
      return { success: true };
    }),
    updateCardStatus: admin2FAProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["available", "reserved", "traded"]) })).mutation(async ({ ctx, input }) => {
      await db.updateFigurinhaStatus(input.id, input.status);
      await db.logActivity(ctx.user!.id, "ADMIN_CARD_STATUS_UPDATED", `Figurinha ${input.id}: ${input.status}`, "figurinha", input.id);
      return { success: true };
    }),
    cancelReservation: admin2FAProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await db.setReservaStatus(input.id, "cancelled");
      await db.logActivity(ctx.user!.id, "ADMIN_RESERVATION_CANCELLED", `Reserva ${input.id} cancelada`, "reserva", input.id);
      return { success: true };
    }),
    completeReservation: admin2FAProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await db.setReservaStatus(input.id, "completed");
      await db.logActivity(ctx.user!.id, "ADMIN_RESERVATION_COMPLETED", `Reserva ${input.id} concluída`, "reserva", input.id);
      return { success: true };
    }),
    expireReservations: admin2FAProcedure.mutation(async ({ ctx }) => ({ expired: await db.expireOldReservas(), actor: ctx.user!.id })),
  }),
});

export type AppRouter = typeof appRouter;
