import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import buttonsRouter from "./buttons";
import foldersRouter from "./folders";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/profiles", profilesRouter);
router.use(buttonsRouter);
router.use(foldersRouter);

export default router;
