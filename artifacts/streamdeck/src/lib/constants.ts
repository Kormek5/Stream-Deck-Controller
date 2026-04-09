import { LayoutGrid, Globe, Keyboard, Terminal, Shield, Gamepad2, PlaySquare, Play, Pause, SkipForward, SkipBack, Image, Box, Power, Monitor, Volume2, VolumeX, Music, Code, MessageCircle, MessageSquare, Camera, Youtube, Book, User, Github } from "lucide-react";

export const ACTION_TYPES = [
  { value: "url" as const, label: "Open URL", icon: Globe },
  { value: "hotkey" as const, label: "Hotkey", icon: Keyboard },
  { value: "script" as const, label: "Run Script", icon: Terminal },
  { value: "vpn" as const, label: "Toggle VPN", icon: Shield },
  { value: "steam" as const, label: "Switch Steam Account", icon: Gamepad2 },
  { value: "app" as const, label: "Launch App", icon: PlaySquare },
  { value: "media" as const, label: "Media Control", icon: Play },
];

export const BUTTON_COLORS = [
  { id: "teal", label: "Teal", class: "bg-teal-500", hex: "#14b8a6" },
  { id: "purple", label: "Purple", class: "bg-purple-500", hex: "#a855f7" },
  { id: "orange", label: "Orange", class: "bg-orange-500", hex: "#f97316" },
  { id: "red", label: "Red", class: "bg-red-500", hex: "#ef4444" },
  { id: "green", label: "Green", class: "bg-green-500", hex: "#22c55e" },
  { id: "blue", label: "Blue", class: "bg-blue-500", hex: "#3b82f6" },
  { id: "pink", label: "Pink", class: "bg-pink-500", hex: "#ec4899" },
  { id: "yellow", label: "Yellow", class: "bg-yellow-500", hex: "#eab308" },
  { id: "slate", label: "Slate", class: "bg-slate-700", hex: "#334155" },
];

export const ICONS = [
  { name: "Globe", icon: Globe },
  { name: "Keyboard", icon: Keyboard },
  { name: "Terminal", icon: Terminal },
  { name: "Shield", icon: Shield },
  { name: "Gamepad2", icon: Gamepad2 },
  { name: "PlaySquare", icon: PlaySquare },
  { name: "Play", icon: Play },
  { name: "Pause", icon: Pause },
  { name: "SkipForward", icon: SkipForward },
  { name: "SkipBack", icon: SkipBack },
  { name: "Image", icon: Image },
  { name: "Box", icon: Box },
  { name: "Power", icon: Power },
  { name: "Monitor", icon: Monitor },
  { name: "LayoutGrid", icon: LayoutGrid },
  { name: "Volume2", icon: Volume2 },
  { name: "VolumeX", icon: VolumeX },
  { name: "Music", icon: Music },
  { name: "Code", icon: Code },
  { name: "MessageCircle", icon: MessageCircle },
  { name: "MessageSquare", icon: MessageSquare },
  { name: "Camera", icon: Camera },
  { name: "Youtube", icon: Youtube },
  { name: "Book", icon: Book },
  { name: "User", icon: User },
  { name: "Github", icon: Github },
];
