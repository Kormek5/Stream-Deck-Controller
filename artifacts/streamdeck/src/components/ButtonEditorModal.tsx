import { useState, useEffect } from "react";
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
  SelectValue 
} from "@/components/ui/select";
import { useCreateButton, useUpdateButton, useDeleteButton, getListButtonsQueryKey } from "@workspace/api-client-react";
import { Button as ButtonType, ButtonActionType, CreateButtonBodyActionType } from "@workspace/api-client-react/src/generated/api.schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ACTION_TYPES, BUTTON_COLORS, ICONS } from "@/lib/constants";
import { Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  label: z.string().min(1, "Label is required").max(20),
  icon: z.string().min(1, "Icon is required"),
  color: z.string().min(1, "Color is required"),
  actionType: z.enum(["url", "hotkey", "script", "vpn", "steam", "app", "media"]),
  actionValue: z.string().min(1, "Action value is required"),
  position: z.number().int().min(0).max(14),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: number;
  button: ButtonType | null;
}

export function ButtonEditorModal({ open, onOpenChange, profileId, button }: Props) {
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

  useEffect(() => {
    if (open) {
      if (button) {
        form.reset({
          label: button.label,
          icon: button.icon,
          color: button.color,
          actionType: button.actionType,
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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (button) {
        await updateBtn.mutateAsync({
          id: button.id,
          data: {
            ...values,
            actionType: values.actionType as CreateButtonBodyActionType,
            profileId,
          }
        });
        toast({ title: "Button updated" });
      } else {
        await createBtn.mutateAsync({
          data: {
            ...values,
            actionType: values.actionType as CreateButtonBodyActionType,
            profileId,
          }
        });
        toast({ title: "Button created" });
      }
      
      queryClient.invalidateQueries({ queryKey: getListButtonsQueryKey(profileId) });
      onOpenChange(false);
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Failed to save button", 
        variant: "destructive" 
      });
    }
  };

  const handleDelete = async () => {
    if (!button) return;
    try {
      await deleteBtn.mutateAsync({ id: button.id });
      queryClient.invalidateQueries({ queryKey: getListButtonsQueryKey(profileId) });
      toast({ title: "Button deleted" });
      onOpenChange(false);
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Failed to delete button", 
        variant: "destructive" 
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle>{button ? "Edit Button" : "Create Button"}</DialogTitle>
          <DialogDescription>
            Configure what this button does when pressed.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input {...field} className="font-mono uppercase bg-input border-border" placeholder="e.g. LAUNCH OBS" />
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
                          <SelectValue placeholder="Select color" />
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
                          <SelectValue placeholder="Select icon" />
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
                    <SelectContent>
                      {ACTION_TYPES.map((type) => {
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
                  <FormLabel>Action Value</FormLabel>
                  <FormControl>
                    <Input {...field} className="font-mono bg-input border-border" placeholder="https://... or script path" />
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
                    <FormLabel>Grid Position (0-14)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} className="bg-input border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex items-center justify-between pt-4">
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
