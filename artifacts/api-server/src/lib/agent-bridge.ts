import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { logger } from "./logger";

interface AgentInfo {
  ws: WebSocket;
  id: string;
  platform: string;
  hostname: string;
  connectedAt: Date;
}

interface Screenshot {
  data: string;
  timestamp: string;
}

export interface SystemStats {
  cpu: number;
  ram: { total: number; free: number; used: number; pct: number };
  disk: Array<{ label: string; total: number; free: number }> | null;
  uptime: number;
  platform: string;
  hostname: string;
}

export interface ProcessInfo {
  name: string;
  cpu: number;
  mem: number;
  pid?: number;
}

interface ExecResult {
  output: string;
  exitCode: number;
  error?: boolean;
}

const agents = new Map<string, AgentInfo>();
let nextId = 1;

let latestScreenshot: Screenshot | null = null;
let latestSystemStats: SystemStats | null = null;
let latestProcessList: ProcessInfo[] | null = null;

const sseScreenshotClients = new Set<ServerResponse>();
const sseStatsClients     = new Set<ServerResponse>();
const sseProcessClients   = new Set<ServerResponse>();

const pendingExecs = new Map<string, { resolve: (v: ExecResult) => void; timer: NodeJS.Timeout }>();

// ── Getters ───────────────────────────────────────────────────────────────────
export function getAgents() { return Array.from(agents.values()); }
export function getAgentCount() { return agents.size; }
export function getLatestScreenshot() { return latestScreenshot; }
export function getLatestSystemStats() { return latestSystemStats; }
export function getLatestProcessList() { return latestProcessList; }

// ── SSE subscriptions ─────────────────────────────────────────────────────────
export function subscribeToScreenshots(res: ServerResponse) {
  sseScreenshotClients.add(res);
  return () => sseScreenshotClients.delete(res);
}
export function subscribeToSystemStats(res: ServerResponse) {
  sseStatsClients.add(res);
  return () => sseStatsClients.delete(res);
}
export function subscribeToProcessList(res: ServerResponse) {
  sseProcessClients.add(res);
  return () => sseProcessClients.delete(res);
}

function pushSse(clients: Set<ServerResponse>, data: unknown) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

// ── Terminal exec ─────────────────────────────────────────────────────────────
export function executeTerminalCommand(command: string): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    if (agents.size === 0) {
      reject(new Error("No agent connected"));
      return;
    }
    const execId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timer = setTimeout(() => {
      pendingExecs.delete(execId);
      resolve({ output: "⚠️  Timeout: command took longer than 30 s", exitCode: 124, error: true });
    }, 30000);
    pendingExecs.set(execId, { resolve, timer });
    sendToAllAgents({ type: "terminal-exec", execId, command });
  });
}

// ── Send to agents ────────────────────────────────────────────────────────────
export function sendToAllAgents(message: object): number {
  const payload = JSON.stringify(message);
  let sent = 0;
  for (const agent of agents.values()) {
    if (agent.ws.readyState === WebSocket.OPEN) {
      agent.ws.send(payload);
      sent++;
    }
  }
  return sent;
}

// ── WebSocket server ──────────────────────────────────────────────────────────
export function attachWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/api/ws/agent" });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    const id = `agent-${nextId++}`;
    const agent: AgentInfo = { ws, id, platform: "unknown", hostname: "unknown", connectedAt: new Date() };
    agents.set(id, agent);
    logger.info({ id }, "Agent connected");

    ws.send(JSON.stringify({ type: "hello", agentId: id, message: "StreamDeck agent connected" }));

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;

        if (msg.type === "identify") {
          agent.platform = String(msg.platform ?? "unknown");
          agent.hostname = String(msg.hostname ?? "unknown");
          logger.info({ id, platform: agent.platform, hostname: agent.hostname }, "Agent identified");

        } else if (msg.type === "screenshot_result" && typeof msg.data === "string") {
          const shot: Screenshot = {
            data: msg.data,
            timestamp: typeof msg.timestamp === "string" ? msg.timestamp : new Date().toISOString(),
          };
          latestScreenshot = shot;
          logger.info({ id }, "Screenshot received from agent");
          pushSse(sseScreenshotClients, shot);

        } else if (msg.type === "system-stats" && msg.stats) {
          latestSystemStats = msg.stats as SystemStats;
          pushSse(sseStatsClients, latestSystemStats);

        } else if (msg.type === "process-list" && Array.isArray(msg.processes)) {
          latestProcessList = msg.processes as ProcessInfo[];
          pushSse(sseProcessClients, latestProcessList);

        } else if (msg.type === "exec-result" && typeof msg.execId === "string") {
          const pending = pendingExecs.get(msg.execId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingExecs.delete(msg.execId);
            pending.resolve({
              output: String(msg.output ?? ""),
              exitCode: Number(msg.exitCode ?? 0),
              error: Boolean(msg.error),
            });
          }
        }
      } catch {
        logger.warn({ id }, "Invalid agent message");
      }
    });

    ws.on("close", () => { agents.delete(id); logger.info({ id }, "Agent disconnected"); });
    ws.on("error", (err) => { logger.error({ id, err }, "Agent WebSocket error"); agents.delete(id); });
  });

  logger.info("WebSocket agent bridge attached at /api/ws/agent");
  return wss;
}
