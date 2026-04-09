import { useState, useMemo } from "react";
import { useListProfiles, getListProfilesQueryKey } from "@workspace/api-client-react";
import { useListButtons, getListButtonsQueryKey, useExecuteButton } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Check } from "lucide-react";
import { StreamButton } from "@/components/StreamButton";
import { ButtonEditorModal } from "@/components/ButtonEditorModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Button as ButtonType } from "@workspace/api-client-react/src/generated/api.schemas";

export function Dashboard() {
  const { data: profiles, isLoading: profilesLoading } = useListProfiles();
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingButton, setEditingButton] = useState<ButtonType | null>(null);
  
  const { toast } = useToast();

  const currentProfileId = activeProfileId ?? profiles?.find(p => p.isDefault)?.id ?? profiles?.[0]?.id;

  const { data: buttons, isLoading: buttonsLoading } = useListButtons(currentProfileId || 0, {
    query: {
      enabled: !!currentProfileId,
      queryKey: getListButtonsQueryKey(currentProfileId || 0)
    }
  });

  const executeButton = useExecuteButton();

  const handleButtonPress = async (button: ButtonType) => {
    if (editMode) {
      setEditingButton(button);
      setEditorOpen(true);
      return;
    }

    try {
      const result = await executeButton.mutateAsync({ id: button.id });
      if (result.success) {
        toast({
          title: "Executed",
          description: result.message,
          duration: 2000,
        });
      } else {
        toast({
          title: "Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to execute action",
        variant: "destructive",
      });
    }
  };

  const handleAddButton = () => {
    setEditingButton(null);
    setEditorOpen(true);
  };

  // Create a grid of 15 buttons (5 rows, 3 columns on mobile)
  const gridPositions = Array.from({ length: 15 }, (_, i) => i);
  
  const buttonsByPos = useMemo(() => {
    const map = new Map<number, ButtonType>();
    if (buttons) {
      buttons.forEach(b => map.set(b.position, b));
    }
    return map;
  }, [buttons]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between p-4 shrink-0 border-b border-border bg-card/50">
        <div className="flex-1 max-w-[200px]">
          {profilesLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              value={currentProfileId?.toString() || ""}
              onValueChange={(val) => setActiveProfileId(parseInt(val, 10))}
            >
              <SelectTrigger className="w-full bg-background border-border font-mono">
                <SelectValue placeholder="Select Profile" />
              </SelectTrigger>
              <SelectContent>
                {profiles?.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.icon} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={editMode ? "default" : "outline"}
            size="icon"
            onClick={() => setEditMode(!editMode)}
            className={editMode ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]" : ""}
          >
            {editMode ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        {buttonsLoading ? (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 w-full max-w-4xl aspect-[3/5] md:aspect-[5/3]">
            {Array.from({ length: 15 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-full rounded-2xl opacity-20" />
            ))}
          </div>
        ) : !currentProfileId ? (
          <div className="text-center text-muted-foreground flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Plus className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p>Create a profile to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 w-full max-w-4xl h-[min(80vh,800px)]">
            {gridPositions.map((pos) => {
              const button = buttonsByPos.get(pos);
              
              if (button) {
                return (
                  <StreamButton
                    key={button.id}
                    button={button}
                    isEditMode={editMode}
                    onClick={() => handleButtonPress(button)}
                  />
                );
              }
              
              return (
                <button
                  key={`empty-${pos}`}
                  onClick={() => editMode && handleAddButton()}
                  disabled={!editMode}
                  className={`
                    w-full h-full rounded-2xl border-2 border-dashed 
                    flex items-center justify-center transition-all duration-200
                    ${editMode 
                      ? "border-border hover:border-primary hover:bg-primary/5 cursor-pointer text-muted-foreground hover:text-primary" 
                      : "border-transparent bg-card/20 opacity-30 cursor-default"
                    }
                  `}
                >
                  {editMode && <Plus className="w-8 h-8 opacity-50" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {currentProfileId && (
        <ButtonEditorModal
          open={editorOpen}
          onOpenChange={setEditorOpen}
          profileId={currentProfileId}
          button={editingButton}
        />
      )}
    </div>
  );
}
