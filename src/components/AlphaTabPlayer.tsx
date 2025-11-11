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
  const [allowPlayWithoutReady, setAllowPlayWithoutReady] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>({
    soundFontProbe: null,
    audioContext: null,
    environment: {
      userAgent: navigator.userAgent,
      origin: window.location.origin,
    },
  });
  const loadProgressRef = useRef(0);
  const initializingRef = useRef(false);
  const readySetRef = useRef(false);

  const addDebugEvent = (event: string, details?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[AlphaTab] ${event}${details ? ': ' + details : ''}`);
    setDebugEvents((prev) => [...prev, { timestamp, event, details }]);
  };

  const probeSoundFont = async (url: string) => {
    addDebugEvent("SoundFont probe", `Testing ${url}`);
    try {
      let res = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (!res.ok || !res.headers.get("content-length")) {
        addDebugEvent("SoundFont probe", "HEAD failed, trying Range GET");
        res = await fetch(url, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
          cache: "no-store",
        });
      }
      const probeResult = {
        status: res.status,
        statusText: res.statusText,
        contentLength: res.headers.get("content-length"),
        contentType: res.headers.get("content-type"),
        url,
      };
      setDiagnostics((prev: any) => ({ ...prev, soundFontProbe: probeResult }));
      addDebugEvent(
        "SoundFont probe OK",
        `${res.status}, ${(parseInt(res.headers.get("content-length") || "0") / 1024 / 1024).toFixed(2)}MB`
      );
    } catch (e: any) {
      const probeResult = { error: e.message, url };
      setDiagnostics((prev: any) => ({ ...prev, soundFontProbe: probeResult }));
      addDebugEvent("SoundFont probe error", e.message);
    }
  };

  const forceInit = async () => {
    addDebugEvent("Force init", "Starting forced initialization sequence");
    const api = apiRef.current;
    if (!api) {
      addDebugEvent("Force init", "No API instance available");
      return;
    }
    try {
      addDebugEvent("Force init", "Attempting play()");
      await api.play();
      addDebugEvent("Force init", "play() called successfully");
      
      const player: any = api.player;
      if (player) {
        const ctx = player.audioContext || player.context;
        if (ctx) {
          addDebugEvent("Force init", `AudioContext state: ${ctx.state}`);
          setDiagnostics((prev: any) => ({
            ...prev,
            audioContext: {
              state: ctx.state,
              sampleRate: ctx.sampleRate,
              baseLatency: ctx.baseLatency,
            },
          }));
        }
      }

      setTimeout(() => {
        try {
          api.stop();
          addDebugEvent("Force init", "stop() called");
        } catch (e: any) {
          addDebugEvent("Force init stop error", e.message);
        }
      }, 250);
    } catch (e: any) {
      addDebugEvent("Force init error", e.message);
    }
  };

  const reloadPlayer = () => {
    addDebugEvent("Manual reload", "User triggered reload");
    if (apiRef.current) {
      try {
        apiRef.current.destroy();
        apiRef.current = null;
        addDebugEvent("Manual reload", "Destroyed old instance");
      } catch (e: any) {
        addDebugEvent("Manual reload error", e.message);
      }
    }
    window.location.reload();
  };

  const testBeep = async () => {
    addDebugEvent("Test Beep", "Attempting to play note via synthesizer");
    const api: any = apiRef.current;
    if (!api) {
      addDebugEvent("Test Beep", "No API instance");
      return;
    }

    try {
      // Ensure AudioContext is resumed
      const player = api.player;
      const ctx = player?.audioContext || player?.context;
      if (ctx && ctx.state === "suspended") {
        await ctx.resume();
        addDebugEvent("Test Beep", `AudioContext resumed (was suspended)`);
      }

      // Ensure synthesizer is ready
      if (!api.isReadyForPlayback) {
        addDebugEvent("Test Beep", "Synth not ready, calling forceInit()");
        await forceInit();
      }

      // Require a valid Note object per AlphaTab docs
      const score = api.score;
      const note = score?.tracks?.[0]?.staves?.[0]?.bars?.[0]?.voices?.[0]?.beats?.[0]?.notes?.[0];
      if (!note) {
        addDebugEvent("Test Beep", "No note found in score to play");
        return;
      }

      if (typeof api.playNote === "function") {
        api.playNote(note);
        addDebugEvent("Test Beep", "api.playNote(first note) called");
      } else if (typeof player?.playNote === "function") {
        player.playNote(note);
        addDebugEvent("Test Beep", "player.playNote(first note) called");
      } else {
        addDebugEvent("Test Beep", "No playNote method on API or player");
      }
    } catch (e: any) {
      addDebugEvent("Test Beep error", e.message);
    }
  };

  const resetSynth = async () => {
    addDebugEvent("Reset Synth", "Resetting soundfonts and reloading");
    const api: any = apiRef.current;
    if (!api) {
      addDebugEvent("Reset Synth", "No API instance");
      return;
    }
    
    try {
      const soundFontUrl = `${window.location.origin}/soundfont/sonivox.sf2`;
      
      if (api.resetSoundFonts) {
        api.resetSoundFonts();
        addDebugEvent("Reset Synth", "resetSoundFonts() called");
      } else {
        addDebugEvent("Reset Synth", "resetSoundFonts() not available");
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (api.loadSoundFontFromUrl) {
        api.loadSoundFontFromUrl(soundFontUrl, true);
        addDebugEvent("Reset Synth", "loadSoundFontFromUrl() called");
      } else {
        addDebugEvent("Reset Synth", "loadSoundFontFromUrl() not available");
      }
    } catch (e: any) {
      addDebugEvent("Reset Synth error", e.message);
    }
  };

  const dumpState = () => {
    const api: any = apiRef.current;
    const player = api?.player;
    const ctx = player?.audioContext || player?.context;
    
    const state = {
      isPlayerReady,
      loadProgress: loadProgressRef.current,
      actualPlayerMode: api?.actualPlayerMode,
      isReadyForPlayback: api?.isReadyForPlayback,
      containerExists: !!containerRef.current,
      hasApiRef: !!apiRef.current,
      hasPlayer: !!player,
      playerKeys: player ? Object.keys(player).slice(0, 10) : [],
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
    
    addDebugEvent("State dump", JSON.stringify(state, null, 2));
    console.log("[AlphaTab] State dump:", state);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Prevent double initialization
    if (initializingRef.current) {
      addDebugEvent("Init guard", "Already initializing, skipping");
      return;
    }

    // Width check - ensure container has dimensions before init
    const checkWidth = () => {
      const width = containerRef.current?.offsetWidth || 0;
      if (width === 0) {
        addDebugEvent("Width check", "Container width is 0, retrying...");
        return false;
      }
      addDebugEvent("Width check", `Container width: ${width}px`);
      return true;
    };

    // Retry width check with requestAnimationFrame
    let widthCheckAttempts = 0;
    const maxWidthChecks = 10;
    
    const initWhenReady = () => {
      if (!checkWidth()) {
        widthCheckAttempts++;
        if (widthCheckAttempts < maxWidthChecks) {
          requestAnimationFrame(initWhenReady);
        } else {
          addDebugEvent("Width check failed", "Max attempts reached, proceeding anyway");
          startInit();
        }
      } else {
        startInit();
      }
    };

    const startInit = () => {
      initializingRef.current = true;

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
      loadProgressRef.current = 0;
      readySetRef.current = false;
      setDebugEvents([]);

      addDebugEvent("Initializing AlphaTab", `File: ${fileUrl}`);
      addDebugEvent("Init mode", "player=enabled (minimal synth mode)");

      const soundFontUrl = `${window.location.origin}/soundfont/sonivox.sf2`;
      
      // Probe SoundFont with a HEAD/Range request first
      probeSoundFont(soundFontUrl);

      try {
        const settings = {
          core: {
            file: fileUrl,
            fontDirectory: "/font/",
            useWorkers: false, // Keep false for stability
          },
          player: {
            enablePlayer: true, // RE-ENABLED for audio
            enableCursor: false, // Keep cursor disabled for now
            enableUserInteraction: false, // Keep interaction disabled for now
            scrollMode: "off" as any, // No scrolling
            soundFont: soundFontUrl,
          },
          display: {
            layoutMode: alphaTab.LayoutMode.Page,
            scale: 1.0,
          },
          notation: {
            notationMode: alphaTab.NotationMode.GuitarPro,
          },
        };

        addDebugEvent(
          "Settings configured",
          "player=enabled, cursor/interaction=disabled"
        );

        // Create AlphaTab API with settings (file loads automatically)
        const api = new alphaTab.AlphaTabApi(containerRef.current, settings);
        apiRef.current = api;
        addDebugEvent("API creation successful", "Instance created");

        // Event listeners - minimal set with player enabled
        api.scoreLoaded.on((score: any) => {
          addDebugEvent("Score loaded", `Track count: ${score.tracks.length}`);
          setTrackCount(score.tracks.length);
        });

        api.renderFinished.on(() => {
          addDebugEvent("Render finished", "Tablature rendered successfully");
          setIsLoading(false);
        });

        api.soundFontLoad.on((e: any) => {
          const percentage = Math.floor((e.loaded / e.total) * 100);
          setLoadProgress(percentage);
          loadProgressRef.current = percentage;
          addDebugEvent(
            "SoundFont loading",
            `${percentage}% (${e.loaded}/${e.total} bytes)`
          );
        });

        api.soundFontLoaded.on(() => {
          addDebugEvent("SoundFont loaded", "Ready for playback");
          setLoadProgress(100);
          loadProgressRef.current = 100;
        });

        api.playerReady.on(() => {
          const player: any = api.player;
          const ctx = player?.audioContext || player?.context;
          const ctxInfo = ctx ? `AudioContext: ${ctx.state}` : "No AudioContext";
          addDebugEvent("Player ready", ctxInfo);
          setIsPlayerReady(true);
          
          if (ctx) {
            setDiagnostics((prev: any) => ({
              ...prev,
              audioContext: {
                state: ctx.state,
                sampleRate: ctx.sampleRate,
                baseLatency: ctx.baseLatency,
              },
            }));
          }
        });

        api.error.on((error: any) => {
          const errorMsg = error?.message || error?.toString?.() || "Unknown error";
          addDebugEvent("AlphaTab error", errorMsg);
          setError(`AlphaTab error: ${errorMsg}`);
        });

        addDebugEvent("Event listeners registered", "Minimal player events subscribed");

      } catch (e: any) {
        const message = e?.message || e?.toString?.() || "Unknown error";
        addDebugEvent("Initialization error", message);
        setError(`Failed to initialize: ${message}`);
        setIsLoading(false);
      }
    };

    initWhenReady();

    return () => {
      initializingRef.current = false;
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
        addDebugEvent("Play/Pause", `AudioContext resumed from ${audioContext.state}`);
      }

      apiRef.current.playPause();
      addDebugEvent("Play/Pause", "playPause() called");
    } catch (e: any) {
      addDebugEvent("Play/Pause error", e?.message);
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

  return (
    <div className="space-y-6">
      {/* Tablature Display */}
      <Card className="p-4 bg-white">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="font-semibold text-red-700">Error Loading Tablature</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        )}

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
          style={{ minHeight: '600px', width: '100%' }}
        />
      </Card>

      {/* Custom Controls */}
      <Card className="p-6 bg-card/50 backdrop-blur">
        <h3 className="text-lg font-semibold mb-4">Playback Controls</h3>
        
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Button
            onClick={togglePlayPause}
            disabled={!isPlayerReady && !allowPlayWithoutReady}
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
            disabled={!isPlayerReady && !allowPlayWithoutReady}
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

      {/* Diagnostics Panel */}
      <Card className="p-6 bg-card/50 backdrop-blur">
        <details open>
          <summary className="text-lg font-semibold mb-4 cursor-pointer">
            Diagnostics & Debug Controls
          </summary>
          
          <div className="space-y-6 mt-4">
            {/* Environment */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Environment</h4>
              <div className="bg-muted/40 p-3 rounded-md text-xs font-mono space-y-1">
                <div>Origin: {diagnostics.environment.origin}</div>
                <div className="truncate">UA: {diagnostics.environment.userAgent}</div>
              </div>
            </div>

            {/* AlphaTab Info */}
            <div>
              <h4 className="text-sm font-semibold mb-2">AlphaTab</h4>
              <div className="bg-muted/40 p-3 rounded-md text-xs font-mono space-y-1">
                <div>PlayerMode: {alphaTab.PlayerMode?.EnabledSynthesizer ?? 2} (EnabledSynthesizer)</div>
                <div>LayoutMode: {alphaTab.LayoutMode.Page} (Page)</div>
                <div>Version check: {typeof alphaTab.PlayerMode}</div>
              </div>
            </div>

            {/* Audio */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Audio</h4>
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

            {/* SoundFont */}
            <div>
              <h4 className="text-sm font-semibold mb-2">SoundFont</h4>
              <div className="bg-muted/40 p-3 rounded-md text-xs font-mono space-y-1">
                <div>URL: {window.location.origin}/soundfont/sonivox.sf2</div>
                {diagnostics.soundFontProbe ? (
                  diagnostics.soundFontProbe.error ? (
                    <div className="text-destructive">Error: {diagnostics.soundFontProbe.error}</div>
                  ) : (
                    <>
                      <div>Status: {diagnostics.soundFontProbe.status} {diagnostics.soundFontProbe.statusText}</div>
                      <div>Size: {diagnostics.soundFontProbe.contentLength} bytes</div>
                      <div>Type: {diagnostics.soundFontProbe.contentType}</div>
                    </>
                  )
                ) : (
                  <div>Probe pending...</div>
                )}
              </div>
            </div>

            {/* Debug Controls */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Debug Controls</h4>
              <div className="flex flex-wrap gap-2">
                <Button onClick={forceInit} size="sm" variant="outline">
                  Force Init (Play/Stop)
                </Button>
                <Button onClick={testBeep} size="sm" variant="outline">
                  Test Beep
                </Button>
                <Button onClick={resetSynth} size="sm" variant="outline">
                  Reset Synth + Reload SoundFont
                </Button>
                <Button
                  onClick={() => probeSoundFont(`${window.location.origin}/soundfont/sonivox.sf2`)}
                  size="sm"
                  variant="outline"
                >
                  Test SoundFont URL
                </Button>
                <Button onClick={reloadPlayer} size="sm" variant="outline">
                  Reload Player
                </Button>
                <Button onClick={dumpState} size="sm" variant="outline">
                  Dump State
                </Button>
              </div>
            </div>

            {/* Diagnostic Toggle */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Diagnostic Options</h4>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowPlayWithoutReady}
                  onChange={(e) => setAllowPlayWithoutReady(e.target.checked)}
                  className="rounded"
                />
                <span>Allow Play without Ready (for testing)</span>
              </label>
            </div>
          </div>
        </details>
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
        
        {!isPlayerReady && (
          <p className="text-xs text-muted-foreground mb-4">
            💡 If player stuck loading, try <strong>Force Init</strong> in Diagnostics above
          </p>
        )}

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
