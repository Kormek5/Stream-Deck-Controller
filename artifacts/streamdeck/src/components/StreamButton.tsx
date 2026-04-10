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

/** Resolve stored icon string → React element */
function ButtonIcon({ icon, hex, size = 44 }: { icon: string; hex: string; size?: number }) {
  if (icon.startsWith("iconify:")) {
    const id = icon.slice(8); // e.g. "logos:discord-icon"
    const isLogo = id.startsWith("logos:") || id.startsWith("simple-icons:");
    const src = isLogo
      ? `https://api.iconify.design/${id.replace(":", "/")}.svg`
      : `https://api.iconify.design/${id.replace(":", "/")}.svg?color=${encodeURIComponent(hex)}`;
    return (
      <img
        src={src}
        width={size}
        height={size}
        alt=""
        style={{ objectFit: "contain", filter: "none" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }

  if (icon.startsWith("custom:")) {
    const data = localStorage.getItem(icon.slice(7)) ?? "";
    return data ? (
      <img src={data} width={size} height={size} alt="" style={{ objectFit: "contain", borderRadius: 4 }} />
    ) : (
      <Box size={size} color={hex} />
    );
  }

  const iconDef = ICONS.find(i => i.name === icon) ?? ICONS.find(i => i.name === "Box");
  const Icon = iconDef?.icon ?? Box;
  return <Icon size={size} color={hex} strokeWidth={1.75} />;
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

  const colorDef = BUTTON_COLORS.find(c => c.id === button.color) ?? BUTTON_COLORS[0];
  const hex = colorDef.hex;
  const multiSteps = getMultiStepCount(button.actionType, button.actionValue);

  const isCustomImage = button.icon.startsWith("custom:") || button.icon.startsWith("iconify:logos:") || button.icon.startsWith("iconify:simple-icons:");

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
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const handleClick = () => {
    if (didLongPress.current) return;
    if (showQuickMenu) { setShowQuickMenu(false); return; }
    onClick();
  };

  return (
    <div className="relative w-full h-full">
      {/* Quick action menu (long press) */}
      {showQuickMenu && !isEditMode && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowQuickMenu(false)} />
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 min-w-[130px]"
            onClick={e => e.stopPropagation()}
          >
            <div className="rounded-xl overflow-hidden shadow-2xl" style={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.12)" }}>
              <button
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium hover:bg-white/8 transition-colors text-left"
                style={{ color: hex }}
                onClick={(e) => { e.stopPropagation(); setShowQuickMenu(false); onClick(); }}
              >
                <Edit2 className="w-3.5 h-3.5 shrink-0" /> Edit
              </button>
              {onDuplicate && (
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium hover:bg-white/8 transition-colors text-left text-blue-400 border-t border-white/5"
                  onClick={(e) => { e.stopPropagation(); setShowQuickMenu(false); onDuplicate(); }}
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" /> Duplicate
                </button>
              )}
              {onDelete && (
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium hover:bg-white/8 transition-colors text-left text-red-400 border-t border-white/5"
                  onClick={(e) => { e.stopPropagation(); setShowQuickMenu(false); onDelete(); }}
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" /> Delete
                </button>
              )}
            </div>
            <div className="flex justify-center mt-0.5">
              <div className="w-2.5 h-2 overflow-hidden">
                <div className="w-2.5 h-2.5 rotate-45 -translate-y-1.5" style={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.12)" }} />
              </div>
            </div>
          </div>
        </>
      )}

      <motion.button
        whileTap={{ scale: isEditMode ? 0.97 : 0.94 }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleClick}
        className={cn(
          "relative w-full h-full overflow-hidden",
          "touch-manipulation select-none transition-all duration-150",
          showQuickMenu ? "ring-2" : ""
        )}
        style={{
          borderRadius: 12,
          background: isPressed
            ? "linear-gradient(180deg, #161616 0%, #1c1c1c 100%)"
            : "linear-gradient(180deg, #2c2c2c 0%, #1e1e1e 100%)",
          boxShadow: isPressed
            ? "inset 0 3px 6px rgba(0,0,0,0.7)"
            : "0 1px 0 rgba(255,255,255,0.07) inset, 0 4px 12px rgba(0,0,0,0.5)",
          border: "1px solid rgba(0,0,0,0.55)",
          ...(showQuickMenu ? { ringColor: hex } : {}),
        }}
      >
        {/* Color accent strip at bottom */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
          background: hex, borderRadius: "0 0 11px 11px",
          opacity: isPressed ? 0.6 : 0.9,
        }} />

        {/* Top reflective edge */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "rgba(255,255,255,0.09)", borderRadius: "12px 12px 0 0",
        }} />

        {/* Label at bottom — fixed height */}
        <div
          className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center"
          style={{
            height: 28,
            paddingBottom: 5,
            paddingLeft: 6, paddingRight: 6,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: isPressed ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.82)",
              letterSpacing: 0.15,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
              transform: isPressed ? "translateY(0.5px)" : "none",
              transition: "color 0.1s",
            }}
          >
            {button.label}
          </span>
        </div>

        {/* Icon area — fills space above label */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center z-10"
          style={{
            bottom: 28,
            transform: isPressed ? "translateY(1px)" : "translateY(0)",
            transition: "transform 0.1s",
          }}
        >
          <ButtonIcon icon={button.icon} hex={hex} size={38} />
        </div>

        {/* Multi-action badge */}
        {multiSteps !== null && (
          <div
            className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium leading-none"
            style={{ background: `${hex}20`, color: hex, border: `1px solid ${hex}40` }}
          >
            <Layers className="w-2.5 h-2.5" />
            {multiSteps}
          </div>
        )}

        {/* Edit mode overlay */}
        {isEditMode && (
          <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.52)" }}>
            <div className="rounded-full p-2" style={{ background: hex }}>
              <Edit2 className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </motion.button>
    </div>
  );
}
