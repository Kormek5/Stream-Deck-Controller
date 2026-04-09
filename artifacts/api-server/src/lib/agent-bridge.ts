import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "http";
import { logger } from "./logger";

interface AgentInfo {
  ws: WebSocket;
  id: string;
  platform: string;
  hostname: string;
  connectedAt: Date;
}

const agents = new Map<string, AgentInfo>();
let nextId = 1;

export function getAgents(): AgentInfo[] {
  return Array.from(agents.values());
}

export function getAgentCount(): number {
  return agents.size;
}

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

export function attachWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/api/ws/agent" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const id = `agent-${nextId++}`;
    const agent: AgentInfo = {
      ws,
      id,
      platform: "unknown",
      hostname: "unknown",
      connectedAt: new Date(),
    };

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
        }
      } catch {
        logger.warn({ id }, "Invalid agent message");
      }
    });

    ws.on("close", () => {
      agents.delete(id);
      logger.info({ id }, "Agent disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ id, err }, "Agent WebSocket error");
      agents.delete(id);
    });
  });

  logger.info("WebSocket agent bridge attached at /api/ws/agent");
  return wss;
}
