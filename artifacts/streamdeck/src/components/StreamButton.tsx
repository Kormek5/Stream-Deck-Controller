import { useState } from "react";
import { motion } from "framer-motion";
import { Button as ButtonType } from "@workspace/api-client-react/src/generated/api.schemas";
import { ICONS, BUTTON_COLORS } from "@/lib/constants";
import { Box } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreamButtonProps {
  button: ButtonType;
  isEditMode: boolean;
  onClick: () => void;
}

export function StreamButton({ button, isEditMode, onClick }: StreamButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const iconDef = ICONS.find(i => i.name === button.icon) || ICONS.find(i => i.name === "Box");
  const Icon = iconDef ? iconDef.icon : Box;
  
  const colorDef = BUTTON_COLORS.find(c => c.id === button.color) || BUTTON_COLORS[0];
  const hexColor = colorDef.hex;

  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      onClick={onClick}
      className={cn(
        "relative w-full h-full rounded-2xl flex flex-col items-center justify-center gap-2 p-2",
        "border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_16px_rgba(0,0,0,0.5)]",
        "transition-all duration-200 overflow-hidden group touch-manipulation select-none",
        isEditMode ? "animate-pulse shadow-[0_0_15px_rgba(var(--primary),0.3)]" : ""
      )}
      style={{
        backgroundColor: "#1a1f2e", // Dark card base
        boxShadow: isPressed 
          ? `inset 0 4px 8px rgba(0,0,0,0.6), 0 0 20px ${hexColor}40`
          : `inset 0 1px 1px rgba(255,255,255,0.1), 0 4px 8px rgba(0,0,0,0.4), 0 1px 30px ${hexColor}15`,
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
      
      {/* Edit mode overlay */}
      {isEditMode && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px] z-20">
          <div className="bg-primary/90 text-primary-foreground rounded-full p-2 shadow-lg">
            <Edit2 className="w-4 h-4" />
          </div>
        </div>
      )}
    </motion.button>
  );
}

// Temporary internal component
import { Edit2 } from "lucide-react";