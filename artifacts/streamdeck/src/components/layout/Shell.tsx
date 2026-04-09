import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LayoutGrid, List, Activity, Settings, Smartphone, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScreenshotStream } from "@/hooks/useScreenshotStream";

const BASE_NAV = [
  { path: "/", icon: LayoutGrid, label: "Deck" },
  { path: "/profiles", icon: List, label: "Profiles" },
  { path: "/activity", icon: Activity, label: "Activity" },
  { path: "/connect", icon: Smartphone, label: "Connect" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const latestScreenshot = useScreenshotStream();

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const navItems = [
    ...BASE_NAV,
    { path: "/screenshot", icon: Camera, label: "Screen", badge: !!latestScreenshot },
  ];

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-background text-foreground overflow-hidden">
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
      
      <nav className="shrink-0 border-t border-border bg-card/80 backdrop-blur-md pb-safe">
        <div className="flex items-center justify-around h-16 max-w-2xl mx-auto px-2">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            const hasBadge = (item as any).badge;
            
            return (
              <Link key={item.path} href={item.path}>
                <div 
                  className={cn(
                    "relative flex flex-col items-center justify-center w-12 h-14 rounded-xl gap-1 transition-all duration-200 cursor-pointer touch-manipulation",
                    isActive 
                      ? "text-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.2)]" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[9px] font-medium tracking-wide">{item.label}</span>
                  {hasBadge && !isActive && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
