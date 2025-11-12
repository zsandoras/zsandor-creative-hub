import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import AlphaTabControls from "./AlphaTabControls";
import { GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import "./AlphaTabPlayer.css";

declare global {
  interface Window {
    alphaTab: any;
  }
}

interface AlphaTabPlayerProps {
  fileUrl?: string;
  file?: File;
  title?: string;
  onReset?: () => void;
  defaultInstrument?: { name: string; program: number } | null;
  onApiReady?: (api: any) => void;
}

const AlphaTabPlayer = ({ fileUrl, file, title, onReset, defaultInstrument, onApiReady }: AlphaTabPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [alphaTabLoaded, setAlphaTabLoaded] = useState<boolean>(!!window.alphaTab);
  const [containerWidth, setContainerWidth] = useState(80); // percentage
  const [containerHeight, setContainerHeight] = useState(1000); // pixels
  const [isHovered, setIsHovered] = useState(false);
  const [scaleControls, setScaleControls] = useState(true);
  const [soundFontLoading, setSoundFontLoading] = useState(false);
  const [soundFontReady, setSoundFontReady] = useState(false);
  const [soundFontUrl, setSoundFontUrl] = useState<string>("https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2");

  // Load soundfont URL from settings
  useEffect(() => {
    const loadSoundfontUrl = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'soundfont_url')
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error("Error loading soundfont URL:", error);
          return;
        }

        if (data?.value) {
          setSoundFontUrl(data.value as string);
        }
      } catch (e) {
        console.error("Failed to load soundfont URL:", e);
      }
    };

    loadSoundfontUrl();
  }, []);

  // Handle wheel events to enable scrolling on hover
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (isHovered) {
        e.stopPropagation();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [isHovered]);

  // Handle spacebar to play/pause (only on guitar pages)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Only handle spacebar on guitar pages (check if AlphaTab player exists)
      if (e.code === "Space" && apiRef.current) {
        e.preventDefault();
        
        // Pause MP3 player if it's playing
        window.dispatchEvent(new CustomEvent('alphaTabPlay'));
        
        // Toggle AlphaTab playback
        apiRef.current.playPause();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, []);

  // Load AlphaTab script from CDN
  useEffect(() => {
    if (window.alphaTab) {
      setAlphaTabLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/alphaTab.js";
    script.async = true;
    script.onload = () => {
      setAlphaTabLoaded(true);
    };
    script.onerror = () => {
      console.error("Failed to load AlphaTab CDN script");
      setError("Failed to load AlphaTab player");
      setIsLoading(false);
    };
    document.body.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Initialize AlphaTab
  useEffect(() => {
    if (!containerRef.current || !alphaTabLoaded || !window.alphaTab) return;
    if (apiRef.current) return;
    setIsLoading(true);

    try {
      const api = new window.alphaTab.AlphaTabApi(containerRef.current, {
        core: {
          fontDirectory: "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/font/",
          logLevel: window.alphaTab.LogLevel?.Debug ?? 1,
        },
        display: {
          layoutMode: window.alphaTab.LayoutMode.Page,
          staveProfile: window.alphaTab.StaveProfile.Default,
          scale: 1.0,
        },
        player: {
          enablePlayer: true,
          soundFont: soundFontUrl,
          enableCursor: true,
          scrollMode: window.alphaTab.ScrollMode.OffScreen,
          scrollElement: containerRef.current, // This is the actual scrollable container
        },
      });

      apiRef.current = api;
      
      // Enable debug logging for synth and bridge worker messages
      try {
        if (api.synth && typeof api.synth.logLevel !== 'undefined') {
          api.synth.logLevel = window.alphaTab.LogLevel?.Debug ?? 1;
        }
        
        // Bridge soundFontLoadFailed events to window
        if (api.synth?.soundFontLoadFailed) {
          api.synth.soundFontLoadFailed.on((details: any) => {
            window.dispatchEvent(new CustomEvent('alphatab-sf-failed', { detail: details }));
          });
        }
        
        // Bridge midiLoadFailed events
        if (api.midiLoadFailed) {
          api.midiLoadFailed.on((err: any) => {
            window.dispatchEvent(new CustomEvent('alphatab-midi-failed', { detail: err }));
          });
        }
        
        // Bridge raw worker messages if available
        if (api.synth?.worker) {
          api.synth.worker.addEventListener('message', (evt: MessageEvent) => {
            if (evt?.data?.type === 'log') {
              window.dispatchEvent(new CustomEvent('alphatab-worker-log', { detail: evt.data }));
            }
          });
        }
      } catch (e) {
        console.warn('Could not setup AlphaTab worker bridges:', e);
      }
      
      // Notify parent component that API is ready
      onApiReady?.(api);

      // Monitor soundfont loading
      setSoundFontLoading(true);
      api.soundFontLoad.on((e: any) => {
        // Track loading progress
        console.log("[AlphaTab] SoundFont loading:", e.loaded, "/", e.total);
      });

      api.soundFontLoaded.on(() => {
        console.log("[AlphaTab] SoundFont loaded successfully");
        setSoundFontLoading(false);
        setSoundFontReady(true);
      });

      // Event listeners
      api.playerStateChanged.on((e: any) => {
        setIsPlaying(e.state === 1);
      });

      api.scoreLoaded.on((score: any) => {
        setTracks(score.tracks);
        // Notify parent again after score is loaded
        onApiReady?.(api);
        // Ensure score header shows title and transcriber (arranger) on print and screen
        try {
          const at = window.alphaTab;
          if (at?.model && at?.platform) {
            if (!score.style) {
              score.style = new at.model.ScoreStyle();
            }
            const HeaderFooterStyle = at.model.HeaderFooterStyle;
            const ScoreSubElement = at.model.ScoreSubElement;
            const TextAlign = at.platform.TextAlign;

            // Title on the left (keeps default if already set)
            score.style.headerAndFooter.set(
              ScoreSubElement.Title,
              new HeaderFooterStyle("%TITLE%", true, TextAlign.Left)
            );

            // Transcriber on the right as "arr. <name>"
            score.style.headerAndFooter.set(
              ScoreSubElement.Transcriber,
              new HeaderFooterStyle("arr. %TABBER%", true, TextAlign.Right)
            );

            // Re-render score to apply header/footer style
            if (typeof api.renderScore === 'function') {
              api.renderScore(score);
            } else {
              api.render();
            }
          }
        } catch (e) {
          console.warn("Failed to apply header/footer style:", e);
        }
      });

      api.renderFinished.on(() => {
        setIsLoading(false);
      });

      api.error.on((error: any) => {
        console.error("AlphaTab error:", error);
        setError(error?.message || "Failed to load tablature");
        setIsLoading(false);
      });

      // Load file
      loadFile(api);
    } catch (e: any) {
      console.error("Failed to initialize AlphaTab:", e);
      setError(e?.message || "Failed to initialize player");
      setIsLoading(false);
    }

    return () => {
      if (apiRef.current) {
        try {
          apiRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying AlphaTab:", e);
        }
        apiRef.current = null;
      }
    };
  }, [alphaTabLoaded, fileUrl, file, soundFontUrl]);

  const loadFile = async (api: any) => {
    try {
      setIsLoading(true);
      if (file) {
        // Load from File object
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        console.log("[AlphaTab] Loading from File, bytes:", uint8Array.byteLength);
        api.load(uint8Array);
        return;
      }

      if (fileUrl) {
        console.log("[AlphaTab] Fetching URL:", fileUrl);
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} when fetching file`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        console.log("[AlphaTab] Loaded bytes:", uint8Array.byteLength);
        api.load(uint8Array);
        return;
      }

      throw new Error("No file or fileUrl provided");
    } catch (e: any) {
      console.warn("[AlphaTab] Typed-array load failed, trying direct URL...", e);
      try {
        if (fileUrl) {
          api.load(fileUrl); // fallback: let AlphaTab fetch the URL itself
          return;
        }
      } catch (inner: any) {
        console.error("Failed to load file (both methods):", inner);
        setError(inner?.message || e?.message || "Failed to load file");
        setIsLoading(false);
      }
    }
  };


  const handleHorizontalResize = (direction: 'left' | 'right', e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startWidth = containerWidth;
    
    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = clientX - startX;
      const parentWidth = wrapperRef.current?.parentElement?.offsetWidth || 1000;
      const deltaPercent = (deltaX / parentWidth) * 100;
      
      let newWidth;
      if (direction === 'left') {
        newWidth = startWidth - (deltaPercent * 2);
      } else {
        newWidth = startWidth + (deltaPercent * 2);
      }
      
      setContainerWidth(Math.max(50, Math.min(500, newWidth)));
    };
    
    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove as any);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove as any);
      document.removeEventListener('touchend', handleEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    document.addEventListener('mousemove', handleMove as any);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove as any, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  const handleVerticalResize = (direction: 'top' | 'bottom', e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startHeight = containerHeight;
    
    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaY = clientY - startY;
      
      let newHeight;
      if (direction === 'top') {
        newHeight = startHeight - (deltaY * 2);
      } else {
        newHeight = startHeight + (deltaY * 2);
      }
      
      setContainerHeight(Math.max(300, Math.min(2000, newHeight)));
    };
    
    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove as any);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove as any);
      document.removeEventListener('touchend', handleEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    document.addEventListener('mousemove', handleMove as any);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove as any, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <>
      {/* Tablature Display - Custom Resizable */}
      <div ref={wrapperRef} className="relative w-full flex justify-center overflow-visible">
        <div 
          className="group relative transition-all duration-200" 
          style={{ 
            width: containerWidth > 100 ? `${containerWidth}vw` : `${containerWidth}%`, 
            minWidth: '400px' 
          }}
        >
          {/* Top Resize Handle */}
          <div
            className="absolute left-0 right-0 top-0 h-2 md:h-1 bg-border/50 hover:bg-primary/50 cursor-ns-resize z-20 opacity-30 md:opacity-0 group-hover:opacity-100 transition-opacity touch-none"
            onMouseDown={(e) => handleVerticalResize('top', e)}
            onTouchStart={(e) => handleVerticalResize('top', e)}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-muted/80 backdrop-blur-sm p-1 rounded">
              <GripVertical className="h-4 w-4 text-muted-foreground rotate-90" />
            </div>
          </div>

          {/* Left Resize Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-2 md:w-1 bg-border/50 hover:bg-primary/50 cursor-ew-resize z-20 opacity-30 md:opacity-0 group-hover:opacity-100 transition-opacity touch-none"
            onMouseDown={(e) => handleHorizontalResize('left', e)}
            onTouchStart={(e) => handleHorizontalResize('left', e)}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-muted/80 backdrop-blur-sm p-1 rounded">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Right Resize Handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2 md:w-1 bg-border/50 hover:bg-primary/50 cursor-ew-resize z-20 opacity-30 md:opacity-0 group-hover:opacity-100 transition-opacity touch-none"
            onMouseDown={(e) => handleHorizontalResize('right', e)}
            onTouchStart={(e) => handleHorizontalResize('right', e)}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-muted/80 backdrop-blur-sm p-1 rounded">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Bottom Resize Handle */}
          <div
            className="absolute left-0 right-0 bottom-0 h-2 md:h-1 bg-border/50 hover:bg-primary/50 cursor-ns-resize z-20 opacity-30 md:opacity-0 group-hover:opacity-100 transition-opacity touch-none"
            onMouseDown={(e) => handleVerticalResize('bottom', e)}
            onTouchStart={(e) => handleVerticalResize('bottom', e)}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-muted/80 backdrop-blur-sm p-1 rounded">
              <GripVertical className="h-4 w-4 text-muted-foreground rotate-90" />
            </div>
          </div>

          <Card 
            className="relative p-4 bg-card border-2 border-border/50 group-hover:border-primary/50 transition-colors overflow-auto" 
            style={{ height: `${containerHeight}px` }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {error && (
              <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4 mb-4">
                <p className="font-semibold text-destructive">Error Loading Tablature</p>
                <p className="text-sm text-destructive/80 mt-1">{error}</p>
              </div>
            )}

            <div className="relative h-full">
              <div ref={containerRef} className="alphatab-container h-full" />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-card/60 backdrop-blur-sm">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="ml-3 text-muted-foreground">Loading score...</span>
                </div>
              )}
              {soundFontLoading && !isLoading && (
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-muted/90 backdrop-blur-sm px-3 py-2 rounded-lg">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-xs text-muted-foreground">Loading high-quality soundfont...</span>
                </div>
              )}
              {soundFontReady && !isLoading && (
                <div className="absolute top-4 right-4 bg-primary/10 backdrop-blur-sm px-3 py-2 rounded-lg animate-in fade-in duration-500">
                  <span className="text-xs text-primary font-medium">✓ Premium soundfont ready</span>
                </div>
              )}
            </div>
          </Card>

          {/* Resize Hint */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-muted/80 backdrop-blur-sm text-xs text-muted-foreground px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Drag edges to resize • {Math.round(containerWidth)}% × {containerHeight}px
          </div>
        </div>
      </div>

      {/* Professional Player Controls */}
      {!isLoading && !error && apiRef.current && (
        <div className="relative w-full flex justify-center mt-6">
          <div 
            className="transition-all duration-200"
            style={{ 
              width: scaleControls 
                ? (containerWidth > 100 ? `${containerWidth}vw` : `${containerWidth}%`)
                : '100%',
              maxWidth: scaleControls ? 'none' : '1152px',
              minWidth: '400px'
            }}
          >
            <AlphaTabControls
              api={apiRef.current}
              isPlaying={isPlaying}
              title={title}
              artist="Unknown Artist"
              fileUrl={fileUrl}
              onOpenFile={onReset}
              tracks={tracks}
              defaultInstrument={defaultInstrument}
              scaleControls={scaleControls}
              onToggleScale={() => setScaleControls(!scaleControls)}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AlphaTabPlayer;
