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
  const log = (msg: string) => setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
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
      settings.core.file = fileUrl;
      
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
        }
      });

      // Player loading events
      api.soundFontLoad.on((e: any) => {
        const percentage = Math.floor((e.loaded / e.total) * 100);
        setLoadProgress(percentage);
        log(`🎵 SoundFont loading: ${percentage}% (${e.loaded}/${e.total} bytes)`);
      });

      api.soundFontLoaded.on(() => {
        log('🎵 SoundFont fully loaded');
        setLoadProgress(100);
        setIsPlayerReady(true);
      });

      // Temporarily disable MIDI event logs for stability

      api.playerReady.on(() => {
        log(`✓ Player ready - controls enabled (ready=${String(api.isReadyForPlayback)})`);
        setIsPlayerReady(true);
        setLoadProgress(100);
        setUiEnabled(true);
      });

      api.error.on((e: any) => {
        const message = e?.message || e?.reason || e?.toString?.() || 'Unknown error';
        log(`✗ AlphaTab error: ${message}`);
        console.error('AlphaTab error', e);
        window.clearTimeout(timeoutId);
        setError(`AlphaTab error: ${message}`);
        setIsLoading(false);
      });

      // Temporarily disable player state/position subscriptions to avoid noisy init issues
      // api.playerStateChanged.on((e: any) => { ... });
      // api.playerPositionChanged.on((e: any) => { ... });
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

  // Auto-unlock AudioContext on first user gesture
  useEffect(() => {
    const handler = async () => {
      try {
        const player: any = (apiRef.current as any)?.player;
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
      // Resume AudioContext if suspended
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
    log('User clicked Stop');
    apiRef.current.stop();
  };

  const unlockAudio = async () => {
    log('🔧 Initialize Audio clicked');
    try {
      await (apiRef.current as any)?.audioContext?.resume();
      log('🔓 AudioContext resumed');
      apiRef.current?.playPause();
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
          
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-muted-foreground">Debug logs (click to view)</summary>
            <pre className="mt-2 text-muted-foreground bg-muted/40 p-3 rounded-md overflow-auto max-h-48">
{logs.join('\n') || 'No logs yet'}
            </pre>
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
