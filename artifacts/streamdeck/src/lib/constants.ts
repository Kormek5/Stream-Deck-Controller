import {
  Globe, Keyboard, Terminal, Shield, Gamepad2, PlaySquare, Play, Pause,
  SkipForward, SkipBack, Volume2, VolumeX, Music, Code, MessageCircle,
  MessageSquare, Camera, Youtube, Book, User, Github, Monitor, Box, Power,
  LayoutGrid, Image, Video, Radio, Twitch, Cast, Circle, Square, Mic,
  MicOff, GitBranch, GitPullRequest, AlertCircle, Workflow, Settings2
} from "lucide-react";

export const ACTION_TYPES = [
  { value: "url" as const, label: "Open URL", icon: Globe },
  { value: "hotkey" as const, label: "Hotkey", icon: Keyboard },
  { value: "script" as const, label: "Run Script", icon: Terminal },
  { value: "vpn" as const, label: "Toggle VPN", icon: Shield },
  { value: "steam" as const, label: "Switch Steam Account", icon: Gamepad2 },
  { value: "app" as const, label: "Launch App", icon: PlaySquare },
  { value: "media" as const, label: "Media Control", icon: Play },
  { value: "obs" as const, label: "OBS Studio", icon: Video },
  { value: "github" as const, label: "GitHub", icon: Github },
  { value: "twitch" as const, label: "Twitch", icon: Cast },
];

export type ActionType = typeof ACTION_TYPES[number]["value"];

export const ACTION_VALUE_CONFIG: Record<string, {
  label: string;
  placeholder?: string;
  hint?: string;
  type: "text" | "url" | "select" | "hotkey" | "textarea" | "composite";
  options?: { value: string; label: string }[];
  fields?: { key: string; label: string; placeholder: string; type?: "text" | "url" | "select"; options?: { value: string; label: string }[] }[];
}> = {
  url: {
    label: "URL",
    placeholder: "https://example.com",
    hint: "Full URL to open in the browser",
    type: "url",
  },
  hotkey: {
    label: "Key Combination",
    placeholder: "ctrl+shift+m",
    hint: "Use + to separate keys: ctrl, shift, alt, win + key",
    type: "hotkey",
  },
  script: {
    label: "Script / Command",
    placeholder: "python script.py  or  notepad.exe",
    hint: "Command or script path to execute on the host machine",
    type: "textarea",
  },
  vpn: {
    label: "VPN Action",
    type: "select",
    options: [
      { value: "toggle", label: "Toggle (connect/disconnect)" },
      { value: "connect", label: "Connect" },
      { value: "disconnect", label: "Disconnect" },
    ],
  },
  steam: {
    label: "Steam Account Name",
    placeholder: "MyAccountName",
    hint: "The Steam account login name to switch to",
    type: "text",
  },
  app: {
    label: "Application",
    placeholder: "discord  or  C:\\Program Files\\App\\app.exe",
    hint: "App name or full path to the executable",
    type: "text",
  },
  media: {
    label: "Media Command",
    type: "select",
    options: [
      { value: "playpause", label: "Play / Pause" },
      { value: "nexttrack", label: "Next Track" },
      { value: "prevtrack", label: "Previous Track" },
      { value: "volumeup", label: "Volume Up" },
      { value: "volumedown", label: "Volume Down" },
      { value: "mute", label: "Mute / Unmute" },
      { value: "stop", label: "Stop" },
    ],
  },
  obs: {
    label: "OBS Action",
    type: "composite",
    fields: [
      {
        key: "command",
        label: "Command",
        type: "select",
        placeholder: "Select OBS command",
        options: [
          { value: "start-recording", label: "Start Recording" },
          { value: "stop-recording", label: "Stop Recording" },
          { value: "toggle-recording", label: "Toggle Recording" },
          { value: "start-streaming", label: "Start Streaming" },
          { value: "stop-streaming", label: "Stop Streaming" },
          { value: "toggle-streaming", label: "Toggle Streaming" },
          { value: "switch-scene", label: "Switch Scene" },
          { value: "toggle-mute-mic", label: "Toggle Mute Microphone" },
          { value: "toggle-mute-desktop", label: "Toggle Mute Desktop Audio" },
          { value: "screenshot", label: "Save Screenshot" },
        ],
      },
      {
        key: "scene",
        label: "Scene Name (for Switch Scene)",
        type: "text",
        placeholder: "Gaming  or  Just Chatting",
      },
    ],
  },
  github: {
    label: "GitHub Action",
    type: "composite",
    fields: [
      {
        key: "command",
        label: "Action",
        type: "select",
        placeholder: "Select GitHub action",
        options: [
          { value: "open-repo", label: "Open Repository" },
          { value: "open-prs", label: "Open Pull Requests" },
          { value: "open-issues", label: "Open Issues" },
          { value: "open-actions", label: "Open Actions (CI/CD)" },
          { value: "open-commits", label: "Open Commits" },
          { value: "new-issue", label: "Create New Issue" },
          { value: "new-pr", label: "Create New PR" },
          { value: "open-profile", label: "Open My Profile" },
          { value: "open-notifications", label: "Open Notifications" },
        ],
      },
      {
        key: "repo",
        label: "Repository (owner/repo or URL)",
        type: "text",
        placeholder: "octocat/Hello-World",
      },
    ],
  },
  twitch: {
    label: "Twitch Action",
    type: "composite",
    fields: [
      {
        key: "command",
        label: "Action",
        type: "select",
        placeholder: "Select Twitch action",
        options: [
          { value: "open-channel", label: "Open Channel" },
          { value: "open-dashboard", label: "Open Creator Dashboard" },
          { value: "open-analytics", label: "Open Analytics" },
          { value: "open-chat", label: "Open Chat" },
          { value: "open-stream-manager", label: "Open Stream Manager" },
          { value: "clip", label: "Open Clips" },
          { value: "schedule", label: "Open Schedule" },
          { value: "open-homepage", label: "Open Twitch Homepage" },
        ],
      },
      {
        key: "channel",
        label: "Channel Name",
        type: "text",
        placeholder: "xqc  or  ninja",
      },
    ],
  },
};

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
  { name: "Monitor", icon: Monitor },
  { name: "Box", icon: Box },
  { name: "Power", icon: Power },
  { name: "LayoutGrid", icon: LayoutGrid },
  { name: "Image", icon: Image },
  { name: "Video", icon: Video },
  { name: "Radio", icon: Radio },
  { name: "Twitch", icon: Twitch },
  { name: "Cast", icon: Cast },
  { name: "Circle", icon: Circle },
  { name: "Square", icon: Square },
  { name: "Mic", icon: Mic },
  { name: "MicOff", icon: MicOff },
  { name: "GitBranch", icon: GitBranch },
  { name: "GitPullRequest", icon: GitPullRequest },
  { name: "AlertCircle", icon: AlertCircle },
  { name: "Workflow", icon: Workflow },
  { name: "Settings2", icon: Settings2 },
];

export function serializeCompositeValue(fields: Record<string, string>): string {
  return JSON.stringify(fields);
}

export function parseCompositeValue(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch {
  }
  return {};
}
