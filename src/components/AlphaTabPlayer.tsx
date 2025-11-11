import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface AlphaTabPlayerProps {
  fileUrl: string;
  title: string;
}

const AlphaTabPlayer = ({ fileUrl, title }: AlphaTabPlayerProps) => {
  const alphaTabRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tempo, setTempo] = useState([100]);
  const [volume, setVolume] = useState([100]);

  useEffect(() => {
    if (!alphaTabRef.current) return;

    const loadAlphaTab = async () => {
      try {
        // Dynamically import AlphaTab
        const AlphaTabApi = (await import("@coderline/alphatab")).AlphaTabApi;
        
        // Initialize AlphaTab
        const settings = {
          file: fileUrl,
          core: {
            engine: "html5",
            logLevel: 1,
            useWorkers: true,
            fontDirectory: "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/font/",
          },
          player: {
            enablePlayer: true,
            enableCursor: true,
            enableUserInteraction: true,
            soundFont: "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2",
          },
          display: {
            staveProfile: "ScoreTab" as const,
            layoutMode: "page" as const,
          },
        };

        const alphaTab = new AlphaTabApi(alphaTabRef.current, settings);
        
        // Set up event listeners
        alphaTab.playerStateChanged.on((state: any) => {
          setIsPlaying(state.state === 1); // 1 = playing
        });

        alphaTab.renderFinished.on(() => {
          setIsLoading(false);
        });

        alphaTab.error.on((error: any) => {
          console.error("AlphaTab error:", error);
          setError("Failed to load guitar tab. Please check the file format.");
          setIsLoading(false);
        });

        setApi(alphaTab);
      } catch (err) {
        console.error("Failed to initialize AlphaTab:", err);
        setError("Failed to initialize player");
        setIsLoading(false);
      }
    };

    loadAlphaTab();

    return () => {
      if (api) {
        api.destroy();
      }
    };
  }, [fileUrl]);

  useEffect(() => {
    if (api && api.player) {
      api.player.playbackSpeed = tempo[0] / 100;
    }
  }, [tempo, api]);

  useEffect(() => {
    if (api && api.player) {
      api.player.volume = volume[0] / 100;
    }
  }, [volume, api]);

  const togglePlay = () => {
    if (api) {
      if (isPlaying) {
        api.pause();
      } else {
        api.play();
      }
    }
  };

  const stop = () => {
    if (api) {
      api.stop();
    }
  };

  if (error) {
    return (
      <Card className="p-8 text-center bg-card/50 backdrop-blur">
        <p className="text-destructive">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card/50 backdrop-blur">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-2">
            <Button
              onClick={togglePlay}
              disabled={isLoading}
              size="icon"
              variant="default"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              onClick={stop}
              disabled={isLoading}
              size="icon"
              variant="secondary"
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Label className="text-sm whitespace-nowrap">Tempo: {tempo[0]}%</Label>
            <Slider
              value={tempo}
              onValueChange={setTempo}
              min={50}
              max={200}
              step={5}
              className="flex-1"
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Volume2 className="h-4 w-4" />
            <Slider
              value={volume}
              onValueChange={setVolume}
              min={0}
              max={100}
              step={5}
              className="flex-1"
              disabled={isLoading}
            />
          </div>
        </div>
      </Card>

      {isLoading && (
        <Card className="p-8 text-center bg-card/50 backdrop-blur">
          <p className="text-muted-foreground">Loading {title}...</p>
        </Card>
      )}

      <div
        ref={alphaTabRef}
        className="w-full min-h-[600px] rounded-lg overflow-hidden border border-border bg-background"
        style={{ display: isLoading ? "none" : "block" }}
      />
    </div>
  );
};

export default AlphaTabPlayer;
