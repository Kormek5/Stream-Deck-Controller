import { Router, type IRouter, type Request, type Response } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import buttonsRouter from "./buttons";
import foldersRouter from "./folders";
import {
  getAgentCount, getAgents,
  getLatestScreenshot, subscribeToScreenshots,
  getLatestSystemStats, subscribeToSystemStats,
  getLatestProcessList, subscribeToProcessList,
  getLatestFrame, subscribeToFrames,
  executeTerminalCommand,
  sendToAllAgents,
} from "../lib/agent-bridge";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/profiles", profilesRouter);
router.use(buttonsRouter);
router.use(foldersRouter);

router.get("/agent-status", (_req, res) => {
  const agents = getAgents();
  res.json({
    connected: getAgentCount() > 0,
    count: getAgentCount(),
    agents: agents.map(a => ({
      id: a.id,
      platform: a.platform,
      hostname: a.hostname,
      connectedAt: a.connectedAt,
    })),
  });
});

// ── Screenshot ────────────────────────────────────────────────────────────────
router.get("/screenshot/latest", (_req, res) => {
  const shot = getLatestScreenshot();
  res.json(shot ? shot : { data: null, timestamp: null });
});

router.get("/screenshot/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
  }, 20000);

  const existing = getLatestScreenshot();
  if (existing) res.write(`data: ${JSON.stringify(existing)}\n\n`);

  const unsubscribe = subscribeToScreenshots(res);
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
});

// ── Monitor: system stats ─────────────────────────────────────────────────────
router.get("/monitor/stats/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
  }, 20000);

  const existing = getLatestSystemStats();
  if (existing) res.write(`data: ${JSON.stringify(existing)}\n\n`);

  const unsubscribe = subscribeToSystemStats(res);
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
});

// ── Monitor: process list ─────────────────────────────────────────────────────
router.get("/monitor/process/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
  }, 20000);

  const existing = getLatestProcessList();
  if (existing) res.write(`data: ${JSON.stringify(existing)}\n\n`);

  const unsubscribe = subscribeToProcessList(res);
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
});

// ── Monitor: live frame stream ────────────────────────────────────────────────
router.get("/monitor/frame/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
  }, 15000);

  const unsubscribe = subscribeToFrames(res);
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
});

// ── Monitor: stream control ───────────────────────────────────────────────────
router.post("/monitor/stream/start", (_req: Request, res: Response) => {
  const sent = sendToAllAgents({ type: "stream-start" });
  res.json({ ok: true, sent });
});

router.post("/monitor/stream/stop", (_req: Request, res: Response) => {
  const sent = sendToAllAgents({ type: "stream-stop" });
  res.json({ ok: true, sent });
});

// ── Monitor: mouse control ────────────────────────────────────────────────────
router.post("/monitor/mouse", (req: Request, res: Response) => {
  const { type, x, y, button, delta } = req.body as {
    type: string; x?: number; y?: number; button?: string; delta?: number;
  };
  if (!["mouse-move", "mouse-click", "mouse-scroll"].includes(type)) {
    res.status(400).json({ error: "invalid type" });
    return;
  }
  sendToAllAgents({ type, x, y, button, delta });
  res.json({ ok: true });
});

// ── Monitor: remote terminal ──────────────────────────────────────────────────
router.post("/monitor/exec", async (req: Request, res: Response) => {
  const { command } = req.body as { command?: string };
  if (!command || typeof command !== "string" || command.trim().length === 0) {
    res.status(400).json({ error: "command is required" });
    return;
  }
  try {
    const result = await executeTerminalCommand(command.trim());
    res.json(result);
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
});

export default router;
