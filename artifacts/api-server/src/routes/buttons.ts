import { Router } from "express";
import { db, buttonsTable, activityTable, profilesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateButtonBody,
  UpdateButtonBody,
  UpdateButtonParams,
  DeleteButtonParams,
  ExecuteButtonParams,
  ListButtonsParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/profiles/:id/buttons", async (req, res) => {
  const { id } = ListButtonsParams.parse({ id: Number(req.params.id) });
  const buttons = await db.select().from(buttonsTable)
    .where(eq(buttonsTable.profileId, id))
    .orderBy(buttonsTable.position);
  res.json(buttons);
});

router.post("/buttons", async (req, res) => {
  const body = CreateButtonBody.parse(req.body);
  const [button] = await db.insert(buttonsTable).values({
    profileId: body.profileId,
    label: body.label,
    icon: body.icon,
    color: body.color,
    actionType: body.actionType,
    actionValue: body.actionValue,
    position: body.position,
  }).returning();
  res.status(201).json(button);
});

router.put("/buttons/:id", async (req, res) => {
  const { id } = UpdateButtonParams.parse({ id: Number(req.params.id) });
  const body = UpdateButtonBody.parse(req.body);
  const [button] = await db.update(buttonsTable)
    .set({
      profileId: body.profileId,
      label: body.label,
      icon: body.icon,
      color: body.color,
      actionType: body.actionType,
      actionValue: body.actionValue,
      position: body.position,
    })
    .where(eq(buttonsTable.id, id))
    .returning();
  if (!button) {
    res.status(404).json({ error: "Button not found" });
    return;
  }
  res.json(button);
});

router.delete("/buttons/:id", async (req, res) => {
  const { id } = DeleteButtonParams.parse({ id: Number(req.params.id) });
  await db.delete(buttonsTable).where(eq(buttonsTable.id, id));
  res.status(204).send();
});

router.post("/buttons/:id/execute", async (req, res) => {
  const { id } = ExecuteButtonParams.parse({ id: Number(req.params.id) });
  const [button] = await db.select().from(buttonsTable).where(eq(buttonsTable.id, id));
  if (!button) {
    res.status(404).json({ success: false, message: "Button not found", buttonId: id });
    return;
  }

  let message = "";
  const success = true;

  switch (button.actionType) {
    case "url":
      message = `Opening URL: ${button.actionValue}`;
      break;
    case "hotkey":
      message = `Hotkey triggered: ${button.actionValue}`;
      break;
    case "script":
      message = `Script queued: ${button.label}`;
      break;
    case "vpn":
      message = `VPN action: ${button.actionValue || "toggled"}`;
      break;
    case "steam":
      message = `Steam account: ${button.actionValue}`;
      break;
    case "app":
      message = `Launching app: ${button.actionValue}`;
      break;
    case "media":
      message = `Media control: ${button.actionValue}`;
      break;
    default:
      message = `Action executed: ${button.label}`;
  }

  await db.update(buttonsTable)
    .set({ executeCount: button.executeCount + 1, lastExecutedAt: new Date() })
    .where(eq(buttonsTable.id, id));

  await db.insert(activityTable).values({
    buttonId: button.id,
    buttonLabel: button.label,
    actionType: button.actionType,
    success,
    message,
  });

  res.json({ success, message, buttonId: id });
});

router.get("/activity", async (req, res) => {
  const activity = await db.select().from(activityTable)
    .orderBy(desc(activityTable.executedAt))
    .limit(50);
  res.json(activity);
});

router.get("/stats", async (req, res) => {
  const allButtons = await db.select().from(buttonsTable);
  const allProfiles = await db.select().from(profilesTable);
  const allActivity = await db.select().from(activityTable);

  const topButtons = [...allButtons]
    .sort((a, b) => b.executeCount - a.executeCount)
    .slice(0, 5)
    .map(b => ({
      id: b.id,
      label: b.label,
      executeCount: b.executeCount,
    }));

  res.json({
    totalButtons: allButtons.length,
    totalProfiles: allProfiles.length,
    totalExecutions: allActivity.length,
    topButtons,
  });
});

export default router;
