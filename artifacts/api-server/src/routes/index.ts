import { Router, type IRouter, type Request, type Response } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import buttonsRouter from "./buttons";
import foldersRouter from "./folders";
import { getAgentCount, getAgents, getLatestScreenshot, subscribeToScreenshots } from "../lib/agent-bridge";

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

// Returns the latest screenshot (data URL + timestamp)
router.get("/screenshot/latest", (_req, res) => {
  const shot = getLatestScreenshot();
  if (!shot) {
    res.json({ data: null, timestamp: null });
    return;
  }
  res.json(shot);
});

// SSE stream: pushes new screenshots as they arrive
router.get("/screenshot/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send a heartbeat every 20s to keep the connection alive
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { /* ignore */ }
  }, 20000);

  // If there's already a screenshot, send it immediately
  const existing = getLatestScreenshot();
  if (existing) {
    res.write(`data: ${JSON.stringify(existing)}\n\n`);
  }

  const unsubscribe = subscribeToScreenshots(res);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;
