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

/** Renders icon: Iconify URL, custom base64, or Lucide component */
function ButtonIcon({ icon, hex }: { icon: string; hex: string }) {
  if (icon.startsWith("iconify:")) {
    const id = icon.slice(8);
    const isLogo = id.startsWith("logos:") || id.startsWith("simple-icons:");
    const src = isLogo
      ? `https://api.iconify.design/${id.replace(":", "/")}.svg`
      : `https://api.iconify.design/${id.replace(":", "/")}.svg?color=${encodeURIComponent("#ffffff")}`;
    return (
      <img
        src={src}
        width={44}
        height={44}
        alt=""
        style={{ objectFit: "contain", filter: isLogo ? "none" : "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
      />
    );
  }
  if (icon.startsWith("custom:")) {
    const data = localStorage.getItem(icon.slice(7)) ?? "";
    return data
      ? <img src={data} width={44} height={44} alt="" style={{ objectFit: "contain", borderRadius: 6 }} />
      : <Box size={44} color="#fff" strokeWidth={1.5} />;
  }
  const iconDef = ICONS.find(i => i.name === icon) ?? ICONS.find(i => i.name === "Box");
  const Icon = iconDef?.icon ?? Box;
  return <Icon size={44} color="#ffffff" strokeWidth={1.5} />;
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
      {/* Quick action menu */}
      {showQuickMenu && !isEditMode && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowQuickMenu(false)} />
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 min-w-[140px]"
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
          </div>
        </>
      )}

      <motion.button
        whileTap={{ scale: isEditMode ? 0.97 : 0.93, brightness: isEditMode ? 1 : 0.85 }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleClick}
        className={cn("relative w-full h-full overflow-hidden touch-manipulation select-none")}
        style={{
          borderRadius: 14,
          background: isPressed
            ? `linear-gradient(150deg, ${hex}2a 0%, #111 100%)`
            : `linear-gradient(150deg, ${hex}22 0%, #141414 75%)`,
          border: `1px solid ${hex}30`,
          boxShadow: isPressed
            ? `inset 0 2px 8px rgba(0,0,0,0.6)`
            : `0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)`,
          transition: "background 0.12s, box-shadow 0.12s",
        }}
      >
        {/* Very subtle color wash at top */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${hex}18 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        {/* Label bar at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center"
          style={{
            height: 30,
            background: "rgba(0,0,0,0.35)",
            borderTop: `1px solid ${hex}18`,
            paddingLeft: 6, paddingRight: 6,
          }}
        >
          <span style={{
            fontSize: 10.5,
            fontWeight: 500,
            color: "rgba(255,255,255,0.85)",
            letterSpacing: 0.1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}>
            {button.label}
          </span>
        </div>

        {/* Icon — fills space above label */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center z-10"
          style={{ bottom: 30 }}
        >
          <ButtonIcon icon={button.icon} hex={hex} />
        </div>

        {/* Multi-action badge */}
        {multiSteps !== null && (
          <div
            className="absolute top-2 right-2 z-20 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-semibold leading-none"
            style={{ background: `${hex}30`, color: hex, border: `1px solid ${hex}50` }}
          >
            <Layers className="w-2.5 h-2.5" />
            {multiSteps}
          </div>
        )}

        {/* Edit mode overlay */}
        {isEditMode && (
          <div className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[1px]"
            style={{ background: "rgba(0,0,0,0.45)" }}>
            <div className="rounded-full p-2.5" style={{ background: hex + "cc" }}>
              <Edit2 className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </motion.button>
    </div>
  );
}
