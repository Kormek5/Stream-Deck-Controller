import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LayoutGrid, List, Activity, BarChart2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/", icon: LayoutGrid, label: "Deck" },
  { path: "/profiles", icon: List, label: "Profiles" },
  { path: "/activity", icon: Activity, label: "Activity" },
  { path: "/stats", icon: BarChart2, label: "Stats" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-background text-foreground overflow-hidden">
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
      
      <nav className="shrink-0 border-t border-border bg-card/80 backdrop-blur-md pb-safe">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto px-4">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            
            return (
              <Link key={item.path} href={item.path}>
                <div 
                  className={cn(
                    "flex flex-col items-center justify-center w-14 h-14 rounded-xl gap-1 transition-all duration-200 cursor-pointer touch-manipulation",
                    isActive 
                      ? "text-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.2)]" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
