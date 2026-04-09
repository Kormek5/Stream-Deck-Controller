import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Monitor, Wifi, Volume2 } from "lucide-react";

export function Settings() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-mono text-primary uppercase tracking-tight mb-2 flex items-center gap-3">
          <SettingsIcon className="w-8 h-8" />
          Configuration
        </h1>
        <p className="text-muted-foreground">System preferences and app settings.</p>
      </div>

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

      <Card className="bg-card border-border opacity-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-mono uppercase">
            <Wifi className="w-4 h-4" /> Connection
          </CardTitle>
          <CardDescription>API connection settings (Coming soon)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-mono uppercase">Auto-reconnect</Label>
              <p className="text-sm text-muted-foreground">Automatically retry connection on drop</p>
            </div>
            <Switch disabled defaultChecked />
          </div>
        </CardContent>
      </Card>

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
