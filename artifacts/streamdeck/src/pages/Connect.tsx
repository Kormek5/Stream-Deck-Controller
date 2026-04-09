import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  QrCode, Wifi, Cable, Copy, CheckCheck, Smartphone,
  Monitor, ArrowRight, Info, Usb, Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

function useAppUrl() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const base = import.meta.env.BASE_URL ?? "/";
    const origin = window.location.origin;
    const path = base.endsWith("/") ? base : base + "/";
    setUrl(origin + path);
  }, []);
  return url;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="font-mono gap-2 border-border"
    >
      {copied ? <CheckCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function UrlDisplay({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 bg-muted/30 border border-border rounded-lg px-4 py-3">
      <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="font-mono text-sm text-primary flex-1 break-all">{url || "loading..."}</span>
      {url && <CopyButton text={url} />}
    </div>
  );
}

function Step({ num, text, sub }: { num: number; text: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
        {num}
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{text}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function Connect() {
  const appUrl = useAppUrl();

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-mono text-primary uppercase tracking-tight mb-2 flex items-center gap-3">
          <Smartphone className="w-8 h-8" />
          Connect
        </h1>
        <p className="text-muted-foreground text-sm">
          Open StreamDeck on any device — phone, tablet, or another PC.
        </p>
      </div>

      <Tabs defaultValue="qr" className="w-full">
        <TabsList className="w-full grid grid-cols-3 bg-muted/20 border border-border">
          <TabsTrigger value="qr" className="gap-2 font-mono uppercase text-xs">
            <QrCode className="w-4 h-4" /> QR Code
          </TabsTrigger>
          <TabsTrigger value="wifi" className="gap-2 font-mono uppercase text-xs">
            <Wifi className="w-4 h-4" /> WiFi
          </TabsTrigger>
          <TabsTrigger value="cable" className="gap-2 font-mono uppercase text-xs">
            <Cable className="w-4 h-4" /> Cable
          </TabsTrigger>
        </TabsList>

        {/* ─── QR CODE ─── */}
        <TabsContent value="qr" className="mt-4 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono uppercase text-base flex items-center gap-2">
                <QrCode className="w-4 h-4" /> Scan QR Code
              </CardTitle>
              <CardDescription>
                Point your phone camera at the code below — no app needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-2xl shadow-lg shadow-black/40">
                  {appUrl ? (
                    <QRCodeSVG
                      value={appUrl}
                      size={200}
                      level="M"
                      includeMargin={false}
                      bgColor="#ffffff"
                      fgColor="#0f172a"
                    />
                  ) : (
                    <div className="w-[200px] h-[200px] flex items-center justify-center bg-muted/20 rounded">
                      <span className="text-muted-foreground text-sm font-mono">Loading...</span>
                    </div>
                  )}
                </div>
              </div>

              <UrlDisplay url={appUrl} />

              <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-2">
                <Step num={1} text="Open your phone camera" sub="Or any QR code scanner app" />
                <Step num={2} text="Aim at the code above" sub="Hold it steady for 1–2 seconds" />
                <Step num={3} text="Tap the notification that pops up" sub="Your browser opens StreamDeck automatically" />
                <Step num={4} text='Tap "Add to Home Screen"' sub="Get a real app icon on your phone" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── WIFI ─── */}
        <TabsContent value="wifi" className="mt-4 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono uppercase text-base flex items-center gap-2">
                <Wifi className="w-4 h-4" /> Open via WiFi / Internet
              </CardTitle>
              <CardDescription>
                Works from anywhere — your home network, mobile data, or any WiFi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UrlDisplay url={appUrl} />

              <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-2">
                <p className="text-xs font-mono uppercase text-muted-foreground mb-2">On phone / tablet</p>
                <Step num={1} text="Open your browser (Chrome, Safari, Firefox)" />
                <Step num={2} text="Paste the URL above into the address bar" sub="Or copy and send to yourself via messenger" />
                <Step num={3} text="Bookmark it for quick access" />
              </div>

              <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-2">
                <p className="text-xs font-mono uppercase text-muted-foreground mb-2">Add to Home Screen (iOS)</p>
                <Step num={1} text='Tap the Share button at the bottom' sub="The box with an arrow pointing up" />
                <Step num={2} text='"Add to Home Screen"' sub="Give it a name, tap Add" />
              </div>

              <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-2">
                <p className="text-xs font-mono uppercase text-muted-foreground mb-2">Add to Home Screen (Android)</p>
                <Step num={1} text='Tap the three dots menu in Chrome' />
                <Step num={2} text='"Add to Home Screen" or "Install app"' />
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg p-3">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>StreamDeck works on any device with a modern browser. No installation required. All buttons and profiles sync in real time.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── CABLE ─── */}
        <TabsContent value="cable" className="mt-4 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono uppercase text-base flex items-center gap-2">
                <Cable className="w-4 h-4" /> USB Cable Connection
              </CardTitle>
              <CardDescription>
                Connect phone to PC via USB. No internet required — works over local network.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Android */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="font-mono uppercase text-xs border-green-500/40 text-green-400">Android</Badge>
                  <span className="text-xs text-muted-foreground">USB Tethering</span>
                </div>
                <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-2">
                  <Step num={1} text="Connect your phone to PC via USB cable" />
                  <Step num={2} text="On the phone: pull down notification bar" sub="Tap the USB notification" />
                  <Step num={3} text='Choose "USB Tethering"' sub='Settings → Network → Hotspot & Tethering → USB Tethering' />
                  <Step num={4} text="Your PC now shares its internet with the phone" sub="Open browser on phone and go to the URL below" />
                </div>
              </div>

              <UrlDisplay url={appUrl} />

              {/* iOS */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="font-mono uppercase text-xs border-blue-500/40 text-blue-400">iPhone / iPad</Badge>
                  <span className="text-xs text-muted-foreground">USB + iTunes</span>
                </div>
                <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-2">
                  <Step num={1} text="Connect iPhone to PC via Lightning / USB-C cable" />
                  <Step num={2} text="Trust the computer if prompted" />
                  <Step num={3} text="iPhone shares PC's internet automatically via iTunes" sub="Make sure iTunes or Apple Devices is installed on PC" />
                  <Step num={4} text="Open Safari on iPhone and paste the URL" />
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                <Info className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                <span>USB Tethering shares your PC's internet connection with the phone. The app URL stays the same — your phone just uses the PC's network to reach it.</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono uppercase text-base flex items-center gap-2">
                <Usb className="w-4 h-4" /> Alternative: Android Debug Bridge
              </CardTitle>
              <CardDescription>Advanced — for developers. Access localhost directly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-2">
                <Step num={1} text="Enable USB Debugging on Android" sub='Settings → Developer Options → USB Debugging' />
                <Step num={2} text="Connect USB cable and run on PC:" />
                <div className="ml-10 bg-black/40 border border-border rounded-md px-3 py-2 font-mono text-xs text-green-400 select-all">
                  adb reverse tcp:5173 tcp:5173
                </div>
                <Step num={3} text="Open on phone: http://localhost:5173" sub="Direct tunnel from PC's dev server to phone" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
