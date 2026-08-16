import { afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { championships, figurinhas, negotiations, reservas, users } from "../drizzle/schema";
import { completeReserva, getDb, getNegotiationHistoryForUser } from "./db";

let cleanup: {
  negotiationId?: number;
  reservationId?: number;
  figurinhaId?: number;
  championshipId?: number;
  sellerId?: number;
  buyerId?: number;
} = {};

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  if (cleanup.negotiationId) await db.delete(negotiations).where(eq(negotiations.id, cleanup.negotiationId));
  if (cleanup.reservationId) await db.delete(reservas).where(eq(reservas.id, cleanup.reservationId));
  if (cleanup.figurinhaId) await db.delete(figurinhas).where(eq(figurinhas.id, cleanup.figurinhaId));
  if (cleanup.championshipId) await db.delete(championships).where(eq(championships.id, cleanup.championshipId));
  if (cleanup.sellerId) await db.delete(users).where(eq(users.id, cleanup.sellerId));
  if (cleanup.buyerId) await db.delete(users).where(eq(users.id, cleanup.buyerId));
  cleanup = {};
});

describe("negotiations persistence", () => {
  it("persiste uma compra concluída e a retorna no histórico do comprador", async () => {
    const db = await getDb();
    if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const sellerOpenId = `integration-seller-${suffix}`;
    const buyerOpenId = `integration-buyer-${suffix}`;
    const championshipName = `Integration Cup ${suffix}`;
    const cardNumber = `INT-${suffix}`;

    await db.insert(users).values({
      openId: sellerOpenId,
      email: `${sellerOpenId}@example.com`,
      userToken: sellerOpenId,
      name: "Integration Seller",
      role: "user",
    });
    await db.insert(users).values({
      openId: buyerOpenId,
      email: `${buyerOpenId}@example.com`,
      userToken: buyerOpenId,
      name: "Integration Buyer",
      role: "user",
    });
    const seller = (await db.select({ id: users.id }).from(users).where(eq(users.openId, sellerOpenId)).limit(1))[0];
    const buyer = (await db.select({ id: users.id }).from(users).where(eq(users.openId, buyerOpenId)).limit(1))[0];
    if (!seller || !buyer) throw new Error("Integration users were not created");
    cleanup.sellerId = seller.id;
    cleanup.buyerId = buyer.id;

    await db.insert(championships).values({ name: championshipName, year: 2026 });
    const championship = (await db.select({ id: championships.id }).from(championships).where(eq(championships.name, championshipName)).limit(1))[0];
    if (!championship) throw new Error("Integration championship was not created");
    cleanup.championshipId = championship.id;

    await db.insert(figurinhas).values({
      userId: seller.id,
      championshipId: championship.id,
      cardNumber,
      playerName: "Integration Player",
      type: "duplicate",
      condition: "good",
      status: "reserved",
    });
    const card = (await db.select({ id: figurinhas.id }).from(figurinhas).where(eq(figurinhas.cardNumber, cardNumber)).limit(1))[0];
    if (!card) throw new Error("Integration card was not created");
    cleanup.figurinhaId = card.id;

    await db.insert(reservas).values({
      figurinhaId: card.id,
      reservedByUserId: buyer.id,
      ownerId: seller.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      status: "active",
    });
    const reservation = (await db.select({ id: reservas.id }).from(reservas).where(and(eq(reservas.figurinhaId, card.id), eq(reservas.reservedByUserId, buyer.id))).limit(1))[0];
    if (!reservation) throw new Error("Integration reservation was not created");
    cleanup.reservationId = reservation.id;

    const created = await completeReserva(reservation.id, "purchase", 12.5);
    cleanup.negotiationId = created?.id;
    const history = await getNegotiationHistoryForUser(buyer.id, "purchase");
    const entry = history.find((item) => item.negotiation.id === cleanup.negotiationId);

    expect(created?.type).toBe("purchase");
    expect(entry?.negotiation.amount).toBe("12.50");
    expect(entry?.buyer?.id).toBe(buyer.id);
    expect(entry?.seller?.id).toBe(seller.id);
  });
});
