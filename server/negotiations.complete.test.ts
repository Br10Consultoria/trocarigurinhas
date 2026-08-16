import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  completeReserva: vi.fn(),
  getReservaById: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("./db", () => mocks);

const { completeReserva, getReservaById, logActivity } = mocks;

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const user: AuthenticatedUser = {
  id: 1,
  openId: "completion-test-user",
  email: "completion@example.com",
  name: "Completion Test",
  phone: null,
  whatsapp: null,
  userToken: "completion-token",
  loginMethod: "test",
  role: "user",
  twoFactorEnabled: false,
  twoFactorSecret: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createContext(): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("reservas.complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getReservaById.mockResolvedValue({
      reservation: { id: 7, reservedByUserId: 1, ownerId: 2, status: "active" },
    });
    completeReserva.mockResolvedValue({ id: 42, type: "purchase" });
  });

  it("registra uma compra concluída no histórico", async () => {
    const caller = appRouter.createCaller(createContext());

    const result = await caller.reservas.complete({ id: 7, type: "purchase", amount: 12.5 });

    expect(result).toEqual({ success: true, negotiationId: 42 });
    expect(completeReserva).toHaveBeenCalledWith(7, "purchase", 12.5);
    expect(logActivity).toHaveBeenCalledWith(1, "RESERVATION_COMPLETED", "Compra concluída na reserva 7", "negotiation", 42);
  });
});
