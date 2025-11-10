import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface GuitarEmbed {
  id: string;
  title: string;
  embed_code: string;
  description: string | null;
  display_order: number;
}

const GuitarManager = () => {
  const { isAdmin, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [embedCode, setEmbedCode] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: embeds = [] } = useQuery({
    queryKey: ["guitar-embeds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guitar_embeds")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as GuitarEmbed[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("guitar_embeds")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guitar-embeds"] });
      toast({ title: "Embed deleted successfully" });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !embedCode) {
      toast({
        title: "Error",
        description: "Title and embed code are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("guitar_embeds")
        .insert({
          title,
          embed_code: embedCode,
          description: description || null,
          display_order: embeds.length,
        });

      if (error) throw error;

      toast({ title: "Embed added successfully!" });
      setTitle("");
      setEmbedCode("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["guitar-embeds"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link to="/admin">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Guitar Embeds Manager
        </h1>

        <Card className="p-6 mb-8 bg-card/50 backdrop-blur">
          <h2 className="text-2xl font-bold mb-4">Add New Embed</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Song or composition title"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div>
              <Label htmlFor="embedCode">Embed Code *</Label>
              <Textarea
                id="embedCode"
                value={embedCode}
                onChange={(e) => setEmbedCode(e.target.value)}
                placeholder='Paste your Guitar Pro embed code (e.g., <iframe src="..."></iframe>)'
                rows={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Paste the full iframe embed code from Guitar Pro or similar services
              </p>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding..." : "Add Embed"}
            </Button>
          </form>
        </Card>

        <Card className="p-6 bg-card/50 backdrop-blur">
          <h2 className="text-2xl font-bold mb-4">Existing Embeds</h2>
          {embeds.length === 0 ? (
            <p className="text-muted-foreground">No embeds added yet</p>
          ) : (
            <div className="space-y-3">
              {embeds.map((embed) => (
                <div
                  key={embed.id}
                  className="flex items-center justify-between p-4 bg-secondary rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-semibold">{embed.title}</p>
                    {embed.description && (
                      <p className="text-sm text-muted-foreground">{embed.description}</p>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => deleteMutation.mutate(embed.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
};

export default GuitarManager;