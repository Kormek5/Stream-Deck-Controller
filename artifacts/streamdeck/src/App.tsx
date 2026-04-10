import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shell } from "@/components/layout/Shell";
import NotFound from "@/pages/not-found";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useScreenshotStream, type Screenshot } from "@/hooks/useScreenshotStream";

// Pages
import { Dashboard } from "@/pages/Dashboard";
import { Profiles } from "@/pages/Profiles";
import { ActivityLog } from "@/pages/Activity";
import { Stats } from "@/pages/Stats";
import { Settings } from "@/pages/Settings";
import { Connect } from "@/pages/Connect";
import { ScreenshotViewer } from "@/pages/ScreenshotViewer";
import { Monitor } from "@/pages/Monitor";
import { LiveViewer } from "@/pages/LiveViewer";
import { FontPreview } from "@/pages/FontPreview";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ScreenshotNotifier() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  useScreenshotStream((shot: Screenshot) => {
    toast({
      title: "📷 Screenshot captured",
      description: "Your PC screen was captured. Tap to view it.",
      duration: 8000,
      action: (
        <ToastAction altText="View" onClick={() => navigate("/screenshot")}>
          View
        </ToastAction>
      ),
    });
  });

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/profiles" component={Profiles} />
      <Route path="/activity" component={ActivityLog} />
      <Route path="/stats" component={Stats} />
      <Route path="/settings" component={Settings} />
      <Route path="/connect" component={Connect} />
      <Route path="/screenshot" component={ScreenshotViewer} />
      <Route path="/live" component={LiveViewer} />
      <Route path="/monitor" component={Monitor} />
      <Route path="/font-preview" component={FontPreview} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <ScreenshotNotifier />
          <Shell>
            <Router />
          </Shell>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
