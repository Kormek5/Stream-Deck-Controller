import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Settings as SettingsIcon, Monitor, Wifi, Volume2,
  Terminal, Download, CheckCircle2, XCircle, RefreshCw, Video, Copy, Check,
} from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface AgentStatus {
  connected: boolean;
  count: number;
  agents: Array<{
    id: string;
    platform: string;
    hostname: string;
    connectedAt: string;
  }>;
}

function platformIcon(platform: string) {
  if (platform.includes("win")) return "🪟";
  if (platform.includes("darwin")) return "🍎";
  if (platform.includes("linux")) return "🐧";
  return "💻";
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Settings() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [obsPassword, setObsPassword] = useState(() => localStorage.getItem("obs_ws_password") || "");
  const [obsPort, setObsPort] = useState(() => localStorage.getItem("obs_ws_port") || "4455");
  const [urlCopied, setUrlCopied] = useState(false);

  function saveObsConfig() {
    localStorage.setItem("obs_ws_password", obsPassword);
    localStorage.setItem("obs_ws_port", obsPort);
  }

  async function fetchStatus() {
    try {
      const res = await fetch(getApiUrl("api/agent-status"));
      if (!res.ok) return;
      setAgentStatus(await res.json());
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, []);

  const serverUrl = window.location.origin.replace(/\/$/, "");

  function copyServerUrl() {
    navigator.clipboard.writeText(serverUrl).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    });
  }

  function downloadBat() {
    // ASCII ONLY - no Cyrillic, no Unicode - guaranteed to work on any Windows
    const obsArgs = obsPassword
      ? ` --obs-password ${obsPassword}${obsPort !== "4455" ? ` --obs-port ${obsPort}` : ""}`
      : (obsPort !== "4455" ? ` --obs-port ${obsPort}` : "");
    const content = `@echo off
cd /d "%~dp0"
title StreamDeck Agent

echo ====================================
echo   StreamDeck Local Agent - Windows
echo ====================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: Node.js is not installed.
  echo.
  echo Download from https://nodejs.org
  echo Click the big LTS button, install, then run this file again.
  echo.
  start https://nodejs.org
  pause
  exit /b 1
)

echo Starting agent...
echo Server: ${serverUrl}
echo.
echo Agent is running! Do not close this window.
echo To stop - press Ctrl+C
echo.
node agent.js --server ${serverUrl}${obsArgs}
pause
`;
    downloadBlob(content, "start-agent.bat", "application/bat");
  }

  function downloadSh() {
    const content = `#!/bin/bash
echo "===================================="
echo "  StreamDeck Local Agent — Mac/Linux"
echo "===================================="
echo

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "[ОШИБКА] Node.js не установлен!"
  echo
  echo "Mac: установи через https://nodejs.org или: brew install node"
  echo "Linux: sudo apt install nodejs npm"
  exit 1
fi

echo "[1/2] Устанавливаю зависимости..."
npm install || { echo "[ОШИБКА] npm install не удался"; exit 1; }

echo
echo "[2/2] Запускаю агента..."
echo "Сервер: ${serverUrl}"
echo
echo "Агент подключён. Не закрывай это окно!"
echo "Чтобы остановить — нажми Ctrl+C"
echo
node agent.js --server ${serverUrl}
`;
    downloadBlob(content, "start-agent.sh", "application/x-sh");
  }

  function downloadVbs() {
    const obsArgs = obsPassword
      ? ` --obs-password ${obsPassword}${obsPort !== "4455" ? ` --obs-port ${obsPort}` : ""}`
      : (obsPort !== "4455" ? ` --obs-port ${obsPort}` : "");
    // VBScript: запускает node agent.js скрытно (нет окна) через wscript.exe
    const content = `' StreamDeck Agent — Silent Background Mode
' Runs the agent with NO visible terminal window.
' To stop: open Task Manager -> find node.exe -> End Task
' Or run: taskkill /F /IM node.exe  (from another terminal)

Option Explicit
Dim WshShell, fso, agentDir, cmd

Set WshShell = CreateObject("WScript.Shell")
Set fso      = CreateObject("Scripting.FileSystemObject")

agentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = agentDir

cmd = "cmd /c node agent.js --server ${serverUrl}${obsArgs}"

' Window style 0 = hidden, False = don't wait (fire and forget)
WshShell.Run cmd, 0, False

WScript.Sleep 1500
WshShell.Popup "StreamDeck Agent started in background." & Chr(13) & Chr(10) & _
               "To stop: Task Manager -> node.exe -> End Task", _
               4, "StreamDeck Agent", 64
`;
    downloadBlob(content, "start-agent-silent.vbs", "text/vbscript");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-mono text-primary uppercase tracking-tight mb-2 flex items-center gap-3">
          <SettingsIcon className="w-8 h-8" />
          Configuration
        </h1>
        <p className="text-muted-foreground">System preferences and app settings.</p>
      </div>

      {/* ── Desktop Agent ─────────────────────────────────────────────── */}
      <Card className="bg-card border-border border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-mono uppercase">
            <Terminal className="w-4 h-4 text-primary" />
            Desktop Agent
            {agentStatus !== null && (
              agentStatus.connected
                ? <Badge className="ml-2 bg-green-600 text-white">● {agentStatus.count} connected</Badge>
                : <Badge variant="secondary" className="ml-2 text-muted-foreground">● Offline</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Панель открывается на любом устройстве. Агент нужен только на ПК — чтобы кнопки выполняли реальные действия.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Status row */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
            {agentStatus?.connected
              ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              : <XCircle className="w-5 h-5 text-muted-foreground shrink-0" />
            }
            <div className="flex-1 min-w-0">
              {agentStatus?.connected
                ? <p className="text-sm font-mono text-green-400">Агент подключён — {agentStatus.agents[0]?.hostname}</p>
                : <p className="text-sm font-mono text-muted-foreground">Агент не запущен</p>
              }
              {agentStatus?.agents.map(a => (
                <p key={a.id} className="text-xs text-muted-foreground mt-0.5">
                  {platformIcon(a.platform)} {a.platform} · с {new Date(a.connectedAt).toLocaleTimeString()}
                </p>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={fetchStatus} className="shrink-0">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Phone vs PC note */}
          <div className="flex items-start gap-2 text-xs bg-primary/5 border border-primary/20 rounded-lg p-3">
            <span className="text-base leading-none mt-0.5">📱</span>
            <div className="text-muted-foreground">
              <span className="text-foreground font-medium">Телефон / планшет:</span> просто открой эту страницу в браузере — больше ничего не нужно.<br />
              <span className="text-foreground font-medium">ПК-агент:</span> установи один раз на компьютер, где должны выполняться команды.
            </div>
          </div>

          {/* ─── Server URL box ─── */}
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-1">
            <p className="text-xs font-mono uppercase text-muted-foreground tracking-wide">URL этого сервера (нужен для запуска агента)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-primary bg-black/30 rounded px-2 py-1 truncate select-all">
                {serverUrl}
              </code>
              <Button size="sm" variant="ghost" onClick={copyServerUrl} className="shrink-0 gap-1">
                {urlCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {urlCopied ? "Скопировано" : "Копировать"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Вставь этот URL в <code className="font-mono">start.bat</code> если вводишь вручную.</p>
          </div>

          {/* ─── STEP 0: Node.js ─── */}
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase text-muted-foreground tracking-wide">Шаг 1 — Установи Node.js (один раз)</p>
            <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="block">
              <Button variant="outline" className="w-full gap-2 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 font-mono uppercase py-4 text-sm">
                <Download className="w-4 h-4" />
                Открыть nodejs.org → нажать LTS → установить
              </Button>
            </a>
            <p className="text-xs text-muted-foreground">Если Node.js уже есть — пропусти этот шаг.</p>
          </div>

          {/* ─── STEP 1: Download ZIP ─── */}
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase text-muted-foreground tracking-wide">Шаг 2 — Скачай архив с агентом</p>
            <a href={`${serverUrl}/streamdeck-agent.zip`} download="streamdeck-agent.zip" className="block">
              <Button className="w-full gap-2 font-mono uppercase tracking-wide py-5 text-sm">
                <Download className="w-4 h-4" />
                Скачать streamdeck-agent.zip
              </Button>
            </a>
            <p className="text-xs text-muted-foreground">Распакуй в любую папку на компьютере. Все зависимости уже включены — <code className="font-mono">npm install</code> не нужен.</p>
          </div>

          {/* ─── STEP 3: Download run script ─── */}
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase text-muted-foreground tracking-wide">Шаг 3 — Скачай скрипт запуска и положи в ту же папку</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="gap-2 font-mono border-border py-4 text-sm flex-col h-auto"
                onClick={downloadBat}
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>🪟 Windows</span>
                </div>
                <span className="text-xs text-muted-foreground font-normal normal-case">start-agent.bat</span>
              </Button>
              <Button
                variant="outline"
                className="gap-2 font-mono border-border py-4 text-sm flex-col h-auto"
                onClick={downloadSh}
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>🍎🐧 Mac / Linux</span>
                </div>
                <span className="text-xs text-muted-foreground font-normal normal-case">start-agent.sh</span>
              </Button>
            </div>
          </div>

          {/* ─── STEP 4: Run ─── */}
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 space-y-1">
            <p className="text-xs font-mono uppercase text-muted-foreground tracking-wide">Шаг 4 — Запусти</p>
            <p className="text-sm font-medium">
              🪟 <span className="text-foreground">Windows:</span> двойной клик по <code className="text-primary font-mono">start-agent.bat</code>
            </p>
            <p className="text-sm font-medium">
              🍎 <span className="text-foreground">Mac:</span> правая кнопка по <code className="text-primary font-mono">start-agent.sh</code> → «Открыть»
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Не закрывай появившееся окно — агент должен работать фоном пока ты используешь StreamDeck.
            </p>
          </div>

          {/* ─── Background / Silent start (Windows) ─── */}
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase text-muted-foreground tracking-wide">🔕 Фоновый запуск (без окна) — Windows</p>
            <Button
              variant="outline"
              className="w-full gap-2 font-mono border-border py-4 text-sm flex-col h-auto border-dashed"
              onClick={downloadVbs}
            >
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                <span>🪟 Скачать start-agent-silent.vbs</span>
              </div>
              <span className="text-xs text-muted-foreground font-normal normal-case">
                Агент запустится без терминального окна — можно закрыть explorer
              </span>
            </Button>
            <p className="text-xs text-muted-foreground">
              Положи <code className="font-mono">.vbs</code> файл в ту же папку что и агент.
              Двойной клик — агент запускается скрытно и уведомление исчезнет через 4 секунды.
              Чтобы остановить: <code className="font-mono">Task Manager → node.exe → End Task</code>.
            </p>
          </div>

          {/* Node.js requirement note */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
            <span className="text-base leading-none">⚠️</span>
            <div>
              Нужен <span className="text-foreground font-medium">Node.js 18+</span>.{" "}
              Если агент не запустился — скачай с{" "}
              <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="text-primary underline">nodejs.org</a>{" "}
              (кнопка <strong>LTS</strong>), установи, и запусти скрипт снова.
            </div>
          </div>

        </CardContent>
      </Card>

      {/* ── OBS Studio ─────────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-mono uppercase">
            <Video className="w-4 h-4 text-primary" /> OBS Studio
          </CardTitle>
          <CardDescription>
            Настройки WebSocket для управления OBS (переключение сцен, запись и т.д.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 text-xs bg-primary/5 border border-primary/20 rounded-lg p-3">
            <span className="text-base leading-none mt-0.5">ℹ️</span>
            <div className="text-muted-foreground">
              В OBS: <strong className="text-foreground">Tools → WebSocket Server Settings</strong> → Enable → Set password. По умолчанию порт <code className="font-mono">4455</code>.
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs font-mono uppercase text-muted-foreground">WebSocket Password</Label>
              <Input
                type="password"
                placeholder="Пароль из OBS настроек"
                value={obsPassword}
                onChange={e => setObsPassword(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-mono uppercase text-muted-foreground">Port</Label>
              <Input
                type="number"
                placeholder="4455"
                value={obsPort}
                onChange={e => setObsPort(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            После сохранения — скачай <strong>start-agent.bat</strong> заново, пароль будет включён в скрипт автоматически.
          </p>
          <Button onClick={saveObsConfig} variant="outline" size="sm" className="font-mono uppercase w-full">
            Сохранить конфигурацию OBS
          </Button>
        </CardContent>
      </Card>

      {/* ── Display ─────────────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-mono uppercase">
            <Monitor className="w-4 h-4" /> Display
          </CardTitle>
          <CardDescription>Configure appearance and layout</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-mono uppercase">Show Button Labels</Label>
              <p className="text-sm text-muted-foreground">Display text under icons on the deck</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-mono uppercase">Haptic Feedback</Label>
              <p className="text-sm text-muted-foreground">Vibrate device on button press (mobile only)</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* ── Connection ──────────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-mono uppercase">
            <Wifi className="w-4 h-4" /> Connection
          </CardTitle>
          <CardDescription>Информация о подключении</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-mono uppercase">Auto-reconnect</Label>
              <p className="text-sm text-muted-foreground">Автоматически переподключаться при разрыве</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-mono uppercase text-muted-foreground">URL сервера</Label>
            <code className="block text-xs bg-black/30 rounded px-3 py-2 font-mono text-green-400 break-all">{serverUrl}</code>
          </div>
        </CardContent>
      </Card>

      {/* ── Sound ───────────────────────────────────────────────────────── */}
      <Card className="bg-card border-border opacity-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-mono uppercase">
            <Volume2 className="w-4 h-4" /> Sound
          </CardTitle>
          <CardDescription>Audio feedback — coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-mono uppercase">Press Sound</Label>
              <p className="text-sm text-muted-foreground">Play click sound on action</p>
            </div>
            <Switch disabled />
          </div>
        </CardContent>
      </Card>

      <div className="text-center mt-12 text-muted-foreground text-xs font-mono">
        STREAMDECK WEB v1.0.0
      </div>
    </div>
  );
}
