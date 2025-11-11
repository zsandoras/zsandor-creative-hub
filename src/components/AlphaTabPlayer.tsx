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
  const [isSoundFontLoaded, setIsSoundFontLoaded] = useState(false);
  const [isRenderFinished, setIsRenderFinished] = useState(false);
  const [trackCount, setTrackCount] = useState(0);
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const [needsUserGesture, setNeedsUserGesture] = useState(true);
  const initializingRef = useRef(false);

  const addDebugEvent = (event: string, details?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[AlphaTab] ${event}${details ? ': ' + details : ''}`);
    setDebugEvents((prev) => [...prev, { timestamp, event, details }]);
  };

  const logState = (state: string, details?: string) => {
    addDebugEvent(`STATE: ${state}`, details);
  };

  const initAlphaTab = async () => {
    logState("LOADING", "User clicked - initializing AlphaTab");
    if (initializingRef.current || apiRef.current) {
      logState("LOADING", "Already initialized or initializing");
      return;
    }

    const container = document.getElementById("alphaTab");
    if (!container) {
      logState("ERROR", "Container #alphaTab not found");
      setError("AlphaTab container not found");
      return;
    }

    try {
      initializingRef.current = true;
      setNeedsUserGesture(false);
      setIsLoading(true);
      setError(null);
      setIsPlayerReady(false);
      setIsSoundFontLoaded(false);
      setIsRenderFinished(false);
      setDebugEvents([]);

      // Create Settings - SIMPLIFIED
      const settings = new alphaTab.Settings();
      settings.player.enablePlayer = true;
      settings.player.enableUserInteraction = true; // Allow clicking notation to play
      settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
      settings.player.soundFont = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.6.3/dist/soundfont/sonivox.sf2";
      settings.player.scrollElement = (container.querySelector('.at-viewport') as HTMLElement) || undefined;
      settings.display.layoutMode = alphaTab.LayoutMode.Page;
      settings.display.scale = 1.0;
      settings.notation.notationMode = alphaTab.NotationMode.GuitarPro;
      settings.core.fontDirectory = "/font/";
      settings.core.useWorkers = false;

      logState("LOADING", "Settings configured - single SoundFont URL");

      // Create API
      const api = new alphaTab.AlphaTabApi(container, settings);
      (api as any).masterVolume = playerState.volume / 100;
      apiRef.current = api;
      logState("LOADING", "AlphaTabApi created");

      // Resume AudioContext on user gesture
      const player: any = (api as any).player;
      const ctx = player?.audioContext || player?.context;
      if (ctx) {
        if (ctx.state === "suspended") {
          await ctx.resume();
          logState("LOADING", `AudioContext resumed from suspended`);
        }
        logState("LOADING", `AudioContext state: ${ctx.state}`);
      }

      // Event Listeners
      api.scoreLoaded.on((score: any) => {
        logState("LOADING", `Score loaded - ${score.tracks.length} track(s)`);
        setTrackCount(score.tracks.length);
      });

      api.renderFinished.on(() => {
        logState("RENDER_FINISHED", "Tablature rendered - try clicking the notation to play");
        setIsLoading(false);
        setIsRenderFinished(true);
      });

      api.soundFontLoad.on((e: any) => {
        const pct = e.total > 0 ? Math.floor((e.loaded / e.total) * 100) : null;
        setLoadProgress(pct ?? 0);
        if (pct !== null) {
          logState("LOADING", `SoundFont: ${pct}%`);
        }
      });

      api.soundFontLoaded.on(() => {
        logState("SOUNDFONT_LOADED", "SoundFont ready");
        setLoadProgress(100);
        setIsSoundFontLoaded(true);
      });

      api.playerReady.on(() => {
        logState("PLAYER_READY", "Player ready for playback");
        setIsPlayerReady(true);
      });

      api.playerStateChanged.on((e: any) => {
        setPlayerState((prev) => ({ ...prev, isPlaying: e.state === 1 }));
        const stateMsg = e.state === 1 ? "Playing" : "Stopped";
        logState("PLAYER_STATE", stateMsg);
      });

      api.error.on((error: any) => {
        const errorMsg = error?.message || error?.toString?.() || "Unknown error";
        logState("ERROR", errorMsg);
        setError(`AlphaTab error: ${errorMsg}`);
      });

      logState("LOADING", "Event listeners registered");

      // Load file
      logState("LOADING", `Loading file: ${fileUrl}`);
      api.load(fileUrl);

    } catch (e: any) {
      const message = e?.message || e?.toString?.() || "Unknown error";
      logState("ERROR", `Initialization failed: ${message}`);
      setError(`Failed to initialize: ${message}`);
      setIsLoading(false);
      initializingRef.current = false;
    }
  };


  // Cleanup on unmount
  useEffect(() => {
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
  }, []);

  const togglePlayPause = async () => {
    if (!apiRef.current) return;

    try {
      const api: any = apiRef.current;
      const audioContext = api?.player?.audioContext || api?.player?.context;
      
      // Resume AudioContext if suspended
      if (audioContext && audioContext.state === "suspended") {
        await audioContext.resume();
        logState("PLAY_PAUSE", "AudioContext resumed");
      }

      // Simple direct call - no retry logic
      apiRef.current.playPause();
      logState("PLAY_PAUSE", "playPause() called");
    } catch (e: any) {
      logState("PLAY_PAUSE", `Error: ${e?.message || e}`);
    }
  };

  const stop = () => {
    if (!apiRef.current) return;
    apiRef.current.stop();
    logState("STOP", "stop() called");
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

  return (
    <div className="space-y-6">
      {/* Tablature Display */}
      <Card className="p-4 bg-white">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="font-semibold text-red-700">Error Loading Tablature</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        )}

        {/* Initialization Button */}
        {needsUserGesture && (
          <div className="flex flex-col items-center justify-center py-12">
            <Button onClick={initAlphaTab} size="lg" className="gap-2">
              <Play className="h-5 w-5" />
              Load Tablature & Initialize Player
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Click to load the music sheet and initialize audio playback
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Tip: Once loaded, you can click directly on the notation to play
            </p>
          </div>
        )}

        {/* Loading Indicator */}
        {!needsUserGesture && isLoading && (
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

        {/* AlphaTab Container - always rendered for DOM availability */}
        <div id="alphaTab" className="at-wrap" style={{ display: needsUserGesture ? 'none' : 'block' }}>
          <div className="at-content">
            <div className="at-viewport"></div>
          </div>
        </div>
      </Card>

      {/* Custom Controls */}
      <Card className="p-6 bg-card/50 backdrop-blur">
        <h3 className="text-lg font-semibold mb-4">Playback Controls</h3>
        
        {isRenderFinished && (
          <p className="text-sm text-muted-foreground mb-4">
            💡 Try clicking directly on the rendered tablature to start playback
          </p>
        )}
        
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Button
            onClick={togglePlayPause}
            disabled={!isSoundFontLoaded || !isPlayerReady}
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
            disabled={!isSoundFontLoaded || !isPlayerReady}
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
            max={100}
            step={1}
            className="w-32"
          />
          <span className="text-sm text-muted-foreground min-w-[3ch]">
            {playerState.volume}%
          </span>
        </div>
      </Card>

      {/* Diagnostics - Simplified */}
      <Card className="p-6 bg-card/50 backdrop-blur">
        <details>
          <summary className="text-lg font-semibold mb-4 cursor-pointer">
            Diagnostics
          </summary>
          
          <div className="space-y-4 mt-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Readiness Status</h4>
              <div className="bg-muted/40 p-3 rounded-md text-xs space-y-1">
                <div>{isRenderFinished ? "✅" : "⏳"} Render Finished</div>
                <div>{isSoundFontLoaded ? "✅" : "⏳"} SoundFont Loaded</div>
                <div>{isPlayerReady ? "✅" : "⏳"} Player Ready</div>
                <div className="font-semibold mt-2">
                  {isSoundFontLoaded && isPlayerReady ? "✅ Ready to play" : "⏳ Initializing..."}
                </div>
              </div>
            </div>
          </div>
        </details>
      </Card>

      {/* Status */}
      <Card className="p-6 bg-card/50 backdrop-blur">
        <h3 className="text-lg font-semibold mb-4">Status</h3>
        <div className="grid grid-cols-2 gap-2 text-sm mb-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isRenderFinished ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span>Rendering: {isRenderFinished ? 'Done' : 'In Progress'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isPlayerReady ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span>Player: {isPlayerReady ? 'Ready' : 'Initializing'}</span>
          </div>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer font-semibold mb-2">Event Log</summary>
          <div className="bg-muted/40 p-3 rounded-md max-h-96 overflow-y-auto text-xs font-mono">
            {debugEvents.length === 0 ? (
              <div className="text-muted-foreground">No events yet</div>
            ) : (
              debugEvents.map((evt, idx) => (
                <div key={idx} className="py-1 border-b border-border/20 last:border-0">
                  <span className="text-muted-foreground">[{evt.timestamp}]</span>{" "}
                  <span className="font-semibold">{evt.event}</span>
                  {evt.details && <span className="text-muted-foreground"> - {evt.details}</span>}
                </div>
              ))
            )}
          </div>
        </details>
      </Card>
    </div>
  );
};

export default AlphaTabPlayer;
