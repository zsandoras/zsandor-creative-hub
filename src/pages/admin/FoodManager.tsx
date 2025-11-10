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

interface FoodItem {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string;
  display_order: number;
}

const FoodManager = () => {
  const { isAdmin, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: foodItems = [] } = useQuery({
    queryKey: ["food-gallery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_gallery")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as FoodItem[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("food_gallery")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-gallery"] });
      toast({ title: "Image deleted successfully" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("food-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("food-images")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from("food_gallery")
        .insert({
          title: title || null,
          description: description || null,
          image_url: publicUrl,
          display_order: foodItems.length,
        });

      if (insertError) throw insertError;

      toast({ title: "Image uploaded successfully!" });
      setTitle("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["food-gallery"] });
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
          Food Gallery Manager
        </h1>

        <Card className="p-6 mb-8 bg-card/50 backdrop-blur">
          <h2 className="text-2xl font-bold mb-4">Upload New Image</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Optional title"
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
              <Label htmlFor="file">Image File *</Label>
              <Input
                id="file"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </div>
            {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
          </div>
        </Card>

        <Card className="p-6 bg-card/50 backdrop-blur">
          <h2 className="text-2xl font-bold mb-4">Gallery Images</h2>
          {foodItems.length === 0 ? (
            <p className="text-muted-foreground">No images uploaded yet</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {foodItems.map((item) => (
                <div key={item.id} className="relative group">
                  <img
                    src={item.image_url}
                    alt={item.title || "Food"}
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => deleteMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {item.title && (
                    <p className="mt-2 text-sm font-medium truncate">{item.title}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
};

export default FoodManager;