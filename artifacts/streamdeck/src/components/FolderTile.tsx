import { FolderOpen, Edit2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUTTON_COLORS } from "@/lib/constants";
import type { Folder } from "@workspace/api-client-react";

interface Props {
  folder: Folder;
  isEditMode: boolean;
  onClick: () => void;
  onEdit: () => void;
  buttonCount?: number;
}

export function FolderTile({ folder, isEditMode, onClick, onEdit, buttonCount }: Props) {
  const colorDef = BUTTON_COLORS.find((c) => c.id === folder.color) ?? BUTTON_COLORS[8];

  return (
    <button
      onClick={isEditMode ? onEdit : onClick}
      className={cn(
        "relative w-full h-full rounded-2xl border-2 flex flex-col items-center justify-center gap-2",
        "transition-all duration-200 cursor-pointer touch-manipulation select-none",
        "overflow-hidden group",
        isEditMode
          ? "border-primary/50 animate-pulse-slow"
          : "border-border/40 hover:border-border/80"
      )}
      style={{
        background: `linear-gradient(135deg, ${colorDef.hex}18 0%, ${colorDef.hex}08 100%)`,
        boxShadow: isEditMode ? `0 0 20px ${colorDef.hex}30` : `0 0 15px ${colorDef.hex}20`,
      }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at center, ${colorDef.hex}15 0%, transparent 70%)`,
        }}
      />

      {isEditMode && (
        <div className="absolute top-2 right-2 bg-background/60 rounded-lg p-1">
          <Edit2 className="w-3 h-3 text-primary" />
        </div>
      )}

      <div
        className="relative w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          background: `${colorDef.hex}25`,
          boxShadow: `0 0 12px ${colorDef.hex}40`,
        }}
      >
        <FolderOpen
          className="w-6 h-6"
          style={{ color: colorDef.hex, filter: `drop-shadow(0 0 6px ${colorDef.hex}80)` }}
        />
      </div>

      <span
        className="text-[10px] font-bold uppercase tracking-wider leading-tight text-center px-1 line-clamp-2"
        style={{ color: `${colorDef.hex}dd` }}
      >
        {folder.name}
      </span>

      {buttonCount !== undefined && (
        <span className="text-[9px] text-muted-foreground/60 font-mono">
          {buttonCount} {buttonCount === 1 ? "button" : "buttons"}
        </span>
      )}

      {!isEditMode && (
        <ChevronRight
          className="absolute bottom-2 right-2 w-3 h-3 opacity-30 group-hover:opacity-60 transition-opacity"
          style={{ color: colorDef.hex }}
        />
      )}
    </button>
  );
}
