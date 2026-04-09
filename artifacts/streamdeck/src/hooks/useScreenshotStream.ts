import { useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/lib/api";

export interface Screenshot {
  data: string;      // data:image/png;base64,...
  timestamp: string; // ISO string
}

/**
 * Subscribes to the screenshot SSE stream.
 * onNew is called only for screenshots that arrive AFTER the initial connection.
 */
export function useScreenshotStream(onNew?: (s: Screenshot) => void) {
  const [latest, setLatest] = useState<Screenshot | null>(null);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  useEffect(() => {
    const url = getApiUrl("api/screenshot/stream");
    let es: EventSource;
    let isFirstMessage = true;

    function connect() {
      es = new EventSource(url);

      es.onmessage = (e) => {
        try {
          const shot = JSON.parse(e.data) as Screenshot;
          setLatest(shot);
          if (!isFirstMessage && onNewRef.current) {
            onNewRef.current(shot);
          }
          isFirstMessage = false;
        } catch {}
      };

      es.onerror = () => {
        es.close();
        // Reconnect after 5 seconds
        setTimeout(connect, 5000);
      };
    }

    connect();
    return () => es?.close();
  }, []);

  return latest;
}
