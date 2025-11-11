import { useState, useEffect } from 'react';
import * as alphaTab from '@coderline/alphatab';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  SkipBack, 
  Volume2, 
  Repeat,
  Timer,
  Download,
  ZoomIn,
  LayoutGrid,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AlphaTabControlsProps {
  api: alphaTab.AlphaTabApi;
  fileUrl: string;
  title?: string;
}

interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackSpeed: number;
  zoom: number;
  countIn: boolean;
  metronome: boolean;
  loop: boolean;
}

const AlphaTabControls = ({ api, fileUrl, title }: AlphaTabControlsProps) => {
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 80,
    playbackSpeed: 1,
    zoom: 100,
    countIn: false,
    metronome: false,
    loop: false,
  });

  useEffect(() => {
    // Set initial volume
    api.masterVolume = playerState.volume / 100;

    // Listen to player state changes
    const stateHandler = (e: any) => {
      setPlayerState((prev) => ({ ...prev, isPlaying: e.state === 1 }));
    };

    api.playerStateChanged.on(stateHandler);

    return () => {
      api.playerStateChanged.off(stateHandler);
    };
  }, [api]);

  const togglePlayPause = async () => {
    try {
      const audioContext = (api as any)?.player?.audioContext || (api as any)?.player?.context;
      
      if (audioContext && audioContext.state === "suspended") {
        await audioContext.resume();
      }

      api.playPause();
    } catch (e) {
      console.error('Play/Pause error:', e);
    }
  };

  const stop = () => {
    api.stop();
  };

  const handleVolumeChange = (values: number[]) => {
    const volume = values[0];
    setPlayerState((prev) => ({ ...prev, volume }));
    api.masterVolume = volume / 100;
  };

  const handlePlaybackSpeedChange = (speed: number) => {
    setPlayerState((prev) => ({ ...prev, playbackSpeed: speed }));
    (api as any).playbackSpeed = speed;
  };

  const handleZoomChange = (zoom: number) => {
    setPlayerState((prev) => ({ ...prev, zoom }));
    const settings = (api as any).settings;
    if (settings) {
      settings.display.scale = zoom / 100;
      api.updateSettings();
      api.render();
    }
  };

  const toggleCountIn = () => {
    setPlayerState((prev) => ({ ...prev, countIn: !prev.countIn }));
    (api as any).countInVolume = !playerState.countIn ? 1 : 0;
  };

  const toggleMetronome = () => {
    setPlayerState((prev) => ({ ...prev, metronome: !prev.metronome }));
    (api as any).metronomeVolume = !playerState.metronome ? 1 : 0;
  };

  const toggleLoop = () => {
    setPlayerState((prev) => ({ ...prev, loop: !prev.loop }));
    (api as any).isLooping = !playerState.loop;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="p-0 bg-card border-border overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 bg-muted/30">
        {/* Left Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={stop}
            title="Stop"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button
            variant="default"
            size="icon"
            onClick={togglePlayPause}
            title="Play/Pause"
          >
            {playerState.isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          {/* Playback Speed Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 px-3">
                {playerState.playbackSpeed}x
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {[0.25, 0.5, 0.75, 0.9, 1, 1.25, 1.5, 2].map((speed) => (
                <DropdownMenuItem
                  key={speed}
                  onClick={() => handlePlaybackSpeedChange(speed)}
                >
                  {speed}x
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Song Info */}
          <div className="hidden md:flex items-center gap-2 text-sm px-2">
            <span className="font-semibold text-foreground">{title || "Tablature"}</span>
          </div>

          {/* Time Display */}
          <div className="text-sm text-muted-foreground px-2">
            {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Count-In Toggle */}
          <Button
            variant={playerState.countIn ? "default" : "ghost"}
            size="icon"
            onClick={toggleCountIn}
            title="Count-In"
          >
            <Timer className="h-4 w-4" />
          </Button>

          {/* Metronome Toggle */}
          <Button
            variant={playerState.metronome ? "default" : "ghost"}
            size="icon"
            onClick={toggleMetronome}
            title="Metronome"
          >
            <Timer className="h-4 w-4" />
          </Button>

          {/* Loop Toggle */}
          <Button
            variant={playerState.loop ? "default" : "ghost"}
            size="icon"
            onClick={toggleLoop}
            title="Loop"
          >
            <Repeat className="h-4 w-4" />
          </Button>

          {/* Download */}
          <Button
            variant="ghost"
            size="icon"
            title="Download"
            onClick={() => window.open(fileUrl, '_blank')}
          >
            <Download className="h-4 w-4" />
          </Button>

          {/* Zoom Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 px-3 gap-1">
                <ZoomIn className="h-4 w-4" />
                {playerState.zoom}%
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {[25, 50, 75, 90, 100, 110, 125, 150, 200].map((zoom) => (
                <DropdownMenuItem
                  key={zoom}
                  onClick={() => handleZoomChange(zoom)}
                >
                  {zoom}%
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Layout Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Layout">
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Page Layout</DropdownMenuItem>
              <DropdownMenuItem>Horizontal</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Volume Control */}
          <div className="hidden lg:flex items-center gap-2 px-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[playerState.volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground min-w-[3ch]">
              {playerState.volume}%
            </span>
          </div>
        </div>
      </div>

      {/* Tip for Click-to-Play */}
      <div className="px-4 py-2 bg-muted/20 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          💡 Tip: Click directly on the rendered tablature to start playback
        </p>
      </div>
    </Card>
  );
};

export default AlphaTabControls;
