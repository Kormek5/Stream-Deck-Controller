#!/usr/bin/env bash
cd "$(dirname "$0")"
SERVER="${1:-}"
if [ -z "$SERVER" ]; then
  echo "Usage: ./start.sh https://your-server.replit.app"
  echo ""
  echo "If you opened from the StreamDeck panel, the URL is shown in Settings - Connect tab."
  echo ""
  read -p "Paste your server URL here: " SERVER
fi
echo ""
echo "Starting StreamDeck Agent..."
node agent.js --server "$SERVER"
