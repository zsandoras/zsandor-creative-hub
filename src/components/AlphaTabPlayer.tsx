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
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [trackCount, setTrackCount] = useState(0);
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);

  const addDebugEvent = (event: string, details?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[AlphaTab] ${event}${details ? ': ' + details : ''}`);
    setDebugEvents((prev) => [...prev, { timestamp, event, details }]);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Cleanup previous instance
    if (apiRef.current) {
      try {
        apiRef.current.destroy();
      } catch (e) {
        console.warn("Error destroying previous alphaTab instance:", e);
      }
      apiRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    setIsPlayerReady(false);
    setTrackCount(0);
    setLoadProgress(0);
    setDebugEvents([]);

    addDebugEvent("Initializing AlphaTab", `File: ${fileUrl}`);

    try {
      // Configure AlphaTab settings following official pattern
      const settings = new alphaTab.Settings();
      settings.core.fontDirectory = "/font/";
      settings.core.useWorkers = false;
      settings.display.layoutMode = alphaTab.LayoutMode.Page;
      settings.display.scale = 1.0;
      
      // Player configuration - CRITICAL: Must be configured BEFORE API creation
      settings.player.enablePlayer = true;
      settings.player.enableCursor = true;
      settings.player.enableAnimatedBeatCursor = true;
      settings.player.enableUserInteraction = true;
      settings.player.soundFont = "/soundfont/sonivox.sf2";
      settings.player.scrollElement = containerRef.current;
      
      // CRITICAL: Set player mode to synthesizer (required for soundfont playback)
      settings.player.playerMode = alphaTab.PlayerMode?.EnabledSynthesizer ?? 2;
      
      addDebugEvent("Settings configured", `Player mode: ${settings.player.playerMode}, SoundFont: sonivox.sf2`);

      // Create AlphaTab API
      const api = new alphaTab.AlphaTabApi(containerRef.current, settings);
      apiRef.current = api;

      addDebugEvent("API created successfully");

      // Event: Score Loaded
      api.scoreLoaded.on((score) => {
        addDebugEvent("Score loaded", `${score?.tracks?.length || 0} tracks`);
        setTrackCount(score?.tracks?.length || 0);
      });

      // Event: Render Finished
      api.renderFinished.on((result) => {
        addDebugEvent("Render finished");
        setIsLoading(false);
      });

      // Event: SoundFont Loading Progress
      api.soundFontLoad.on((e: any) => {
        const percentage = Math.floor((e.loaded / e.total) * 100);
        setLoadProgress(percentage);
        addDebugEvent("SoundFont loading", `${percentage}%`);
      });

      // Event: SoundFont Loaded
      api.soundFontLoaded.on(() => {
        addDebugEvent("SoundFont loaded", "Ready for playback");
        setLoadProgress(100);
      });

      // Event: Player Ready
      api.playerReady.on(() => {
        addDebugEvent("Player ready", "Playback enabled");
        setIsPlayerReady(true);
      });

      // Event: Player State Changed
      api.playerStateChanged.on((e: any) => {
        const isPlaying = e.state === 1; // 1 = Playing
        setPlayerState((prev) => ({ ...prev, isPlaying }));
        addDebugEvent("Player state", isPlaying ? "Playing" : "Paused");
      });

      // Event: Player Position Changed
      api.playerPositionChanged.on((e: any) => {
        setPlayerState((prev) => ({
          ...prev,
          currentTime: e.currentTime / 1000,
          duration: e.endTime / 1000,
        }));
      });

      // Event: Error handling
      api.error.on((e: any) => {
        const message = e?.message || e?.toString?.() || "Unknown error";
        addDebugEvent("Error", message);
        setError(`Failed to load tablature: ${message}`);
        setIsLoading(false);
      });

      // Load the file
      addDebugEvent("Loading file...");
      api.load(fileUrl);

    } catch (e: any) {
      const message = e?.message || e?.toString?.() || "Unknown error";
      addDebugEvent("Initialization error", message);
      setError(`Failed to initialize: ${message}`);
      setIsLoading(false);
    }

    return () => {
      if (apiRef.current) {
        try {
          apiRef.current.destroy();
        } catch (e) {
          console.warn("Error during cleanup:", e);
        }
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
        console.warn("Audio unlock error:", e);
      }
    };

    const handler = () => {
      unlockAudio();
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
    } catch (e: any) {
      console.error("Play/Pause error:", e?.message);
    }
  };

  const stop = () => {
    if (!apiRef.current) return;
    apiRef.current.stop();
  };

  const handleVolumeChange = (values: number[]) => {
    const volume = values[0];
    setPlayerState((prev) => ({ ...prev, volume }));
    
    if (apiRef.current) {
      apiRef.current.masterVolume = volume / 100;
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
        <p className="text-muted-foreground">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tablature Display */}
      <Card className="p-4 bg-white">
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
          data-alphatab
          style={{ minHeight: '600px', width: '100%' }}
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

          {trackCount > 0 && (
            <div className="text-sm text-muted-foreground">
              {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
            </div>
          )}
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

      {/* Status Panel */}
      <Card className="p-6 bg-card/50 backdrop-blur">
        <h3 className="text-lg font-semibold mb-4">Status</h3>
        <div className="grid grid-cols-2 gap-2 text-sm mb-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLoading ? "bg-yellow-500" : "bg-green-500"}`} />
            <span className="text-muted-foreground">Rendering: {isLoading ? "In Progress" : "Complete"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isPlayerReady ? "bg-green-500" : "bg-yellow-500"}`} />
            <span className="text-muted-foreground">Player: {isPlayerReady ? "Ready" : "Loading"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${loadProgress === 100 ? "bg-green-500" : "bg-yellow-500"}`} />
            <span className="text-muted-foreground">SoundFont: {loadProgress === 100 ? "Loaded" : `${loadProgress}%`}</span>
          </div>
        </div>

        <details>
          <summary className="text-sm font-medium mb-2 cursor-pointer">Event Log</summary>
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
        </details>
      </Card>
    </div>
  );
};

export default AlphaTabPlayer;
