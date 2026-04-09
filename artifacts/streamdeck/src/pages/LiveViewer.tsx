import { useEffect, useRef, useState, useCallback } from "react";
import { getApiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Monitor, MousePointer2, MousePointerBan, Loader2, Wifi, WifiOff, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Frame {
  data: string;
  width: number;
  height: number;
  timestamp: number;
}

const MOUSE_THROTTLE_MS = 80;

export function LiveViewer() {
  const [streaming, setStreaming]     = useState(false);
  const [frame, setFrame]             = useState<Frame | null>(null);
  const [mouseEnabled, setMouseEnabled] = useState(true);
  const [fps, setFps]                 = useState(0);
  const [fullscreen, setFullscreen]   = useState(false);

  const imgRef      = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMouseSend = useRef(0);
  const fpsCount    = useRef(0);
  const fpsTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const esRef       = useRef<EventSource | null>(null);

  // ── SSE frame stream ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!streaming) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    const url = getApiUrl("api/monitor/frame/stream");
    let es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const f = JSON.parse(e.data) as Frame;
        if (f.data) {
          setFrame(f);
          fpsCount.current++;
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      if (streaming) {
        setTimeout(() => {
          const newEs = new EventSource(url);
          esRef.current = newEs;
          newEs.onmessage = es.onmessage;
          newEs.onerror  = es.onerror;
        }, 2000);
      }
    };

    fpsTimer.current = setInterval(() => {
      setFps(fpsCount.current);
      fpsCount.current = 0;
    }, 1000);

    return () => {
      es.close();
      if (fpsTimer.current) clearInterval(fpsTimer.current);
    };
  }, [streaming]);

  // ── Stream control ──────────────────────────────────────────────────────────
  async function toggleStream() {
    if (streaming) {
      await fetch(getApiUrl("api/monitor/stream/stop"),  { method: "POST" });
      setStreaming(false);
      setFrame(null);
      setFps(0);
    } else {
      await fetch(getApiUrl("api/monitor/stream/start"), { method: "POST" });
      setStreaming(true);
    }
  }

  // ── Mouse helpers ────────────────────────────────────────────────────────────
  function toScreenCoords(e: React.MouseEvent | React.Touch, el: HTMLImageElement, f: Frame) {
    const rect = el.getBoundingClientRect();
    const clientX = "clientX" in e ? e.clientX : e.clientX;
    const clientY = "clientY" in e ? e.clientY : e.clientY;
    const x = Math.round(((clientX - rect.left) / rect.width)  * f.width);
    const y = Math.round(((clientY - rect.top)  / rect.height) * f.height);
    return { x: Math.max(0, Math.min(x, f.width)), y: Math.max(0, Math.min(y, f.height)) };
  }

  async function sendMouse(payload: object) {
    try {
      await fetch(getApiUrl("api/monitor/mouse"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {}
  }

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!mouseEnabled || !frame || !imgRef.current) return;
    const now = Date.now();
    if (now - lastMouseSend.current < MOUSE_THROTTLE_MS) return;
    lastMouseSend.current = now;
    const { x, y } = toScreenCoords(e, imgRef.current, frame);
    sendMouse({ type: "mouse-move", x, y });
  }, [mouseEnabled, frame]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!mouseEnabled || !frame || !imgRef.current) return;
    e.preventDefault();
    const btn = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
    const { x, y } = toScreenCoords(e, imgRef.current, frame);
    sendMouse({ type: "mouse-click", x, y, button: btn });
  }, [mouseEnabled, frame]);

  const handleDblClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!mouseEnabled || !frame || !imgRef.current) return;
    const { x, y } = toScreenCoords(e, imgRef.current, frame);
    sendMouse({ type: "mouse-click", x, y, button: "double" });
  }, [mouseEnabled, frame]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLImageElement>) => {
    if (!mouseEnabled || !frame || !imgRef.current) return;
    e.preventDefault();
    const { x, y } = toScreenCoords(e, imgRef.current, frame);
    const delta = e.deltaY < 0 ? 3 : -3;
    sendMouse({ type: "mouse-scroll", x, y, delta });
  }, [mouseEnabled, frame]);

  // ── Touch → mouse (mobile) ──────────────────────────────────────────────────
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLImageElement>) => {
    if (!mouseEnabled || !frame || !imgRef.current) return;
    const now = Date.now();
    if (now - lastMouseSend.current < MOUSE_THROTTLE_MS) return;
    lastMouseSend.current = now;
    const touch = e.touches[0];
    const rect  = imgRef.current.getBoundingClientRect();
    const x = Math.round(((touch.clientX - rect.left) / rect.width)  * frame.width);
    const y = Math.round(((touch.clientY - rect.top)  / rect.height) * frame.height);
    sendMouse({ type: "mouse-move", x: Math.max(0, x), y: Math.max(0, y) });
  }, [mouseEnabled, frame]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLImageElement>) => {
    if (!mouseEnabled || !frame || !imgRef.current) return;
    const touch = e.changedTouches[0];
    const rect  = imgRef.current.getBoundingClientRect();
    const x = Math.round(((touch.clientX - rect.left) / rect.width)  * frame.width);
    const y = Math.round(((touch.clientY - rect.top)  / rect.height) * frame.height);
    sendMouse({ type: "mouse-click", x: Math.max(0, x), y: Math.max(0, y), button: "left" });
  }, [mouseEnabled, frame]);

  // ── Fullscreen ───────────────────────────────────────────────────────────────
  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-3 shrink-0 bg-card/80 backdrop-blur">
        <Monitor className="w-5 h-5 text-primary shrink-0" />
        <h2 className="font-mono font-bold uppercase tracking-wide text-sm flex-1">Live Remote</h2>

        {streaming && (
          <div className="flex items-center gap-3 text-xs font-mono">
            {frame && (
              <span className="text-muted-foreground">{frame.width}×{frame.height}</span>
            )}
            <span className={cn(
              "flex items-center gap-1",
              fps > 0 ? "text-green-400" : "text-yellow-400"
            )}>
              {fps > 0 ? <Wifi className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
              {fps > 0 ? `${fps} fps` : "connecting…"}
            </span>
          </div>
        )}

        {/* Mouse toggle */}
        <button
          onClick={() => setMouseEnabled(v => !v)}
          className={cn(
            "p-1.5 rounded-lg transition-all",
            mouseEnabled ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
          )}
          title={mouseEnabled ? "Mouse control ON (click to disable)" : "Mouse control OFF (click to enable)"}
        >
          {mouseEnabled ? <MousePointer2 className="w-4 h-4" /> : <MousePointerBan className="w-4 h-4" />}
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all"
          title="Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Start/Stop */}
        <Button
          size="sm"
          variant={streaming ? "destructive" : "default"}
          className="text-xs px-3 h-7 font-mono"
          onClick={toggleStream}
        >
          {streaming ? "Stop" : "Start"}
        </Button>
      </div>

      {/* Viewer */}
      <div className="flex-1 overflow-hidden flex items-center justify-center bg-black relative select-none">
        {frame ? (
          <img
            ref={imgRef}
            src={frame.data}
            alt="Live remote screen"
            draggable={false}
            className={cn(
              "max-w-full max-h-full object-contain block",
              mouseEnabled ? "cursor-crosshair" : "cursor-default"
            )}
            onMouseMove={handleMouseMove}
            onMouseDown={handleClick}
            onDoubleClick={handleDblClick}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        ) : streaming ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin opacity-40" />
            <p className="font-mono text-sm uppercase tracking-wide">Waiting for first frame…</p>
            <p className="text-xs text-center opacity-60">First frame may take a few seconds</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center text-muted-foreground px-6">
            <div className="relative">
              <Monitor className="w-16 h-16 opacity-15" />
              <WifiOff className="w-6 h-6 opacity-30 absolute bottom-0 right-0" />
            </div>
            <div className="space-y-1.5">
              <p className="font-mono text-sm uppercase tracking-wide">Remote Desktop</p>
              <p className="text-xs opacity-60 max-w-xs">
                Press <strong className="text-foreground">Start</strong> to begin streaming your PC screen in real time.
                Mouse control sends clicks and movement back to your PC.
              </p>
            </div>
            <Button onClick={toggleStream} className="mt-1 font-mono text-xs uppercase tracking-wide">
              Start Stream
            </Button>
          </div>
        )}

        {/* Mouse control badge */}
        {streaming && mouseEnabled && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
            <span className="bg-black/70 text-white/60 text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/10">
              Left click · Right click · Scroll · Drag
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
