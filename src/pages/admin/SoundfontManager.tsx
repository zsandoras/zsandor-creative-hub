import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, Check } from "lucide-react";
import { Navigate } from "react-router-dom";

const SoundfontManager = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [soundfonts, setSoundfonts] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentSoundfont, setCurrentSoundfont] = useState<string>("");

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadSoundfonts();
      loadCurrentSetting();
    }
  }, [authLoading, isAdmin]);

  const loadSoundfonts = async () => {
    try {
      const { data, error } = await supabase
        .storage
        .from('soundfonts')
        .list();

      if (error) throw error;
      setSoundfonts(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading soundfonts",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'soundfont_url')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setCurrentSoundfont(data.value as string);
      } else {
        // Default soundfont
        setCurrentSoundfont("https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2");
      }
    } catch (error: any) {
      console.error("Error loading soundfont setting:", error);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file extension
    if (!file.name.endsWith('.sf2')) {
      toast({
        title: "Invalid file",
        description: "Please upload a .sf2 soundfont file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('soundfonts')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      toast({
        title: "Success",
        description: "Soundfont uploaded successfully",
      });

      loadSoundfonts();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSetActive = async (fileName: string) => {
    try {
      const { data: { publicUrl } } = supabase.storage
        .from('soundfonts')
        .getPublicUrl(fileName);

      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'soundfont_url',
          value: publicUrl,
          updated_by: user?.id,
        });

      if (error) throw error;

      setCurrentSoundfont(publicUrl);
      toast({
        title: "Success",
        description: "Active soundfont updated. Refresh the Guitar Pro page to apply changes.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSetDefault = async () => {
    try {
      const defaultUrl = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2";
      
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'soundfont_url',
          value: defaultUrl,
          updated_by: user?.id,
        });

      if (error) throw error;

      setCurrentSoundfont(defaultUrl);
      toast({
        title: "Success",
        description: "Reverted to default soundfont. Refresh the Guitar Pro page to apply changes.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!confirm(`Delete ${fileName}?`)) return;

    try {
      const { error } = await supabase.storage
        .from('soundfonts')
        .remove([fileName]);

      if (error) throw error;

      // If deleting active soundfont, revert to default
      const { data: { publicUrl } } = supabase.storage
        .from('soundfonts')
        .getPublicUrl(fileName);

      if (currentSoundfont === publicUrl) {
        await handleSetDefault();
      }

      toast({
        title: "Success",
        description: "Soundfont deleted",
      });

      loadSoundfonts();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
          ← Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Soundfont Manager</CardTitle>
          <CardDescription>
            Upload and manage soundfont files (.sf2) for the Guitar Pro player. 
            Larger soundfonts provide better quality but slower loading times.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Section */}
          <div className="space-y-2">
            <Label htmlFor="soundfont-upload">Upload Soundfont (.sf2)</Label>
            <div className="flex gap-2">
              <Input
                id="soundfont-upload"
                type="file"
                accept=".sf2"
                onChange={handleUpload}
                disabled={uploading}
              />
              {uploading && <Loader2 className="h-5 w-5 animate-spin" />}
            </div>
            <p className="text-sm text-muted-foreground">
              Recommended: FluidR3_GM.sf2 (~148MB) - 
              <a 
                href="https://musical-artifacts.com/artifacts/738" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-primary"
              >
                Download here
              </a>
            </p>
          </div>

          {/* Default Soundfont Option */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Default Soundfont (sonivox.sf2)</p>
                <p className="text-sm text-muted-foreground">Web-optimized, ~30MB, hosted on CDN</p>
              </div>
              {currentSoundfont === "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2" ? (
                <div className="flex items-center gap-2 text-primary">
                  <Check className="h-5 w-5" />
                  <span className="text-sm font-medium">Active</span>
                </div>
              ) : (
                <Button onClick={handleSetDefault} variant="outline" size="sm">
                  Use Default
                </Button>
              )}
            </div>
          </div>

          {/* Soundfont List */}
          <div className="space-y-2">
            <Label>Uploaded Soundfonts</Label>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : soundfonts.length === 0 ? (
              <div className="text-center p-8 border rounded-lg border-dashed">
                <Upload className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No soundfonts uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {soundfonts.map((sf) => {
                  const { data: { publicUrl } } = supabase.storage
                    .from('soundfonts')
                    .getPublicUrl(sf.name);
                  const isActive = currentSoundfont === publicUrl;

                  return (
                    <div
                      key={sf.name}
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        isActive ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{sf.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(sf.metadata?.size || 0)} • 
                          Uploaded {new Date(sf.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isActive ? (
                          <div className="flex items-center gap-2 text-primary">
                            <Check className="h-5 w-5" />
                            <span className="text-sm font-medium">Active</span>
                          </div>
                        ) : (
                          <Button onClick={() => handleSetActive(sf.name)} size="sm">
                            Set Active
                          </Button>
                        )}
                        <Button
                          onClick={() => handleDelete(sf.name)}
                          variant="ghost"
                          size="icon"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Current Status */}
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              <strong>Current soundfont URL:</strong>
              <br />
              <span className="break-all">{currentSoundfont}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SoundfontManager;
