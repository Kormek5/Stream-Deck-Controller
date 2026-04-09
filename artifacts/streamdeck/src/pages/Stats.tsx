import { useGetStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, Zap, LayoutGrid, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function Stats() {
  const { data: stats, isLoading } = useGetStats();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-mono text-primary uppercase tracking-tight mb-2 flex items-center gap-3">
          <BarChart2 className="w-8 h-8" />
          Telemetry
        </h1>
        <p className="text-muted-foreground">System usage statistics and button metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground font-mono uppercase">Total Executions</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-4xl font-bold font-mono">{stats?.totalExecutions || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground font-mono uppercase">Active Buttons</CardTitle>
            <LayoutGrid className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-4xl font-bold font-mono">{stats?.totalButtons || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground font-mono uppercase">Profiles</CardTitle>
            <Layers className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-4xl font-bold font-mono">{stats?.totalProfiles || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold font-mono uppercase tracking-tight">Most Used Buttons</h3>
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : stats?.topButtons?.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground font-mono text-sm">
                No data available yet
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats?.topButtons.map((button, index) => (
                  <div key={button.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="font-mono text-muted-foreground text-sm w-4">{index + 1}.</div>
                      <div className="font-mono font-bold uppercase">{button.label}</div>
                    </div>
                    <div className="font-mono text-sm bg-primary/20 text-primary px-2 py-1 rounded">
                      {button.executeCount} presses
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
