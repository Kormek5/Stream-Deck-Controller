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
const fs = require("fs");
const https = require("https");
const http = require("http");

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let serverUrl = "";
let obsPassword = "";
let obsPort = 4455;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--server" && args[i + 1])       serverUrl   = args[i + 1];
  if (args[i] === "--obs-password" && args[i + 1]) obsPassword = args[i + 1];
  if (args[i] === "--obs-port" && args[i + 1])     obsPort     = parseInt(args[i + 1], 10);
}

// Auto-detect from environment or fallback
if (!serverUrl)   serverUrl   = process.env.STREAMDECK_SERVER    || "http://localhost:3001";
if (!obsPassword) obsPassword = process.env.OBS_WS_PASSWORD      || "";
if (!obsPort)     obsPort     = parseInt(process.env.OBS_WS_PORT || "4455", 10);

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
  console.error("ERROR: 'ws' module not found in node_modules/");
  console.error("Make sure you extracted the full ZIP (including node_modules folder).");
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

// ── Helper: write PowerShell to temp file and execute ─────────────────────────
async function runPsScript(script) {
  const tmpFile = path.join(os.tmpdir(), `sd_${Date.now()}.ps1`);
  fs.writeFileSync(tmpFile, script, "utf8");
  try {
    return await run(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
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

// ── Helper: build PowerShell SendKeys string from combo ───────────────────────
function buildSendKeysString(combo) {
  // Parse parts e.g. "ctrl+shift+m" → modifiers + key
  const parts = combo.toLowerCase().split("+");
  const specialKeys = {
    enter: "{ENTER}", return: "{ENTER}", tab: "{TAB}", esc: "{ESC}", escape: "{ESC}",
    space: " ", backspace: "{BACKSPACE}", delete: "{DELETE}", del: "{DELETE}",
    up: "{UP}", down: "{DOWN}", left: "{LEFT}", right: "{RIGHT}",
    home: "{HOME}", end: "{END}", pageup: "{PGUP}", pagedown: "{PGDN}",
    insert: "{INSERT}", f1: "{F1}", f2: "{F2}", f3: "{F3}", f4: "{F4}",
    f5: "{F5}", f6: "{F6}", f7: "{F7}", f8: "{F8}", f9: "{F9}",
    f10: "{F10}", f11: "{F11}", f12: "{F12}",
    // Characters that SendKeys treats as special - escape them
    "~": "{~}", "(": "{(}", ")": "{)}", "%": "{%}", "^": "{^}", "+": "{+}",
  };
  let prefix = "";
  let mainKey = "";
  for (const p of parts) {
    const t = p.trim();
    if (t === "ctrl")  prefix += "^";
    else if (t === "shift") prefix += "+";
    else if (t === "alt")   prefix += "%";
    else if (t === "win")   { prefix += "^{ESC}"; } // best approximation
    else mainKey = specialKeys[t] || t;
  }
  return prefix + mainKey;
}

// ── Helper: send keyboard shortcut ───────────────────────────────────────────
async function sendHotkey(combo) {
  // combo examples: "ctrl+shift+m", "win+d", "cmd+space"
  if (platform === "win32") {
    const psKeys = buildSendKeysString(combo);
    await runPsScript(
      `Add-Type -AssemblyName System.Windows.Forms\n[System.Windows.Forms.SendKeys]::SendWait('${psKeys}')`
    );
  } else if (platform === "darwin") {
    // AppleScript: keystroke with modifiers
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
    await run(`xdotool key ${combo}`);
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

// ── OBS WebSocket v5 helper ────────────────────────────────────────────────────
const crypto = require("crypto");
function obsAuthString(password, salt, challenge) {
  const secret = crypto.createHash("sha256").update(password + salt).digest("base64");
  return crypto.createHash("sha256").update(secret + challenge).digest("base64");
}
async function obsRequest(requestType, requestData = {}) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(`ws://localhost:${obsPort}`);
    } catch (e) {
      return reject(new Error("OBS WebSocket not available"));
    }
    let done = false;
    const finish = (err, val) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch {}
      if (err) reject(err); else resolve(val);
    };
    const timer = setTimeout(() => finish(new Error("OBS connection timed out (is OBS running with WebSocket enabled?)")), 5000);

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      const { op, d } = msg;
      if (op === 0) {
        // Hello → send Identify
        const identPayload = { op: 1, d: { rpcVersion: 1 } };
        if (d.authentication && obsPassword) {
          identPayload.d.authentication = obsAuthString(obsPassword, d.authentication.salt, d.authentication.challenge);
        }
        ws.send(JSON.stringify(identPayload));
      } else if (op === 2) {
        // Identified → send request
        ws.send(JSON.stringify({ op: 6, d: { requestType, requestId: "r1", requestData } }));
      } else if (op === 7) {
        // RequestResponse
        if (d.requestStatus.result) finish(null, d.responseData || {});
        else finish(new Error(`OBS error: ${d.requestStatus.comment || d.requestStatus.code}`));
      }
    });
    ws.on("error", (err) => finish(new Error(`OBS WebSocket: ${err.message}`)));
    ws.on("close", () => { if (!done) finish(new Error("OBS WebSocket closed unexpectedly")); });
  });
}

