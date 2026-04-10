import { Volume2, Mic, Play, Globe, Gamepad2, Shield } from "lucide-react";

const FONTS = [
  { name: "Space Grotesk", family: "'Space Grotesk', sans-serif", desc: "Современный геометрический" },
  { name: "Rajdhani", family: "'Rajdhani', sans-serif", desc: "Техно / военный стиль" },
  { name: "Barlow Condensed", family: "'Barlow Condensed', sans-serif", desc: "Компактный и чёткий" },
  { name: "Orbitron", family: "'Orbitron', sans-serif", desc: "Sci-fi / игровой" },
  { name: "IBM Plex Sans", family: "'IBM Plex Sans', sans-serif", desc: "Строгий, профессиональный" },
  { name: "DM Sans", family: "'DM Sans', sans-serif", desc: "Мягкий, дружелюбный" },
  { name: "Inter", family: "'Inter', sans-serif", desc: "Текущий (стандарт)" },
];

const SAMPLE_BUTTONS = [
  { label: "Volume Up", icon: Volume2, color: "#f97316" },
  { label: "Mute Mic", icon: Mic, color: "#ef4444" },
  { label: "Play/Pause", icon: Play, color: "#22c55e" },
  { label: "Open URL", icon: Globe, color: "#06b6d4" },
  { label: "Steam", icon: Gamepad2, color: "#3b82f6" },
  { label: "Toggle VPN", icon: Shield, color: "#a855f7" },
];

function SampleButton({ label, icon: Icon, color, fontFamily }: {
  label: string; icon: typeof Volume2; color: string; fontFamily: string;
}) {
  return (
    <div
      style={{
        borderRadius: 12,
        background: `linear-gradient(150deg, ${color}22 0%, #141414 75%)`,
        border: `1px solid ${color}30`,
        width: 90,
        height: 90,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${color}18 0%, transparent 70%)`,
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 26,
        background: "rgba(0,0,0,0.35)",
        borderTop: `1px solid ${color}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
        paddingLeft: 4, paddingRight: 4,
      }}>
        <span style={{
          fontFamily,
          fontSize: 10,
          fontWeight: 600,
          color: "rgba(255,255,255,0.88)",
          letterSpacing: 0.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "100%",
        }}>
          {label}
        </span>
      </div>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 26,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={32} color="#fff" strokeWidth={1.5} />
      </div>
    </div>
  );
}

export function FontPreview() {
  return (
    <div style={{ padding: "20px 16px", overflowY: "auto", height: "100%" }}>
      <h2 style={{ color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
        Сравнение шрифтов
      </h2>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 20 }}>
        Посмотри как выглядят подписи кнопок в каждом шрифте и скажи какой нравится
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {FONTS.map((font) => (
          <div key={font.name}>
            <div style={{ marginBottom: 8, display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontFamily: font.family, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
                {font.name}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{font.desc}</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SAMPLE_BUTTONS.map((btn) => (
                <SampleButton
                  key={btn.label}
                  label={btn.label}
                  icon={btn.icon}
                  color={btn.color}
                  fontFamily={font.family}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
