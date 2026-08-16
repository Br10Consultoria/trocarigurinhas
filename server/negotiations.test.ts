import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(user: AuthenticatedUser | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const user: AuthenticatedUser = {
  id: 1,
  openId: "history-test-user",
  email: "history@example.com",
  name: "History Test",
  phone: null,
  whatsapp: null,
  userToken: "history-token",
  loginMethod: "test",
  role: "user",
  twoFactorEnabled: false,
  twoFactorSecret: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("negotiations.history", () => {
  it("permite filtrar o histórico por compras para usuários autenticados", async () => {
    const caller = appRouter.createCaller(createContext(user));
    const result = await caller.negotiations.history({ type: "purchase" });

    expect(Array.isArray(result)).toBe(true);
    expect(result.every((item) => item.negotiation.type === "purchase")).toBe(true);
  });

  it("bloqueia o histórico para visitantes não autenticados", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.negotiations.history()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
