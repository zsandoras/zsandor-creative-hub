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
  const [diagnostics, setDiagnostics] = useState<any>({
    audioContext: null,
    environment: {
      userAgent: navigator.userAgent,
      origin: window.location.origin,
    },
  });
  const loadProgressRef = useRef(0);
  const initializingRef = useRef(false);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);

  const addDebugEvent = (event: string, details?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[AlphaTab] ${event}${details ? ': ' + details : ''}`);
    setDebugEvents((prev) => [...prev, { timestamp, event, details }]);
  };

  const logState = (state: string, details?: string) => {
    addDebugEvent(`STATE: ${state}`, details);
  };

  // Watchdog: auto-retry if playerReady doesn't fire within 10s of renderFinished
  const startWatchdog = () => {
    if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    
    watchdogTimerRef.current = setTimeout(() => {
      if (isRenderFinished && !isPlayerReady && apiRef.current) {
        logState("WATCHDOG", "PlayerReady timeout - retrying SoundFont load");
        const api: any = apiRef.current;
        
        // Fetch and load SoundFont with proper headers
        const sfUrl = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.6.3/dist/soundfont/sonivox.sf2";
        fetch(sfUrl)
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.arrayBuffer();
          })
          .then(bytes => {
            if (api.loadSoundFont) {
              api.loadSoundFont(bytes, false);
              logState("WATCHDOG", "SoundFont re-loaded from ArrayBuffer");
            }
          })
          .catch(err => {
            logState("WATCHDOG", `SoundFont fetch failed: ${err.message}`);
          });
      }
    }, 10000);
  };

  const clearWatchdog = () => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
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
      clearWatchdog();

      // Create Settings with single automatic SoundFont load
      const settings = new alphaTab.Settings();
      settings.player.enablePlayer = true;
      settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
      settings.player.soundFont = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.6.3/dist/soundfont/sonivox.sf2";
      // Ensure cursor scrolling uses the correct viewport
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
          logState("LOADING", `AudioContext resumed from suspended state`);
        }
        logState("LOADING", `AudioContext state: ${ctx.state}`);
        setDiagnostics((prev: any) => ({
          ...prev,
          audioContext: {
            state: ctx.state,
            sampleRate: ctx.sampleRate,
            baseLatency: ctx.baseLatency,
          },
        }));
      }

      // Event Listeners
      api.scoreLoaded.on((score: any) => {
        logState("LOADING", `Score loaded - ${score.tracks.length} track(s)`);
        setTrackCount(score.tracks.length);
      });

      api.renderFinished.on(() => {
        logState("RENDER_FINISHED", "Tablature rendered successfully");
        setIsLoading(false);
        setIsRenderFinished(true);
        startWatchdog(); // Start watchdog timer
      });

      api.soundFontLoad.on((e: any) => {
        const pct = e.total > 0 ? Math.floor((e.loaded / e.total) * 100) : null;
        setLoadProgress(pct ?? 0);
        loadProgressRef.current = pct ?? 0;
        logState(
          "LOADING",
          pct !== null
            ? `SoundFont: ${pct}% (${e.loaded}/${e.total} bytes)`
            : `SoundFont: ${e.loaded} bytes (total unknown)`
        );
      });

      api.soundFontLoaded.on(() => {
        console.log("✅ SoundFont loaded");
        logState("SOUNDFONT_LOADED", "SoundFont ready for playback");
        setLoadProgress(100);
        loadProgressRef.current = 100;
        setIsSoundFontLoaded(true);
        clearWatchdog(); // Cancel watchdog if SoundFont loads
      });

      api.playerReady.on(() => {
        console.log("✅ Player ready");
        const playerObj: any = (api as any).player;
        const actx = playerObj?.audioContext || playerObj?.context;
        const ctxInfo = actx ? `AudioContext: ${actx.state}` : "No AudioContext";
        logState("PLAYER_READY", ctxInfo);
        setIsPlayerReady(true);
        clearWatchdog(); // Cancel watchdog if player is ready
        
        if (actx) {
          setDiagnostics((prev: any) => ({
            ...prev,
            audioContext: {
              state: actx.state,
              sampleRate: actx.sampleRate,
              baseLatency: actx.baseLatency,
            },
          }));
        }
      });

      api.playerStateChanged.on((e: any) => {
        setPlayerState((prev) => ({ ...prev, isPlaying: e.state === 1 }));
        isPlayingRef.current = e.state === 1;
        if (e.state === 1) {
          logState("PLAYBACK_STARTED", "Playback active");
        } else if (e.state === 0) {
          logState("PLAYBACK_STOPPED", "Playback stopped");
        }
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

  const reloadPlayer = () => {
    logState("RELOAD", "User triggered manual reload");
    clearWatchdog();
    if (apiRef.current) {
      try {
        apiRef.current.destroy();
        apiRef.current = null;
        logState("RELOAD", "Destroyed API instance");
      } catch (e: any) {
        logState("RELOAD", `Error: ${e.message}`);
      }
    }
    window.location.reload();
  };

  // Wait for both SoundFont and Player readiness with a timeout
  const waitForReady = async (timeoutMs = 5000) => {
    const start = Date.now();
    return new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (isSoundFontLoaded && isPlayerReady) {
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timeout waiting for synth readiness"));
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  };

  const testBeep = async () => {
    logState("TEST_BEEP", "Attempting to play note");
    const api: any = apiRef.current;
    if (!api) {
      logState("TEST_BEEP", "No API instance");
      return;
    }

    // Wait for readiness
    if (!isSoundFontLoaded || !isPlayerReady) {
      logState("TEST_BEEP", "Waiting for synth readiness...");
      try {
        await waitForReady(5000);
        logState("TEST_BEEP", "Synth ready");
      } catch {
        logState("TEST_BEEP", "Timeout - synth not ready");
        return;
      }
    }

    try {
      // Ensure AudioContext is resumed
      const player = api.player;
      const ctx = player?.audioContext || player?.context;
      if (ctx && ctx.state === "suspended") {
        await ctx.resume();
        logState("TEST_BEEP", `AudioContext resumed from suspended`);
      }
      if (ctx) {
        logState("TEST_BEEP", `AudioContext state: ${ctx.state}`);
      }

      // Get note to play
      const score = api.score;
      const beat = score?.tracks?.[0]?.staves?.[0]?.bars?.[0]?.voices?.[0]?.beats?.[0];
      const note = beat?.notes?.[0];
      if (!note) {
        logState("TEST_BEEP", "No note found in score");
        return;
      }

      if (typeof api.playNote === "function") {
        api.playNote(note);
        logState("TEST_BEEP", `✅ playNote() called - fret ${note.fret} on string ${note.string}`);
      } else if (typeof (api as any).playBeat === "function" && beat) {
        (api as any).playBeat(beat);
        logState("TEST_BEEP", "✅ playBeat() called (fallback)");
      } else {
        logState("TEST_BEEP", "No playNote/playBeat method available");
      }
    } catch (e: any) {
      logState("TEST_BEEP", `Error: ${e.message}`);
    }
  };

  const dumpState = () => {
    const api: any = apiRef.current;
    const player = api?.player;
    const ctx = player?.audioContext || player?.context;
    
    const state = {
      isPlayerReady,
      isSoundFontLoaded,
      isRenderFinished,
      loadProgress: loadProgressRef.current,
      isReadyForPlayback: api?.isReadyForPlayback,
      containerExists: !!document.getElementById("alphaTab"),
      hasApiRef: !!apiRef.current,
      hasPlayer: !!player,
      audioContext: ctx ? {
        state: ctx.state,
        sampleRate: ctx.sampleRate,
        baseLatency: ctx.baseLatency,
        currentTime: ctx.currentTime,
      } : null,
      masterVolume: api?.masterVolume,
      playerState,
      trackCount,
      tracks: api?.score?.tracks?.length,
    };
    
    logState("STATE_DUMP", JSON.stringify(state, null, 2));
    console.log("[AlphaTab] State dump:", state);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearWatchdog();
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
      if (audioContext && audioContext.state === "suspended") {
        await audioContext.resume();
        logState("PLAY_PAUSE", `AudioContext resumed from ${audioContext.state}`);
      }

      apiRef.current.playPause();
      logState("PLAY_PAUSE", "playPause() called");

      // Fallback nudge: if synth is ready but not playing after a short delay, try play() once
      window.setTimeout(() => {
        const ready = isSoundFontLoaded && isPlayerReady;
        if (!apiRef.current || !ready) return;
        if (!isPlayingRef.current && typeof (apiRef.current as any).player?.play === "function") {
          try {
            (apiRef.current as any).player.play();
            logState("NUDGE", "Retrying play() once after readiness");
          } catch (err: any) {
            logState("NUDGE", `Retry play() error: ${err?.message || err}`);
          }
        }
      }, 1200);
    } catch (e: any) {
      logState("PLAY_PAUSE", `Error: ${e?.message}`);
      console.error("Play/Pause error:", e?.message);
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
              Click to load the music sheet and initialize audio
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

      {/* Diagnostics */}
      <Card className="p-6 bg-card/50 backdrop-blur">
        <details>
          <summary className="text-lg font-semibold mb-4 cursor-pointer">
            Diagnostics & Debug Controls
          </summary>
          
          <div className="space-y-6 mt-4">
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

            <div>
              <h4 className="text-sm font-semibold mb-2">AudioContext</h4>
              <div className="bg-muted/40 p-3 rounded-md text-xs font-mono space-y-1">
                {diagnostics.audioContext ? (
                  <>
                    <div>State: {diagnostics.audioContext.state}</div>
                    <div>SampleRate: {diagnostics.audioContext.sampleRate}Hz</div>
                    <div>BaseLatency: {diagnostics.audioContext.baseLatency ?? "n/a"}</div>
                  </>
                ) : (
                  <div>No AudioContext info yet</div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Debug Controls</h4>
              <div className="flex flex-wrap gap-2">
                <Button onClick={testBeep} size="sm" variant="outline">
                  Test Beep
                </Button>
                <Button onClick={reloadPlayer} size="sm" variant="outline">
                  Reload Player
                </Button>
                <Button onClick={dumpState} size="sm" variant="outline">
                  Dump State
                </Button>
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
