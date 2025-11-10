import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface MusicTrack {
  id: string;
  title: string;
  artist: string | null;
  file_url: string;
  display_order: number;
}

const MusicManager = () => {
  const { isAdmin, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tracks = [] } = useQuery({
    queryKey: ["music-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("music_tracks")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as MusicTrack[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("music_tracks")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["music-tracks"] });
      toast({ title: "Track deleted successfully" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !title) {
      toast({
        title: "Error",
        description: "Please provide a title and select a file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("music")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("music")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from("music_tracks")
        .insert({
          title,
          artist: artist || null,
          file_url: publicUrl,
          display_order: tracks.length,
        });

      if (insertError) throw insertError;

      toast({ title: "Track uploaded successfully!" });
      setTitle("");
      setArtist("");
      queryClient.invalidateQueries({ queryKey: ["music-tracks"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
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
          Music Manager
        </h1>

        <Card className="p-6 mb-8 bg-card/50 backdrop-blur">
          <h2 className="text-2xl font-bold mb-4">Upload New Track</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Track title"
              />
            </div>
            <div>
              <Label htmlFor="artist">Artist</Label>
              <Input
                id="artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Artist name (optional)"
              />
            </div>
            <div>
              <Label htmlFor="file">MP3 File *</Label>
              <Input
                id="file"
                type="file"
                accept="audio/mp3,audio/mpeg"
                onChange={handleFileUpload}
                disabled={uploading || !title}
              />
            </div>
            {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
          </div>
        </Card>

        <Card className="p-6 bg-card/50 backdrop-blur">
          <h2 className="text-2xl font-bold mb-4">Existing Tracks</h2>
          {tracks.length === 0 ? (
            <p className="text-muted-foreground">No tracks uploaded yet</p>
          ) : (
            <div className="space-y-3">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-4 bg-secondary rounded-lg"
                >
                  <div>
                    <p className="font-semibold">{track.title}</p>
                    {track.artist && (
                      <p className="text-sm text-muted-foreground">{track.artist}</p>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => deleteMutation.mutate(track.id)}
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

export default MusicManager;