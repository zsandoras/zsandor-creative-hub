import { useEffect, useRef, useState } from "react";
import * as alphaTab from "@coderline/alphatab";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import "@/styles/alphatab.css";

interface AlphaTabPlayerProps {
  fileUrl: string;
  title?: string;
}

interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

interface DebugEvent {
  timestamp: string;
  event: string;
  details?: string;
}

const AlphaTabPlayer = ({ fileUrl, title }: AlphaTabPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 80,
  });
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  const addDebugEvent = (event: string, details?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugEvents((prev) => [...prev, { timestamp, event, details }]);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Cleanup previous instance
    if (apiRef.current) {
      apiRef.current.destroy();
      apiRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    setDebugEvents([]);
    addDebugEvent("Initializing AlphaTab", `File: ${fileUrl}`);

    try {
      // Configure AlphaTab settings
      const settings = new alphaTab.Settings();
      settings.core.fontDirectory = "/font/";
      settings.core.useWorkers = true;
      settings.display.layoutMode = alphaTab.LayoutMode.Page;
      settings.core.engine = "svg";
      
      // Enable player with synthesizer mode
      settings.player.enablePlayer = true;
      settings.player.enableCursor = true;
      settings.player.enableAnimatedBeatCursor = true;
      settings.player.soundFont = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.6.3/dist/soundfont/sonivox.sf2";
      settings.player.playerMode = alphaTab.PlayerMode?.EnabledSynthesizer ?? 2;
      
      addDebugEvent("Settings configured", `SoundFont: ${settings.player.soundFont}`);

      // Create AlphaTab API
      const api = new alphaTab.AlphaTabApi(containerRef.current, settings);
      apiRef.current = api;
      const actualMode = (api as any).settings?.player?.playerMode ?? 'unknown';
      addDebugEvent("AlphaTab API created", `Player mode: ${actualMode}`);

      // Score loaded event
      api.scoreLoaded.on(() => {
        addDebugEvent("Score loaded", `Tracks: ${api.score?.tracks.length || 0}`);
        addDebugEvent("Triggering render");
        api.render();
      });

      // Render finished event
      api.renderFinished.on(() => {
        addDebugEvent("Render finished");
        setIsLoading(false);
      });

      // SoundFont loading progress
      api.soundFontLoad.on((e: any) => {
        const percentage = Math.floor((e.loaded / e.total) * 100);
        setLoadProgress(percentage);
        addDebugEvent("SoundFont loading", `${percentage}%`);
      });

      // SoundFont loaded event
      api.soundFontLoaded.on(() => {
        addDebugEvent("SoundFont loaded");
        setLoadProgress(100);
      });

      // Player ready event
      api.playerReady.on(() => {
        addDebugEvent("Player ready", "Ready for playback");
        setIsPlayerReady(true);
      });

      // Player state changed
      api.playerStateChanged.on((e: any) => {
        const isPlaying = e.state === 1; // 1 = Playing
        setPlayerState((prev) => ({ ...prev, isPlaying }));
        addDebugEvent("Player state changed", isPlaying ? "Playing" : "Paused");
      });

      // Player position changed
      api.playerPositionChanged.on((e: any) => {
        setPlayerState((prev) => ({
          ...prev,
          currentTime: e.currentTime / 1000,
          duration: e.endTime / 1000,
        }));
      });

      // Error handling
      api.error.on((e: any) => {
        const message = e?.message || e?.toString?.() || "Unknown error";
        addDebugEvent("Error", message);
        setError(`AlphaTab error: ${message}`);
        setIsLoading(false);
      });

      // Load the tablature file
      addDebugEvent("Loading tablature file");
      api.load(fileUrl);
    } catch (e: any) {
      const message = e?.message || e?.toString?.() || "Unknown error";
      addDebugEvent("Initialization error", message);
      setError(`Failed to initialize: ${message}`);
      setIsLoading(false);
    }

    return () => {
      if (apiRef.current) {
        apiRef.current.destroy();
        apiRef.current = null;
      }
    };
  }, [fileUrl]);

  // Auto-unlock audio on first user interaction
  useEffect(() => {
    const unlockAudio = async () => {
      try {
        const api: any = apiRef.current;
        const audioContext = api?.player?.audioContext || api?.player?.context;
        if (audioContext && audioContext.state === "suspended") {
          await audioContext.resume();
          addDebugEvent("Audio unlocked", "AudioContext resumed");
        }
      } catch (e) {
        // Ignore
      }
    };

    const handler = () => {
      unlockAudio();
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
    };

    window.addEventListener("click", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });

    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
    };
  }, []);

  const togglePlayPause = async () => {
    if (!apiRef.current) return;

    try {
      // Ensure AudioContext is resumed
      const api: any = apiRef.current;
      const audioContext = api?.player?.audioContext || api?.player?.context;
      if (audioContext && audioContext.state === "suspended") {
        await audioContext.resume();
      }

      apiRef.current.playPause();
      addDebugEvent("Play/Pause toggled");
    } catch (e: any) {
      addDebugEvent("Play/Pause error", e?.message);
    }
  };

  const stop = () => {
    if (!apiRef.current) return;
    apiRef.current.stop();
    addDebugEvent("Stopped");
  };

  const handleVolumeChange = (values: number[]) => {
    const volume = values[0];
    setPlayerState((prev) => ({ ...prev, volume }));
    
    if (apiRef.current) {
      apiRef.current.masterVolume = volume / 100;
      addDebugEvent("Volume changed", `${volume}%`);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (error) {
    return (
      <Card className="p-8 bg-card/50 backdrop-blur">
        <h2 className="text-xl font-semibold text-destructive mb-4">Error Loading Tablature</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground mb-2">Debug Log</summary>
          <div className="bg-muted/40 p-3 rounded-md max-h-48 overflow-auto">
            {debugEvents.map((evt, i) => (
              <div key={i} className="text-xs mb-1">
                <span className="text-muted-foreground">[{evt.timestamp}]</span>{" "}
                <span className="font-medium">{evt.event}</span>
                {evt.details && <span className="text-muted-foreground"> - {evt.details}</span>}
              </div>
            ))}
          </div>
        </details>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tablature Display */}
      <Card className="p-4 bg-card/50 backdrop-blur">
        {isLoading && (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">
              Loading {title || "tablature"}...
            </p>
            {loadProgress > 0 && (
              <p className="text-sm text-muted-foreground">
                SoundFont: {loadProgress}%
              </p>
            )}
          </div>
        )}
        <div 
          ref={containerRef} 
          className="rounded-lg border border-border overflow-hidden"
          data-alphatab
        />
      </Card>

      {/* Custom Controls */}
      <Card className="p-6 bg-card/50 backdrop-blur">
        <h3 className="text-lg font-semibold mb-4">Playback Controls</h3>
        
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Button
            onClick={togglePlayPause}
            disabled={!isPlayerReady}
            size="lg"
            className="gap-2"
          >
            {playerState.isPlaying ? (
              <>
                <Pause className="h-5 w-5" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Play
              </>
            )}
          </Button>
          
          <Button
            onClick={stop}
            disabled={!isPlayerReady}
            variant="secondary"
            size="lg"
            className="gap-2"
          >
            <Square className="h-5 w-5" />
            Stop
          </Button>

          <div className="text-sm text-muted-foreground">
            {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Volume2 className="h-5 w-5 text-muted-foreground" />
          <Slider
            value={[playerState.volume]}
            onValueChange={handleVolumeChange}
            min={0}
            max={100}
            step={1}
            className="flex-1 max-w-xs"
          />
          <span className="text-sm text-muted-foreground w-12">
            {playerState.volume}%
          </span>
        </div>
      </Card>

      {/* Debug/Status Panel */}
      <Card className="p-6 bg-card/50 backdrop-blur">
        <details open>
          <summary className="text-lg font-semibold mb-4 cursor-pointer">
            Debug & Status Panel
          </summary>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Status</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isLoading ? "bg-yellow-500" : "bg-green-500"}`} />
                  <span className="text-muted-foreground">Loading: {isLoading ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isPlayerReady ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-muted-foreground">Player Ready: {isPlayerReady ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Event Log</h4>
              <div className="bg-muted/40 p-3 rounded-md max-h-64 overflow-auto">
                {debugEvents.map((evt, i) => (
                  <div key={i} className="text-xs mb-1 font-mono">
                    <span className="text-muted-foreground">[{evt.timestamp}]</span>{" "}
                    <span className="font-medium">{evt.event}</span>
                    {evt.details && <span className="text-muted-foreground"> - {evt.details}</span>}
                  </div>
                ))}
                {debugEvents.length === 0 && (
                  <p className="text-xs text-muted-foreground">No events yet</p>
                )}
              </div>
            </div>
          </div>
        </details>
      </Card>
    </div>
  );
};

export default AlphaTabPlayer;
