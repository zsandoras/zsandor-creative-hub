import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Navigate } from "react-router-dom";
import AlphaTabPlayer from "@/components/AlphaTabPlayer";
import { INSTRUMENTS } from "@/constants/instruments";
import { Progress } from "@/components/ui/progress";

declare global {
  interface Window {
    alphaTab: any;
  }
}

const TEST_TAB_ID = 'b8394bb0-a284-4d16-a578-d68e993e9ad4';

const SoundfontManager = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [soundfonts, setSoundfonts] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentSoundfont, setCurrentSoundfont] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentInstrument, setCurrentInstrument] = useState<string>("");
  const [unsupportedPrograms, setUnsupportedPrograms] = useState<number[]>([]);
  const [scanResults, setScanResults] = useState<{working: number; unsupported: number} | null>(null);
  const [testerExpanded, setTesterExpanded] = useState(true);
  const [testerEmbed, setTesterEmbed] = useState<any>(null);
  const testerApiRef = useRef<any>(null);
  const [debugVisible, setDebugVisible] = useState(true);
  const [debugMessages, setDebugMessages] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadSoundfonts();
      loadCurrentSetting();
      loadTesterTab();
    }
  }, [authLoading, isAdmin]);

  const loadTesterTab = async () => {
    try {
      const { data, error } = await supabase
        .from('guitar_embeds')
        .select('*')
        .eq('id', TEST_TAB_ID)
        .single();
      
      if (error) throw error;
      setTesterEmbed(data);
    } catch (error: any) {
      console.error("Error loading tester tab:", error);
    }
  };

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
    if (!testerApiRef.current) {
      toast({
        title: "Error",
        description: "Test player not ready. Please wait for the tester to load.",
        variant: "destructive",
      });
      return;
    }

    setScanning(true);
    setScanProgress(0);
    setCurrentInstrument("");
    setScanResults(null);
    setUnsupportedPrograms([]);
    setDebugMessages([]);
    setDebugVisible(true);
    const startTime = Date.now();
    
    const api = testerApiRef.current;
    const originalVolume = api.masterVolume ?? 1;
    
    // Store ALL original console methods
    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    const capturedUnsupported = new Set<number>();
    let detectionActive = false;
    let currentProgramCandidate: number | null = null;

    // Save original AlphaTab Logger
    const at = window.alphaTab;
    const originalAtLogger = at?.Logger?.log; // The ILogger object, not logDelegate
    const originalLogLevel = at?.Logger?.logLevel;

    // Local debug helper
    const addDebug = (msg: string) => {
      const ts = new Date().toLocaleTimeString();
      setDebugMessages((prev) => {
        const next = [...prev, `${ts} ${msg}`];
        return next.length > 300 ? next.slice(next.length - 300) : next;
      });
    };

    try {
      toast({
        title: "Starting Scan",
        description: "Preparing to test all 128 GM instruments...",
      });

      // Mute the player
      api.masterVolume = 0;

      // Helper to check any message for unsupported patterns
      const checkMessageForUnsupported = (message: string) => {
        const lowerMsg = message.toLowerCase();
        const isSynth = lowerMsg.includes('[alphatab][alphasynth]') || lowerMsg.includes('alphasynth');
        const mentionsUnsupported = lowerMsg.includes('unsupported') || lowerMsg.includes('skipping load of unsupported');
        
        if (isSynth && mentionsUnsupported) {
          // Try to extract program number directly from the log
          const match = message.match(/program\s+(\d{1,3})/i);
          let foundProgram: number | null = null;
          
          if (match) {
            const prog = parseInt(match[1], 10);
            if (!Number.isNaN(prog) && prog >= 0 && prog < 128) {
              foundProgram = prog;
              capturedUnsupported.add(prog);
            }
          } else if (detectionActive && currentProgramCandidate !== null) {
            // Fallback to current detection window
            foundProgram = currentProgramCandidate;
            capturedUnsupported.add(currentProgramCandidate);
          }
          
          // Show in debug feed with detection info
          const suffix = foundProgram !== null ? ` ⛔ UNSUPPORTED → ${foundProgram}` : '';
          addDebug(message + suffix);
        }
      };

      // Wrap AlphaTab Logger to intercept Web Worker messages
      if (at?.Logger) {
        // Set log level to Debug for maximum verbosity
        at.Logger.logLevel = at.LogLevel?.Debug ?? 0;
        
        // Create wrapper ILogger that captures and forwards messages
        const wrappedLogger = {
          debug: (category: string, msg: string, details?: any) => {
            const fullMsg = `[debug][${category}] ${msg}`;
            addDebug(fullMsg);
            checkMessageForUnsupported(fullMsg);
            if (originalAtLogger?.debug) {
              originalAtLogger.debug(category, msg, details);
            }
          },
          info: (category: string, msg: string, details?: any) => {
            const fullMsg = `[info][${category}] ${msg}`;
            addDebug(fullMsg);
            checkMessageForUnsupported(fullMsg);
            if (originalAtLogger?.info) {
              originalAtLogger.info(category, msg, details);
            }
          },
          warning: (category: string, msg: string, details?: any) => {
            const fullMsg = `[warn][${category}] ${msg}`;
            addDebug(fullMsg);
            checkMessageForUnsupported(fullMsg);
            if (originalAtLogger?.warning) {
              originalAtLogger.warning(category, msg, details);
            }
          },
          error: (category: string, msg: string, details?: any) => {
            const fullMsg = `[error][${category}] ${msg}`;
            addDebug(fullMsg);
            checkMessageForUnsupported(fullMsg);
            if (originalAtLogger?.error) {
              originalAtLogger.error(category, msg, details);
            }
          }
        };
        
        at.Logger.log = wrappedLogger;
      }


      // Hook console.log
      console.log = (...args: any[]) => {
        const message = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        checkMessageForUnsupported(message);
        return originalLog.apply(console, args);
      };

      // Hook console.info
      console.info = (...args: any[]) => {
        const message = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        checkMessageForUnsupported(message);
        return originalInfo.apply(console, args);
      };

      // Hook console.warn
      console.warn = (...args: any[]) => {
        const message = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        checkMessageForUnsupported(message);
        return originalWarn.apply(console, args);
      };

      // Hook console.error
      console.error = (...args: any[]) => {
        const message = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        checkMessageForUnsupported(message);
        return originalError.apply(console, args);
      };

      // Wait for soundfont and score to be ready
      if (!api.score) {
        throw new Error("Score not loaded in tester player");
      }

      // Small delay to ensure everything is ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast({
        title: "Scanning Instruments",
        description: "Testing each instrument... This will take a few seconds.",
      });

      // Test each instrument one by one
      const MidiEventType = window.alphaTab?.midi?.MidiEventType;
      
      for (let program = 0; program < 128; program++) {
        const instrumentName = INSTRUMENTS.find(i => i.program === program)?.name || `Program ${program}`;
        setCurrentInstrument(instrumentName);
        setScanProgress(((program + 1) / 128) * 100);
        
        // Debug trace
        addDebug(`▶ Testing program ${program} - ${instrumentName}`);

        // Open detection window for this program
        currentProgramCandidate = program;
        detectionActive = true;

        // Attach midiLoad handler to rewrite all program changes to current program
        const midiLoadHandler = (file: any) => {
          for (const ev of file.events) {
            const isPC = MidiEventType 
              ? (ev.type === MidiEventType.ProgramChange || ev.command === MidiEventType.ProgramChange)
              : ev.command === 0xC0;
            if (isPC && ev.channel !== 9) { // Skip drums (channel 9)
              ev.program = program;
            }
          }
        };

        api.midiLoad.on(midiLoadHandler);
        api.loadMidiForScore();
        
        // Force preset loading with brief playback (optimized timing: 50ms total)
        try {
          api.play();
          await new Promise(resolve => setTimeout(resolve, 10));
          api.stop();
        } catch (e) {
          // Ignore playback errors
        }

        api.midiLoad.off(midiLoadHandler);

        // Wait for console messages to arrive (40ms settle time)
        await new Promise(resolve => setTimeout(resolve, 40));
      }

      // Keep detection active for last program with tail wait to catch late logs
      await new Promise(resolve => setTimeout(resolve, 200));
      detectionActive = false;
      currentProgramCandidate = null;

      // Calculate results
      const unsupported = Array.from(capturedUnsupported).sort((a, b) => a - b);
      const working = 128 - unsupported.length;
      
      setUnsupportedPrograms(unsupported);
      setScanResults({ working, unsupported: unsupported.length });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      toast({
        title: "✅ Scan Complete",
        description: `Found ${working} working instruments, ${unsupported.length} unsupported. Duration: ${duration}s`,
      });

    } catch (error: any) {
      console.error('Scan error:', error);
      toast({
        title: "❌ Scan Failed",
        description: error.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      // Restore all console methods
      console.log = originalLog;
      console.info = originalInfo;
      console.warn = originalWarn;
      console.error = originalError;
      
      // Restore AlphaTab Logger
      if (at?.Logger) {
        if (originalAtLogger) {
          at.Logger.log = originalAtLogger;
        }
        if (originalLogLevel !== undefined) {
          at.Logger.logLevel = originalLogLevel;
        }
      }
      
      api.masterVolume = originalVolume;
      setScanning(false);
      setScanProgress(0);
      setCurrentInstrument("");
    }
  };

  const handleConfirmRemoval = async () => {
    try {
      const supported = Array.from({ length: 128 }, (_, i) => i)
        .filter(p => !unsupportedPrograms.includes(p));

      const { error } = await supabase
        .from('app_settings')
        .update({ 
          metadata: { available_instruments: supported }
        })
        .eq('key', 'soundfont_url');

      if (error) throw error;

      toast({
        title: "✅ Updated",
        description: `Saved ${supported.length} supported instruments. Refresh Guitar Pro page to apply.`,
      });

      setScanResults(null);
      setUnsupportedPrograms([]);
      await loadCurrentSetting();
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
            <strong className="block mt-2 text-primary">⚠️ AlphaTab Compatibility:</strong>
            <span className="block mt-1">
              AlphaTab only supports <strong>mono samples</strong>. Many high-quality soundfonts (like FluidR3_GM.sf2) 
              use stereo samples and won't play correctly. The default sonivox.sf2 is optimized for AlphaTab and recommended.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tester Player Section */}
          {testerEmbed && (
            <Card className="border-primary/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Instrument Compatibility Tester</CardTitle>
                    <CardDescription className="text-xs">
                      Preloaded with "{testerEmbed.title}" • Required for scanning
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTesterExpanded(!testerExpanded)}
                  >
                    {testerExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              {testerExpanded && (
                <CardContent className="pt-0">
                  <div className="max-w-2xl">
                    <AlphaTabPlayer
                      fileUrl={testerEmbed.file_url}
                      title={`${testerEmbed.title} (Tester)`}
                      defaultInstrument={testerEmbed.default_instrument}
                      onApiReady={(api) => {
                        testerApiRef.current = api;
                        console.log("Tester API ready");
                      }}
                    />
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Scan Progress */}
          {scanning && (
            <Card className="border-primary">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Testing: {currentInstrument}</span>
                  <span className="text-muted-foreground">{Math.round(scanProgress)}%</span>
                </div>
                <Progress value={scanProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Testing {Math.floor((scanProgress / 100) * 128)}/128 instruments
                </p>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Debug logs</Label>
                  <Button variant="outline" size="sm" onClick={() => setDebugVisible((v) => !v)}>
                    {debugVisible ? 'Hide' : 'Show'} Debug ({debugMessages.length})
                  </Button>
                </div>
                {debugVisible && (
                  <div className="max-h-48 overflow-y-auto border rounded-md p-2 bg-muted/30 text-[11px] font-mono space-y-1">
                    {debugMessages.length === 0 ? (
                      <div className="text-muted-foreground">No messages yet...</div>
                    ) : (
                      debugMessages.map((m, idx) => (
                        <div key={idx} className="whitespace-pre-wrap">{m}</div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Scan Results */}
          {scanResults && !scanning && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="text-lg">Scan Results</CardTitle>
                <CardDescription>
                  {scanResults.working} working instruments, {scanResults.unsupported} unsupported
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Unsupported Instruments ({unsupportedPrograms.length})
                  </Label>
                  <div className="max-h-40 overflow-y-auto border rounded-lg p-3 text-xs space-y-1 bg-muted/30">
                    {unsupportedPrograms.map(program => {
                      const instrument = INSTRUMENTS.find(i => i.program === program);
                      return (
                        <div key={program} className="flex gap-2">
                          <span className="text-muted-foreground w-8">{program}:</span>
                          <span>{instrument?.name || 'Unknown'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <Button onClick={handleConfirmRemoval} className="w-full">
                  Confirm Removal of Unsupported Instruments
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  This will update the available instruments list in the database
                </p>
              </CardContent>
            </Card>
          )}

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
