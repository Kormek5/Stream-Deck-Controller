import { useState, useEffect, useCallback, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateButton, useUpdateButton, useDeleteButton, getListButtonsQueryKey } from "@workspace/api-client-react";
import type { Button as ButtonType, CreateButtonBodyActionType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ACTION_TYPES,
  ACTION_VALUE_CONFIG,
  BUTTON_COLORS,
  ICONS,
  serializeCompositeValue,
  parseCompositeValue,
} from "@/lib/constants";
import { Trash2, Info, Plus, X, Search, Upload, RotateCcw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// ── Iconify suggestions per action type ──────────────────────────────────────
const ICONIFY_SUGGESTIONS: Record<string, string[]> = {
  discord:    ["logos:discord-icon", "simple-icons:discord"],
  steam:      ["logos:steam", "simple-icons:steam"],
  spotify:    ["logos:spotify-icon", "simple-icons:spotify"],
  obs:        ["logos:obs-studio", "simple-icons:obsstudio"],
  github:     ["logos:github-icon", "simple-icons:github"],
  vscode:     ["logos:visual-studio-code", "simple-icons:visualstudiocode"],
  youtube:    ["logos:youtube-icon", "simple-icons:youtube"],
  twitch:     ["logos:twitch", "simple-icons:twitch"],
  telegram:   ["logos:telegram", "simple-icons:telegram"],
  slack:      ["logos:slack-icon", "simple-icons:slack"],
  zoom:       ["logos:zoom", "simple-icons:zoom"],
  teams:      ["logos:microsoft-teams", "simple-icons:microsoftteams"],
  notion:     ["logos:notion-icon", "simple-icons:notion"],
  figma:      ["logos:figma", "simple-icons:figma"],
  chatgpt:    ["logos:openai-icon", "simple-icons:openai"],
  gmail:      ["logos:gmail", "simple-icons:gmail"],
  whatsapp:   ["logos:whatsapp-icon", "simple-icons:whatsapp"],
  x:          ["simple-icons:x", "logos:twitter"],
  googlemeet: ["logos:google-meet", "simple-icons:googlemeet"],
  vpn:        ["logos:wireguard", "mdi:vpn"],
  hotkey:     ["mdi:keyboard", "mdi:keyboard-outline"],
  script:     ["mdi:console", "mdi:terminal"],
  url:        ["mdi:web", "mdi:earth"],
  media:      ["mdi:play-circle", "mdi:music"],
  system:     ["mdi:desktop-mac", "mdi:monitor-shimmer"],
  app:        ["mdi:application", "mdi:apps"],
  clipboard:  ["mdi:clipboard-text", "mdi:content-copy"],
  type:       ["mdi:keyboard-variant", "mdi:text"],
  notification: ["mdi:bell-ring", "mdi:bell-badge"],
  wol:        ["mdi:power-plug", "mdi:lan-connect"],
  multi:      ["mdi:layers-triple", "mdi:format-list-bulleted"],
  browser:    ["logos:chrome", "logos:firefox"],
  airdrop:    ["mdi:airdrop", "mdi:share-variant"],
};

function iconifyUrl(id: string, color = "#ffffff") {
  const isLogo = id.startsWith("logos:") || id.startsWith("simple-icons:");
  return isLogo
    ? `https://api.iconify.design/${id.replace(":", "/")}.svg`
    : `https://api.iconify.design/${id.replace(":", "/")}.svg?color=${encodeURIComponent(color)}`;
}

// ── Icon/Image Picker ─────────────────────────────────────────────────────────
interface IconImagePickerProps {
  value: string;
  onChange: (v: string) => void;
  actionType: string;
  accentColor: string;
}

function IconImagePicker({ value, onChange, actionType, accentColor }: IconImagePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suggestions = ICONIFY_SUGGESTIONS[actionType] ?? ["mdi:lightning-bolt", "mdi:star", "mdi:circle"];

  // Debounced Iconify search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(searchQuery)}&limit=24`);
        const data = await res.json();
        setSearchResults((data.icons ?? []).map((id: string) => id));
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 500);
  }, [searchQuery]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const key = `sd-img-${Date.now()}`;
      localStorage.setItem(key, reader.result as string);
      onChange(`custom:${key}`);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const isCustom = value.startsWith("custom:");
  const isIconify = value.startsWith("iconify:");
  const isLucide = !isCustom && !isIconify;

  const previewSrc = isIconify
    ? iconifyUrl(value.slice(8), accentColor)
    : isCustom
    ? (localStorage.getItem(value.slice(7)) ?? "")
    : "";

  const iconsToShow = searchQuery.trim() ? searchResults : suggestions;

  return (
    <div className="space-y-3">
      {/* Preview + upload row */}
      <div className="flex items-center gap-3">
        {/* Current preview */}
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {isIconify && (
            <img src={previewSrc} width={36} height={36} alt="" style={{ objectFit: "contain" }} />
          )}
          {isCustom && previewSrc && (
            <img src={previewSrc} width={40} height={40} alt="" style={{ objectFit: "contain", borderRadius: 4 }} />
          )}
          {(isLucide || (!previewSrc && (isCustom || isIconify))) && (
            <span className="text-[10px] text-muted-foreground text-center px-1">{isLucide ? value : "?"}</span>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            {/* Upload button */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border transition-colors hover:bg-accent"
              style={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload image
            </button>
            {/* Reset to default */}
            {(isCustom || isIconify) && (
              <button
                type="button"
                onClick={() => onChange("Box")}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border transition-colors hover:bg-accent"
                style={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}
                title="Reset to default icon"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lucide icon name display (read only, small) */}
          {isLucide && (
            <p className="text-[10px] text-muted-foreground">Using Lucide: <span className="text-foreground">{value}</span></p>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={`Search icons… (e.g. "${actionType}")`}
          className="w-full rounded-lg bg-input border border-border pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground animate-pulse">
            …
          </span>
        )}
      </div>

      {/* Icon grid */}
      <div>
        <p className="text-[10px] text-muted-foreground mb-1.5">
          {searchQuery.trim() ? `${searchResults.length} results` : "Suggested for this action"}
        </p>
        {iconsToShow.length === 0 && !searching && searchQuery.trim() && (
          <p className="text-xs text-muted-foreground py-2 text-center">No icons found</p>
        )}
        <div className="grid grid-cols-8 gap-1">
          {iconsToShow.map((id) => {
            const selected = value === `iconify:${id}`;
            return (
              <button
                key={id}
                type="button"
                title={id}
                onClick={() => onChange(`iconify:${id}`)}
                className="rounded-lg p-1.5 flex items-center justify-center transition-all"
                style={{
                  background: selected ? `${accentColor}22` : "rgba(255,255,255,0.05)",
                  border: selected ? `1.5px solid ${accentColor}` : "1.5px solid transparent",
                  aspectRatio: "1",
                }}
              >
                <img
                  src={iconifyUrl(id, accentColor)}
                  width={22}
                  height={22}
                  alt={id}
                  style={{ objectFit: "contain" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Lucide fallback */}
      <details className="group">
        <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground select-none py-1">
          ▸ Use a Lucide system icon instead
        </summary>
        <div className="mt-1.5">
          <ScrollArea className="h-[140px]">
            <div className="grid grid-cols-4 gap-1 pr-2">
              {ICONS.map((i) => {
                const Ic = i.icon;
                const selected = value === i.name;
                return (
                  <button
                    key={i.name}
                    type="button"
                    title={i.name}
                    onClick={() => onChange(i.name)}
                    className="rounded-lg p-2 flex flex-col items-center gap-1 transition-all"
                    style={{
                      background: selected ? `${accentColor}22` : "rgba(255,255,255,0.04)",
                      border: selected ? `1.5px solid ${accentColor}` : "1.5px solid transparent",
                    }}
                  >
                    <Ic className="w-4 h-4" style={{ color: selected ? accentColor : "rgba(255,255,255,0.6)" }} />
                    <span className="text-[8px] text-muted-foreground truncate w-full text-center">{i.name}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </details>
    </div>
  );
}

const formSchema = z.object({
  label: z.string().min(1, "Label is required").max(20),
  icon: z.string().min(1, "Icon is required"),
  color: z.string().min(1, "Color is required"),
  actionType: z.enum(["url", "hotkey", "script", "vpn", "steam", "app", "media", "obs", "github", "twitch", "zoom", "discord", "spotify", "slack", "teams", "telegram", "notion", "browser", "system", "googlemeet", "vscode", "youtube", "gmail", "whatsapp", "figma", "x", "chatgpt", "airdrop", "multi", "clipboard", "type", "notification", "wol"]),
  actionValue: z.string(),
  position: z.number().int().min(0).max(29),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: number;
  button: ButtonType | null;
  folderId?: number | null;
  folders?: Array<{ id: number; name: string; color: string }>;
}

// ── Multi-Action Step Editor ──────────────────────────────────────────────────

interface MultiStep { type: string; value: string; delay?: number }

function parseMultiSteps(raw: string): MultiStep[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as MultiStep[];
  } catch {}
  return [{ type: "hotkey", value: "", delay: 200 }];
}

const NON_MULTI_TYPES = ACTION_TYPES.filter(t => t.value !== "multi");
const NON_MULTI_GROUPS = Object.entries(
  NON_MULTI_TYPES.reduce<Record<string, typeof ACTION_TYPES>>((acc, t) => {
    (acc[t.group] ??= []).push(t);
    return acc;
  }, {})
);

function MultiActionEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const steps = parseMultiSteps(value);

  const commit = (next: MultiStep[]) => onChange(JSON.stringify(next));

  const updateType = (i: number, type: string) =>
    commit(steps.map((s, idx) => idx === i ? { type, value: "", delay: s.delay ?? 200 } : s));

  const updateValue = (i: number, val: string) =>
    commit(steps.map((s, idx) => idx === i ? { ...s, value: val } : s));

  const updateDelay = (i: number, ms: number) =>
    commit(steps.map((s, idx) => idx === i ? { ...s, delay: ms } : s));

  const addStep = () => commit([...steps, { type: "hotkey", value: "", delay: 200 }]);

  const removeStep = (i: number) => {
    const next = steps.filter((_, idx) => idx !== i);
    commit(next.length > 0 ? next : [{ type: "hotkey", value: "", delay: 200 }]);
  };

  const moveStep = (from: number, to: number) => {
    const next = [...steps];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    commit(next);
  };

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          {steps.length} step{steps.length !== 1 ? "s" : ""} — runs top to bottom
        </p>
      </div>

      {steps.map((step, i) => (
        <div key={i} className="relative">
          {/* Step card */}
          <div className="border border-border rounded-xl p-3 space-y-2.5 bg-muted/10 hover:border-primary/30 transition-colors">
            {/* Step header row */}
            <div className="flex items-center gap-2">
              {/* Step number */}
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0"
                style={{ background: "hsl(var(--primary)/0.2)", color: "hsl(var(--primary))" }}
              >
                {i + 1}
              </div>

              {/* Action type picker */}
              <Select value={step.type} onValueChange={(v) => updateType(i, v)}>
                <SelectTrigger className="bg-input border-border h-7 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[220px] overflow-y-auto">
                  {NON_MULTI_GROUPS.map(([group, types]) => (
                    <SelectGroup key={group}>
                      <SelectLabel className="text-[10px] text-muted-foreground uppercase tracking-wider py-1">
                        {group}
                      </SelectLabel>
                      {types.map((type) => {
                        const Icon = type.icon;
                        return (
                          <SelectItem key={type.value} value={type.value} className="text-xs">
                            <div className="flex items-center gap-2">
                              <Icon className="w-3 h-3" />
                              {type.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>

              {/* Reorder up/down */}
              <div className="flex flex-col shrink-0">
                <button
                  type="button" disabled={i === 0}
                  onClick={() => moveStep(i, i - 1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors leading-none"
                >
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><path d="M6 2l4 5H2z"/></svg>
                </button>
                <button
                  type="button" disabled={i === steps.length - 1}
                  onClick={() => moveStep(i, i + 1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors leading-none"
                >
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><path d="M6 10L2 5h8z"/></svg>
                </button>
              </div>

              {/* Delete */}
              {steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Action value */}
            <ActionValueField actionType={step.type} value={step.value} onChange={(v) => updateValue(i, v)} />

            {/* Delay after this step (not shown for last step) */}
            {i < steps.length - 1 && (
              <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider shrink-0">
                  Wait after:
                </span>
                <div className="flex gap-1">
                  {[0, 200, 500, 1000, 2000].map(ms => (
                    <button
                      key={ms}
                      type="button"
                      onClick={() => updateDelay(i, ms)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        (step.delay ?? 200) === ms
                          ? "bg-primary/20 text-primary border border-primary/40"
                          : "bg-muted/30 text-muted-foreground hover:text-foreground border border-transparent"
                      }`}
                    >
                      {ms === 0 ? "0ms" : ms < 1000 ? `${ms}ms` : `${ms/1000}s`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Arrow connector between steps */}
          {i < steps.length - 1 && (
            <div className="flex justify-center my-0.5">
              <svg className="w-3 h-3 text-muted-foreground/40" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 10L2 5h8z"/>
              </svg>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addStep}
        className="w-full flex items-center justify-center gap-1.5 border border-dashed border-border rounded-xl py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors mt-1"
      >
        <Plus className="w-3.5 h-3.5" />
        Add step
      </button>
    </div>
  );
}

// ── Action Value Field ────────────────────────────────────────────────────────

function ActionValueField({
  actionType,
  value,
  onChange,
}: {
  actionType: string;
  value: string;
  onChange: (v: string) => void;
}) {
  if (actionType === "multi") {
    return <MultiActionEditor value={value} onChange={onChange} />;
  }

  const config = ACTION_VALUE_CONFIG[actionType];

  if (!config) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Action value"
        className="font-mono bg-input border-border"
      />
    );
  }

  if (config.type === "select") {
    return (
      <div className="space-y-1">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="bg-input border-border">
            <SelectValue placeholder={`Select ${config.label}`} />
          </SelectTrigger>
          <SelectContent>
            {config.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {config.hint && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="w-3 h-3" />
            {config.hint}
          </p>
        )}
      </div>
    );
  }

  if (config.type === "textarea") {
    return (
      <div className="space-y-1">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={config.placeholder}
          className="font-mono bg-input border-border resize-none h-20 text-sm"
        />
        {config.hint && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="w-3 h-3" />
            {config.hint}
          </p>
        )}
      </div>
    );
  }

  if (config.type === "hotkey") {
    return (
      <div className="space-y-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={config.placeholder}
          className="font-mono bg-input border-border tracking-widest"
        />
        {config.hint && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="w-3 h-3" />
            {config.hint}
          </p>
        )}
      </div>
    );
  }

  if (config.type === "composite" && config.fields) {
    const parsed = parseCompositeValue(value);

    const handleFieldChange = (key: string, fieldVal: string) => {
      const updated = { ...parsed, [key]: fieldVal };
      onChange(serializeCompositeValue(updated));
    };

    return (
      <div className="space-y-3">
        {config.fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {field.label}
            </label>
            {field.type === "select" ? (
              <Select
                value={parsed[field.key] ?? ""}
                onValueChange={(v) => handleFieldChange(field.key, v)}
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder={field.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={parsed[field.key] ?? ""}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="font-mono bg-input border-border text-sm"
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={config.placeholder}
        className="font-mono bg-input border-border"
        type={config.type === "url" ? "url" : "text"}
      />
      {config.hint && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="w-3 h-3" />
          {config.hint}
        </p>
      )}
    </div>
  );
}

export function ButtonEditorModal({ open, onOpenChange, profileId, button, folderId, folders = [] }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createBtn = useCreateButton();
  const updateBtn = useUpdateButton();
  const deleteBtn = useDeleteButton();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      label: "",
      icon: "Box",
      color: "teal",
      actionType: "url",
      actionValue: "",
      position: 0,
    },
  });

  const watchedActionType = useWatch({ control: form.control, name: "actionType" });

  useEffect(() => {
    if (open) {
      if (button) {
        form.reset({
          label: button.label,
          icon: button.icon,
          color: button.color,
          actionType: button.actionType as z.infer<typeof formSchema>["actionType"],
          actionValue: button.actionValue,
          position: button.position,
        });
      } else {
        form.reset({
          label: "",
          icon: "Box",
          color: "teal",
          actionType: "url",
          actionValue: "",
          position: 0,
        });
      }
    }
  }, [open, button, form]);

  useEffect(() => {
    if (!open) return;
    const prevActionType = button?.actionType;
    if (watchedActionType !== prevActionType) {
      form.setValue("actionValue", "");
    }
  }, [watchedActionType]);

  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(folderId ?? button?.folderId ?? null);

  useEffect(() => {
    setSelectedFolderId(folderId ?? button?.folderId ?? null);
  }, [open, folderId, button]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const payload = {
        ...values,
        actionType: values.actionType as CreateButtonBodyActionType,
        profileId,
        folderId: selectedFolderId,
      } as any;
      if (button) {
        await updateBtn.mutateAsync({ id: button.id, data: payload });
        toast({ title: "Button updated" });
      } else {
        await createBtn.mutateAsync({ data: payload });
        toast({ title: "Button created" });
      }
      queryClient.invalidateQueries({ queryKey: getListButtonsQueryKey(profileId) });
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to save button", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!button) return;
    try {
      await deleteBtn.mutateAsync({ id: button.id });
      queryClient.invalidateQueries({ queryKey: getListButtonsQueryKey(profileId) });
      toast({ title: "Button deleted" });
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to delete button", variant: "destructive" });
    }
  };

  const currentActionConfig = ACTION_VALUE_CONFIG[watchedActionType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-card border-border text-foreground max-h-[92vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{button ? "Edit Button" : "Create Button"}</DialogTitle>
          <DialogDescription>
            Configure what this button does when pressed.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 py-2 pb-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="font-mono uppercase bg-input border-border"
                      placeholder="e.g. START STREAM"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Color accent row */}
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Accent Color</FormLabel>
                  <div className="flex gap-2 flex-wrap">
                    {BUTTON_COLORS.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        title={color.label}
                        onClick={() => field.onChange(color.id)}
                        className="w-8 h-8 rounded-lg transition-all"
                        style={{
                          background: color.hex,
                          border: field.value === color.id ? `2px solid white` : `2px solid transparent`,
                          boxShadow: field.value === color.id ? `0 0 0 1px ${color.hex}` : "none",
                          outline: "none",
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Icon / Image picker */}
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => {
                const watchedColor = form.watch("color");
                const accentHex = BUTTON_COLORS.find(c => c.id === watchedColor)?.hex ?? "#06b6d4";
                return (
                  <FormItem>
                    <FormLabel>Icon / Image</FormLabel>
                    <IconImagePicker
                      value={field.value}
                      onChange={field.onChange}
                      actionType={watchedActionType}
                      accentColor={accentHex}
                    />
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Folder assignment — only show when there are folders */}
            {folders.length > 0 && (
              <div className="space-y-1">
                <label className="text-sm font-medium leading-none">Folder</label>
                <Select
                  value={selectedFolderId?.toString() ?? "none"}
                  onValueChange={(v) => setSelectedFolderId(v === "none" ? null : Number(v))}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="No folder (root)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No folder (root)</SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id.toString()}>
                        📁 {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <FormField
              control={form.control}
              name="actionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Action Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select action type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[280px] overflow-y-auto">
                      {Object.entries(
                        ACTION_TYPES.reduce<Record<string, typeof ACTION_TYPES>>((acc, t) => {
                          (acc[t.group] ??= []).push(t);
                          return acc;
                        }, {})
                      ).map(([group, types]) => (
                        <SelectGroup key={group}>
                          <SelectLabel className="text-xs text-muted-foreground uppercase tracking-wider py-1">
                            {group}
                          </SelectLabel>
                          {types.map((type) => {
                            const IconComponent = type.icon;
                            return (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                  <IconComponent className="w-4 h-4" />
                                  {type.label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="actionValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {currentActionConfig?.label ?? "Action Value"}
                  </FormLabel>
                  <FormControl>
                    <ActionValueField
                      actionType={watchedActionType}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!button && (
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grid Position</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        className="bg-input border-border"
                        min={0}
                        max={29}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

          </div>
          </ScrollArea>

            <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
              {button ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={handleDelete}
                  disabled={deleteBtn.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              ) : (
                <div />
              )}
              <div className="space-x-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createBtn.isPending || updateBtn.isPending}>
                  Save
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
