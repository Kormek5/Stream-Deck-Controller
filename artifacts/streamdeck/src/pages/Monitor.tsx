import { useState, useRef, useEffect } from "react";
import { useSystemStats } from "@/hooks/useSystemStats";
import { useProcessList } from "@/hooks/useProcessList";
import { getApiUrl } from "@/lib/api";
import { Monitor as MonitorIcon, Cpu, MemoryStick, HardDrive, Clock, Terminal, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function fmtBytes(bytes: number) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + " MB";
  return (bytes / 1e3).toFixed(0) + " KB";
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function UsageBar({ pct, color = "primary" }: { pct: number; color?: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          color === "red" ? "bg-red-500" :
          color === "yellow" ? "bg-yellow-500" :
          color === "green" ? "bg-green-500" :
          "bg-primary"
        )}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function cpuColor(pct: number) {
  if (pct > 80) return "red";
  if (pct > 60) return "yellow";
  return "green";
}

interface TermEntry { cmd: string; output: string; exitCode: number; error?: boolean; ts: Date }

export function Monitor() {
  const stats = useSystemStats();
  const processes = useProcessList();

  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<TermEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  async function runCmd() {
    const command = cmd.trim();
    if (!command || running) return;
    setCmd("");
    setHistIdx(-1);
    setCmdHistory(h => [command, ...h.slice(0, 49)]);
    setRunning(true);
    try {
      const res = await fetch(getApiUrl("api/monitor/exec"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const data = await res.json() as { output?: string; exitCode?: number; error?: boolean; error_msg?: string };
      if (!res.ok) {
        setHistory(h => [...h, { cmd: command, output: (data as any).error || "Request failed", exitCode: 1, error: true, ts: new Date() }]);
      } else {
        setHistory(h => [...h, { cmd: command, output: data.output ?? "", exitCode: data.exitCode ?? 0, error: data.error, ts: new Date() }]);
      }
    } catch (e: any) {
      setHistory(h => [...h, { cmd: command, output: e.message, exitCode: 1, error: true, ts: new Date() }]);
    } finally {
      setRunning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { runCmd(); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(next);
      setCmd(cmdHistory[next] ?? "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = histIdx - 1;
      if (next < 0) { setHistIdx(-1); setCmd(""); }
      else { setHistIdx(next); setCmd(cmdHistory[next] ?? ""); }
    }
  }

  const noAgent = !stats && processes.length === 0;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-mono text-primary uppercase tracking-tight mb-1 flex items-center gap-3">
          <MonitorIcon className="w-8 h-8" />
          Monitor
        </h1>
        <p className="text-muted-foreground text-sm">
          {noAgent
            ? "Агент не подключён — запусти агента на ПК для мониторинга"
            : `${stats?.hostname ?? "?"} · ${stats?.platform ?? "?"}`
          }
        </p>
      </div>

      {noAgent && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-muted-foreground">
          ⚠️ Подключи агент через страницу <span className="text-foreground font-medium">Settings</span> чтобы видеть данные мониторинга.
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        {/* CPU */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Cpu className="w-4 h-4" />
              <span className="text-xs font-mono uppercase tracking-wide">CPU</span>
            </div>
            <span className="text-2xl font-bold font-mono text-foreground">
              {stats ? `${stats.cpu}%` : "—"}
            </span>
          </div>
          <UsageBar pct={stats?.cpu ?? 0} color={cpuColor(stats?.cpu ?? 0)} />
        </div>

        {/* RAM */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MemoryStick className="w-4 h-4" />
              <span className="text-xs font-mono uppercase tracking-wide">RAM</span>
            </div>
            <span className="text-2xl font-bold font-mono text-foreground">
              {stats ? `${stats.ram.pct}%` : "—"}
            </span>
          </div>
          <UsageBar pct={stats?.ram.pct ?? 0} color={cpuColor(stats?.ram.pct ?? 0)} />
          {stats && (
            <p className="text-xs text-muted-foreground font-mono">
              {fmtBytes(stats.ram.used)} / {fmtBytes(stats.ram.total)}
            </p>
          )}
        </div>

        {/* Disk */}
        {stats?.disk && stats.disk.length > 0 && stats.disk.map(d => {
          const usedBytes = d.total - d.free;
          const pct = Math.round(usedBytes / d.total * 100);
          return (
            <div key={d.label} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <HardDrive className="w-4 h-4" />
                  <span className="text-xs font-mono uppercase tracking-wide">Disk {d.label}</span>
                </div>
                <span className="text-2xl font-bold font-mono text-foreground">{pct}%</span>
              </div>
              <UsageBar pct={pct} color={cpuColor(pct)} />
              <p className="text-xs text-muted-foreground font-mono">
                {fmtBytes(usedBytes)} / {fmtBytes(d.total)}
              </p>
            </div>
          );
        })}

        {/* Uptime */}
        {stats && (
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs font-mono uppercase text-muted-foreground tracking-wide">Uptime</p>
              <p className="text-xl font-bold font-mono text-foreground">{fmtUptime(stats.uptime)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Process list */}
      {processes.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-muted-foreground tracking-wide">Top Processes</span>
            <Badge variant="secondary" className="text-xs">{processes.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-right px-3 py-2">CPU</th>
                  <th className="text-right px-4 py-2">Memory</th>
                </tr>
              </thead>
              <tbody>
                {processes.slice(0, 15).map((p, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-1.5 truncate max-w-[160px]">
                      <span className="text-foreground">{p.name}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <span className={p.cpu > 50 ? "text-red-400" : p.cpu > 20 ? "text-yellow-400" : "text-muted-foreground"}>
                        {p.cpu > 0 ? p.cpu.toFixed(1) + "%" : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-right text-muted-foreground">
                      {fmtBytes(p.mem)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Terminal */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono uppercase text-muted-foreground tracking-wide">Terminal</span>
          </div>
          {history.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setHistory([])}>
              <Trash2 className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Output */}
        <div
          ref={terminalRef}
          className="h-64 overflow-y-auto p-3 space-y-3 bg-black/40 font-mono text-xs"
          onClick={() => inputRef.current?.focus()}
        >
          {history.length === 0 && (
            <p className="text-muted-foreground/50 italic">
              Введи команду ниже — она выполнится на ПК с подключённым агентом.
            </p>
          )}
          {history.map((entry, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-primary">$</span>
                <span className="text-foreground">{entry.cmd}</span>
                <span className="ml-auto text-muted-foreground/40 text-[10px]">
                  {entry.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
              {entry.output && (
                <pre className={cn(
                  "whitespace-pre-wrap break-all pl-3 text-[11px] leading-relaxed",
                  entry.error ? "text-red-400" : "text-green-300/80"
                )}>
                  {entry.output}
                </pre>
              )}
              {!entry.error && entry.exitCode !== 0 && (
                <p className="pl-3 text-yellow-500 text-[10px]">exit code: {entry.exitCode}</p>
              )}
            </div>
          ))}
          {running && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="animate-pulse">▌</span>
              <span>Running…</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-black/20">
          <span className="text-primary font-mono text-sm shrink-0">$</span>
          <Input
            ref={inputRef}
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={noAgent ? "Агент не подключён" : "echo Hello  |  tasklist  |  ls -la"}
            disabled={noAgent || running}
            className="flex-1 bg-transparent border-0 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0 px-0"
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={noAgent || running || !cmd.trim()}
            onClick={runCmd}
            className="shrink-0 h-7 px-2"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
