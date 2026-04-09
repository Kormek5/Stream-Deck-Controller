# StreamDeck Local Agent

Runs on your PC and executes real system commands when buttons are pressed.

## Quick Start

```bash
# 1. Install the one dependency
npm install

# 2. Start the agent (replace with your StreamDeck server URL)
node agent.js --server https://your-app.replit.app

# Or for local development:
node agent.js --server http://localhost:3001
```

The agent will auto-reconnect if the connection drops.

## What it can do

| Action Type | What happens on your PC |
|-------------|------------------------|
| Open URL | Opens in your default browser |
| Hotkey | Sends keyboard shortcut to OS |
| Script | Runs shell command / script |
| Launch App | Opens the application |
| Media Control | Play/Pause/Next/Volume via OS media keys |
| System | Lock, Sleep, Shutdown, Screenshot, etc. |
| Zoom | Mute/video/screenshare via Zoom hotkeys |
| Discord | Mute/deafen via Discord hotkeys |
| Slack | Open channels, DND toggle |
| Spotify | Playback control via Spotify hotkeys |
| VS Code | Editor commands via hotkeys |
| Teams | Meeting controls via Teams hotkeys |
| All others | Opens the app's URL scheme or website |

## Requirements

- Node.js 18+
- `npm install` (installs `ws` WebSocket client)
- Platform: Windows, macOS, or Linux

## Compile to a single executable (optional)

```bash
npm install -g pkg
pkg agent.js --targets node18-win-x64,node18-mac-x64,node18-linux-x64
```

This creates standalone `.exe` / binary files that don't need Node.js installed.
