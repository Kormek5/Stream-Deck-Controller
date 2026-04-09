import { useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api";

export interface SystemStats {
  cpu: number;
  ram: { total: number; free: number; used: number; pct: number };
  disk: Array<{ label: string; total: number; free: number }> | null;
  uptime: number;
  platform: string;
  hostname: string;
}

export function useSystemStats() {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    const url = getApiUrl("api/monitor/stats/stream");
    let es: EventSource;

    function connect() {
      es = new EventSource(url);
      es.onmessage = (e) => {
        try { setStats(JSON.parse(e.data) as SystemStats); } catch {}
      };
      es.onerror = () => {
        es.close();
        setTimeout(connect, 5000);
      };
    }

    connect();
    return () => es?.close();
  }, []);

  return stats;
}
