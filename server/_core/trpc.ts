import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG, COOKIE_NAME } from '@shared/const';
import { parse as parseCookie } from "cookie";
import { hasValidAdminTwoFactorSession } from "../db";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/** Administrative actions are unavailable until the admin has completed 2FA setup. */
export const admin2FAProcedure = adminProcedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user!.twoFactorEnabled) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Ative o 2FA para acessar esta área administrativa.",
      });
    }

    const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME];
    const verified = await hasValidAdminTwoFactorSession(ctx.user!.id, sessionToken ?? "");
    if (!verified) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Valide o segundo fator para continuar nesta área administrativa.",
      });
    }

    return next({ ctx });
  }),
);
