import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AlphaTabPlayerProps {
  fileUrl: string;
  title: string;
}

const AlphaTabPlayer = ({ fileUrl, title }: AlphaTabPlayerProps) => {
  const alphaTabRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tempo, setTempo] = useState([100]);
  const [volume, setVolume] = useState([80]);

  useEffect(() => {
    if (!alphaTabRef.current) return;

    const loadAlphaTab = async () => {
      try {
        const { AlphaTabApi } = await import("@coderline/alphatab");
        
        const settings = {
          core: {
            file: fileUrl,
            useWorkers: true,
          },
          player: {
            enablePlayer: true,
            enableCursor: true,
            enableUserInteraction: true,
            soundFont: "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2",
          },
        };

        const apiInstance = new AlphaTabApi(alphaTabRef.current!, settings);
        
        apiInstance.renderStarted.on(() => {
          setIsLoading(true);
        });

        apiInstance.renderFinished.on(() => {
          setIsLoading(false);
        });

        apiInstance.playerStateChanged.on((e: any) => {
          setIsPlaying(e.state === 1); // 1 = playing
        });

        setApi(apiInstance);

        return () => {
          apiInstance?.destroy();
        };
      } catch (error) {
        console.error("Error loading AlphaTab:", error);
        setIsLoading(false);
      }
    };

    loadAlphaTab();
  }, [fileUrl]);

  const handlePlayPause = () => {
    if (!api) return;
    if (isPlaying) {
      api.pause();
    } else {
      api.play();
    }
  };

  const handleStop = () => {
    if (!api) return;
    api.stop();
  };

  const handleTempoChange = (value: number[]) => {
    setTempo(value);
    if (api) {
      api.playbackSpeed = value[0] / 100;
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value);
    if (api) {
      api.masterVolume = value[0] / 100;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card/50 backdrop-blur">
        <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
          <div className="flex gap-2">
            <Button
              onClick={handlePlayPause}
              disabled={isLoading || !api}
              size="icon"
              variant="default"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              onClick={handleStop}
              disabled={isLoading || !api}
              size="icon"
              variant="secondary"
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-4 items-center flex-1 max-w-md">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                Tempo: {tempo[0]}%
              </label>
              <Slider
                value={tempo}
                onValueChange={handleTempoChange}
                min={50}
                max={200}
                step={5}
                disabled={isLoading || !api}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                <Volume2 className="h-3 w-3" />
                Volume: {volume[0]}%
              </label>
              <Slider
                value={volume}
                onValueChange={handleVolumeChange}
                min={0}
                max={100}
                step={5}
                disabled={isLoading || !api}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="relative min-h-[600px] rounded-lg overflow-hidden border border-border bg-background">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading {title}...</p>
            </div>
          </div>
        )}
        <div ref={alphaTabRef} className="w-full" />
      </div>
    </div>
  );
};

export default AlphaTabPlayer;
