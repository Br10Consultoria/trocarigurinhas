import type { Response } from "express";

export type NotificationStreamEvent = {
  id?: number;
  kind: "trade_accepted" | "trade_completed" | "system_notice";
  category: "trade" | "purchase" | "system";
  title: string;
  message: string;
};

const subscribers = new Map<number, Set<Response>>();

function writeEvent(response: Response, event: NotificationStreamEvent) {
  response.write(`event: notification\ndata: ${JSON.stringify(event)}\n\n`);
}

export function publishNotificationEvent(userId: number, event: NotificationStreamEvent) {
  const userSubscribers = subscribers.get(userId);
  if (!userSubscribers) return;

  userSubscribers.forEach((response) => {
    try {
      writeEvent(response, event);
    } catch {
      userSubscribers.delete(response);
    }
  });

  if (userSubscribers.size === 0) subscribers.delete(userId);
}

export function subscribeToNotificationStream(userId: number, response: Response) {
  response.status(200);
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders?.();
  response.write("retry: 5000\n\n");

  const userSubscribers = subscribers.get(userId) ?? new Set<Response>();
  userSubscribers.add(response);
  subscribers.set(userId, userSubscribers);

  const heartbeat = setInterval(() => {
    try {
      response.write(": heartbeat\n\n");
    } catch {
      cleanup();
    }
  }, 25_000);

  const cleanup = () => {
    clearInterval(heartbeat);
    const activeSubscribers = subscribers.get(userId);
    activeSubscribers?.delete(response);
    if (activeSubscribers?.size === 0) subscribers.delete(userId);
  };

  response.on("close", cleanup);
}
