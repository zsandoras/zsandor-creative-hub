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
  embed_code: string | null;
  file_url: string | null;
  description: string | null;
  display_order: number;
}

const GuitarManager = () => {
  const { isAdmin, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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
      toast({ title: "File deleted successfully" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validExtensions = [".gp3", ".gp4", ".gp5", ".gpx", ".gp"];
      const fileExtension = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf("."));
      
      if (!validExtensions.includes(fileExtension)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a Guitar Pro file (.gp3, .gp4, .gp5, .gpx, .gp)",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !file) {
      toast({
        title: "Error",
        description: "Title and Guitar Pro file are required",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("guitar-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("guitar-files")
        .getPublicUrl(filePath);

      // Insert into database
      const { error: insertError } = await supabase
        .from("guitar_embeds")
        .insert({
          title,
          file_url: publicUrl,
          description: description || null,
          display_order: embeds.length,
        });

      if (insertError) throw insertError;

      toast({ title: "Guitar Pro file uploaded successfully!" });
      setTitle("");
      setDescription("");
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById("gpFile") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
      queryClient.invalidateQueries({ queryKey: ["guitar-embeds"] });
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
          Guitar Pro Manager
        </h1>

        <Card className="p-6 mb-8 bg-card/50 backdrop-blur">
          <h2 className="text-2xl font-bold mb-4">Upload Guitar Pro File</h2>
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
              <Label htmlFor="gpFile">Guitar Pro File *</Label>
              <Input
                id="gpFile"
                type="file"
                accept=".gp,.gp3,.gp4,.gp5,.gpx"
                onChange={handleFileChange}
              />
              {file && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Upload a Guitar Pro file (.gp3, .gp4, .gp5, .gpx, .gp)
              </p>
            </div>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload File"}
            </Button>
          </form>
        </Card>

        <Card className="p-6 bg-card/50 backdrop-blur">
          <h2 className="text-2xl font-bold mb-4">Uploaded Files</h2>
          {embeds.length === 0 ? (
            <p className="text-muted-foreground">No files uploaded yet</p>
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
                    {embed.file_url && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Guitar Pro file uploaded
                      </p>
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
