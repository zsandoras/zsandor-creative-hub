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
  const [scanning, setScanning] = useState(false);

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

  const getKnownSoundfontInstruments = (fileName: string): number[] | null => {
    // Known complete GM soundfonts
    if (fileName.toLowerCase().includes('fluidr3') || fileName.toLowerCase().includes('fluid_r3')) {
      return Array.from({ length: 128 }, (_, i) => i); // All 128 GM instruments
    }
    if (fileName.toLowerCase().includes('generaluser')) {
      return Array.from({ length: 128 }, (_, i) => i); // All 128 GM instruments
    }
    // For unknown soundfonts, return null (will show all instruments with warning)
    return null;
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
        description: "Soundfont uploaded successfully. Set it as active to use it.",
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

      // Check if this is a known soundfont with full GM support
      const knownInstruments = getKnownSoundfontInstruments(fileName);

      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'soundfont_url',
          value: publicUrl,
          updated_by: user?.id,
          metadata: { available_instruments: knownInstruments }
        });

      if (error) throw error;

      setCurrentSoundfont(publicUrl);
      
      const instrumentMessage = knownInstruments 
        ? `All 128 GM instruments available.`
        : `Unknown soundfont - all instruments will be shown. Some may not produce sound.`;
      
      toast({
        title: "Success",
        description: `Active soundfont updated. ${instrumentMessage} Refresh the Guitar Pro page to apply changes.`,
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
      
      // Known working instruments in sonivox.sf2 (incomplete GM set)
      const sonivoxInstruments = [
        0, 1, 4, 5, 6, 7, 8, 16, 24, 25, 26, 27, 28, 29, 30, 32, 33, 34, 35, 36, 37, 38, 39, 40,
        42, 44, 45, 46, 48, 49, 50, 51, 52, 53, 56, 57, 58, 60, 61, 62, 64, 65, 66, 68, 69, 70,
        71, 72, 73, 74, 76, 80, 81, 84, 88, 89, 91, 92, 93, 94, 95, 96, 104, 114, 115, 116, 117,
        118, 119, 120, 121, 122, 123, 124, 125, 126, 127
      ];
      
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'soundfont_url',
          value: defaultUrl,
          updated_by: user?.id,
          metadata: { available_instruments: sonivoxInstruments }
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

  const handleRescan = async (fileName: string) => {
    setScanning(true);
    try {
      console.log('Starting AlphaTab-based soundfont scan for:', fileName);
      
      toast({
        title: "Starting Scan",
        description: "Testing each instrument with AlphaTab...",
      });

      const { data: { publicUrl } } = supabase.storage
        .from('soundfonts')
        .getPublicUrl(fileName);

      const startTime = Date.now();
      
      // Dynamically import AlphaTab
      const { AlphaTabApi, Settings } = await import('@coderline/alphatab');
      
      // Create a small visible container for testing (to avoid font loading issues)
      const testContainer = document.createElement('div');
      testContainer.style.position = 'fixed';
      testContainer.style.bottom = '10px';
      testContainer.style.right = '10px';
      testContainer.style.width = '200px';
      testContainer.style.height = '100px';
      testContainer.style.border = '2px solid hsl(var(--primary))';
      testContainer.style.borderRadius = '8px';
      testContainer.style.background = 'hsl(var(--background))';
      testContainer.style.zIndex = '9999';
      testContainer.style.overflow = 'hidden';
      testContainer.innerHTML = '<div style="padding:10px;font-size:12px;">Testing soundfont...</div>';
      document.body.appendChild(testContainer);

      // Intercept console warnings to detect unsupported instruments
      const unsupportedPrograms = new Set<number>();
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        const message = args.join(' ');
        if (message.includes('[AlphaTab][AlphaSynth]') && message.includes('sample type') && message.includes('not supported')) {
          // Extract program number from message like "bank 0 program 99"
          const match = message.match(/program (\d+)/);
          if (match) {
            unsupportedPrograms.add(parseInt(match[1]));
          }
        }
        originalWarn.apply(console, args);
      };

      try {
        // Initialize AlphaTab with the soundfont and a simple test track
        const settings = new Settings();
        settings.core.engine = 'html5';
        settings.core.logLevel = 1; // Enable warnings
        settings.player.enablePlayer = true;
        settings.player.soundFont = publicUrl;

        const api = new AlphaTabApi(testContainer, settings);

        // Load a minimal test track - soundfont will be loaded and warnings triggered
        api.tex(`\\title "Soundfont Test"
        . | c.4 d.4 e.4 f.4`);

        toast({
          title: "Loading Soundfont",
          description: "AlphaTab is analyzing the soundfont (this may take 30-60s)...",
        });

        // Wait for soundfont to load - this automatically tests all presets
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Soundfont load timeout after 60s')), 60000);
          
          api.soundFontLoaded.on(() => {
            clearTimeout(timeout);
            console.log('Soundfont loaded, waiting for warnings to be logged...');
            // Wait for all warnings to be logged
            setTimeout(() => {
              console.log('Unsupported programs detected:', Array.from(unsupportedPrograms).sort((a, b) => a - b));
              resolve();
            }, 3000);
          });
          
          api.error.on((e) => {
            clearTimeout(timeout);
            console.error('AlphaTab error:', e);
            reject(e);
          });
        });

        // Restore console.warn
        console.warn = originalWarn;

        // Calculate supported instruments (all 128 minus unsupported ones)
        const availableInstruments = Array.from({ length: 128 }, (_, i) => i)
          .filter(program => !unsupportedPrograms.has(program));

        console.log('Unsupported programs:', Array.from(unsupportedPrograms).sort((a, b) => a - b));
        console.log('Available instruments:', availableInstruments);

        // Clean up
        api.destroy();
        document.body.removeChild(testContainer);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        // Update the metadata in app_settings
        const { error: updateError } = await supabase
          .from('app_settings')
          .update({ 
            metadata: { available_instruments: availableInstruments }
          })
          .eq('key', 'soundfont_url');

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }

        toast({
          title: "✅ Scan Complete",
          description: `Found ${availableInstruments.length}/128 working instruments in ${duration}s. ${128 - availableInstruments.length} instruments use unsupported stereo samples. Refresh Guitar Pro page.`,
        });

        await loadCurrentSetting();
      } finally {
        // Ensure cleanup
        console.warn = originalWarn;
        if (document.body.contains(testContainer)) {
          document.body.removeChild(testContainer);
        }
      }
    } catch (error: any) {
      console.error('Full error details:', error);
      toast({
        title: "❌ Scan Failed",
        description: error.message || "Unknown error. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
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
            <strong className="block mt-2 text-primary">⚠️ AlphaTab Compatibility:</strong>
            <span className="block mt-1">
              AlphaTab only supports <strong>mono samples</strong>. Many high-quality soundfonts (like FluidR3_GM.sf2) 
              use stereo samples and won't play correctly. The default sonivox.sf2 is optimized for AlphaTab and recommended.
            </span>
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
              Recommended: FluidR3_GM.sf2 (~148MB, all 128 GM instruments) - 
              <a 
                href="https://musical-artifacts.com/artifacts/738" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-primary ml-1"
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
                          <>
                            <div className="flex items-center gap-2 text-primary">
                              <Check className="h-5 w-5" />
                              <span className="text-sm font-medium">Active</span>
                            </div>
                            <Button 
                              onClick={() => handleRescan(sf.name)} 
                              size="sm"
                              variant="outline"
                              disabled={scanning}
                              title="Scan soundfont to detect available instruments"
                            >
                              {scanning ? "Scanning..." : "Rescan"}
                            </Button>
                          </>
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
