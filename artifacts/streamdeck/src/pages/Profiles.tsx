import { useState } from "react";
import { useListProfiles, useCreateProfile, useDeleteProfile, getListProfilesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export function Profiles() {
  const { data: profiles, isLoading } = useListProfiles();
  const createProfile = useCreateProfile();
  const deleteProfile = useDeleteProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [newProfileName, setNewProfileName] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    
    try {
      await createProfile.mutateAsync({
        data: {
          name: newProfileName,
          icon: "🚀",
          isDefault: profiles?.length === 0,
        }
      });
      setNewProfileName("");
      queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
      toast({ title: "Profile created" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to create profile", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProfile.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
      toast({ title: "Profile deleted" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete profile", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-mono text-primary uppercase tracking-tight mb-2">Profiles</h1>
        <p className="text-muted-foreground">Manage your decks and configurations.</p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input 
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="New Profile Name"
              className="bg-input border-border font-mono uppercase"
            />
            <Button type="submit" disabled={createProfile.isPending}>
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : profiles?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
            No profiles found. Create one above.
          </div>
        ) : (
          profiles?.map((profile) => (
            <Card key={profile.id} className="bg-card/50 border-border hover:bg-card transition-colors">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-xl">
                    {profile.icon}
                  </div>
                  <div>
                    <h3 className="font-mono font-bold text-lg">{profile.name}</h3>
                    {profile.isDefault && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded uppercase font-bold tracking-wider">Default</span>
                    )}
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(profile.id)}
                  disabled={profile.isDefault || deleteProfile.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
