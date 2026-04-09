@echo off
cd /d "%~dp0"
title StreamDeck Agent Setup

echo ====================================
echo   StreamDeck Local Agent
echo ====================================
echo.

if NOT "%1"=="" (
  set SERVER=%1
  goto run
)

echo BEST WAY: Get a pre-configured script from the StreamDeck panel:
echo   1. Open the StreamDeck panel in your browser
echo   2. Go to Settings page
echo   3. Click "Windows - start-agent.bat" button
echo   4. Save it here (same folder as agent.js)
echo   5. Run that file instead - it already has the correct URL
echo.
echo MANUAL WAY: Type the URL of your StreamDeck panel below.
echo   Example: https://your-app.replit.app
echo   (This is the address you open in your browser to use the panel)
echo.
set /p SERVER="Server URL: "

:run
if "%SERVER%"=="" (
  echo No URL entered. Exiting.
  pause
  exit /b 1
)

echo.
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: Node.js is not installed.
  echo Download from https://nodejs.org and install, then run this file again.
  start https://nodejs.org
  pause
  exit /b 1
)

echo Starting agent...
echo Server: %SERVER%
echo.
echo Agent is running! Do NOT close this window.
echo To stop - press Ctrl+C
echo.
node agent.js --server %SERVER%
pause
