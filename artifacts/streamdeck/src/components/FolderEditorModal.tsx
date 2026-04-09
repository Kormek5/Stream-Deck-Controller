import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  getListFoldersQueryKey,
} from "@workspace/api-client-react";
import type { Folder } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { BUTTON_COLORS } from "@/lib/constants";
import { Trash2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(30),
  color: z.string().min(1),
  icon: z.string().min(1),
  position: z.number().int().min(0),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: number;
  folder: Folder | null;
  defaultPosition?: number;
}

export function FolderEditorModal({ open, onOpenChange, profileId, folder, defaultPosition = 0 }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      color: "slate",
      icon: "Folder",
      position: defaultPosition,
    },
  });

  useEffect(() => {
    if (open) {
      if (folder) {
        form.reset({
          name: folder.name,
          color: folder.color,
          icon: folder.icon,
          position: folder.position,
        });
      } else {
        form.reset({
          name: "",
          color: "slate",
          icon: "Folder",
          position: defaultPosition,
        });
      }
    }
  }, [open, folder, defaultPosition, form]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey(profileId) });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (folder) {
        await updateFolder.mutateAsync({ id: folder.id, data: { ...values, profileId } });
        toast({ title: "Folder updated" });
      } else {
        await createFolder.mutateAsync({ data: { ...values, profileId } });
        toast({ title: "Folder created" });
      }
      invalidate();
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to save folder", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!folder) return;
    try {
      await deleteFolder.mutateAsync({ id: folder.id });
      toast({ title: "Folder deleted", description: "All buttons inside were also deleted" });
      invalidate();
      queryClient.invalidateQueries();
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to delete folder", variant: "destructive" });
    }
  };

  const watchedColor = form.watch("color");
  const colorDef = BUTTON_COLORS.find((c) => c.id === watchedColor) ?? BUTTON_COLORS[8];

  const isSaving = createFolder.isPending || updateFolder.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${colorDef.hex}30`, boxShadow: `0 0 10px ${colorDef.hex}40` }}
            >
              <FolderOpen className="w-4 h-4" style={{ color: colorDef.hex }} />
            </div>
            {folder ? "Edit Folder" : "New Folder"}
          </DialogTitle>
          <DialogDescription>
            {folder ? "Rename or recolor this folder." : "Create a folder to group related buttons."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Work, Gaming, Media..."
                      className="bg-input border-border"
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {BUTTON_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => field.onChange(c.id)}
                        className={cn(
                          "w-8 h-8 rounded-lg transition-all duration-200 border-2",
                          field.value === c.id
                            ? "border-white scale-110 shadow-lg"
                            : "border-transparent opacity-60 hover:opacity-100"
                        )}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-2">
              {folder && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={handleDelete}
                  disabled={deleteFolder.isPending}
                  className="shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isSaving}>
                {isSaving ? "Saving..." : folder ? "Save" : "Create Folder"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
