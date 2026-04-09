import { useGetActivity } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Terminal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function ActivityLog() {
  const { data: activity, isLoading } = useGetActivity();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-mono text-primary uppercase tracking-tight mb-2 flex items-center gap-3">
          <Terminal className="w-8 h-8" />
          Activity Log
        </h1>
        <p className="text-muted-foreground">Recent command executions and system events.</p>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : activity?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl font-mono text-sm">
            &gt; No recent activity detected
          </div>
        ) : (
          activity?.map((entry) => (
            <Card key={entry.id} className="bg-card/50 border-border overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center p-3 sm:p-4 gap-4">
                  <div className="shrink-0">
                    {entry.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="font-mono font-bold text-sm truncate uppercase">
                        {entry.buttonLabel}
                      </h4>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {format(new Date(entry.executedAt), "HH:mm:ss.SSS")}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono uppercase">
                        {entry.actionType}
                      </span>
                      <p className="text-xs text-muted-foreground truncate">
                        {entry.message}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
