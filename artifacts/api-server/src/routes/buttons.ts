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

  const parseComposite = (raw: string): Record<string, string> => {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, string>;
    } catch {}
    return {};
  };

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
    case "media": {
      const mediaLabels: Record<string, string> = {
        playpause: "Play/Pause",
        nexttrack: "Next Track",
        prevtrack: "Previous Track",
        volumeup: "Volume Up",
        volumedown: "Volume Down",
        mute: "Mute/Unmute",
        stop: "Stop",
      };
      message = `Media: ${mediaLabels[button.actionValue] ?? button.actionValue}`;
      break;
    }
    case "obs": {
      const obs = parseComposite(button.actionValue);
      const obsLabels: Record<string, string> = {
        "start-recording": "Start Recording",
        "stop-recording": "Stop Recording",
        "toggle-recording": "Toggle Recording",
        "start-streaming": "Start Streaming",
        "stop-streaming": "Stop Streaming",
        "toggle-streaming": "Toggle Streaming",
        "switch-scene": `Switch Scene${obs.scene ? `: ${obs.scene}` : ""}`,
        "toggle-mute-mic": "Toggle Mute Microphone",
        "toggle-mute-desktop": "Toggle Mute Desktop Audio",
        "screenshot": "Save Screenshot",
      };
      message = `OBS: ${obsLabels[obs.command ?? ""] ?? obs.command ?? "action triggered"}`;
      break;
    }
    case "github": {
      const gh = parseComposite(button.actionValue);
      const ghLabels: Record<string, string> = {
        "open-repo": "Open Repository",
        "open-prs": "Open Pull Requests",
        "open-issues": "Open Issues",
        "open-actions": "Open Actions",
        "open-commits": "Open Commits",
        "new-issue": "Create New Issue",
        "new-pr": "Create New PR",
        "open-profile": "Open Profile",
        "open-notifications": "Open Notifications",
      };
      const repoSuffix = gh.repo ? ` (${gh.repo})` : "";
      message = `GitHub: ${ghLabels[gh.command ?? ""] ?? gh.command ?? "action triggered"}${repoSuffix}`;
      break;
    }
    case "twitch": {
      const tw = parseComposite(button.actionValue);
      const twLabels: Record<string, string> = {
        "open-channel": "Open Channel",
        "open-dashboard": "Open Creator Dashboard",
        "open-analytics": "Open Analytics",
        "open-chat": "Open Chat",
        "open-stream-manager": "Open Stream Manager",
        "clip": "Open Clips",
        "schedule": "Open Schedule",
        "open-homepage": "Open Twitch Homepage",
      };
      const channelSuffix = tw.channel ? ` (${tw.channel})` : "";
      message = `Twitch: ${twLabels[tw.command ?? ""] ?? tw.command ?? "action triggered"}${channelSuffix}`;
      break;
    }
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
