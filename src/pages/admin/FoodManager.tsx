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
import { Trash2, ArrowLeft, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BatchFileUpload } from "@/components/BatchFileUpload";
import { ImageCropper } from "@/components/ImageCropper";

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
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [currentCropImage, setCurrentCropImage] = useState<string | null>(null);
  const [currentCropIndex, setCurrentCropIndex] = useState(0);
  const [processedFiles, setProcessedFiles] = useState<Blob[]>([]);
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, title, description }: { id: string; title: string; description: string }) => {
      const { error } = await supabase
        .from("food_gallery")
        .update({
          title: title || null,
          description: description || null,
        })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-gallery"] });
      toast({ title: "Item updated successfully" });
      setIsDialogOpen(false);
      setEditingItem(null);
    },
  });

  const handleEdit = (item: FoodItem) => {
    setEditingItem(item);
    setEditTitle(item.title || "");
    setEditDescription(item.description || "");
    setIsDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    updateMutation.mutate({
      id: editingItem.id,
      title: editTitle,
      description: editDescription,
    });
  };

  const handleFileUpload = async (files: File[]) => {
    setSelectedFiles(files);
    if (files.length > 0) {
      // Start cropping flow
      const reader = new FileReader();
      reader.onload = () => {
        setCurrentCropImage(reader.result as string);
        setCurrentCropIndex(0);
        setCropperOpen(true);
      };
      reader.readAsDataURL(files[0]);
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    const newProcessed = [...processedFiles, croppedBlob];
    setProcessedFiles(newProcessed);
    
    const nextIndex = currentCropIndex + 1;
    
    if (nextIndex < selectedFiles.length) {
      // Crop next image
      const reader = new FileReader();
      reader.onload = () => {
        setCurrentCropImage(reader.result as string);
        setCurrentCropIndex(nextIndex);
      };
      reader.readAsDataURL(selectedFiles[nextIndex]);
    } else {
      // All images cropped, upload them
      setCropperOpen(false);
      await uploadAllImages(newProcessed);
    }
  };

  const uploadAllImages = async (blobs: Blob[]) => {
    setUploading(true);

    try {
      for (let i = 0; i < blobs.length; i++) {
        const blob = blobs[i];
        const fileName = `${Math.random()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("food-images")
          .upload(fileName, blob);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("food-images")
          .getPublicUrl(fileName);

        const { error: insertError } = await supabase
          .from("food_gallery")
          .insert({
            title: null,
            description: null,
            image_url: publicUrl,
            display_order: foodItems.length + i,
          });

        if (insertError) throw insertError;
      }

      toast({ title: `${blobs.length} images uploaded successfully!` });
      setSelectedFiles([]);
      setProcessedFiles([]);
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
          <h2 className="text-2xl font-bold mb-4">Upload New Images</h2>
          <BatchFileUpload
            onFilesSelect={handleFileUpload}
            accept="image/*"
            maxFiles={10}
            disabled={uploading}
          />
          {uploading && (
            <p className="text-sm text-muted-foreground mt-4">
              Uploading {processedFiles.length} of {selectedFiles.length} images...
            </p>
          )}
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
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => handleEdit(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Optional title"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {currentCropImage && (
          <ImageCropper
            image={currentCropImage}
            onCropComplete={handleCropComplete}
            onCancel={() => {
              setCropperOpen(false);
              setCurrentCropImage(null);
              setSelectedFiles([]);
              setProcessedFiles([]);
            }}
            open={cropperOpen}
          />
        )}
      </div>
    </main>
  );
};

export default FoodManager;