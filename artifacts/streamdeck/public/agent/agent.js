#!/usr/bin/env node
/**
 * StreamDeck Local Agent
 * ----------------------
 * Runs on your PC and executes system commands when buttons are pressed.
 *
 * Usage:
 *   node agent.js --server https://your-server.com
 *   node agent.js --server http://localhost:3001
 *
 * Requirements:
 *   npm install ws
 */

const { execSync, exec } = require("child_process");
const os = require("os");
const path = require("path");
const https = require("https");
const http = require("http");

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let serverUrl = "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--server" && args[i + 1]) serverUrl = args[i + 1];
}

// Auto-detect from environment or fallback
if (!serverUrl) {
  serverUrl = process.env.STREAMDECK_SERVER || "http://localhost:3001";
}

// ── Platform detection ────────────────────────────────────────────────────────
const platform = process.platform; // 'win32' | 'darwin' | 'linux'
const hostname = os.hostname();

console.log(`
========================================
   StreamDeck Local Agent  v1.0
========================================
  Platform : ${platform}
  Hostname : ${hostname}
  Server   : ${serverUrl}
`);

// ── Load ws ───────────────────────────────────────────────────────────────────
let WebSocket;
try {
  WebSocket = require("ws");
} catch {
  console.error("❌  'ws' package not found. Run: npm install ws");
  process.exit(1);
}

