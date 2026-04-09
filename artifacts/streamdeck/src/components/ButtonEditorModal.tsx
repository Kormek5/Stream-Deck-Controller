import { useState, useEffect, useCallback } from "react";
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
import { Trash2, Info, Plus, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  label: z.string().min(1, "Label is required").max(20),
  icon: z.string().min(1, "Icon is required"),
  color: z.string().min(1, "Color is required"),
  actionType: z.enum(["url", "hotkey", "script", "vpn", "steam", "app", "media", "obs", "github", "twitch", "zoom", "discord", "spotify", "slack", "teams", "telegram", "notion", "browser", "system", "googlemeet", "vscode", "youtube", "gmail", "whatsapp", "figma", "x", "chatgpt", "airdrop", "multi", "clipboard", "type", "notification"]),
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Color" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BUTTON_COLORS.map((color) => (
                          <SelectItem key={color.id} value={color.id}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${color.class}`} />
                              {color.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Icon" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <ScrollArea className="h-[200px]">
                          {ICONS.map((i) => {
                            const IconComponent = i.icon;
                            return (
                              <SelectItem key={i.name} value={i.name}>
                                <div className="flex items-center gap-2">
                                  <IconComponent className="w-4 h-4" />
                                  {i.name}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
