import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import buttonsRouter from "./buttons";
import foldersRouter from "./folders";
import { getAgentCount, getAgents } from "../lib/agent-bridge";

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

export default router;
