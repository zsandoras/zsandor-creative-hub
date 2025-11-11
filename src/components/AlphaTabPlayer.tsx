import { useEffect, useRef, useState } from "react";
import * as alphaTab from "@coderline/alphatab";
import "@coderline/alphatab/dist/alphaTab.webAudio.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  SkipBack, 
  Volume2, 
  Repeat,
  Timer,
  Download,
  ZoomIn,
  LayoutGrid,
  FolderOpen
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  playbackSpeed: number;
  zoom: number;
  countIn: boolean;
  metronome: boolean;
  loop: boolean;
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
    playbackSpeed: 1,
    zoom: 100,
    countIn: false,
    metronome: false,
    loop: false,
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
      settings.player.soundFont = "/soundfont/sonivox.sf2";
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

      // Resume AudioContext on user gesture and check player state
      const player: any = (api as any).player;
      logState("LOADING", `Player object exists: ${!!player}`);
      
      if (player) {
        logState("LOADING", `Player ready state: ${player.ready || player.isReady || 'unknown'}`);
        logState("LOADING", `Player state: ${player.state || 'unknown'}`);
        
        const ctx = player.audioContext || player.context;
        if (ctx) {
          if (ctx.state === "suspended") {
            await ctx.resume();
            logState("LOADING", `AudioContext resumed from suspended`);
          }
          logState("LOADING", `AudioContext state: ${ctx.state}`);
        } else {
          logState("LOADING", `No AudioContext found on player`);
        }
      } else {
        logState("LOADING", `No player object - this means synth not initialized!`);
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
      
      // Check if player is initializing after load
      setTimeout(() => {
        const playerCheck: any = (api as any).player;
        logState("DEBUG", `Player check after load - exists: ${!!playerCheck}`);
        if (playerCheck) {
          logState("DEBUG", `Player isReady: ${playerCheck.isReady}, ready: ${playerCheck.ready}`);
          logState("DEBUG", `Player soundFontLoaded: ${playerCheck.soundFontLoaded}`);
        }
      }, 2000);

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

  const handlePlaybackSpeedChange = (speed: number) => {
    setPlayerState((prev) => ({ ...prev, playbackSpeed: speed }));
    if (apiRef.current) {
      (apiRef.current as any).playbackSpeed = speed;
    }
    logState("PLAYBACK_SPEED", `Set to ${speed}x`);
  };

  const handleZoomChange = (zoom: number) => {
    setPlayerState((prev) => ({ ...prev, zoom }));
    if (apiRef.current) {
      const settings = (apiRef.current as any).settings;
      if (settings) {
        settings.display.scale = zoom / 100;
        apiRef.current.updateSettings();
        apiRef.current.render();
      }
    }
    logState("ZOOM", `Set to ${zoom}%`);
  };

  const toggleCountIn = () => {
    setPlayerState((prev) => ({ ...prev, countIn: !prev.countIn }));
    if (apiRef.current) {
      (apiRef.current as any).countInVolume = !playerState.countIn ? 1 : 0;
    }
  };

  const toggleMetronome = () => {
    setPlayerState((prev) => ({ ...prev, metronome: !prev.metronome }));
    if (apiRef.current) {
      (apiRef.current as any).metronomeVolume = !playerState.metronome ? 1 : 0;
    }
  };

  const toggleLoop = () => {
    setPlayerState((prev) => ({ ...prev, loop: !prev.loop }));
    if (apiRef.current) {
      (apiRef.current as any).isLooping = !playerState.loop;
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

      {/* Professional Player Controls */}
      {!needsUserGesture && isRenderFinished && (
        <Card className="p-0 bg-card border-border overflow-hidden">
          <div className="flex items-center justify-between gap-4 p-4 bg-muted/30">
            {/* Left Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="ghost"
                size="icon"
                onClick={stop}
                disabled={!isPlayerReady}
                title="Stop"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              
              <Button
                variant="default"
                size="icon"
                onClick={togglePlayPause}
                disabled={!isPlayerReady}
                title="Play/Pause"
              >
                {playerState.isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>

              {/* Playback Speed Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 px-3">
                    {playerState.playbackSpeed}x
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {[0.25, 0.5, 0.75, 0.9, 1, 1.25, 1.5, 2].map((speed) => (
                    <DropdownMenuItem
                      key={speed}
                      onClick={() => handlePlaybackSpeedChange(speed)}
                    >
                      {speed}x
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Song Info */}
              <div className="hidden md:flex items-center gap-2 text-sm px-2">
                <span className="font-semibold text-foreground">{title || "Tablature"}</span>
              </div>

              {/* Time Display */}
              <div className="text-sm text-muted-foreground px-2">
                {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Count-In Toggle */}
              <Button
                variant={playerState.countIn ? "default" : "ghost"}
                size="icon"
                onClick={toggleCountIn}
                title="Count-In"
              >
                <Timer className="h-4 w-4" />
              </Button>

              {/* Metronome Toggle */}
              <Button
                variant={playerState.metronome ? "default" : "ghost"}
                size="icon"
                onClick={toggleMetronome}
                title="Metronome"
              >
                <Timer className="h-4 w-4" />
              </Button>

              {/* Loop Toggle */}
              <Button
                variant={playerState.loop ? "default" : "ghost"}
                size="icon"
                onClick={toggleLoop}
                title="Loop"
              >
                <Repeat className="h-4 w-4" />
              </Button>

              {/* Download */}
              <Button
                variant="ghost"
                size="icon"
                title="Download"
                onClick={() => window.open(fileUrl, '_blank')}
              >
                <Download className="h-4 w-4" />
              </Button>

              {/* Zoom Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 px-3 gap-1">
                    <ZoomIn className="h-4 w-4" />
                    {playerState.zoom}%
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {[25, 50, 75, 90, 100, 110, 125, 150, 200].map((zoom) => (
                    <DropdownMenuItem
                      key={zoom}
                      onClick={() => handleZoomChange(zoom)}
                    >
                      {zoom}%
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Layout Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" title="Layout">
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Page Layout</DropdownMenuItem>
                  <DropdownMenuItem>Horizontal</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Volume Control */}
              <div className="hidden lg:flex items-center gap-2 px-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <Slider
                  value={[playerState.volume]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground min-w-[3ch]">
                  {playerState.volume}%
                </span>
              </div>
            </div>
          </div>

          {/* Tip for Click-to-Play */}
          <div className="px-4 py-2 bg-muted/20 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              💡 Tip: Click directly on the rendered tablature to start playback
            </p>
          </div>
        </Card>
      )}

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