// ── Media key commands ────────────────────────────────────────────────────────
async function executeMediaAction(command) {
  if (platform === "win32") {
    const hexMap = {
      playpause: "B3", nexttrack: "B0", prevtrack: "B1", stop: "B2",
      volumeup: "AF", volumedown: "AE", mute: "AD",
    };
    const hex = hexMap[command];
    if (hex) {
      // Write to a temp .ps1 file — heredoc MUST have closing '@ on its own line
      const ps = `$code = @'
using System;
using System.Runtime.InteropServices;
public class KB {
  [DllImport("user32.dll")]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  public static void Press(byte k) {
    keybd_event(k, 0, 0, UIntPtr.Zero);
    keybd_event(k, 0, 2, UIntPtr.Zero);
  }
}
'@
Add-Type -TypeDefinition $code
[KB]::Press(0x${hex})
`;
      await runPsScript(ps);
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
        if (actionValue === "screenshot") {
          await takeAndSendScreenshot();
        } else {
          await executeSystemAction(actionValue);
        }
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
        // Steam has no URL scheme for account-switching. Best we can do:
        // 1. Bring Steam to foreground, or
        // 2. Kill Steam so login screen appears on next launch
        // actionValue may be a plain username string or JSON {"command":"switch","username":"..."}
        const v = parseComposite(actionValue);
        const steamUser = v.username || (typeof actionValue === "string" && !actionValue.startsWith("{") ? actionValue : "");
        const steamCmd = v.command || (steamUser ? "switch" : "open");
        if (steamCmd === "switch") {
          // Kill Steam → user can restart it and pick an account
          if (platform === "win32") {
            await run(`taskkill /f /im steam.exe`).catch(() => {});
            // Re-launch Steam after short delay (no auto-login flag)
            await new Promise(r => setTimeout(r, 1500));
            const steamExe = `"C:\\Program Files (x86)\\Steam\\steam.exe"`;
            await run(`start "" ${steamExe} -noreactlogin`).catch(() => run(`start steam://open/main`).catch(() => {}));
          } else if (platform === "darwin") {
            await run(`killall Steam 2>/dev/null || true`);
            await new Promise(r => setTimeout(r, 1500));
            await run(`open -a Steam`).catch(() => {});
          } else {
            await run(`pkill steam 2>/dev/null || true`);
          }
        } else {
          // Just open / bring Steam to front
          await openUrl("steam://open/main").catch(() => openUrl("https://store.steampowered.com"));
        }
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
        const cmd = v.command || actionValue;
        if (cmd === "join" && v.meetingId) {
          await openUrl(`zoommtg://zoom.us/join?confno=${v.meetingId.replace(/\D/g, "")}`);
        } else if (cmd === "newmeeting") {
          await openUrl("zoommtg://zoom.us/start?confno=0");
        } else {
          const zoomHotkeys = {
            mute:         { win32: "alt+a",       darwin: "cmd+shift+a" },
            video:        { win32: "alt+v",       darwin: "cmd+shift+v" },
            screenshare:  { win32: "alt+shift+s", darwin: "cmd+shift+s" },
            hand:         { win32: "alt+y",       darwin: "option+y" },
            record:       { win32: "alt+r",       darwin: "cmd+shift+r" },
            leave:        { win32: "alt+q",       darwin: "cmd+w" },
            chat:         { win32: "alt+h",       darwin: "cmd+shift+h" },
            participants: { win32: "alt+u",       darwin: "cmd+u" },
          };
          const hk = zoomHotkeys[cmd];
          if (hk) await sendHotkey(platform === "darwin" ? hk.darwin : hk.win32);
          else await openUrl("zoommtg://zoom.us/");
        }
        break;
      }

      case "teams": {
        const v = parseComposite(actionValue);
        const cmd = v.command || actionValue;
        const teamsHotkeys = {
          mute:        { win32: "ctrl+shift+m", darwin: "cmd+shift+m" },
          video:       { win32: "ctrl+shift+o", darwin: "cmd+shift+o" },
          screenshare: { win32: "ctrl+shift+e", darwin: "cmd+shift+e" },
          hand:        { win32: "ctrl+shift+k", darwin: "cmd+shift+k" },
          leave:       { win32: "ctrl+shift+h", darwin: "cmd+shift+h" },
          blur:        { win32: "ctrl+shift+p", darwin: "cmd+shift+p" },
        };
        const hk = teamsHotkeys[cmd];
        if (hk) await sendHotkey(platform === "darwin" ? hk.darwin : hk.win32);
        else await openUrl("msteams://");
        break;
      }

      case "discord": {
        const v = parseComposite(actionValue);
        const cmd = v.command || actionValue;
        const discordHotkeys = {
          mute:              { win32: "ctrl+shift+m", darwin: "cmd+shift+m" },
          deafen:            { win32: "ctrl+shift+d", darwin: "cmd+shift+d" },
          disconnect:        { win32: "ctrl+shift+e", darwin: "cmd+shift+e" },
          video:             { win32: "ctrl+shift+v", darwin: "cmd+shift+v" },
          screenshare:       { win32: "ctrl+shift+s", darwin: "cmd+shift+s" },
          "go-live":         { win32: "ctrl+shift+l", darwin: "cmd+shift+l" },
          "push-to-talk":    { win32: "ctrl+shift+t", darwin: "cmd+shift+t" },
          "notifications-off": { win32: "ctrl+shift+n", darwin: "cmd+shift+n" },
        };
        const hk = discordHotkeys[cmd];
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
        const cmd = v.command || actionValue;
        // Map commands to OBS WebSocket v5 request types
        const obsWsMap = {
          "start-recording":    () => obsRequest("StartRecord"),
          "stop-recording":     () => obsRequest("StopRecord"),
          "toggle-recording":   () => obsRequest("ToggleRecord"),
          "start-streaming":    () => obsRequest("StartStream"),
          "stop-streaming":     () => obsRequest("StopStream"),
          "toggle-streaming":   () => obsRequest("ToggleStream"),
          "replay-buffer":      () => obsRequest("ToggleReplayBuffer"),
          "save-replay":        () => obsRequest("SaveReplayBuffer"),
          "toggle-mute-mic":    () => obsRequest("ToggleInputMute", { inputName: "Mic/Aux" }),
          "toggle-mute-desktop":() => obsRequest("ToggleInputMute", { inputName: "Desktop Audio" }),
          "switch-scene":       () => v.scene
            ? obsRequest("SetCurrentProgramScene", { sceneName: v.scene })
            : Promise.reject(new Error("No scene name specified")),
          "screenshot":         () => obsRequest("SaveSourceScreenshot", {
            sourceName: v.scene || undefined,
            imageFormat: "png",
            imageFilePath: "",
          }),
        };
        const handler = obsWsMap[cmd];
        if (handler) {
          await handler();
        } else {
          console.log(`  → OBS: unknown command "${cmd}"`);
        }
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

      case "multi": {
        let steps;
        try { steps = JSON.parse(actionValue); } catch { steps = []; }
        if (!Array.isArray(steps)) steps = [];
        for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
          const step = steps[stepIdx];
          if (!step || !step.type) continue;
          console.log(`  ↳ Step ${stepIdx + 1}/${steps.length}: [${step.type}] ${step.value || ""}`);
          // Re-use main handler by constructing a synthetic button
          await handleExecute({ actionType: step.type, actionValue: step.value || "", label: `Step ${stepIdx + 1}` });
          // Small delay between steps
          if (stepIdx < steps.length - 1) {
            await new Promise(r => setTimeout(r, 200));
          }
        }
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
let activeWs = null; // module-level ref so handlers can send messages back

// ── Take screenshot and send to server ───────────────────────────────────────
async function takeAndSendScreenshot() {
  const tmpFile = path.join(os.tmpdir(), "streamdeck_screenshot.png");

  if (platform === "win32") {
    // Save to temp path - no unicode in path needed
    const ps = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $bmp = New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width,[System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen(0,0,0,0,$bmp.Size); $bmp.Save('${tmpFile.replace(/\\/g, "\\\\")}'); $g.Dispose(); $bmp.Dispose()`;
    await run(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { shell: true });
  } else if (platform === "darwin") {
    await run(`screencapture -x '${tmpFile}'`);
  } else {
    await run(`scrot '${tmpFile}' 2>/dev/null || import -window root '${tmpFile}'`);
  }

  const buf = fs.readFileSync(tmpFile);
  const dataUrl = "data:image/png;base64," + buf.toString("base64");

  if (activeWs && activeWs.readyState === WebSocket.OPEN) {
    activeWs.send(JSON.stringify({ type: "screenshot_result", data: dataUrl, timestamp: new Date().toISOString() }));
    console.log("  📷 Screenshot sent to server (" + Math.round(buf.length / 1024) + " KB)");
  } else {
    console.log("  ⚠️  Screenshot taken but agent not connected, cannot send");
  }
}

function connect() {
  const wsUrl = buildWsUrl(serverUrl);
  console.log(`🔌 Connecting to ${wsUrl} …`);

  const ws = new WebSocket(wsUrl, {
    rejectUnauthorized: false, // allow self-signed certs in dev
  });

  activeWs = ws;

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
