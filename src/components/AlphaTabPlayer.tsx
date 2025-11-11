import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Square, Music } from "lucide-react";
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
}

const AlphaTabPlayer = ({ fileUrl, file, title, onReset }: AlphaTabPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState<any[]>([]);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(100);
  const [error, setError] = useState<string | null>(null);

  // Load AlphaTab script from CDN
  useEffect(() => {
    if (window.alphaTab) return;

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/alphaTab.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Initialize AlphaTab
  useEffect(() => {
    if (!containerRef.current || !window.alphaTab) return;
    if (apiRef.current) return;

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
        },
      });

      apiRef.current = api;

      // Event listeners
      api.playerStateChanged.on((e: any) => {
        setIsPlaying(e.state === 1);
      });

      api.scoreLoaded.on((score: any) => {
        setTracks(score.tracks);
        setIsLoading(false);
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
  }, [fileUrl, file]);

  const loadFile = async (api: any) => {
    try {
      if (file) {
        // Load from File object
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        api.load(uint8Array);
      } else if (fileUrl) {
        // Load from URL
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        api.load(uint8Array);
      }
    } catch (e: any) {
      console.error("Failed to load file:", e);
      setError(e?.message || "Failed to load file");
      setIsLoading(false);
    }
  };

  const togglePlayPause = () => {
    if (apiRef.current) {
      apiRef.current.playPause();
    }
  };

  const stop = () => {
    if (apiRef.current) {
      apiRef.current.stop();
    }
  };

  const handlePlaybackSpeedChange = (values: number[]) => {
    const speed = values[0];
    setPlaybackSpeed(speed);
    if (apiRef.current) {
      apiRef.current.playbackSpeed = speed / 100;
    }
  };

  const handleTrackChange = (index: number) => {
    setSelectedTrackIndex(index);
    if (apiRef.current && tracks[index]) {
      apiRef.current.renderTracks([tracks[index]]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tablature Display */}
      <Card className="p-4 bg-card">
        {error && (
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4 mb-4">
            <p className="font-semibold text-destructive">Error Loading Tablature</p>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-center">
              <Music className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
              <p className="text-lg font-semibold">Loading {title || "tablature"}...</p>
            </div>
          </div>
        )}

        <div ref={containerRef} className="alphatab-container" />
      </Card>

      {/* Player Controls */}
      {!isLoading && !error && (
        <Card className="p-6 bg-card">
          <div className="flex flex-col gap-6">
            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={stop}
                title="Stop"
              >
                <Square className="h-4 w-4" />
              </Button>
              
              <Button
                variant="default"
                size="icon"
                onClick={togglePlayPause}
                title="Play/Pause"
                className="h-12 w-12"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
            </div>

            {/* Tempo Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Playback Speed</label>
                <span className="text-sm text-muted-foreground">{playbackSpeed}%</span>
              </div>
              <Slider
                value={[playbackSpeed]}
                onValueChange={handlePlaybackSpeedChange}
                min={25}
                max={200}
                step={5}
                className="w-full"
              />
            </div>

            {/* Track Selector */}
            {tracks.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Track</label>
                <div className="flex flex-wrap gap-2">
                  {tracks.map((track, index) => (
                    <Button
                      key={index}
                      variant={selectedTrackIndex === index ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleTrackChange(index)}
                    >
                      {track.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Reset Button */}
            {onReset && (
              <Button
                variant="outline"
                onClick={onReset}
                className="w-full"
              >
                Load Different File
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AlphaTabPlayer;
