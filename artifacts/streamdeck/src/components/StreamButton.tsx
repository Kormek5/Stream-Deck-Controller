import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button as ButtonType } from "@workspace/api-client-react/src/generated/api.schemas";
import { ICONS, BUTTON_COLORS } from "@/lib/constants";
import { Box, Layers, Edit2, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

function getMultiStepCount(actionType: string, actionValue: string): number | null {
  if (actionType !== "multi") return null;
  try {
    const steps = JSON.parse(actionValue);
    return Array.isArray(steps) ? steps.length : null;
  } catch { return null; }
}

interface StreamButtonProps {
  button: ButtonType;
  isEditMode: boolean;
  onClick: () => void;
  onLongPress?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export function StreamButton({ button, isEditMode, onClick, onLongPress, onDuplicate, onDelete }: StreamButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const iconDef = ICONS.find(i => i.name === button.icon) || ICONS.find(i => i.name === "Box");
  const Icon = iconDef ? iconDef.icon : Box;
  
  const colorDef = BUTTON_COLORS.find(c => c.id === button.color) || BUTTON_COLORS[0];
  const hexColor = colorDef.hex;
  const multiSteps = getMultiStepCount(button.actionType, button.actionValue);

  const handlePointerDown = () => {
    setIsPressed(true);
    didLongPress.current = false;
    if (!isEditMode && (onLongPress || onDuplicate || onDelete)) {
      longPressTimer.current = setTimeout(() => {
        didLongPress.current = true;
        setIsPressed(false);
        setShowQuickMenu(true);
        if (onLongPress) onLongPress();
      }, 550);
    }
  };

  const handlePointerUp = () => {
    setIsPressed(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = () => {
    if (didLongPress.current) return;
    if (showQuickMenu) { setShowQuickMenu(false); return; }
    onClick();
  };

  const dismissMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowQuickMenu(false);
  };

  return (
    <div className="relative w-full h-full">
      {/* Quick action menu (long press) */}
      {showQuickMenu && !isEditMode && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setShowQuickMenu(false)} />
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 flex flex-col gap-1 min-w-[130px]"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="rounded-xl overflow-hidden shadow-2xl border border-white/10"
              style={{ backgroundColor: "#1a1f2e" }}
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono hover:bg-white/10 transition-colors text-left"
                style={{ color: hexColor }}
                onClick={(e) => { e.stopPropagation(); setShowQuickMenu(false); onClick(); }}
              >
                <Edit2 className="w-3.5 h-3.5 shrink-0" />
                Edit
              </button>
              {onDuplicate && (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono hover:bg-white/10 transition-colors text-left text-blue-400"
                  onClick={(e) => { e.stopPropagation(); setShowQuickMenu(false); onDuplicate(); }}
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  Duplicate
                </button>
              )}
              {onDelete && (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono hover:bg-white/10 transition-colors text-left text-red-400 border-t border-white/5"
                  onClick={(e) => { e.stopPropagation(); setShowQuickMenu(false); onDelete(); }}
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  Delete
                </button>
              )}
            </div>
            {/* Arrow */}
            <div className="flex justify-center">
              <div
                className="w-2.5 h-2 overflow-hidden"
                style={{ filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.1))" }}
              >
                <div
                  className="w-2.5 h-2.5 rotate-45 -translate-y-1.5 border-r border-b border-white/10"
                  style={{ backgroundColor: "#1a1f2e" }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      <motion.button
        whileTap={{ scale: isEditMode ? 0.96 : 0.92 }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleClick}
        className={cn(
          "relative w-full h-full rounded-2xl flex flex-col items-center justify-center gap-2 p-2",
          "border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_16px_rgba(0,0,0,0.5)]",
          "transition-all duration-200 overflow-hidden group touch-manipulation select-none",
          isEditMode ? "animate-pulse shadow-[0_0_15px_rgba(var(--primary),0.3)]" : "",
          showQuickMenu ? "ring-2 ring-offset-1 ring-offset-background" : ""
        )}
        style={{
          backgroundColor: "#1a1f2e",
          boxShadow: isPressed 
            ? `inset 0 4px 8px rgba(0,0,0,0.6), 0 0 20px ${hexColor}40`
            : `inset 0 1px 1px rgba(255,255,255,0.1), 0 4px 8px rgba(0,0,0,0.4), 0 1px 30px ${hexColor}15`,
          ...(showQuickMenu ? { ringColor: hexColor } : {}),
        }}
      >
        {/* Background glow */}
        <div 
          className={cn(
            "absolute inset-0 opacity-20 transition-opacity duration-200",
            isPressed ? "opacity-40" : "group-hover:opacity-30"
          )}
          style={{
            background: `radial-gradient(circle at center, ${hexColor} 0%, transparent 70%)`
          }}
        />
        
        {/* Top highlight for 3D effect */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <Icon 
          className={cn(
            "w-10 h-10 md:w-12 md:h-12 relative z-10 transition-transform duration-200",
            isPressed ? "scale-95" : ""
          )} 
          style={{ 
            color: hexColor,
            filter: isPressed ? `drop-shadow(0 0 8px ${hexColor})` : "none"
          }} 
        />
        
        <span 
          className={cn(
            "text-[10px] md:text-xs font-mono font-bold tracking-wider uppercase text-center relative z-10 truncate w-full px-1",
            isPressed ? "text-white" : "text-white/70"
          )}
          style={{
            textShadow: isPressed ? `0 0 5px ${hexColor}` : "none"
          }}
        >
          {button.label}
        </span>
        
        {/* Multi-action badge */}
        {multiSteps !== null && (
          <div
            className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-mono font-bold leading-none"
            style={{ backgroundColor: `${hexColor}30`, color: hexColor, border: `1px solid ${hexColor}50` }}
          >
            <Layers className="w-2.5 h-2.5" />
            {multiSteps}
          </div>
        )}

        {/* Long-press hint dot (non-edit mode) */}
        {!isEditMode && (onDuplicate || onDelete) && !showQuickMenu && (
          <div
            className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full opacity-30 group-hover:opacity-60 transition-opacity z-10"
            style={{ backgroundColor: hexColor }}
          />
        )}

        {/* Edit mode overlay */}
        {isEditMode && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px] z-20">
            <div className="bg-primary/90 text-primary-foreground rounded-full p-2 shadow-lg">
              <Edit2 className="w-4 h-4" />
            </div>
          </div>
        )}
      </motion.button>
    </div>
  );
}
