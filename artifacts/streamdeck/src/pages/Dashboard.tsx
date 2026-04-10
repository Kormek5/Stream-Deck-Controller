import React, { useState, useMemo } from "react";
import {
  useListProfiles,
  useListButtons,
  useListFolders,
  useExecuteButton,
  useCreateButton,
  useDeleteButton,
  getListButtonsQueryKey,
  getListFoldersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Check, ChevronLeft, FolderPlus, Search, X } from "lucide-react";
import { StreamButton } from "@/components/StreamButton";
import { FolderTile } from "@/components/FolderTile";
import { ButtonEditorModal } from "@/components/ButtonEditorModal";
import { FolderEditorModal } from "@/components/FolderEditorModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Button as ButtonType, Folder } from "@workspace/api-client-react";

function parseClipboardComposite(value: string) {
  try { return JSON.parse(value) as Record<string, string>; } catch {}
  return { command: "copy-text", text: value };
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const { data: profiles, isLoading: profilesLoading } = useListProfiles();
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingButton, setEditingButton] = useState<ButtonType | null>(null);
  const [folderEditorOpen, setFolderEditorOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [openFolderId, setOpenFolderId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
  const createButton = useCreateButton();
  const deleteButton = useDeleteButton();

  // ── Drag-and-drop state ──────────────────────────────────────────────────────
  const [dragSrc, setDragSrc] = useState<{ kind: "button" | "folder"; id: number; pos: number } | null>(null);
  const [dragOverPos, setDragOverPos] = useState<number | null>(null);

  const invalidateButtons = () => {
    queryClient.invalidateQueries({ queryKey: getListButtonsQueryKey(currentProfileId || 0) });
  };

  const handleClipboardAction = async (button: ButtonType): Promise<boolean> => {
    if (button.actionType !== "clipboard") return false;
    const clip = parseClipboardComposite(button.actionValue);
    const cmd = clip.command || "copy-text";

    try {
      let text = "";
      if (cmd === "copy-text") {
        text = clip.text || "";
      } else if (cmd === "copy-date") {
        text = new Date().toLocaleDateString();
      } else if (cmd === "copy-time") {
        text = new Date().toLocaleTimeString();
      } else if (cmd === "copy-datetime") {
        text = new Date().toLocaleString();
      } else if (cmd === "paste") {
        return false;
      }

      if (text && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast({ title: "📋 Copied!", description: text.slice(0, 60), duration: 1800 });
        return true;
      }
    } catch {}
    return false;
  };

  const handleButtonPress = async (button: ButtonType) => {
    if (editMode) {
      setEditingButton(button);
      setEditorOpen(true);
      return;
    }

    // URL buttons: open directly in the current browser
    if (button.actionType === "url" && button.actionValue) {
      window.open(button.actionValue, "_blank", "noopener,noreferrer");
    }

    // Clipboard: handle in browser first
    if (button.actionType === "clipboard") {
      const handled = await handleClipboardAction(button);
      if (handled) {
        executeButton.mutate({ id: button.id });
        return;
      }
    }

    try {
      const result = await executeButton.mutateAsync({ id: button.id });
      if (result.success) {
        const noAgent = (result as any).agentsSent === 0;
        const needsAgent = !["url", "clipboard"].includes(button.actionType);
        if (noAgent && needsAgent) {
          toast({
            title: "No agent connected",
            description: "Action requires the desktop agent. Go to Settings to set it up.",
            duration: 4000,
          });
        } else {
          toast({ title: "✓", description: result.message, duration: 1500 });
        }
      } else {
        toast({ title: "Failed", description: result.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to execute action", variant: "destructive" });
    }
  };

  const handleDuplicate = async (button: ButtonType) => {
    if (!currentProfileId) return;
    const allUsedPositions = new Set((allButtons ?? []).map(b => b.position));
    let newPos = button.position + 1;
    while (allUsedPositions.has(newPos)) newPos++;

    try {
      await createButton.mutateAsync({
        data: {
          profileId: currentProfileId,
          folderId: button.folderId ?? null,
          label: `${button.label} (copy)`,
          icon: button.icon,
          color: button.color,
          actionType: button.actionType as any,
          actionValue: button.actionValue,
          position: newPos,
        },
      });
      invalidateButtons();
      toast({ title: "Duplicated", description: `"${button.label}" copied`, duration: 1500 });
    } catch {
      toast({ title: "Error", description: "Could not duplicate button", variant: "destructive" });
    }
  };

  const handleDelete = async (button: ButtonType) => {
    try {
      await deleteButton.mutateAsync({ id: button.id });
      invalidateButtons();
      toast({ title: "Deleted", description: `"${button.label}" removed`, duration: 1500 });
    } catch {
      toast({ title: "Error", description: "Could not delete button", variant: "destructive" });
    }
  };

  const handleAddButton = () => {
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

  // ── Drag-and-drop handlers ───────────────────────────────────────────────────
  const handleDragStart = (kind: "button" | "folder", id: number, pos: number) => {
    setDragSrc({ kind, id, pos });
  };


  const patchBtnPos    = (id: number, pos: number) =>
    fetch(`/api/buttons/${id}/position`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: pos }) });
  const patchFolderPos = (id: number, pos: number) =>
    fetch(`/api/folders/${id}/position`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: pos }) });

  const handleDrop = async (targetPos: number, targetKind: "button" | "folder" | "empty", targetId?: number) => {
    setDragOverPos(null);
    if (!dragSrc || dragSrc.pos === targetPos) { setDragSrc(null); return; }

    const srcPos  = dragSrc.pos;
    const srcId   = dragSrc.id;
    const srcKind = dragSrc.kind;
    setDragSrc(null);

    const patch = srcKind === "button" ? patchBtnPos : patchFolderPos;
    const patchTarget = targetKind === "button" ? patchBtnPos : targetKind === "folder" ? patchFolderPos : null;

    try {
      await patch(srcId, targetPos);
      if (patchTarget && targetId !== undefined) await patchTarget(targetId, srcPos);
      queryClient.invalidateQueries({ queryKey: getListButtonsQueryKey(currentProfileId || 0) });
      queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey(currentProfileId || 0) });
    } catch {
      toast({ title: "Error", description: "Could not move item", variant: "destructive" });
    }
  };

  const handleDragEnd = () => {
    setDragSrc(null);
    setDragOverPos(null);
  };

  const dragCell = (pos: number, kind: "button" | "folder" | "empty", id?: number, inner?: React.ReactNode) => {
    const isDraggingSrc = dragSrc?.pos === pos;
    const isDragOver    = dragOverPos === pos && dragSrc !== null && dragSrc.pos !== pos;
    return (
      <div
        key={`cell-${pos}`}
        className="relative w-full h-full"
        draggable={editMode && kind !== "empty"}
        onDragStart={kind !== "empty" && id !== undefined
          ? (e) => { e.dataTransfer.effectAllowed = "move"; handleDragStart(kind as "button" | "folder", id, pos); }
          : undefined}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverPos(pos); }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverPos(null);
        }}
        onDrop={(e) => { e.preventDefault(); handleDrop(pos, kind, id); }}
        onDragEnd={handleDragEnd}
        style={{
          opacity: isDraggingSrc ? 0.35 : 1,
          outline: isDragOver ? "2px solid hsl(var(--primary))" : "none",
          outlineOffset: "-2px",
          borderRadius: "16px",
          transition: "opacity 0.15s, outline 0.1s",
          cursor: editMode && kind !== "empty" ? "grab" : undefined,
        }}
      >
        {inner}
      </div>
    );
  };

  const isLoading = buttonsLoading || foldersLoading;
  const GRID_SIZE = 15;

  const viewButtons = useMemo(() => {
    if (!allButtons) return [];
    if (openFolderId !== null) {
      return allButtons.filter(b => b.folderId === openFolderId);
    }
    return allButtons.filter(b => b.folderId == null);
  }, [allButtons, openFolderId]);

  // Search results (across all buttons regardless of folder)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !allButtons) return [];
    const q = searchQuery.toLowerCase();
    return allButtons.filter(b => b.label.toLowerCase().includes(q) || b.actionType.includes(q) || b.actionValue.toLowerCase().includes(q));
  }, [searchQuery, allButtons]);

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

  const currentFolder = openFolderId !== null ? folders.find(f => f.id === openFolderId) : null;

  const rootGridItems = useMemo(() => {
    if (openFolderId !== null) return null;
    type Item =
      | { kind: "button"; data: ButtonType; pos: number }
      | { kind: "folder"; data: Folder; pos: number }
      | { kind: "empty"; pos: number };

    const slots = new Map<number, Item>();
    folders.forEach(folder => {
      slots.set(folder.position, { kind: "folder", data: folder, pos: folder.position });
    });
    viewButtons.forEach(btn => {
      let pos = btn.position;
      if (slots.has(pos)) {
        for (let i = 0; i < GRID_SIZE; i++) {
          if (!slots.has(i)) { pos = i; break; }
        }
      }
      slots.set(pos, { kind: "button", data: btn, pos });
    });
    const result: Item[] = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      result.push(slots.get(i) ?? { kind: "empty", pos: i });
    }
    return result;
  }, [openFolderId, folders, viewButtons]);

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
        {/* Profile selector or search input */}
        <div className="flex-1 min-w-0 max-w-[200px]">
          {searchOpen ? (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search buttons..."
                className="w-full bg-background border border-border rounded-md h-10 pl-8 pr-3 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          ) : profilesLoading ? (
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
          {/* Search toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setSearchOpen(s => !s);
              setSearchQuery("");
            }}
            className={searchOpen ? "bg-primary/10 border-primary text-primary" : ""}
            title={searchOpen ? "Close search" : "Search buttons"}
          >
            {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </Button>

          {!searchOpen && openFolderId !== null && (
            <Button variant="outline" size="icon" onClick={() => setOpenFolderId(null)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          {!searchOpen && editMode && openFolderId === null && (
            <Button variant="outline" size="icon" onClick={handleAddFolder} title="New Folder">
              <FolderPlus className="w-4 h-4" />
            </Button>
          )}
          {!searchOpen && (
            <Button
              variant={editMode ? "default" : "outline"}
              size="icon"
              onClick={() => setEditMode(!editMode)}
              className={editMode ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]" : ""}
            >
              {editMode ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </header>

      {/* Breadcrumb / search status */}
      {searchOpen && searchQuery ? (
        <div className="px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground border-b border-border/50 bg-card/30">
          <Search className="w-3 h-3" />
          <span>{searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for <span className="text-foreground font-mono">"{searchQuery}"</span></span>
        </div>
      ) : openFolderId !== null && currentFolder ? (
        <div className="px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground border-b border-border/50 bg-card/30">
          <button onClick={() => setOpenFolderId(null)} className="hover:text-foreground transition-colors">Deck</button>
          <span>/</span>
          <span className="text-foreground font-medium">{currentFolder.name}</span>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        {/* Search results overlay */}
        {searchOpen && searchQuery ? (
          <div className="w-full max-w-4xl">
            {searchResults.length === 0 ? (
              <div className="text-center text-muted-foreground py-12 flex flex-col items-center gap-3">
                <Search className="w-10 h-10 opacity-20" />
                <p className="text-sm">No buttons found for "<span className="font-mono">{searchQuery}</span>"</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
                {searchResults.map(button => (
                  <div key={button.id} className="aspect-square">
                    <StreamButton
                      button={button}
                      isEditMode={false}
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery("");
                        handleButtonPress(button);
                      }}
                      onDuplicate={() => handleDuplicate(button)}
                      onDelete={() => handleDelete(button)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : isLoading ? (
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
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 w-full max-w-4xl h-[min(80vh,800px)]">
            {Array.from({ length: GRID_SIZE }, (_, pos) => {
              const button = buttonsByPos.get(pos);
              if (button) {
                return dragCell(pos, "button", button.id,
                  <StreamButton
                    button={button}
                    isEditMode={editMode}
                    onClick={() => !dragSrc && handleButtonPress(button)}
                    onDuplicate={() => handleDuplicate(button)}
                    onDelete={() => handleDelete(button)}
                  />
                );
              }
              return dragCell(pos, "empty", undefined,
                <button
                  onClick={() => editMode && handleAddButton()}
                  disabled={!editMode}
                  className={`w-full h-full rounded-2xl border-2 border-dashed flex items-center justify-center transition-all duration-200 ${
                    editMode
                      ? "border-border hover:border-primary hover:bg-primary/5 cursor-pointer text-muted-foreground hover:text-primary"
                      : "border-transparent bg-card/20 opacity-30 cursor-default"
                  }`}
                >
                  {editMode && <Plus className="w-8 h-8 opacity-50" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 w-full max-w-4xl h-[min(80vh,800px)]">
            {rootGridItems!.map((item) => {
              if (item.kind === "folder") {
                return dragCell(item.pos, "folder", item.data.id,
                  <FolderTile
                    folder={item.data}
                    isEditMode={editMode}
                    onClick={() => !dragSrc && handleFolderClick(item.data)}
                    onEdit={() => handleFolderClick(item.data)}
                    buttonCount={buttonCountByFolder.get(item.data.id) ?? 0}
                  />
                );
              }
              if (item.kind === "button") {
                return dragCell(item.pos, "button", item.data.id,
                  <StreamButton
                    button={item.data}
                    isEditMode={editMode}
                    onClick={() => !dragSrc && handleButtonPress(item.data)}
                    onDuplicate={() => handleDuplicate(item.data)}
                    onDelete={() => handleDelete(item.data)}
                  />
                );
              }
              return dragCell(item.pos, "empty", undefined,
                <button
                  onClick={() => editMode && handleAddButton()}
                  disabled={!editMode}
                  className={`w-full h-full rounded-2xl border-2 border-dashed flex items-center justify-center transition-all duration-200 ${
                    editMode
                      ? "border-border hover:border-primary hover:bg-primary/5 cursor-pointer text-muted-foreground hover:text-primary"
                      : "border-transparent bg-card/20 opacity-30 cursor-default"
                  }`}
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
