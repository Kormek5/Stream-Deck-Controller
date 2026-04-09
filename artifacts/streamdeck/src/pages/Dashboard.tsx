import { useState, useMemo } from "react";
import {
  useListProfiles,
  useListButtons,
  useListFolders,
  useExecuteButton,
  getListButtonsQueryKey,
  getListFoldersQueryKey,
} from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Check, ChevronLeft, FolderPlus } from "lucide-react";
import { StreamButton } from "@/components/StreamButton";
import { FolderTile } from "@/components/FolderTile";
import { ButtonEditorModal } from "@/components/ButtonEditorModal";
import { FolderEditorModal } from "@/components/FolderEditorModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Button as ButtonType, Folder } from "@workspace/api-client-react";

export function Dashboard() {
  const { data: profiles, isLoading: profilesLoading } = useListProfiles();
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingButton, setEditingButton] = useState<ButtonType | null>(null);
  const [folderEditorOpen, setFolderEditorOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [openFolderId, setOpenFolderId] = useState<number | null>(null);

  const { toast } = useToast();

  const currentProfileId = activeProfileId ?? profiles?.find(p => p.isDefault)?.id ?? profiles?.[0]?.id;

  const { data: allButtons, isLoading: buttonsLoading } = useListButtons(currentProfileId || 0, {
    query: {
      enabled: !!currentProfileId,
      queryKey: getListButtonsQueryKey(currentProfileId || 0),
    },
  });

  const { data: folders = [], isLoading: foldersLoading } = useListFolders(currentProfileId || 0, {
    query: {
      enabled: !!currentProfileId,
      queryKey: getListFoldersQueryKey(currentProfileId || 0),
    },
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
        toast({ title: "Executed", description: result.message, duration: 2000 });
      } else {
        toast({ title: "Failed", description: result.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to execute action", variant: "destructive" });
    }
  };

  const handleAddButton = (pos?: number) => {
    setEditingButton(null);
    setEditorOpen(true);
  };

  const handleAddFolder = () => {
    setEditingFolder(null);
    setFolderEditorOpen(true);
  };

  const handleFolderClick = (folder: Folder) => {
    if (editMode) {
      setEditingFolder(folder);
      setFolderEditorOpen(true);
    } else {
      setOpenFolderId(folder.id);
    }
  };

  const isLoading = buttonsLoading || foldersLoading;

  // Calculate grid items based on current view
  const GRID_SIZE = 15;

  // Buttons for the current view context (root or inside folder)
  const viewButtons = useMemo(() => {
    if (!allButtons) return [];
    if (openFolderId !== null) {
      return allButtons.filter(b => b.folderId === openFolderId);
    }
    return allButtons.filter(b => b.folderId == null);
  }, [allButtons, openFolderId]);

  // Count buttons per folder for display
  const buttonCountByFolder = useMemo(() => {
    const map = new Map<number, number>();
    (allButtons ?? []).forEach(b => {
      if (b.folderId != null) {
        map.set(b.folderId, (map.get(b.folderId) ?? 0) + 1);
      }
    });
    return map;
  }, [allButtons]);

  const buttonsByPos = useMemo(() => {
    const map = new Map<number, ButtonType>();
    viewButtons.forEach(b => map.set(b.position, b));
    return map;
  }, [viewButtons]);

  // In root view, folders occupy early positions, buttons fill around them
  // Simpler: grid is purely positional — folders shown as tiles before buttons
  const currentFolder = openFolderId !== null ? folders.find(f => f.id === openFolderId) : null;

  // In root view: interleave folders (by folder.position) and buttons (by button.position)
  // in one flat grid. We use a combined slot map.
  const rootGridItems = useMemo(() => {
    if (openFolderId !== null) return null;
    type Item =
      | { kind: "button"; data: ButtonType; pos: number }
      | { kind: "folder"; data: Folder; pos: number }
      | { kind: "empty"; pos: number };

    const slots = new Map<number, Item>();

    // Place folders first (they claim their position)
    folders.forEach(folder => {
      slots.set(folder.position, { kind: "folder", data: folder, pos: folder.position });
    });

    // Place root buttons, skipping folder-occupied slots
    viewButtons.forEach(btn => {
      let pos = btn.position;
      if (slots.has(pos)) {
        // Find next free slot
        for (let i = 0; i < GRID_SIZE; i++) {
          if (!slots.has(i)) { pos = i; break; }
        }
      }
      slots.set(pos, { kind: "button", data: btn, pos });
    });

    // Fill empty
    const result: Item[] = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      result.push(slots.get(i) ?? { kind: "empty", pos: i });
    }
    return result;
  }, [openFolderId, folders, viewButtons]);

  // Next available position for new folders
  const nextFolderPosition = useMemo(() => {
    const used = new Set(folders.map(f => f.position));
    for (let i = 0; i < GRID_SIZE; i++) {
      if (!used.has(i)) return i;
    }
    return folders.length;
  }, [folders]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between p-4 shrink-0 border-b border-border bg-card/50 gap-3">
        <div className="flex-1 min-w-0 max-w-[180px]">
          {profilesLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              value={currentProfileId?.toString() || ""}
              onValueChange={(val) => {
                setActiveProfileId(parseInt(val, 10));
                setOpenFolderId(null);
              }}
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

        <div className="flex items-center gap-2 shrink-0">
          {openFolderId !== null && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setOpenFolderId(null)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          {editMode && openFolderId === null && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleAddFolder}
              title="New Folder"
            >
              <FolderPlus className="w-4 h-4" />
            </Button>
          )}
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

      {/* Breadcrumb */}
      {openFolderId !== null && currentFolder && (
        <div className="px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground border-b border-border/50 bg-card/30">
          <button onClick={() => setOpenFolderId(null)} className="hover:text-foreground transition-colors">
            Deck
          </button>
          <span>/</span>
          <span className="text-foreground font-medium">{currentFolder.name}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        {isLoading ? (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 w-full max-w-4xl aspect-[3/5] md:aspect-[5/3]">
            {Array.from({ length: GRID_SIZE }).map((_, i) => (
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
        ) : openFolderId !== null ? (
          /* — Folder view: just show buttons in this folder — */
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 w-full max-w-4xl h-[min(80vh,800px)]">
            {Array.from({ length: GRID_SIZE }, (_, pos) => {
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
                  onClick={() => editMode && handleAddButton(pos)}
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
        ) : (
          /* — Root view: folders + root buttons — */
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 w-full max-w-4xl h-[min(80vh,800px)]">
            {rootGridItems!.map((item) => {
              if (item.kind === "folder") {
                return (
                  <FolderTile
                    key={`folder-${item.data.id}`}
                    folder={item.data}
                    isEditMode={editMode}
                    onClick={() => handleFolderClick(item.data)}
                    onEdit={() => handleFolderClick(item.data)}
                    buttonCount={buttonCountByFolder.get(item.data.id) ?? 0}
                  />
                );
              }
              if (item.kind === "button") {
                return (
                  <StreamButton
                    key={`btn-${item.data.id}`}
                    button={item.data}
                    isEditMode={editMode}
                    onClick={() => handleButtonPress(item.data)}
                  />
                );
              }
              return (
                <button
                  key={`empty-${item.pos}`}
                  onClick={() => editMode && handleAddButton(item.pos)}
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
        <>
          <ButtonEditorModal
            open={editorOpen}
            onOpenChange={setEditorOpen}
            profileId={currentProfileId}
            button={editingButton}
            folderId={openFolderId}
            folders={folders}
          />
          <FolderEditorModal
            open={folderEditorOpen}
            onOpenChange={setFolderEditorOpen}
            profileId={currentProfileId}
            folder={editingFolder}
            defaultPosition={nextFolderPosition}
          />
        </>
      )}
    </div>
  );
}
