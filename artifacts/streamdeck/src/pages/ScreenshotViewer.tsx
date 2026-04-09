import { useState } from "react";
import { useScreenshotStream } from "@/hooks/useScreenshotStream";
import { Button } from "@/components/ui/button";
import { Camera, Download, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

export function ScreenshotViewer() {
  const [zoomed, setZoomed] = useState(false);
  const screenshot = useScreenshotStream();

  function handleDownload() {
    if (!screenshot) return;
    const a = document.createElement("a");
    a.href = screenshot.data;
    a.download = `screenshot_${new Date(screenshot.timestamp).toISOString().replace(/[:.]/g, "-")}.png`;
    a.click();
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary" />
          <h2 className="font-mono font-bold uppercase tracking-wide text-sm">Screenshot</h2>
        </div>
        {screenshot && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">{formatTime(screenshot.timestamp)}</span>
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={handleDownload}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Image area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {screenshot ? (
          <img
            src={screenshot.data}
            alt="PC Screenshot"
            className={cn(
              "rounded-lg border border-border shadow-2xl cursor-zoom-in transition-all duration-200",
              zoomed ? "w-full cursor-zoom-out" : "max-h-full max-w-full object-contain"
            )}
            onClick={() => setZoomed((z) => !z)}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-center text-muted-foreground">
            <Camera className="w-16 h-16 opacity-20" />
            <div className="space-y-1">
              <p className="font-mono text-sm uppercase tracking-wide">No screenshot yet</p>
              <p className="text-xs">Press a Screenshot button on the deck to capture your PC screen</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-primary/70">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Listening for screenshots…</span>
            </div>
          </div>
        )}
      </div>

      {screenshot && (
        <div className="px-4 pb-4 shrink-0">
          <p className="text-center text-xs text-muted-foreground">Tap image to zoom • Updates automatically when a new screenshot arrives</p>
        </div>
      )}
    </div>
  );
}
