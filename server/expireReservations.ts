import type { Request, Response } from "express";
import * as db from "./db";
import { sdk } from "./_core/sdk";

/** Heartbeat callback for project-level reservation cleanup. */
export async function expireReservationsHandler(req: Request, res: Response) {
  let taskUid: string | null = null;

  try {
    const user = await sdk.authenticateRequest(req);
    taskUid = user.taskUid ?? null;

    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const expired = await db.expireOldReservas();
    return res.json({
      ok: true,
      expired,
      taskUid: user.taskUid,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: { url: req.originalUrl, taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
