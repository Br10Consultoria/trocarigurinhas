import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const { mockedDb } = vi.hoisted(() => ({
  mockedDb: {
    getNotificationsForUser: vi.fn(),
    getUnreadNotificationCount: vi.fn(),
    getUnreadNotificationCounts: vi.fn(),
    markNotificationAsRead: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
    setReservaStatus: vi.fn(),
    setReservaProposalStatus: vi.fn(),
    createNotification: vi.fn(),
    getFigurinhaById: vi.fn(),
    createReserva: vi.fn(),
    logActivity: vi.fn(),
    createReservationAcceptedNotifications: vi.fn(),
    getReservaById: vi.fn(),
    completeReserva: vi.fn(),
    createNegotiationCompletedNotifications: vi.fn(),
  },
}));

vi.mock("./db", () => mockedDb);

import { appRouter } from "./routers";

function createContext(userId = 10): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      name: "Colecionador",
      email: "colecionador@example.com",
      phone: null,
      whatsapp: "5511999999999",
      userToken: `token-${userId}`,
      loginMethod: "manus",
      role: "user",
      totpSecret: null,
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("notifications procedures", () => {
  it("requires authentication to list notifications", async () => {
    const caller = appRouter.createCaller({ ...createContext(), user: null });
    await expect(caller.notifications.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lists unread count and marks one notification as read", async () => {
    mockedDb.getNotificationsForUser.mockResolvedValueOnce([
      { id: 4, userId: 10, kind: "trade_accepted", category: "trade", title: "Reserva aceita", message: "Contato", isRead: false, createdAt: new Date(), reservationId: 8, negotiationId: null },
    ]);
    mockedDb.getUnreadNotificationCount.mockResolvedValueOnce(1);
    mockedDb.markNotificationAsRead.mockResolvedValueOnce(undefined);

    const caller = appRouter.createCaller(createContext());
    const list = await caller.notifications.list({ limit: 20, category: "trade" });
    const count = await caller.notifications.unreadCount({ category: "trade" });
    const result = await caller.notifications.markRead({ id: 4 });

    expect(list).toHaveLength(1);
    expect(count).toBe(1);
    expect(mockedDb.getNotificationsForUser).toHaveBeenCalledWith(10, 20, "trade");
    expect(mockedDb.getUnreadNotificationCount).toHaveBeenCalledWith(10, "trade");
    expect(result).toEqual({ success: true });
    expect(mockedDb.markNotificationAsRead).toHaveBeenCalledWith(10, 4);
  });
});

describe("notification triggers", () => {
  it("creates an acceptance notification after reserving a card", async () => {
    mockedDb.getFigurinhaById.mockResolvedValueOnce({ card: { id: 42, userId: 20 }, owner: { id: 20 } });
    mockedDb.createReserva.mockResolvedValueOnce({ reservationId: 8, expiresAt: new Date(Date.now() + 86_400_000) });
    mockedDb.logActivity.mockResolvedValueOnce(undefined);
    mockedDb.createReservationAcceptedNotifications.mockResolvedValueOnce({ id: 100 });

    const caller = appRouter.createCaller(createContext(10));
    const result = await caller.reservas.create({ figurinhaId: 42 });

    expect(result.success).toBe(true);
    expect(mockedDb.createReservationAcceptedNotifications).toHaveBeenCalledWith(8);
  });

  it("accepts a trade proposal from the notification center", async () => {
    mockedDb.getReservaById.mockResolvedValueOnce({
      reservation: { id: 8, ownerId: 20, reservedByUserId: 10, status: "active" },
      card: { cardNumber: "A-01", playerName: "Jogador" },
    });
    mockedDb.setReservaProposalStatus.mockResolvedValueOnce(undefined);
    mockedDb.logActivity.mockResolvedValueOnce(undefined);
    mockedDb.createNotification.mockResolvedValueOnce({ id: 102 });
    mockedDb.markNotificationAsRead.mockResolvedValueOnce(undefined);

    const caller = appRouter.createCaller(createContext(20));
    const result = await caller.reservas.respondProposal({ reservationId: 8, notificationId: 4, action: "accept" });

    expect(result).toEqual({ success: true, status: "accepted" });
    expect(mockedDb.setReservaProposalStatus).toHaveBeenCalledWith(8, "accepted");
    expect(mockedDb.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 10,
      kind: "trade_accepted",
      category: "trade",
      reservationId: 8,
    }));
    expect(mockedDb.completeReserva).not.toHaveBeenCalled();
    expect(mockedDb.markNotificationAsRead).toHaveBeenCalledWith(20, 4);
  });

  it("declines a trade proposal and notifies the requester", async () => {
    mockedDb.getReservaById.mockResolvedValueOnce({
      reservation: { id: 9, ownerId: 20, reservedByUserId: 10, status: "active" },
      card: { cardNumber: "B-02", playerName: "Outra Jogadora" },
    });
    mockedDb.setReservaStatus.mockResolvedValueOnce(undefined);
    mockedDb.logActivity.mockResolvedValueOnce(undefined);
    mockedDb.createNotification.mockResolvedValueOnce({ id: 101 });
    mockedDb.markNotificationAsRead.mockResolvedValueOnce(undefined);

    const caller = appRouter.createCaller(createContext(20));
    const result = await caller.reservas.respondProposal({ reservationId: 9, notificationId: 5, action: "decline" });

    expect(result).toEqual({ success: true, status: "declined" });
    expect(mockedDb.setReservaStatus).toHaveBeenCalledWith(9, "cancelled");
    expect(mockedDb.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 10,
      kind: "system_notice",
      category: "trade",
      reservationId: 9,
    }));
    expect(mockedDb.markNotificationAsRead).toHaveBeenCalledWith(20, 5);
  });

  it("does not allow the requester to answer their own proposal", async () => {
    mockedDb.getReservaById.mockResolvedValueOnce({
      reservation: { id: 10, ownerId: 20, reservedByUserId: 10, status: "active" },
      card: { cardNumber: "C-03", playerName: "Jogador" },
    });

    const caller = appRouter.createCaller(createContext(10));
    await expect(caller.reservas.respondProposal({ reservationId: 10, action: "accept" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates completion notifications after finalizing a reservation", async () => {
    mockedDb.getReservaById.mockResolvedValueOnce({
      reservation: { id: 8, ownerId: 20, reservedByUserId: 10 },
      card: { id: 42 },
    });
    mockedDb.completeReserva.mockResolvedValueOnce({ id: 77 });
    mockedDb.logActivity.mockResolvedValueOnce(undefined);
    mockedDb.createNegotiationCompletedNotifications.mockResolvedValueOnce(undefined);

    const caller = appRouter.createCaller(createContext(10));
    const result = await caller.reservas.complete({ id: 8, type: "trade" });

    expect(result).toEqual({ success: true, negotiationId: 77 });
    expect(mockedDb.createNegotiationCompletedNotifications).toHaveBeenCalledWith(8, 77, "trade");
  });
});
