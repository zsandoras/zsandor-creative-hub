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
      const settings = new alphaTab.Settings();
      // Fonts served locally from /public
      settings.core.fontDirectory = "/font/";
      // Disable workers for simpler bundler setup
      settings.core.useWorkers = false;
      // Display layout
      settings.display.layoutMode = alphaTab.LayoutMode.Page;
      // Enable player
      settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
      settings.player.enablePlayer = true; // keep for older versions
      settings.player.enableCursor = true;
      settings.player.soundFont = "/soundfont/sonivox.sf2";
      (settings.player as any).scrollElement = viewportRef.current as any;
      // Load file directly
      settings.core.file = fileUrl;
      log('AlphaTab settings prepared');

      const api = new alphaTab.AlphaTabApi(containerRef.current, settings);
      apiRef.current = api;
      log('AlphaTabApi created');

      try {
        // Explicitly trigger load as a fallback (in addition to settings.core.file)
        api.load(fileUrl as any);
        log('api.load(fileUrl) called');
      } catch (e: any) {
        log(`api.load failed: ${e?.message || e}`);
      }

      const timeoutId = window.setTimeout(() => {
        log('Render timeout after 15s');
        setIsLoading(false);
        setError((prev) => prev ?? 'Render timeout: AlphaTab did not finish rendering.');
      }, 15000);

      // Render events
      api.renderFinished.on(() => {
        log('renderFinished event received');
        window.clearTimeout(timeoutId);
        setIsLoading(false);

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
            selectedTracks: [0], // Select first track by default
          }));
          log(`Loaded ${tracks.length} tracks`);
        }
      });

      // Player loading events
      api.soundFontLoad.on((e: any) => {
        const percentage = Math.floor((e.loaded / e.total) * 100);
        setLoadProgress(percentage);
        log(`SoundFont loading: ${percentage}%`);
      });

      api.playerReady.on(() => {
        log('Player ready');
        setIsPlayerReady(true);
      });

      api.error.on((e: any) => {
        const message = e?.message || e?.reason || e?.toString?.() || 'Unknown error';
        log(`AlphaTab error: ${message}`);
        console.error('AlphaTab error', e);
        window.clearTimeout(timeoutId);
        setError(`AlphaTab error: ${message}`);
        setIsLoading(false);
      });

      // Player events - following alphaTab official pattern
      api.playerStateChanged.on((e: any) => {
        const isPlaying = e.state === alphaTab.synth.PlayerState.Playing;
        setPlayerState((prev) => ({ ...prev, isPlaying }));
        log(`Player state: ${isPlaying ? 'Playing' : 'Paused'}`);
      });

      api.playerPositionChanged.on((e: any) => {
        setPlayerState((prev) => ({
          ...prev,
          currentTime: e.currentTime / 1000,
          duration: e.endTime / 1000,
        }));
      });
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

  const togglePlayPause = () => {
    if (!apiRef.current || !isPlayerReady) return;
    apiRef.current.playPause(); // Use playPause() as per alphaTab official docs
  };

  const stop = () => {
    if (!apiRef.current || !isPlayerReady) return;
    apiRef.current.stop();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <Card className="p-8 bg-card/50 backdrop-blur">
        <p className="text-destructive font-medium mb-2">{error}</p>
        <p className="text-muted-foreground text-sm mb-4">File: {fileUrl}</p>
        <pre className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-md overflow-auto max-h-64">
{logs.join('\n') || 'No logs yet'}
        </pre>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <Card className="p-8 bg-card/50 backdrop-blur">
          <p className="text-muted-foreground mb-2">
            Loading{title ? ` ${title}` : ' tab'}...
          </p>
          <pre className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-md overflow-auto max-h-64">
{logs.join('\n') || 'Initializing...'}
          </pre>
        </Card>
      )}

      {!isLoading && !error && (
        <Card className="p-4 bg-card/50 backdrop-blur">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={stop}
                disabled={!isPlayerReady}
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
                disabled={!isPlayerReady}
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
                <span className="text-sm text-muted-foreground">
                  Loading player... {loadProgress}%
                </span>
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
        </Card>
      )}

      <div className="relative rounded-lg border border-border bg-background/95 backdrop-blur">
        <div className="at-viewport" ref={viewportRef}>
          <div
            ref={containerRef}
            className="w-full min-h-[600px]"
            style={{ visibility: isLoading ? "hidden" : "visible" }}
          />
        </div>
      </div>
    </div>
  );
};

export default AlphaTabPlayer;
