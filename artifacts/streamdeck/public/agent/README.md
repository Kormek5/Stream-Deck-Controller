# StreamDeck Local Agent

Runs on your PC and executes real system commands when buttons are pressed.

## Requirements

- Node.js 18+ — download at https://nodejs.org
- Windows 10+, macOS 12+, or Linux

## Quick Start

> **`node_modules` is already bundled in the ZIP — no `npm install` needed.**

### Windows

1. Extract the ZIP to any folder (e.g. `C:\streamdeck-agent\`)
2. Double-click **`start.bat`**
3. Paste your server URL when prompted (shown in StreamDeck panel → Settings → Connect tab)

Or run from Command Prompt:
```
cd C:\streamdeck-agent
start.bat https://your-server.replit.app
```

### macOS / Linux

1. Extract the ZIP
2. Open Terminal in the extracted folder
3. Run:
```bash
chmod +x start.sh
./start.sh https://your-server.replit.app
```

### Manual (any platform)

```bash
cd path/to/streamdeck-agent
node agent.js --server https://your-server.replit.app
```

**Important:** Always run from inside the extracted folder so Node.js can find the bundled `node_modules/ws`.

## OBS WebSocket (optional)

To control OBS Studio, pass the WebSocket password:

```bash
node agent.js --server https://your-server.replit.app --obs-password yourPassword
```

Enable OBS WebSocket: **OBS → Tools → WebSocket Server Settings → Enable WebSocket server**

## What it can do

| Action Type     | What happens on your PC                           |
|-----------------|---------------------------------------------------|
| Open URL        | Opens in your default browser                     |
| Hotkey          | Sends keyboard shortcut to OS                     |
| Script          | Runs shell command / PowerShell / bash script     |
| Type Text       | Types text via clipboard paste (supports Unicode) |
| Notification    | Shows a system desktop notification               |
| Clipboard       | Copy text / date / time to clipboard, or paste    |
| Launch App      | Opens the application                             |
| Media Control   | Play/Pause/Next/Volume via OS media keys          |
| System          | Lock, Sleep, Shutdown, Screenshot, Record, etc.   |
| OBS             | Start/stop recording, streaming, switch scene     |
| Zoom            | Mute/video/screenshare via Zoom hotkeys           |
| Discord         | Mute/deafen via Discord hotkeys                   |
| Spotify         | Playback control via Spotify hotkeys              |
| VS Code         | Editor commands via hotkeys                       |
| Multi-action    | Sequential steps with per-step delays             |

## Troubleshooting

**`ERROR: 'ws' module not found`**  
You are running `node agent.js` from outside the extracted folder.  
Fix: `cd` into the `streamdeck-agent` folder first, then run `node agent.js`.  
Or simply use `start.bat` (Windows) / `start.sh` (macOS/Linux) — they handle this automatically.

**`Cannot connect to server`**  
Check that the StreamDeck panel is running and the URL is correct (Settings → Connect tab).
