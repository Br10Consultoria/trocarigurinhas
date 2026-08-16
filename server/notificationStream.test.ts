import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import { publishNotificationEvent, subscribeToNotificationStream } from "./notificationStream";

type FakeResponse = {
  writes: string[];
  closeHandler?: () => void;
  status: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  flushHeaders: ReturnType<typeof vi.fn>;
  write: (chunk: string) => boolean;
  on: (event: string, handler: () => void) => FakeResponse;
};

function createFakeResponse(): FakeResponse {
  const response = {
    writes: [],
    status: vi.fn(),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write(chunk: string) {
      response.writes.push(chunk);
      return true;
    },
    on(event: string, handler: () => void) {
      if (event === "close") response.closeHandler = handler;
      return response;
    },
  } as FakeResponse;
  return response;
}

describe("notificationStream", () => {
  it("entrega o evento de negociação ao usuário conectado sem esperar polling", () => {
    const response = createFakeResponse();
    subscribeToNotificationStream(901, response as unknown as Response);

    publishNotificationEvent(901, {
      id: 55,
      kind: "trade_completed",
      title: "Negociação finalizada",
      message: "A troca foi finalizada.",
    });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
    expect(response.writes.join("\n")).toContain('"id":55');
    expect(response.writes.join("\n")).toContain("Negociação finalizada");

    response.closeHandler?.();
  });
});
