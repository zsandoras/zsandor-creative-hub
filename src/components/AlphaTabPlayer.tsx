import { useEffect, useRef, useState } from "react";
import * as alphaTab from "@coderline/alphatab";
import { Card } from "@/components/ui/card";
import "@/styles/alphatab.css";
interface AlphaTabPlayerProps {
  fileUrl: string;
  title?: string;
}

interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  tracks: Array<{ index: number; name: string }>;
  selectedTracks: number[];
}

interface DebugState {
  soundFontLoadStarted: boolean;
  soundFontLoadProgress: number;
  soundFontLoaded: boolean;
  playerReady: boolean;
  playerState: number | null;
  playerStateName: string;
  audioContextState: string;
  synthReady: boolean | null;
  isReadyForPlayback: boolean;
  lastEventTime: string;
}

const AlphaTabPlayer = ({ fileUrl, title }: AlphaTabPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    tracks: [],
    selectedTracks: [],
  });
  const [uiEnabled, setUiEnabled] = useState(false);
  const [debugState, setDebugState] = useState<DebugState>({
    soundFontLoadStarted: false,
    soundFontLoadProgress: 0,
    soundFontLoaded: false,
    playerReady: false,
    playerState: null,
    playerStateName: 'unknown',
    audioContextState: 'unknown',
    synthReady: null,
    isReadyForPlayback: false,
    lastEventTime: '',
  });
  
  const log = (msg: string) => setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const getPlayerStateName = (state: number): string => {
    const PlayerState = (alphaTab as any).PlayerState;
    if (!PlayerState) return `State ${state}`;
    const names: Record<number, string> = {
      0: 'Paused',
      1: 'Playing',
      2: 'Stopped',
    };
    return names[state] || `Unknown(${state})`;
  };

  const inspectSynthStatus = () => {
    if (!apiRef.current) return;
    try {
      const api: any = apiRef.current as any;
      const player: any = api.player;
      const synth: any = player?.synthesizer || player?.synth;
      const audioContext: AudioContext | undefined = player?.audioContext || player?.context;
      
      const status = {
        apiPlayerState: api.playerState ?? 'undefined',
        isReadyForPlayback: api.isReadyForPlayback ?? false,
        audioContextState: audioContext?.state ?? 'unknown',
        synthExists: !!synth,
        synthReady: synth?.ready ?? synth?.isReady ?? null,
        synthLoaded: synth?.loaded ?? null,
        masterVolume: api.masterVolume ?? player?.volume ?? 'unknown',
      };
      
      log(`🔍 Synth Status: ${JSON.stringify(status, null, 2)}`);
      console.log('🔍 AlphaTab Deep Inspection:', {
        api: apiRef.current,
        player,
        synth,
        audioContext,
        status,
      });
      
      setDebugState(prev => ({ 
        ...prev,
        audioContextState: status.audioContextState,
        synthReady: status.synthReady,
        isReadyForPlayback: status.isReadyForPlayback,
      }));
    } catch (e: any) {
      log(`❌ Failed to inspect synth: ${e?.message || e}`);
    }
  };
  useEffect(() => {
    if (!containerRef.current) {
      log('No container element available');
      return;
    }

    // Cleanup previous instance if any
    if (apiRef.current) {
      log('Destroying previous AlphaTab instance');
      apiRef.current.destroy();
      apiRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    setLogs([`Init with fileUrl: ${fileUrl}`]);

    // Basic file type guard: .gp (Guitar Pro 7/8) is not supported by alphaTab
    const lowerUrl = (fileUrl || '').toLowerCase();
    if (lowerUrl.endsWith('.gp')) {
      const fmtMsg = 'Unsupported format: .gp (Guitar Pro 7/8). Please upload .gpx (GP6) or .gp3/.gp4/.gp5.';
      log(fmtMsg);
      setError(fmtMsg);
      setIsLoading(false);
      return;
    }

    try {
      // Use Settings object for proper initialization
      const settings = new alphaTab.Settings();
      settings.core.fontDirectory = "/font/";
      settings.core.useWorkers = false;
      settings.display.layoutMode = alphaTab.LayoutMode.Page;
      settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
      settings.player.enableCursor = true;
      settings.player.enableAnimatedBeatCursor = true;
      settings.player.soundFont = window.location.origin + "/soundfont/sonivox.sf2";
      
      // Note: do not set scrollElement to keep defaults and avoid potential init issues
      
      log(`AlphaTab settings prepared. SoundFont: ${settings.player.soundFont}`);

      const api = new alphaTab.AlphaTabApi(containerRef.current, settings);
      apiRef.current = api;
      log('AlphaTabApi created');
      try {
        const mode = api.actualPlayerMode;
        const modeName = (alphaTab as any).PlayerMode?.[mode] ?? String(mode);
        log(`Player actual mode: ${mode} (${modeName})`);
      } catch {}

      const timeoutId = window.setTimeout(() => {
        log('Render timeout after 15s');
        setIsLoading(false);
        setError((prev) => prev ?? 'Render timeout: AlphaTab did not finish rendering.');
      }, 15000);

      // Score load events
      api.scoreLoaded.on(() => {
        const score = api.score;
        if (score) {
          const tracks = score.tracks.map((t: any, i: number) => ({ index: i, name: t.name }));
          setPlayerState((prev) => ({ ...prev, tracks, selectedTracks: [0] }));
          log(`scoreLoaded: ${tracks.length} tracks`);
        } else {
          log('scoreLoaded but no score available');
        }
      });

      // Render events
      api.renderFinished.on(() => {
        log('renderFinished event received');
        window.clearTimeout(timeoutId);
        setIsLoading(false);
        setUiEnabled(true);

        // Extract track info
        const score = api.score;
        if (score) {
          const tracks = score.tracks.map((t: any, i: number) => ({
            index: i,
            name: t.name,
          }));
          setPlayerState((prev) => ({
            ...prev,
            tracks,
            selectedTracks: [0],
          }));
          log(`Loaded ${tracks.length} tracks`);
          // Removed manual soundfont load here; will load on first user gesture to ensure AudioContext is unlocked
        }
      });

      // Player loading events with enhanced diagnostics
      api.soundFontLoad.on((e: any) => {
        const percentage = Math.floor((e.loaded / e.total) * 100);
        setLoadProgress(percentage);
        
        if (!debugState.soundFontLoadStarted) {
          log('🎵 ▶️ SoundFont loading STARTED');
          setDebugState(prev => ({ ...prev, soundFontLoadStarted: true, lastEventTime: new Date().toISOString() }));
        }
        
        log(`🎵 📊 SoundFont loading: ${percentage}% (${e.loaded}/${e.total} bytes)`);
        setDebugState(prev => ({ ...prev, soundFontLoadProgress: percentage }));
        
        if (percentage === 100) {
          log('🎵 ✅ SoundFont download COMPLETE (100%), waiting for soundFontLoaded event...');
        }
      });

      api.soundFontLoaded.on(() => {
        log('🎵 ✓ soundFontLoaded EVENT FIRED - Synth should be connecting');
        setLoadProgress(100);
        setIsPlayerReady(true);
        setDebugState(prev => ({ 
          ...prev, 
          soundFontLoaded: true,
          lastEventTime: new Date().toISOString()
        }));
        inspectSynthStatus();
      });

      api.playerReady.on(() => {
        log(`✅ playerReady EVENT FIRED (isReadyForPlayback=${String(api.isReadyForPlayback)})`);
        setIsPlayerReady(true);
        setLoadProgress(100);
        setUiEnabled(true);
        setDebugState(prev => ({ 
          ...prev, 
          playerReady: true,
          isReadyForPlayback: api.isReadyForPlayback,
          lastEventTime: new Date().toISOString()
        }));
        inspectSynthStatus();
      });

      api.error.on((e: any) => {
        const message = e?.message || e?.reason || e?.toString?.() || 'Unknown error';
        log(`✗ AlphaTab error: ${message}`);
        console.error('AlphaTab error', e);
        window.clearTimeout(timeoutId);
        setError(`AlphaTab error: ${message}`);
        setIsLoading(false);
      });

      // Player state listeners for UI updates
      api.playerStateChanged.on((e: any) => {
        const stateNum = e.state;
        const stateName = getPlayerStateName(stateNum);
        setPlayerState(prev => ({ ...prev, isPlaying: stateNum === 1 }));
        log(`🎮 playerStateChanged: ${stateNum} (${stateName})`);
        setDebugState(prev => ({ 
          ...prev, 
          playerState: stateNum,
          playerStateName: stateName,
          lastEventTime: new Date().toISOString()
        }));
      });

      api.playerPositionChanged.on((e: any) => {
        setPlayerState(prev => ({
          ...prev,
          currentTime: e.currentTime,
          duration: e.endTime
        }));
      });

      // Check for additional events (may not exist in all alphaTab versions)
      if ('midiLoad' in api) {
        (api as any).midiLoad.on((e: any) => {
          log(`🎹 MIDI loading: ${e?.loaded || 0}/${e?.total || 0}`);
        });
      }

      if ('midiLoaded' in api) {
        (api as any).midiLoaded.on(() => {
          log('🎹 ✓ midiLoaded EVENT FIRED');
          inspectSynthStatus();
        });
      }

      if ('audioReady' in api) {
        (api as any).audioReady.on(() => {
          log('🔊 ✓ audioReady EVENT FIRED');
          setDebugState(prev => ({ ...prev, lastEventTime: new Date().toISOString() }));
          inspectSynthStatus();
        });
      }

      // Start loading score after all listeners are attached
      log(`Init order OK. SoundFont=${settings.player.soundFont}. Loading: ${fileUrl}`);
      api.load(fileUrl);
    } catch (e: any) {
      const message = e?.message || e?.toString?.() || 'Unknown init error';
      log(`Init failed: ${message}`);
      console.error('AlphaTab init failed', e);
      setError(`Player failed to initialize: ${message}`);
      setIsLoading(false);
    }

    return () => {
      log('Cleanup: destroying AlphaTab instance');
      if (apiRef.current) {
        try {
          apiRef.current.destroy();
        } catch (e) {
          console.warn('Cleanup error', e);
        }
        apiRef.current = null;
      }
    };
  }, [fileUrl]);

  // Periodic synth status polling during loading
  useEffect(() => {
    if (isLoading || !apiRef.current) return;
    
    const interval = setInterval(() => {
      inspectSynthStatus();
    }, 2000);
    
    return () => clearInterval(interval);
  }, [isLoading]);

  // Auto-unlock AudioContext on first user gesture
  useEffect(() => {
    const handler = async () => {
      try {
        const api: any = apiRef.current as any;
        const player: any = api?.player;
        const ac: AudioContext | undefined = player?.audioContext || player?.context;
        if (ac && ac.state === 'suspended') {
          await ac.resume();
          log('🔓 AudioContext resumed (global user gesture)');
        }
      } catch (e) {
        // ignore
      } finally {
        window.removeEventListener('pointerdown', handler);
        window.removeEventListener('keydown', handler);
        window.removeEventListener('touchstart', handler);
      }
    };
    window.addEventListener('pointerdown', handler, { once: true } as any);
    window.addEventListener('keydown', handler, { once: true } as any);
    window.addEventListener('touchstart', handler, { once: true } as any);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('touchstart', handler);
    };
  }, []);

  const togglePlayPause = async () => {
    if (!apiRef.current) {
      log('API not ready');
      return;
    }

    try {
      await (apiRef.current as any).audioContext?.resume();
      log('🔓 AudioContext resumed');
    } catch (e: any) {
      log(`❌ AudioContext resume failed: ${e?.message || e}`);
    }

    try {
      apiRef.current.playPause();
      log('▶️ playPause() called');
    } catch (e: any) {
      log(`❌ playPause() error: ${e?.message || e}`);
    }
  };
  const stop = () => {
    if (!apiRef.current) return;
    log('⏹ stop() called');
    apiRef.current.stop();
  };

  const handleSeek = (seconds: number) => {
    if (!apiRef.current) return;
    try {
      (apiRef.current as any).seek(seconds);
      setPlayerState(prev => ({ ...prev, currentTime: seconds }));
      log(`⏩ seek(${seconds.toFixed(2)})`);
    } catch (e: any) {
      log(`❌ seek failed: ${e?.message || e}`);
    }
  };

  const setVolume = (vol01: number) => {
    if (!apiRef.current) return;
    const v = Math.max(0, Math.min(1, vol01));
    const api: any = apiRef.current as any;
    try {
      if (typeof api.setVolume === 'function') {
        api.setVolume(v);
      } else if ('volume' in api) {
        api.volume = v;
      } else if (api.player && 'volume' in api.player) {
        api.player.volume = v;
      }
      log(`🔊 volume=${v.toFixed(2)}`);
    } catch (e: any) {
      log(`❌ volume set failed: ${e?.message || e}`);
    }
  };

  const unlockAudio = async () => {
    log('🔧 Initialize Audio clicked');
    try {
      await (apiRef.current as any)?.audioContext?.resume();
      log('🔓 AudioContext resumed');
      apiRef.current?.playPause?.();
      log('▶️ playPause() called');
    } catch (e: any) {
      log(`❌ Audio unlock failed: ${e?.message || e}`);
    }
  };
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="space-y-4">
        <Card className="p-8 bg-card/50 backdrop-blur">
          <p className="text-destructive font-medium mb-2">{error}</p>
          <p className="text-muted-foreground text-sm mb-4">File: {fileUrl}</p>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground mb-2">Debug logs</summary>
            <pre className="text-muted-foreground bg-muted/40 p-3 rounded-md overflow-auto max-h-64">
{logs.join('\n') || 'No logs yet'}
            </pre>
          </details>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <Card className="p-8 bg-card/50 backdrop-blur">
          <p className="text-muted-foreground mb-2">
            Loading{title ? ` ${title}` : ' tab'}...
          </p>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground mb-2">Debug logs</summary>
            <pre className="text-muted-foreground bg-muted/40 p-3 rounded-md overflow-auto max-h-64">
{logs.join('\n') || 'Initializing...'}
            </pre>
          </details>
        </Card>
      )}

      {!isLoading && !error && (
        <Card className="p-4 bg-card/50 backdrop-blur">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={stop}
                disabled={!uiEnabled}
                className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Stop"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              </button>
              <button
                onClick={togglePlayPause}
                disabled={!uiEnabled}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {playerState.isPlaying ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6" y="4" width="4" height="16"></rect>
                      <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                    Pause
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    Play
                  </>
                )}
              </button>
              {!isPlayerReady && (
                <button
                  onClick={unlockAudio}
                  className="px-3 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors"
                  title="Initialize Audio"
                >
                  Initialize Audio
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{formatTime(playerState.currentTime)}</span>
              <span>/</span>
              <span>{formatTime(playerState.duration)}</span>
            </div>

            {playerState.tracks.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-muted-foreground">Tracks:</span>
                {playerState.tracks.map((track) => (
                  <span
                    key={track.index}
                    className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground"
                  >
                    {track.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <details className="mt-3 text-xs" open>
            <summary className="cursor-pointer text-muted-foreground font-semibold mb-2">
              🔍 Debug Panel (Lifecycle Tracking)
            </summary>
            
            {/* Visual State Timeline */}
            <div className="mb-3 p-2 bg-muted/60 rounded-md">
              <div className="font-semibold mb-1">Lifecycle Status:</div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  {debugState.soundFontLoadStarted ? '✅' : '⏳'} SoundFont Download Started
                  {debugState.soundFontLoadStarted && ` (${debugState.soundFontLoadProgress}%)`}
                </div>
                <div className="flex items-center gap-2">
                  {debugState.soundFontLoaded ? '✅' : '⏳'} SoundFont Loaded Event
                </div>
                <div className="flex items-center gap-2">
                  {debugState.playerReady ? '✅' : '⏳'} Player Ready Event
                </div>
                <div className="flex items-center gap-2">
                  {debugState.synthReady === true ? '✅' : debugState.synthReady === false ? '❌' : '⏳'} Synth Ready
                </div>
                <div className="flex items-center gap-2">
                  {debugState.isReadyForPlayback ? '✅' : '❌'} Ready for Playback
                </div>
              </div>
            </div>
            
            {/* Live State Values */}
            <div className="mb-3 p-2 bg-muted/60 rounded-md">
              <div className="font-semibold mb-1">Current State:</div>
              <div className="space-y-1 text-xs font-mono">
                <div>Player State: {debugState.playerStateName} ({debugState.playerState ?? 'null'})</div>
                <div>AudioContext: {debugState.audioContextState}</div>
                <div>Synth Ready: {String(debugState.synthReady)}</div>
                <div>Ready for Playback: {String(debugState.isReadyForPlayback)}</div>
                <div className="text-muted-foreground text-xs mt-1">
                  Last Event: {debugState.lastEventTime || 'none'}
                </div>
              </div>
            </div>
            
            {/* Event Log */}
            <div className="p-2 bg-muted/40 rounded-md">
              <div className="font-semibold mb-1">Event Log:</div>
              <pre className="text-muted-foreground overflow-auto max-h-64">
{logs.join('\n') || 'No logs yet'}
              </pre>
            </div>
          </details>
        </Card>
      )}

      <div className="relative rounded-lg border border-border bg-background/95 backdrop-blur">
        <div className="at-viewport" ref={viewportRef}>
          <div
            ref={containerRef}
            className="w-full min-h-[600px]"
          />
        </div>
      </div>
    </div>
  );
};

export default AlphaTabPlayer;
