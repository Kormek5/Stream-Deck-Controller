import { useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api";

export interface ProcessInfo {
  name: string;
  cpu: number;
  mem: number;
  pid?: number;
}

export function useProcessList() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);

  useEffect(() => {
    const url = getApiUrl("api/monitor/process/stream");
    let es: EventSource;

    function connect() {
      es = new EventSource(url);
      es.onmessage = (e) => {
        try { setProcesses(JSON.parse(e.data) as ProcessInfo[]); } catch {}
      };
      es.onerror = () => {
        es.close();
        setTimeout(connect, 5000);
      };
    }

    connect();
    return () => es?.close();
  }, []);

  return processes;
}
