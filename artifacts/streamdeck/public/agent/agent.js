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
  // Write UTF-8 BOM so PowerShell reads Unicode (Cyrillic etc.) correctly on any Windows locale
  fs.writeFileSync(tmpFile, "\ufeff" + script, "utf8");
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
      screenrecord: `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{F10}')" & start ms-gamebar:`,
      taskmanager:  "taskmgr",
      explorer:     "explorer",
      clipboard:    "explorer ms-settings:clipboard",
      emoji:        `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^{ESC}')"`,
      desktop:      `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^d')"`,
      notification: `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('+^n')"`,
      focus:        `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{TAB}')"`,
    },
    darwin: {
      lock:         "sysadminctl -screenLock immediate || osascript -e 'tell application \"System Events\" to keystroke \"q\" using {control down, command down}'",
      sleep:        "pmset sleepnow",
      shutdown:     "osascript -e 'tell application \"System Events\" to shut down'",
      restart:      "osascript -e 'tell application \"System Events\" to restart'",
      logoff:       "osascript -e 'tell application \"System Events\" to log out'",
      screenshot:   "screencapture -i ~/Desktop/screenshot_$(date +%Y%m%d_%H%M%S).png",
      screenrecord: "osascript -e 'tell application \"System Events\" to key code 95 using {command down, shift down}'",
      taskmanager:  "open -a 'Activity Monitor'",
      explorer:     "open ~",
      clipboard:    "open -a 'Finder'",
      emoji:        "open '/System/Library/Input Methods/CharacterPaletteIM.app'",
      desktop:      "osascript -e 'tell application \"Finder\" to reveal desktop'",
      notification: "open 'x-apple.systempreferences:com.apple.preference.notifications'",
      focus:        "osascript -e 'tell application \"System Events\" to key code 48 using {command down}'",
    },
    linux: {
      lock:         "loginctl lock-session || xdg-screensaver lock",
      sleep:        "systemctl suspend",
      shutdown:     "systemctl poweroff",
      restart:      "systemctl reboot",
      logoff:       "pkill -u $USER",
      screenshot:   "scrot ~/Desktop/screenshot_$(date +%Y%m%d_%H%M%S).png",
      screenrecord: "ffmpeg -f x11grab -r 30 -s 1920x1080 -i :0.0 ~/Desktop/recording_$(date +%Y%m%d_%H%M%S).mp4 &",
      taskmanager:  "gnome-system-monitor || xterm -e htop",
      explorer:     "xdg-open ~",
      clipboard:    "xdg-open ~",
      emoji:        "ibus-daemon -d -x || xdg-open ~",
      desktop:      "xdotool key super+d",
      notification: "xdg-open ~",
      focus:        "xdotool key alt+Tab",
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
    ws.on("error", (err) => {
      // Build a descriptive message — err.message is sometimes empty on Windows
      const detail = err.message || err.code || err.syscall || String(err);
      const code   = err.code ? ` [${err.code}]` : "";
      finish(new Error(`OBS WebSocket: ${detail}${code}`));
    });
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
        } else if (actionValue === "screenrecord" && platform === "win32") {
          // Send Win+Alt+R (Xbox Game Bar record toggle) via keybd_event
          await runPsScript(
            `Add-Type -TypeDefinition @'\n` +
            `using System; using System.Runtime.InteropServices;\n` +
            `public class KB {\n` +
            `  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);\n` +
            `  public const int KEYEVENTF_KEYUP = 2; public const int KEYEVENTF_EXTENDEDKEY = 1;\n` +
            `}\n` +
            `'@ -Language CSharp\n` +
            `# Win+Alt+R = Xbox Game Bar Start/Stop Recording\n` +
            `[KB]::keybd_event(0x5B, 0, 1, 0)  # LWin down\n` +
            `[KB]::keybd_event(0x12, 0, 0, 0)  # Alt down\n` +
            `[KB]::keybd_event(0x52, 0, 0, 0)  # R down\n` +
            `Start-Sleep -Milliseconds 50\n` +
            `[KB]::keybd_event(0x52, 0, 2, 0)  # R up\n` +
            `[KB]::keybd_event(0x12, 0, 2, 0)  # Alt up\n` +
            `[KB]::keybd_event(0x5B, 0, 3, 0)  # LWin up`
          );
          console.log("  → Sent Win+Alt+R (Xbox Game Bar record toggle)");
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
        if (steamUser) {
          // Kill Steam, then relaunch logged into the specific saved account.
          // Requires "Remember my password" was used for this account before.
          if (platform === "win32") {
            await run(`taskkill /f /im steam.exe`).catch(() => {});
            await new Promise(r => setTimeout(r, 2000));
            // Try default install path; fall back to PATH
            const loginArgs = `-login ${steamUser}`;
            await run(`start "" "C:\\Program Files (x86)\\Steam\\steam.exe" ${loginArgs}`)
              .catch(() => run(`start "" "C:\\Program Files\\Steam\\steam.exe" ${loginArgs}`)
              .catch(() => run(`start steam://open/main`).catch(() => {})));
          } else if (platform === "darwin") {
            await run(`killall Steam 2>/dev/null || true`);
            await new Promise(r => setTimeout(r, 2000));
            await run(`open -a Steam --args -login ${steamUser}`).catch(() => run(`open -a Steam`).catch(() => {}));
          } else {
            await run(`pkill steam 2>/dev/null || true`);
            await new Promise(r => setTimeout(r, 1500));
            await run(`steam -login ${steamUser}`).catch(() => run(`steam`).catch(() => {}));
          }
        } else {
          await openUrl("steam://open/main");
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
          "open":               () => { openUrl("obs://"); return Promise.resolve(); },
        };
        const handler = obsWsMap[cmd];
        if (handler) {
          try {
            await handler();
            console.log(`  → OBS: ${cmd} OK`);
          } catch (obsErr) {
            const msg = obsErr.message || String(obsErr);
            const isConnRefused  = msg.includes("ECONNREFUSED") || msg.includes("not available") || obsErr.code === "ECONNREFUSED";
            const isClosedEmpty  = msg.includes("closed") || msg === "OBS WebSocket: " || msg.trim().endsWith(":");
            const isAuthFail     = msg.includes("Authentication") || msg.includes("auth") || msg.includes("4009");
            const isTimeout      = msg.includes("timed out");
            if (isConnRefused || isClosedEmpty) {
              console.error(`  ⚠️  OBS WebSocket not reachable on port ${obsPort} — is OBS running?`);
              console.error(`      Fix: OBS → Tools → WebSocket Server Settings → Enable WebSocket server`);
              console.error(`      Then check port (default 4455) matches Settings → OBS Studio section`);
            } else if (isAuthFail) {
              console.error(`  ⚠️  OBS WebSocket: Wrong password`);
              console.error(`      Fix: update password in Settings → OBS Studio, then re-download start-agent.bat`);
            } else if (isTimeout) {
              console.error(`  ⚠️  OBS WebSocket: Connection timed out`);
              console.error(`      OBS may be starting up — try again in a few seconds`);
            } else {
              console.error(`  ⚠️  OBS error: ${msg}`);
            }
          }
        } else {
          console.log(`  → OBS: unknown command "${cmd}" — valid: start-recording, stop-recording, toggle-recording, start-streaming, stop-streaming, switch-scene, toggle-mute-mic, screenshot`);
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
        console.log(`  ↳ Multi-action: ${steps.length} step(s)`);
        for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
          const step = steps[stepIdx];
          if (!step || !step.type) continue;
          console.log(`  ↳ [${stepIdx + 1}/${steps.length}] ${step.type}: ${step.value || "(no value)"}`);
          await handleExecute({ actionType: step.type, actionValue: step.value || "", label: `Step ${stepIdx + 1}` });
          // Respect per-step delay (defaults to 200ms if not set)
          if (stepIdx < steps.length - 1) {
            const delayMs = typeof step.delay === "number" ? step.delay : 200;
            if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
          }
        }
        break;
      }

      case "clipboard": {
        let clip = {};
        try { clip = JSON.parse(actionValue); } catch { clip = { command: "copy-text", text: actionValue }; }
        const cmd = clip.command || "copy-text";
        if (cmd === "paste") {
          // Trigger paste shortcut
          if (platform === "win32") await runPsScript(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")`);
          else if (platform === "darwin") await exec("osascript -e 'tell app \"System Events\" to keystroke \"v\" using command down'");
          else await exec("xdotool key ctrl+v");
        } else {
          // Copy text to clipboard
          let text = clip.text || "";
          if (cmd === "copy-date") text = new Date().toLocaleDateString();
          else if (cmd === "copy-time") text = new Date().toLocaleTimeString();
          else if (cmd === "copy-datetime") text = new Date().toLocaleString();
          if (text) {
            const escaped = text.replace(/'/g, "\\'");
            if (platform === "win32") await runPsScript(`Set-Clipboard -Value '${escaped}'`);
            else if (platform === "darwin") await exec(`echo '${escaped}' | pbcopy`);
            else await exec(`echo '${escaped}' | xclip -selection clipboard || echo '${escaped}' | xsel --clipboard --input`);
            console.log(`  → Copied to clipboard: "${text.slice(0, 40)}${text.length > 40 ? "…" : ""}"`);
          }
        }
        break;
      }

      case "type": {
        if (!actionValue) break;
        if (platform === "win32") {
          // Copy to clipboard then paste — works for all Unicode including Cyrillic
          // PS single-quoted strings use '' to escape a literal single quote
          const psText = actionValue.replace(/'/g, "''");
          await runPsScript(
            `Add-Type -AssemblyName System.Windows.Forms\n` +
            `[System.Windows.Forms.Clipboard]::SetText('${psText}')\n` +
            `Start-Sleep -Milliseconds 150\n` +
            `[System.Windows.Forms.SendKeys]::SendWait('^v')`
          );
        } else if (platform === "darwin") {
          // Use clipboard+paste on macOS too — handles Unicode
          const safe = actionValue.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          await exec(`printf '%s' "${safe}" | pbcopy && osascript -e 'tell app "System Events" to keystroke "v" using command down'`);
        } else {
          // xdotool type handles Unicode via --clearmodifiers
          const safeText = actionValue.replace(/'/g, "'\\''");
          await exec(`xdotool type --clearmodifiers --delay 20 '${safeText}'`);
        }
        console.log(`  → Typed text (${actionValue.length} chars)`);
        break;
      }

      case "notification": {
        let notif = {};
        try { notif = JSON.parse(actionValue); } catch { notif = { title: label, message: actionValue }; }
        const rawTitle   = notif.title   || label || "StreamDeck";
        const rawMessage = notif.message || "";
        // PS single-quoted strings: escape ' as ''
        const title   = rawTitle.replace(/'/g, "''");
        const message = rawMessage.replace(/'/g, "''");
        if (platform === "win32") {
          // Use Windows 10+ WinRT Toast notification; fall back to NotifyIcon balloon
          await runPsScript(
            `$title   = '${title}'\n` +
            `$message = '${message}'\n` +
            `try {\n` +
            `  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null\n` +
            `  $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(\n` +
            `    [Windows.UI.Notifications.ToastTemplateType]::ToastText02)\n` +
            `  $xml = [xml]$template.GetXml()\n` +
            `  $xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode($title))  | Out-Null\n` +
            `  $xml.GetElementsByTagName('text')[1].AppendChild($xml.CreateTextNode($message)) | Out-Null\n` +
            `  $xDoc = New-Object Windows.Data.Xml.Dom.XmlDocument\n` +
            `  $xDoc.LoadXml($xml.OuterXml)\n` +
            `  $toast = [Windows.UI.Notifications.ToastNotification]::new($xDoc)\n` +
            `  [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('StreamDeck').Show($toast)\n` +
            `} catch {\n` +
            `  # Fallback: tray balloon\n` +
            `  Add-Type -AssemblyName System.Windows.Forms\n` +
            `  $b = New-Object System.Windows.Forms.NotifyIcon\n` +
            `  $b.Icon = [System.Drawing.SystemIcons]::Information\n` +
            `  $b.BalloonTipIcon  = [System.Windows.Forms.ToolTipIcon]::Info\n` +
            `  $b.BalloonTipTitle = $title\n` +
            `  $b.BalloonTipText  = $message\n` +
            `  $b.Visible = $true\n` +
            `  $b.ShowBalloonTip(4000)\n` +
            `  Start-Sleep -Milliseconds 5000\n` +
            `  $b.Dispose()\n` +
            `}`
          );
        } else if (platform === "darwin") {
          // macOS: escape " for AppleScript
          const t = (notif.title   || label || "StreamDeck").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          const m = (notif.message || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          await exec(`osascript -e 'display notification "${m}" with title "${t}"'`);
        } else {
          const lnxTitle = rawTitle.replace(/'/g, "'\\''");
          const lnxMsg   = rawMessage.replace(/'/g, "'\\''");
          await exec(`notify-send '${lnxTitle}' '${lnxMsg}'`);
        }
        console.log(`  → Notification shown: ${rawTitle}`);
        break;
      }

      case "wol": {
        // Wake-on-LAN: send UDP magic packet to broadcast so the target PC powers on
        // actionValue = MAC address, e.g. "AA:BB:CC:DD:EE:FF" or "AA-BB-CC-DD-EE-FF"
        const macRaw = actionValue.trim().replace(/[:\-]/g, "");
        if (!/^[0-9a-fA-F]{12}$/.test(macRaw)) {
          throw new Error(`Invalid MAC address "${actionValue}" — expected format: AA:BB:CC:DD:EE:FF`);
        }
        const macBuf = Buffer.from(macRaw, "hex");
        const magic  = Buffer.alloc(102);
        magic.fill(0xff, 0, 6);                          // 6 bytes of 0xFF
        for (let i = 0; i < 16; i++) macBuf.copy(magic, 6 + i * 6); // MAC repeated 16x
        const dgram = require("dgram");
        await new Promise((resolve, reject) => {
          const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
          sock.once("error", reject);
          sock.bind(() => {
            sock.setBroadcast(true);
            // Send to both directed broadcast variants and global broadcast
            const targets = ["255.255.255.255", "192.168.1.255", "192.168.0.255"];
            let sent = 0;
            targets.forEach(addr => {
              sock.send(magic, 9, addr, () => {
                if (++sent === targets.length) { sock.close(); resolve(); }
              });
            });
          });
        });
        console.log(`  → WOL magic packet sent to ${actionValue} — PC should wake within 10–30 s`);
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

// ── Live Screen Stream ─────────────────────────────────────────────────────────
let streamTimer   = null;
let frameCapturing = false;  // prevent overlapping captures
let streamWidth    = 1920;
let streamHeight   = 1080;

async function captureFrame(ws) {
  if (!ws || ws.readyState !== WebSocket.OPEN || frameCapturing) return;
  frameCapturing = true;
  const tmpFile = path.join(os.tmpdir(), "sd_live.jpg");
  try {
    if (platform === "win32") {
      // GDI+ screenshot → JPEG 40%  (one PS call, fast after JIT warmup)
      const ps = [
        "Add-Type -AssemblyName System.Windows.Forms,System.Drawing;",
        "$s=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;",
        "$b=New-Object System.Drawing.Bitmap($s.Width,$s.Height);",
        "$g=[System.Drawing.Graphics]::FromImage($b);$g.CopyFromScreen(0,0,0,0,$b.Size);$g.Dispose();",
        "$c=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()|?{$_.MimeType-eq'image/jpeg'};",
        "$p=New-Object System.Drawing.Imaging.EncoderParameters(1);",
        "$p.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,40L);",
        `$b.Save('${tmpFile.replace(/\\/g, "\\\\")}', $c, $p);`,
        "Write-Output ($s.Width.ToString()+' '+$s.Height.ToString());",
        "$b.Dispose()"
      ].join("");
      const info = await run(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { shell: true, timeout: 8000 });
      const parts = info.trim().split(/\s+/);
      if (parts.length >= 2) { streamWidth = parseInt(parts[0]) || 1920; streamHeight = parseInt(parts[1]) || 1080; }
    } else if (platform === "darwin") {
      await run(`screencapture -x -t jpeg '${tmpFile}'`);
      try {
        const info = await run(`sips -g pixelWidth -g pixelHeight '${tmpFile}'`);
        const matches = info.match(/pixelWidth:\s*(\d+)[\s\S]*pixelHeight:\s*(\d+)/);
        if (matches) { streamWidth = parseInt(matches[1]); streamHeight = parseInt(matches[2]); }
      } catch {}
    } else {
      await run(`scrot -q 40 '${tmpFile}' 2>/dev/null || import -window root -quality 40 '${tmpFile}'`);
    }
    const buf = fs.readFileSync(tmpFile);
    ws.send(JSON.stringify({
      type: "frame",
      data: "data:image/jpeg;base64," + buf.toString("base64"),
      width: streamWidth,
      height: streamHeight,
      timestamp: Date.now(),
    }));
  } catch (e) {
    // Suppress noisy frame errors during streaming
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
    frameCapturing = false;
  }
}

// ── Mouse & Keyboard Control ───────────────────────────────────────────────────
const MOUSE_DLL = `
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public class SDMouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f,int x,int y,int d,int e);
  public const uint LDOWN=0x02,LUP=0x04,RDOWN=0x08,RUP=0x10,MDWN=0x20,MUP=0x40,WHEEL=0x0800;
}
'@ -ErrorAction SilentlyContinue;`;

async function handleMouseControl(msg) {
  const x = Math.round(msg.x ?? 0);
  const y = Math.round(msg.y ?? 0);
  try {
    if (platform === "win32") {
      if (msg.type === "mouse-move") {
        await run(
          `powershell -NoProfile -NonInteractive -Command "Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.Cursor]::Position=New-Object System.Drawing.Point(${x},${y})"`,
          { shell: true, timeout: 3000 }
        );
      } else if (msg.type === "mouse-click") {
        const btn   = msg.button === "right" ? "RDOWN,SDMOUSE.RUP" : "SDMOUSE.LDOWN,SDMOUSE.LUP";
        const dbl   = msg.button === "double";
        const flags = msg.button === "right"
          ? "SDMouse.RDOWN; [System.Threading.Thread]::Sleep(40); [SDMouse]::mouse_event([SDMouse]::RUP,0,0,0,0)"
          : dbl
            ? "[SDMouse]::mouse_event([SDMouse]::LDOWN,0,0,0,0); [System.Threading.Thread]::Sleep(30); [SDMouse]::mouse_event([SDMouse]::LUP,0,0,0,0); [System.Threading.Thread]::Sleep(80); [SDMouse]::mouse_event([SDMouse]::LDOWN,0,0,0,0); [System.Threading.Thread]::Sleep(30); [SDMouse]::mouse_event([SDMouse]::LUP,0,0,0,0)"
            : "[SDMouse]::mouse_event([SDMouse]::LDOWN,0,0,0,0); [System.Threading.Thread]::Sleep(40); [SDMouse]::mouse_event([SDMouse]::LUP,0,0,0,0)";
        await runPsScript(
          `${MOUSE_DLL} [SDMouse]::SetCursorPos(${x},${y}); [System.Threading.Thread]::Sleep(30); ${flags}`
        );
      } else if (msg.type === "mouse-scroll") {
        const delta = Math.round((msg.delta ?? 3) * 120);
        await runPsScript(`${MOUSE_DLL} [SDMouse]::mouse_event([SDMouse]::WHEEL,0,0,${delta},0)`);
      }
    } else if (platform === "darwin") {
      if (msg.type === "mouse-move") {
        await run(`osascript -e 'tell application "System Events" to set the position of the mouse cursor to {${x}, ${y}}'`, { timeout: 3000 });
      } else if (msg.type === "mouse-click") {
        const btn = msg.button === "right" ? "right" : msg.button === "double" ? "double" : "left";
        const cliBtn = btn === "right" ? "rc" : btn === "double" ? "dc" : "c";
        await run(`cliclick ${cliBtn}:${x},${y} 2>/dev/null || osascript -e 'tell application "System Events" to click at {${x}, ${y}}'`, { timeout: 3000 });
      } else if (msg.type === "mouse-scroll") {
        const d = Math.round(msg.delta ?? 3);
        await run(`osascript -e 'tell application "System Events" to scroll {0, ${d}} at {${x}, ${y}}'`, { timeout: 3000 });
      }
    } else {
      // Linux — xdotool
      if (msg.type === "mouse-move") {
        await run(`xdotool mousemove ${x} ${y}`, { timeout: 3000 });
      } else if (msg.type === "mouse-click") {
        const btn = msg.button === "right" ? "3" : "1";
        const dbl = msg.button === "double" ? "--repeat 2 --delay 80" : "";
        await run(`xdotool mousemove ${x} ${y} click ${dbl} ${btn}`, { timeout: 3000 });
      } else if (msg.type === "mouse-scroll") {
        const btn = (msg.delta ?? 1) > 0 ? "4" : "5";
        const cnt = Math.abs(Math.round(msg.delta ?? 3));
        await run(`xdotool click --repeat ${cnt} ${btn}`, { timeout: 3000 });
      }
    }
  } catch (e) {
    console.error(`  Mouse error (${msg.type}): ${e.message}`);
  }
}

// ── System Stats & Monitor ─────────────────────────────────────────────────────

// CPU% — two-sample approach (compares cpu times over ~600ms interval)
function _cpuTimes() {
  const cpus = os.cpus();
  let total = 0, idle = 0;
  for (const c of cpus) {
    for (const v of Object.values(c.times)) total += v;
    idle += c.times.idle;
  }
  return { total, idle };
}
let _prevCpu = _cpuTimes();

function getCpuPct() {
  return new Promise((resolve) => {
    setTimeout(() => {
      const curr = _cpuTimes();
      const tDiff = curr.total - _prevCpu.total;
      const iDiff = curr.idle  - _prevCpu.idle;
      _prevCpu = curr;
      const pct = tDiff > 0 ? Math.round((1 - iDiff / tDiff) * 100) : 0;
      resolve(Math.max(0, Math.min(100, pct)));
    }, 600);
  });
}

async function getDiskStats() {
  try {
    if (platform === "win32") {
      // Get all local drives quickly
      const raw = await run(
        `powershell -NoProfile -c "Get-PSDrive -PSProvider FileSystem | ForEach-Object { $_.Name+':'+($_.Used+$_.Free)+':'+$_.Free } | Where-Object { $_ -match '^[A-Z]:' }"`,
        { timeout: 6000 }
      );
      return raw.split("\n")
        .map(l => l.trim()).filter(Boolean)
        .map(l => {
          const parts = l.split(":");
          // label:total:free  e.g. "C:200000000:50000000"
          const label = parts[0] + ":";
          const total = parseInt(parts[1]);
          const free  = parseInt(parts[2]);
          return { label, total, free };
        })
        .filter(d => !isNaN(d.total) && !isNaN(d.free) && d.total > 0);
    } else {
      const raw = await run(`df -k / | awk 'NR==2{print $2,$4}'`, { timeout: 5000 });
      const [blocks, avail] = raw.trim().split(/\s+/).map(Number);
      if (!isNaN(blocks) && !isNaN(avail)) {
        return [{ label: "/", total: blocks * 1024, free: avail * 1024 }];
      }
    }
  } catch {}
  return null;
}

async function getProcessList() {
  try {
    if (platform === "win32") {
      const raw = await run(
        `powershell -NoProfile -c "Get-Process | Sort-Object WS -Descending | Select-Object -First 15 Name,CPU,WS,Id | ConvertTo-Csv -NoTypeInformation"`,
        { timeout: 8000 }
      );
      return raw.split("\n").filter(Boolean).slice(1).map(line => {
        const cols = line.replace(/\r/g, "").split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/"/g, "").trim());
        return { name: cols[0] || "?", cpu: parseFloat(cols[1]) || 0, mem: parseInt(cols[2]) || 0, pid: parseInt(cols[3]) || 0 };
      }).filter(p => p.name && p.name !== "?" && p.mem > 0);
    } else {
      const raw = await run(`ps aux --sort=-%mem 2>/dev/null | head -16 | tail -15 || ps aux | head -16 | tail -15`, { timeout: 8000 });
      return raw.split("\n").filter(Boolean).map(line => {
        const parts = line.trim().split(/\s+/);
        const name  = (parts.slice(10).join(" ") || parts[10] || "?").replace(/^.*\//, "").substring(0, 30);
        return { name, cpu: parseFloat(parts[2]) || 0, mem: parseInt(parts[5]) * 1024 || 0, pid: parseInt(parts[1]) || 0 };
      }).filter(p => p.name && p.mem > 0);
    }
  } catch { return []; }
}

async function sendSystemStats(ws) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    const [cpu, disk, processes] = await Promise.all([getCpuPct(), getDiskStats(), getProcessList()]);
    const totalMem = os.totalmem();
    const freeMem  = os.freemem();
    ws.send(JSON.stringify({
      type: "system-stats",
      stats: {
        cpu,
        ram: { total: totalMem, free: freeMem, used: totalMem - freeMem, pct: Math.round((totalMem - freeMem) / totalMem * 100) },
        disk,
        uptime: os.uptime(),
        platform,
        hostname,
      },
    }));
    ws.send(JSON.stringify({ type: "process-list", processes }));
  } catch (e) {
    console.error("Stats error:", e.message);
  }
}

// ── Terminal exec handler ──────────────────────────────────────────────────────
async function handleTerminalExec(execId, command, ws) {
  console.log(`  ▶ Terminal [${execId.slice(-6)}]: ${command.substring(0, 60)}`);
  try {
    const output = await run(command, { timeout: 28000, shell: true });
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "exec-result", execId, output, exitCode: 0 }));
    }
  } catch (err) {
    const output = (err.stderr || err.stdout || err.message || String(err)).substring(0, 8000);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "exec-result", execId, output, exitCode: err.code || 1, error: true }));
    }
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

  let statsTimer = null;

  ws.on("open", () => {
    reconnectDelay = 2000;
    console.log("✅ Connected to StreamDeck server!\n");
    ws.send(JSON.stringify({
      type: "identify",
      platform,
      hostname,
      version: "1.0.0",
    }));
    // Start sending system stats immediately, then every 4s
    sendSystemStats(ws);
    statsTimer = setInterval(() => sendSystemStats(ws), 4000);
  });

  ws.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.type === "execute" && msg.button) {
      handleExecute(msg.button);
    } else if (msg.type === "hello") {
      console.log(`  Agent ID: ${msg.agentId}`);
    } else if (msg.type === "terminal-exec" && msg.execId && msg.command) {
      handleTerminalExec(String(msg.execId), String(msg.command), ws);
    } else if (msg.type === "stream-start") {
      if (!streamTimer) {
        console.log("  📹 Live stream started");
        captureFrame(ws);
        streamTimer = setInterval(() => captureFrame(ws), 450); // ~2fps
      }
    } else if (msg.type === "stream-stop") {
      if (streamTimer) { clearInterval(streamTimer); streamTimer = null; }
      frameCapturing = false;
      console.log("  📹 Live stream stopped");
    } else if (["mouse-move", "mouse-click", "mouse-scroll"].includes(msg.type)) {
      handleMouseControl(msg);
    }
  });

  ws.on("close", () => {
    if (statsTimer)  { clearInterval(statsTimer);  statsTimer  = null; }
    if (streamTimer) { clearInterval(streamTimer); streamTimer = null; frameCapturing = false; }
    console.log(`\n⚠️  Disconnected. Reconnecting in ${reconnectDelay / 1000}s…`);
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  });

  ws.on("error", (err) => {
    console.error(`❌ WebSocket error: ${err.message}`);
  });
}

connect();
