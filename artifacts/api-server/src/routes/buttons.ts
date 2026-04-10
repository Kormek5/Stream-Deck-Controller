import { Router } from "express";
import { db, buttonsTable, activityTable, profilesTable } from "@workspace/db";
import { eq, desc, and, isNull } from "drizzle-orm";
import { sendToAllAgents, getAgentCount } from "../lib/agent-bridge";
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
  const folderIdParam = req.query.folderId;
  let buttons;
  if (folderIdParam === "null" || folderIdParam === "") {
    buttons = await db.select().from(buttonsTable)
      .where(and(eq(buttonsTable.profileId, id), isNull(buttonsTable.folderId)))
      .orderBy(buttonsTable.position);
  } else if (folderIdParam !== undefined) {
    const fid = Number(folderIdParam);
    buttons = await db.select().from(buttonsTable)
      .where(and(eq(buttonsTable.profileId, id), eq(buttonsTable.folderId, fid)))
      .orderBy(buttonsTable.position);
  } else {
    buttons = await db.select().from(buttonsTable)
      .where(eq(buttonsTable.profileId, id))
      .orderBy(buttonsTable.position);
  }
  res.json(buttons);
});

router.post("/buttons", async (req, res) => {
  const body = CreateButtonBody.parse(req.body);
  const [button] = await db.insert(buttonsTable).values({
    profileId: body.profileId,
    folderId: (body as any).folderId ?? null,
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
      folderId: (body as any).folderId ?? null,
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

router.patch("/buttons/:id/position", async (req, res) => {
  const id = Number(req.params.id);
  const position = Number(req.body?.position);
  if (isNaN(position)) { res.status(400).json({ error: "position required" }); return; }
  const [button] = await db.update(buttonsTable).set({ position }).where(eq(buttonsTable.id, id)).returning();
  if (!button) { res.status(404).json({ error: "Not found" }); return; }
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
    case "zoom": {
      const z = parseComposite(button.actionValue);
      const zLabels: Record<string, string> = {
        mute: "Mute/Unmute Microphone",
        video: "Start/Stop Video",
        screenshare: "Start/Stop Screen Share",
        hand: "Raise/Lower Hand",
        record: "Start/Stop Recording",
        leave: "Leave Meeting",
        end: "End Meeting",
        chat: "Open Chat",
        participants: "Show Participants",
        reactions: "Send Reaction",
        newmeeting: "Start New Meeting",
        join: `Join Meeting${z.meetingId ? `: ${z.meetingId}` : ""}`,
        schedule: "Schedule Meeting",
      };
      message = `Zoom: ${zLabels[z.command ?? ""] ?? z.command ?? "action triggered"}`;
      break;
    }
    case "teams": {
      const t = parseComposite(button.actionValue);
      const tLabels: Record<string, string> = {
        mute: "Mute/Unmute Microphone",
        video: "Start/Stop Camera",
        screenshare: "Share Screen",
        hand: "Raise Hand",
        leave: "Leave Call",
        chat: "Open Chat",
        calendar: "Open Calendar",
        "teams-tab": "Open Teams Tab",
        newcall: `Start New Call${t.contact ? ` (${t.contact})` : ""}`,
        blur: "Toggle Background Blur",
        reactions: "Send Reaction",
      };
      message = `Teams: ${tLabels[t.command ?? ""] ?? t.command ?? "action triggered"}`;
      break;
    }
    case "discord": {
      const d = parseComposite(button.actionValue);
      const dLabels: Record<string, string> = {
        mute: "Mute/Unmute Microphone",
        deafen: "Deafen/Undeafen",
        video: "Toggle Video",
        screenshare: "Start/Stop Screen Share",
        disconnect: "Disconnect from Voice",
        "push-to-talk": "Push to Talk",
        "open-channel": `Open ${d.target ? `#${d.target.replace(/^#/, "")}` : "Channel"}`,
        "open-dm": `DM ${d.target || ""}`.trim(),
        "go-live": "Go Live / Stream",
        "notifications-off": "Suppress Notifications",
        invite: "Create Invite",
      };
      message = `Discord: ${dLabels[d.command ?? ""] ?? d.command ?? "action triggered"}`;
      break;
    }
    case "slack": {
      const s = parseComposite(button.actionValue);
      const sLabels: Record<string, string> = {
        open: "Open Slack",
        "new-message": "New Message",
        "open-channel": `Open ${s.target || "Channel"}`,
        "set-status": `Set Status: ${s.target || ""}`,
        dnd: "Toggle Do Not Disturb",
        "mute-notifs": "Mute Notifications",
        "open-huddle": "Start Huddle",
        "open-dm": `DM ${s.target || ""}`.trim(),
        search: "Open Search",
        "open-threads": "Open Threads",
        "open-mentions": "Open Mentions & Reactions",
      };
      message = `Slack: ${sLabels[s.command ?? ""] ?? s.command ?? "action triggered"}`;
      break;
    }
    case "spotify": {
      const spLabels: Record<string, string> = {
        playpause: "Play/Pause",
        next: "Next Track",
        prev: "Previous Track",
        volumeup: "Volume Up",
        volumedown: "Volume Down",
        mute: "Mute/Unmute",
        shuffle: "Toggle Shuffle",
        repeat: "Toggle Repeat",
        like: "Save Current Song",
        open: "Open Spotify",
        "open-liked": "Open Liked Songs",
        "open-queue": "Open Queue",
      };
      message = `Spotify: ${spLabels[button.actionValue] ?? button.actionValue}`;
      break;
    }
    case "telegram": {
      const tg = parseComposite(button.actionValue);
      const tgLabels: Record<string, string> = {
        open: "Open Telegram",
        "open-chat": `Open chat${tg.target ? `: ${tg.target}` : ""}`,
        "new-message": `New message${tg.target ? ` to ${tg.target}` : ""}`,
        saved: "Open Saved Messages",
        calls: "Open Calls",
      };
      message = `Telegram: ${tgLabels[tg.command ?? ""] ?? tg.command ?? "action triggered"}`;
      break;
    }
    case "notion": {
      const no = parseComposite(button.actionValue);
      const noLabels: Record<string, string> = {
        open: "Open Notion",
        "new-page": "Create New Page",
        "open-page": `Open Page${no.pageUrl ? `: ${no.pageUrl}` : ""}`,
        search: "Quick Search",
        inbox: "Open Inbox",
        templates: "Open Templates",
      };
      message = `Notion: ${noLabels[no.command ?? ""] ?? no.command ?? "action triggered"}`;
      break;
    }
    case "browser": {
      const brLabels: Record<string, string> = {
        newtab: "New Tab",
        newwindow: "New Window",
        incognito: "New Incognito Window",
        bookmark: "Bookmark Current Page",
        history: "Open History",
        downloads: "Open Downloads",
        devtools: "Toggle DevTools",
        hardrefresh: "Hard Refresh",
        fullscreen: "Toggle Fullscreen",
        zoomin: "Zoom In",
        zoomout: "Zoom Out",
        zoomreset: "Reset Zoom",
      };
      message = `Browser: ${brLabels[button.actionValue] ?? button.actionValue}`;
      break;
    }
    case "system": {
      const sysLabels: Record<string, string> = {
        lock: "Lock Screen",
        sleep: "Sleep",
        shutdown: "Shutdown",
        restart: "Restart",
        logoff: "Log Off",
        screenshot: "Screenshot",
        screenrecord: "Screen Recording",
        taskmanager: "Task Manager",
        explorer: "File Explorer",
        clipboard: "Clipboard History",
        emoji: "Emoji Picker",
        desktop: "Show Desktop",
        notification: "Notification Center",
      };
      message = `System: ${sysLabels[button.actionValue] ?? button.actionValue}`;
      break;
    }
    case "googlemeet": {
      const gm = parseComposite(button.actionValue);
      const gmLabels: Record<string, string> = {
        mute: "Mute/Unmute Microphone",
        video: "Toggle Camera",
        screenshare: "Share Screen",
        hand: "Raise Hand",
        leave: "Leave Meeting",
        chat: "Open Chat",
        captions: "Toggle Captions",
        reactions: "Send Reaction",
        join: `Join Meeting${gm.link ? `: ${gm.link}` : ""}`,
        newmeeting: "Start New Meeting",
        record: "Start/Stop Recording",
      };
      message = `Google Meet: ${gmLabels[gm.command ?? ""] ?? gm.command ?? "action triggered"}`;
      break;
    }
    case "vscode": {
      const vsLabels: Record<string, string> = {
        terminal: "New Terminal",
        format: "Format Document",
        save: "Save All Files",
        debug: "Start Debugging",
        sidebar: "Toggle Sidebar",
        explorer: "Open Explorer",
        extensions: "Open Extensions",
        command: "Open Command Palette",
        zen: "Toggle Zen Mode",
        split: "Split Editor",
        closetab: "Close Current Tab",
        "open-file": "Open File",
        runtask: "Run Task",
        settings: "Open Settings",
        git: "Open Source Control",
      };
      message = `VS Code: ${vsLabels[button.actionValue] ?? button.actionValue}`;
      break;
    }
    case "youtube": {
      const ytLabels: Record<string, string> = {
        open: "Open YouTube",
        subscriptions: "Open Subscriptions",
        watchlater: "Watch Later",
        trending: "Open Trending",
        history: "View History",
        library: "Open Library",
        studio: "Open YouTube Studio",
        search: "Search",
        "open-channel": "Open Channel",
        liked: "Liked Videos",
        notifications: "Open Notifications",
      };
      message = `YouTube: ${ytLabels[button.actionValue] ?? button.actionValue}`;
      break;
    }
    case "gmail": {
      const gmailLabels: Record<string, string> = {
        compose: "Compose New Email",
        inbox: "Open Inbox",
        starred: "Open Starred",
        snoozed: "Open Snoozed",
        sent: "Open Sent",
        drafts: "Open Drafts",
        search: "Search Emails",
        spam: "Open Spam",
        meet: "Start Meet from Gmail",
      };
      message = `Gmail: ${gmailLabels[button.actionValue] ?? button.actionValue}`;
      break;
    }
    case "whatsapp": {
      const wa = parseComposite(button.actionValue);
      const waLabels: Record<string, string> = {
        open: "Open WhatsApp",
        "new-chat": `New Message${wa.contact ? ` to ${wa.contact}` : ""}`,
        "open-chat": `Open Chat${wa.contact ? `: ${wa.contact}` : ""}`,
        calls: "Open Calls",
        status: "Open Status",
        groups: "Open Groups",
        communities: "Open Communities",
      };
      message = `WhatsApp: ${waLabels[wa.command ?? ""] ?? wa.command ?? "action triggered"}`;
      break;
    }
    case "figma": {
      const figmaLabels: Record<string, string> = {
        open: "Open Figma",
        "new-file": "Create New File",
        "open-file": "Open File",
        community: "Open Community",
        drafts: "Open Drafts",
        "hand-tool": "Hand Tool",
        "frame-tool": "Frame Tool",
        component: "Toggle Component Properties",
        "dev-mode": "Toggle Dev Mode",
        preview: "Open Preview",
        "zoom-fit": "Zoom to Fit",
        grid: "Toggle Layout Grid",
        rulers: "Toggle Rulers",
      };
      message = `Figma: ${figmaLabels[button.actionValue] ?? button.actionValue}`;
      break;
    }
    case "x": {
      const xLabels: Record<string, string> = {
        home: "Open X Home",
        compose: "New Post",
        notifications: "Open Notifications",
        messages: "Open Messages",
        explore: "Open Explore",
        bookmarks: "Open Bookmarks",
        profile: "Open Profile",
        grok: "Open Grok",
        lists: "Open Lists",
        spaces: "Open Spaces",
      };
      message = `X (Twitter): ${xLabels[button.actionValue] ?? button.actionValue}`;
      break;
    }
    case "chatgpt": {
      const cgLabels: Record<string, string> = {
        open: "Open ChatGPT",
        "new-chat": "New Chat",
        gpts: "Open GPT Store",
        explore: "Explore GPTs",
        history: "Open Chat History",
        voice: "Start Voice Mode",
        canvas: "Open Canvas Mode",
        dalle: "Open Image Generation",
      };
      message = `ChatGPT: ${cgLabels[button.actionValue] ?? button.actionValue}`;
      break;
    }
    case "airdrop": {
      message = `AirDrop: Share file`;
      break;
    }
    case "multi": {
      let steps: Array<{ type: string; value: string }> = [];
      try { steps = JSON.parse(button.actionValue); } catch {}
      const stepCount = Array.isArray(steps) ? steps.length : 0;
      message = `Multi-action: ${stepCount} step${stepCount !== 1 ? "s" : ""} (${button.label})`;
      break;
    }
    case "clipboard": {
      const clip = parseComposite(button.actionValue);
      if (clip.command === "copy-date") message = `Clipboard: Copy current date`;
      else if (clip.command === "copy-time") message = `Clipboard: Copy current time`;
      else if (clip.command === "copy-datetime") message = `Clipboard: Copy date & time`;
      else if (clip.command === "paste") message = `Clipboard: Paste`;
      else message = `Clipboard: Copy text`;
      break;
    }
    case "type": {
      const preview = (button.actionValue || "").slice(0, 40);
      message = `Type text: "${preview}${button.actionValue.length > 40 ? "…" : ""}"`;
      break;
    }
    case "notification": {
      const notif = parseComposite(button.actionValue);
      message = `Notification: ${notif.title || button.label}`;
      break;
    }
    default:
      message = `Action executed: ${button.label}`;
  }

  // Forward the action to any connected desktop agents
  const agentsSent = sendToAllAgents({
    type: "execute",
    button: {
      id: button.id,
      label: button.label,
      actionType: button.actionType,
      actionValue: button.actionValue,
    },
  });

  await db.update(buttonsTable)
    .set({ executeCount: button.executeCount + 1, lastExecutedAt: new Date() })
    .where(eq(buttonsTable.id, id));

  await db.insert(activityTable).values({
    buttonId: button.id,
    buttonLabel: button.label,
    actionType: button.actionType,
    success,
    message: agentsSent > 0 ? `[Agent] ${message}` : message,
  });

  res.json({ success, message: agentsSent > 0 ? `[Agent] ${message}` : message, buttonId: id, agentsSent });
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
