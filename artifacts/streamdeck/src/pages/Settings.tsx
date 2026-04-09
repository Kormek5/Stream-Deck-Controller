import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Monitor, Wifi, Volume2, Terminal, Download, CheckCircle2, XCircle, RefreshCw, Cpu, Copy } from "lucide-react";
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

export function Settings() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState(false);

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
    setPolling(true);
    const timer = setInterval(fetchStatus, 3000);
    return () => { clearInterval(timer); setPolling(false); };
  }, []);

  // Build the public server URL for the agent to connect to
  const serverUrl = window.location.origin.replace(/\/$/, "");
  const agentDownloadUrl = `${serverUrl}/agent/agent.js`;
  const agentPkgUrl = `${serverUrl}/agent/package.json`;

  function copyCommand() {
    const cmd = `node agent.js --server ${serverUrl}`;
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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

      {/* ── Desktop Agent ─────────────────────────────────────────────────── */}
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
            The StreamDeck panel opens on any device — phone, tablet, PC. To execute real system commands (hotkeys, apps, media keys), also run the agent on your PC.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Status */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
            {agentStatus?.connected
              ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              : <XCircle className="w-5 h-5 text-muted-foreground shrink-0" />
            }
            <div className="flex-1 min-w-0">
              {agentStatus?.connected
                ? <p className="text-sm font-mono text-green-400">Agent running on {agentStatus.agents[0]?.hostname || "your PC"}</p>
                : <p className="text-sm font-mono text-muted-foreground">No agent connected</p>
              }
              {agentStatus?.agents.map(a => (
                <p key={a.id} className="text-xs text-muted-foreground mt-0.5">
                  {platformIcon(a.platform)} {a.hostname} ({a.platform}) · connected {new Date(a.connectedAt).toLocaleTimeString()}
                </p>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={fetchStatus} className="shrink-0">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Architecture note */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg p-3">
            <span className="text-lg leading-none">📱</span>
            <div>
              <span className="text-foreground font-medium">Phone / tablet:</span> just open this URL in any browser — no setup needed.<br />
              <span className="text-foreground font-medium">PC agent:</span> install once on the computer where commands should run.
            </div>
          </div>

          {/* Download + steps */}
          <div className="space-y-3">
            {/* Big download button */}
            <a href={`${serverUrl}/streamdeck-agent.zip`} download="streamdeck-agent.zip" className="block">
              <Button className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-mono uppercase tracking-wide py-5 text-base">
                <Download className="w-5 h-5" />
                Скачать агент (.zip)
              </Button>
            </a>
            <p className="text-xs text-muted-foreground text-center">
              Архив со всеми нужными файлами · Requires <span className="text-foreground">Node.js 18+</span>
            </p>

            {/* Steps */}
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-mono uppercase text-muted-foreground tracking-wide">После скачивания:</p>

              <div className="rounded-lg border border-border bg-muted/10 divide-y divide-border/50">
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs font-mono bg-primary/20 text-primary rounded px-1.5 py-0.5 shrink-0">1</span>
                  <p className="text-sm">Распакуй архив в любую папку на ПК</p>
                </div>
                <div className="flex items-start gap-3 px-4 py-2.5">
                  <span className="text-xs font-mono bg-primary/20 text-primary rounded px-1.5 py-0.5 shrink-0 mt-0.5">2</span>
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-sm">Открой терминал в этой папке и выполни:</p>
                    <code className="block text-xs bg-black/40 rounded px-3 py-2 font-mono text-green-400">npm install</code>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-4 py-2.5">
                  <span className="text-xs font-mono bg-primary/20 text-primary rounded px-1.5 py-0.5 shrink-0 mt-0.5">3</span>
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-sm">Запусти агента:</p>
                    <div className="flex items-center gap-1">
                      <code className="flex-1 text-xs bg-black/40 rounded px-3 py-2 font-mono text-green-400 break-all min-w-0">
                        node agent.js --server {serverUrl}
                      </code>
                      <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={copyCommand}>
                        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
          <CardDescription>API connection settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-mono uppercase">Auto-reconnect</Label>
              <p className="text-sm text-muted-foreground">Automatically retry connection on drop</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-mono uppercase text-muted-foreground">Server URL</Label>
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
          <CardDescription>Audio feedback settings (Coming soon)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
