@echo off
cd /d "%~dp0"
if "%1"=="" (
  echo Usage: start.bat https://your-server.replit.app
  echo.
  echo If you opened from the StreamDeck panel, the URL is shown in Settings - Connect tab.
  echo.
  set /p SERVER="Paste your server URL here: "
) else (
  set SERVER=%1
)
echo.
echo Starting StreamDeck Agent...
node agent.js --server %SERVER%
pause
