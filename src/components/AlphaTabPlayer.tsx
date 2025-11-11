import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import AlphaTabControls from "./AlphaTabControls";
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
}

const AlphaTabPlayer = ({ fileUrl, file, title, onReset, defaultInstrument }: AlphaTabPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [alphaTabLoaded, setAlphaTabLoaded] = useState<boolean>(!!window.alphaTab);

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
        },
        display: {
          layoutMode: window.alphaTab.LayoutMode.Page,
          staveProfile: window.alphaTab.StaveProfile.Default,
          scale: 1.0,
        },
        player: {
          enablePlayer: true,
          soundFont: "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2",
          enableCursor: true,
          scrollMode: window.alphaTab.ScrollMode.Off,
        },
      });

      apiRef.current = api;

      // Event listeners
      api.playerStateChanged.on((e: any) => {
        setIsPlaying(e.state === 1);
      });

      api.scoreLoaded.on((score: any) => {
        setTracks(score.tracks);
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
  }, [alphaTabLoaded, fileUrl, file]);

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


  return {
    tablature: (
      <Card className="relative p-4 bg-card">
        {error && (
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4 mb-4">
            <p className="font-semibold text-destructive">Error Loading Tablature</p>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
          </div>
        )}

        <div className="relative">
          <div ref={containerRef} className="alphatab-container" />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/60 backdrop-blur-sm">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="ml-3 text-muted-foreground">Loading score...</span>
            </div>
          )}
        </div>
      </Card>
    ),
    controls: !isLoading && !error && apiRef.current ? (
      <AlphaTabControls
        api={apiRef.current}
        isPlaying={isPlaying}
        title={title}
        artist="Unknown Artist"
        fileUrl={fileUrl}
        onOpenFile={onReset}
        tracks={tracks}
        defaultInstrument={defaultInstrument}
      />
    ) : null,
  };
};

export default AlphaTabPlayer;