// ── Helper: run shell command ─────────────────────────────────────────────────
function run(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { ...opts, timeout: 10000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

// ── Helper: open URL / app-scheme in OS default browser ──────────────────────
async function openUrl(url) {
  if (platform === "win32") {
    await run(`start "" "${url.replace(/"/g, '\\"')}"`);
  } else if (platform === "darwin") {
    await run(`open "${url.replace(/"/g, '\\"')}"`);
  } else {
    await run(`xdg-open "${url.replace(/"/g, '\\"')}"`);
  }
}

// ── Helper: send keyboard shortcut ───────────────────────────────────────────
async function sendHotkey(combo) {
  // combo examples: "ctrl+shift+m", "win+d", "cmd+space"
  if (platform === "win32") {
    // Convert to PowerShell SendKeys format
    const psKeys = combo
      .replace(/ctrl\+/gi, "^")
      .replace(/shift\+/gi, "+")
      .replace(/alt\+/gi, "%")
      .replace(/win\+/gi, "^{ESC}") // approximate
      .replace(/\+/g, "");
    const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${psKeys}')`;
    await run(`powershell -Command "${ps}"`);
  } else if (platform === "darwin") {
    // AppleScript: "keystroke "m" using {control down, shift down}"
    const parts = combo.toLowerCase().split("+");
    const key = parts[parts.length - 1];
    const mods = parts.slice(0, -1).map(m => {
      const map = { ctrl: "control down", shift: "shift down", alt: "option down", cmd: "command down" };
      return map[m] || `${m} down`;
    });
    const modStr = mods.length ? ` using {${mods.join(", ")}}` : "";
    await run(`osascript -e 'tell application "System Events" to keystroke "${key}"${modStr}'`);
  } else {
    // xdotool on Linux
    const xKeys = combo.replace(/\+/g, "+");
    await run(`xdotool key ${xKeys}`);
  }
}

// ── Helper: parse composite JSON value ───────────────────────────────────────
function parseComposite(raw) {
  try { return JSON.parse(raw); } catch { return {}; }
}

// ── App URL schemes ───────────────────────────────────────────────────────────
const APP_SCHEMES = {
  zoom:      (v) => `zoommtg://zoom.us/${v.command || "start"}?confno=${v.meetingId || ""}`,
  discord:   (v) => `discord://`,
  slack:     (v) => `slack://open`,
  spotify:   (v) => `spotify:`,
  telegram:  (v) => `tg://`,
  notion:    (v) => v.pageUrl ? `notion://${v.pageUrl.replace("https://www.notion.so/", "")}` : `notion://`,
  vscode:    (_)  => `vscode://`,
  figma:     (_)  => `figma://`,
  whatsapp:  (v)  => v.contact ? `https://wa.me/${v.contact.replace(/\D/g, "")}` : `https://web.whatsapp.com`,
};

// Full URL mappings for web-based actions
function getActionUrl(actionType, actionValue) {
  const v = typeof actionValue === "string" && actionValue.startsWith("{")
    ? parseComposite(actionValue)
    : { command: actionValue };

  const urls = {
    url: actionValue,
    zoom: `zoommtg://zoom.us/${v.command || "join"}`,
    googlemeet: v.link || "https://meet.google.com/new",
    discord: v.target ? `https://discord.com/channels/@me` : `discord://`,
    slack: v.target ? `slack://channel?team=&id=${v.target}` : `slack://open`,
    teams: `msteams://`,
    spotify: `spotify:`,
    telegram: v.target ? `tg://resolve?domain=${v.target.replace("@", "")}` : `tg://`,
    notion: v.pageUrl || "https://notion.so",
    vscode: `vscode://`,
    figma: "https://figma.com",
    youtube: {
      open: "https://youtube.com",
      subscriptions: "https://youtube.com/feed/subscriptions",
      watchlater: "https://youtube.com/playlist?list=WL",
      trending: "https://youtube.com/feed/trending",
      history: "https://youtube.com/feed/history",
      studio: "https://studio.youtube.com",
    }[v.command] || "https://youtube.com",
    gmail: {
      compose: "https://mail.google.com/mail/u/0/#compose",
      inbox: "https://mail.google.com/mail/u/0/#inbox",
      starred: "https://mail.google.com/mail/u/0/#starred",
      sent: "https://mail.google.com/mail/u/0/#sent",
      drafts: "https://mail.google.com/mail/u/0/#drafts",
    }[v.command] || "https://mail.google.com",
    github: v.repo
      ? `https://github.com/${v.repo}`
      : { "open-profile": "https://github.com", "open-notifications": "https://github.com/notifications" }[v.command] || "https://github.com",
    twitch: v.channel ? `https://twitch.tv/${v.channel}` : "https://twitch.tv",
    x: {
      home: "https://x.com", compose: "https://x.com/compose/post",
      notifications: "https://x.com/notifications", messages: "https://x.com/messages",
      explore: "https://x.com/explore", bookmarks: "https://x.com/i/bookmarks",
      grok: "https://x.com/i/grok",
    }[v.command] || "https://x.com",
    chatgpt: {
      open: "https://chatgpt.com", "new-chat": "https://chatgpt.com",
      gpts: "https://chatgpt.com/gpts", dalle: "https://chatgpt.com/g/g-2fkFE8rbu-dall-e",
    }[v.command] || "https://chatgpt.com",
    whatsapp: v.contact
      ? `https://wa.me/${v.contact.replace(/\D/g, "")}`
      : "https://web.whatsapp.com",
    browser: null, // handled below
    media: null,
    hotkey: null,
    system: null,
    script: null,
    app: null,
    vpn: null,
    steam: null,
  };
  return urls[actionType] || null;
}

// ── System actions ────────────────────────────────────────────────────────────
async function executeSystemAction(command) {
  const cmds = {
    win32: {
      lock:         "rundll32.exe user32.dll,LockWorkStation",
      sleep:        `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState('Suspend',$false,$false)"`,
      shutdown:     "shutdown /s /t 0",
      restart:      "shutdown /r /t 0",
      logoff:       "shutdown /l",
      screenshot:   `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object { $bmp = New-Object System.Drawing.Bitmap($_.Bounds.Width,$_.Bounds.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen(0,0,0,0,$bmp.Size); $bmp.Save([System.IO.Path]::Combine($env:USERPROFILE, 'Desktop', 'screenshot_' + (Get-Date -f 'yyyyMMdd_HHmmss') + '.png')) }"`,
      taskmanager:  "taskmgr",
      explorer:     "explorer",
      clipboard:    "explorer ms-settings:clipboard",
      emoji:        `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^{ESC}')"`,
      desktop:      `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^d')"`,
      notification: `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^n')"`,
    },
    darwin: {
      lock:         "sysadminctl -screenLock immediate || osascript -e 'tell application \"System Events\" to keystroke \"q\" using {control down, command down}'",
      sleep:        "pmset sleepnow",
      shutdown:     "osascript -e 'tell application \"System Events\" to shut down'",
      restart:      "osascript -e 'tell application \"System Events\" to restart'",
      logoff:       "osascript -e 'tell application \"System Events\" to log out'",
      screenshot:   "screencapture -i ~/Desktop/screenshot_$(date +%Y%m%d_%H%M%S).png",
      taskmanager:  "open -a 'Activity Monitor'",
      explorer:     "open ~",
      clipboard:    "open -a 'Finder'",
      emoji:        "open '/System/Library/Input Methods/CharacterPaletteIM.app'",
      desktop:      "osascript -e 'tell application \"Finder\" to reveal desktop'",
      notification: "open 'x-apple.systempreferences:com.apple.preference.notifications'",
    },
    linux: {
      lock:         "loginctl lock-session || xdg-screensaver lock",
      sleep:        "systemctl suspend",
      shutdown:     "systemctl poweroff",
      restart:      "systemctl reboot",
      logoff:       "pkill -u $USER",
      screenshot:   "scrot ~/Desktop/screenshot_$(date +%Y%m%d_%H%M%S).png",
      taskmanager:  "gnome-system-monitor || xterm -e htop",
      explorer:     "xdg-open ~",
      clipboard:    "xdg-open ~",
      emoji:        "ibus-daemon -d -x || xdg-open ~",
      desktop:      "xdotool key super+d",
      notification: "xdg-open ~",
    },
  };

  const platformCmds = cmds[platform] || cmds.linux;
  const cmd = platformCmds[command];
  if (!cmd) throw new Error(`Unknown system command: ${command}`);
  await run(cmd, { shell: true });
}

// ── Media key commands ────────────────────────────────────────────────────────
async function executeMediaAction(command) {
  if (platform === "win32") {
    const keyMap = {
      playpause: "VK_MEDIA_PLAY_PAUSE",
      nexttrack: "VK_MEDIA_NEXT_TRACK",
      prevtrack: "VK_MEDIA_PREV_TRACK",
      stop: "VK_MEDIA_STOP",
      volumeup: "VK_VOLUME_UP",
      volumedown: "VK_VOLUME_DOWN",
      mute: "VK_VOLUME_MUTE",
    };
    const vk = keyMap[command];
    if (vk) {
      const ps = `
        $code = @'
        using System;using System.Runtime.InteropServices;
        public class KB{
          [DllImport("user32.dll")] public static extern void keybd_event(byte bVk,byte bScan,uint dwFlags,UIntPtr dwExtraInfo);
          public static void Press(byte k){keybd_event(k,0,0,UIntPtr.Zero);keybd_event(k,0,2,UIntPtr.Zero);}
        }
'@
        Add-Type -TypeDefinition $code;[KB]::Press(0x${
          { VK_MEDIA_PLAY_PAUSE: "B3", VK_MEDIA_NEXT_TRACK: "B0", VK_MEDIA_PREV_TRACK: "B1",
            VK_MEDIA_STOP: "B2", VK_VOLUME_UP: "AF", VK_VOLUME_DOWN: "AE", VK_VOLUME_MUTE: "AD" }[vk]
        })`;
      await run(`powershell -Command "${ps.replace(/\n/g, " ")}"`);
    }
  } else if (platform === "darwin") {
    const keyMap = {
      playpause: "play", nexttrack: "next", prevtrack: "previous",
      volumeup: "volume up", volumedown: "volume down", mute: "mute",
    };
    const k = keyMap[command];
    if (k) {
      await run(`osascript -e 'tell application "Spotify" to ${k}' 2>/dev/null || osascript -e 'tell application "Music" to ${k}' 2>/dev/null || true`);
    }
  } else {
    const keyMap = {
      playpause: "XF86AudioPlay", nexttrack: "XF86AudioNext",
      prevtrack: "XF86AudioPrev", stop: "XF86AudioStop",
      volumeup: "XF86AudioRaiseVolume", volumedown: "XF86AudioLowerVolume", mute: "XF86AudioMute",
    };
    const k = keyMap[command];
    if (k) await run(`xdotool key ${k}`);
  }
}

// ── Main execute handler ──────────────────────────────────────────────────────
async function handleExecute(button) {
  const { actionType, actionValue, label } = button;

  console.log(`⚡ Execute: [${actionType}] ${label}`);

  try {
    switch (actionType) {
      case "url":
        await openUrl(actionValue);
        break;

      case "hotkey":
        await sendHotkey(actionValue);
        break;

      case "script":
        await run(actionValue, { shell: true });
        break;

      case "app": {
        if (platform === "win32") await run(`start "" "${actionValue}"`);
        else if (platform === "darwin") await run(`open -a "${actionValue}" || open "${actionValue}"`);
        else await run(`${actionValue} &`);
        break;
      }

      case "media": {
        await executeMediaAction(actionValue);
        break;
      }

      case "system": {
        await executeSystemAction(actionValue);
        break;
      }

      case "vpn": {
        // Best-effort: open VPN app or system network settings
        if (platform === "win32") await run("start ms-settings:network-vpn");
        else if (platform === "darwin") await run("open 'x-apple.systempreferences:com.apple.preference.network'");
        else await openUrl("https://mullvad.net/en/download");
        break;
      }

      case "steam": {
        const user = actionValue;
        if (platform === "win32") await run(`start steam://login/${user}`);
        else await openUrl(`steam://login/${user}`);
        break;
      }

      case "browser": {
        const browserUrls = {
          newtab: { win32: "start chrome --new-tab", darwin: "open -a 'Google Chrome' --args --new-tab", linux: "google-chrome --new-tab" },
          incognito: { win32: "start chrome --incognito", darwin: "open -a 'Google Chrome' --args --incognito", linux: "google-chrome --incognito" },
          history: "chrome://history/",
          downloads: "chrome://downloads/",
          devtools: null, // can't open DevTools externally easily
        };
        const val = browserUrls[actionValue];
        if (typeof val === "object" && val !== null) await run(val[platform] || val.linux);
        else if (typeof val === "string") await openUrl(val);
        break;
      }

      case "zoom": {
        const v = parseComposite(actionValue);
        if (v.command === "join" && v.meetingId) {
          await openUrl(`zoommtg://zoom.us/join?confno=${v.meetingId.replace(/\D/g, "")}`);
        } else if (v.command === "newmeeting") {
          await openUrl("zoommtg://zoom.us/start?confno=0");
        } else {
          // For in-meeting hotkeys
          const zoomHotkeys = {
            mute: { win32: "alt+a", darwin: "cmd+shift+a" },
            video: { win32: "alt+v", darwin: "cmd+shift+v" },
            screenshare: { win32: "alt+shift+s", darwin: "cmd+shift+s" },
            hand: { win32: "alt+y", darwin: "option+y" },
            record: { win32: "alt+r", darwin: "cmd+shift+r" },
            leave: { win32: "alt+q", darwin: "cmd+w" },
            chat: { win32: "alt+h", darwin: "cmd+shift+h" },
            participants: { win32: "alt+u", darwin: "cmd+u" },
          };
          const hk = zoomHotkeys[v.command || ""];
          if (hk) await sendHotkey(platform === "darwin" ? hk.darwin : hk.win32);
        }
        break;
      }

      case "teams": {
        const v = parseComposite(actionValue);
        const teamsHotkeys = {
          mute: { win32: "ctrl+shift+m", darwin: "cmd+shift+m" },
          video: { win32: "ctrl+shift+o", darwin: "cmd+shift+o" },
          screenshare: { win32: "ctrl+shift+e", darwin: "cmd+shift+e" },
          hand: { win32: "ctrl+shift+k", darwin: "cmd+shift+k" },
          leave: { win32: "ctrl+shift+h", darwin: "cmd+shift+h" },
          blur: { win32: "ctrl+shift+p", darwin: "cmd+shift+p" },
        };
        const hk = teamsHotkeys[v.command || ""];
        if (hk) await sendHotkey(platform === "darwin" ? hk.darwin : hk.win32);
        else await openUrl("msteams://");
        break;
      }

      case "discord": {
        const v = parseComposite(actionValue);
        const discordHotkeys = {
          mute: { win32: "ctrl+shift+m", darwin: "cmd+shift+m" },
          deafen: { win32: "ctrl+shift+d", darwin: "cmd+shift+d" },
          disconnect: { win32: "ctrl+shift+e", darwin: "cmd+shift+e" },
        };
        const hk = discordHotkeys[v.command || ""];
        if (hk) await sendHotkey(platform === "darwin" ? hk.darwin : hk.win32);
        else await openUrl(`discord://`);
        break;
      }

      case "slack": {
        const v = parseComposite(actionValue);
        if (v.command === "open-channel" && v.target) {
          await openUrl(`slack://channel?team=&id=${v.target}`);
        } else if (v.command === "open-dm" && v.target) {
          await openUrl(`slack://user?team=&id=${v.target}`);
        } else if (v.command === "dnd") {
          await sendHotkey(platform === "darwin" ? "cmd+shift+d" : "ctrl+shift+d");
        } else {
          await openUrl("slack://open");
        }
        break;
      }

      case "spotify": {
        const spotifyHotkeys = {
          playpause: { win32: "ctrl+space", darwin: "space" },
          next: { win32: "ctrl+right", darwin: "cmd+right" },
          prev: { win32: "ctrl+left", darwin: "cmd+left" },
          volumeup: { win32: "ctrl+up", darwin: "cmd+up" },
          volumedown: { win32: "ctrl+down", darwin: "cmd+down" },
          mute: { win32: "ctrl+shift+down", darwin: "cmd+shift+down" },
          shuffle: { win32: "ctrl+s", darwin: "cmd+s" },
          repeat: { win32: "ctrl+r", darwin: "cmd+r" },
          like: { win32: "ctrl+shift+b", darwin: "cmd+shift+b" },
        };
        const hk = spotifyHotkeys[actionValue];
        if (hk) await sendHotkey(platform === "darwin" ? hk.darwin : hk.win32);
        else await openUrl("spotify:");
        break;
      }

      case "obs": {
        const v = parseComposite(actionValue);
        const obsHotkeys = {
          "start-recording": { win32: "ctrl+alt+r", darwin: "cmd+option+r" },
          "stop-recording": { win32: "ctrl+alt+r", darwin: "cmd+option+r" },
          "toggle-recording": { win32: "ctrl+alt+r", darwin: "cmd+option+r" },
          "start-streaming": { win32: "ctrl+alt+s", darwin: "cmd+option+s" },
          "stop-streaming": { win32: "ctrl+alt+s", darwin: "cmd+option+s" },
          "toggle-streaming": { win32: "ctrl+alt+s", darwin: "cmd+option+s" },
          screenshot: { win32: "ctrl+alt+c", darwin: "cmd+option+c" },
        };
        const hk = obsHotkeys[v.command || ""];
        if (hk) await sendHotkey(platform === "darwin" ? hk.darwin : hk.win32);
        break;
      }

      case "vscode": {
        const vsHotkeys = {
          terminal: { win32: "ctrl+`", darwin: "ctrl+`" },
          format: { win32: "shift+alt+f", darwin: "shift+option+f" },
          save: { win32: "ctrl+k ctrl+s", darwin: "cmd+option+s" },
          debug: { win32: "f5", darwin: "f5" },
          sidebar: { win32: "ctrl+b", darwin: "cmd+b" },
          command: { win32: "ctrl+shift+p", darwin: "cmd+shift+p" },
          zen: { win32: "ctrl+k z", darwin: "cmd+k z" },
          split: { win32: "ctrl+\\", darwin: "cmd+\\" },
          closetab: { win32: "ctrl+w", darwin: "cmd+w" },
          "open-file": { win32: "ctrl+p", darwin: "cmd+p" },
          settings: { win32: "ctrl+,", darwin: "cmd+," },
          git: { win32: "ctrl+shift+g", darwin: "cmd+shift+g" },
          extensions: { win32: "ctrl+shift+x", darwin: "cmd+shift+x" },
          explorer: { win32: "ctrl+shift+e", darwin: "cmd+shift+e" },
        };
        const hk = vsHotkeys[actionValue];
        if (hk) await sendHotkey(platform === "darwin" ? hk.darwin : hk.win32);
        else await openUrl("vscode://");
        break;
      }

      default: {
        // Try to get a URL for it and open in browser
        const url = getActionUrl(actionType, actionValue);
        if (url) await openUrl(url);
        else console.log(`  → No handler for actionType '${actionType}', skipped`);
        break;
      }
    }

    console.log(`  ✅ Done`);
  } catch (err) {
    console.error(`  ❌ Error:`, err.message);
  }
}

// ── WebSocket connection with auto-reconnect ───────────────────────────────────
function buildWsUrl(base) {
  const u = new URL(base);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/api/ws/agent";
  return u.toString();
}

let reconnectDelay = 2000;

function connect() {
  const wsUrl = buildWsUrl(serverUrl);
  console.log(`🔌 Connecting to ${wsUrl} …`);

  const ws = new WebSocket(wsUrl, {
    rejectUnauthorized: false, // allow self-signed certs in dev
  });

  ws.on("open", () => {
    reconnectDelay = 2000;
    console.log("✅ Connected to StreamDeck server!\n");
    ws.send(JSON.stringify({
      type: "identify",
      platform,
      hostname,
      version: "1.0.0",
    }));
  });

  ws.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.type === "execute" && msg.button) {
      handleExecute(msg.button);
    } else if (msg.type === "hello") {
      console.log(`  Agent ID: ${msg.agentId}`);
    }
  });

  ws.on("close", () => {
    console.log(`\n⚠️  Disconnected. Reconnecting in ${reconnectDelay / 1000}s…`);
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  });

  ws.on("error", (err) => {
    console.error(`❌ WebSocket error: ${err.message}`);
  });
}

connect();
