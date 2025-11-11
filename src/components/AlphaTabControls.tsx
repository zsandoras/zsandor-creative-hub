import { useState, useEffect } from "react";
import {
  SkipBack,
  Play,
  Pause,
  Timer,
  Repeat,
  Download,
  ZoomIn,
  LayoutGrid,
  Music2,
  Guitar,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";

interface AlphaTabControlsProps {
  api: any;
  isPlaying: boolean;
  title?: string;
  artist?: string;
  fileUrl?: string;
  onOpenFile?: () => void;
  tracks?: any[];
}

// Common MIDI instruments
const INSTRUMENTS = [
  { name: "Acoustic Guitar (nylon)", program: 24 },
  { name: "Acoustic Guitar (steel)", program: 25 },
  { name: "Electric Guitar (jazz)", program: 26 },
  { name: "Electric Guitar (clean)", program: 27 },
  { name: "Electric Guitar (muted)", program: 28 },
  { name: "Overdriven Guitar", program: 29 },
  { name: "Distortion Guitar", program: 30 },
  { name: "Electric Bass (finger)", program: 33 },
  { name: "Electric Bass (pick)", program: 34 },
  { name: "Acoustic Bass", program: 32 },
  { name: "Piano", program: 0 },
  { name: "Electric Piano", program: 4 },
  { name: "Strings", program: 48 },
  { name: "Synth Lead", program: 80 },
];

const AlphaTabControls = ({
  api,
  isPlaying,
  title = "Untitled",
  artist = "Unknown Artist",
  fileUrl,
  onOpenFile,
  tracks = [],
}: AlphaTabControlsProps) => {
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [countIn, setCountIn] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [loop, setLoop] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedInstrument, setSelectedInstrument] = useState(0);
  const [currentInstrument, setCurrentInstrument] = useState(INSTRUMENTS[0]);
  const [volume, setVolume] = useState(80);

  useEffect(() => {
    if (!api) return;

    const updateTime = () => {
      const player = (api as any).player;
      if (player) {
        setCurrentTime(player.playbackRange?.startTick || 0);
        setDuration(player.playbackRange?.endTick || 0);
      }
    };

    const interval = setInterval(updateTime, 100);
    return () => clearInterval(interval);
  }, [api]);

  const togglePlayPause = () => {
    if (api) api.playPause();
  };

  const stop = () => {
    if (api) api.stop();
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (api) api.playbackSpeed = speed;
  };

  const handleZoomChange = (zoomLevel: number) => {
    setZoom(zoomLevel);
    if (api) {
      const settings = (api as any).settings;
      if (settings) {
        settings.display.scale = zoomLevel / 100;
        api.updateSettings();
        api.render();
      }
    }
  };

  const toggleCountIn = () => {
    setCountIn(!countIn);
    if (api) (api as any).countInVolume = !countIn ? 1 : 0;
  };

  const toggleMetronome = () => {
    setMetronome(!metronome);
    if (api) (api as any).metronomeVolume = !metronome ? 1 : 0;
  };

  const toggleLoop = () => {
    setLoop(!loop);
    if (api) (api as any).isLooping = !loop;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (fileUrl) {
      window.open(fileUrl, "_blank");
    }
  };

  const handleLayoutChange = (layoutMode: number) => {
    if (api && (api as any).settings) {
      (api as any).settings.display.layoutMode = layoutMode;
      api.updateSettings();
      api.render();
    }
  };

  const handleInstrumentChange = (trackIndex: number) => {
    setSelectedInstrument(trackIndex);
    if (api && tracks[trackIndex]) {
      api.renderTracks([tracks[trackIndex]]);
    }
  };

  const handleSynthInstrumentChange = (instrument: typeof INSTRUMENTS[0]) => {
    setCurrentInstrument(instrument);
    if (api && (api as any).player) {
      // Change the MIDI program for all channels
      const player = (api as any).player;
      if (player.midiEventsPlayedFilter) {
        // Apply instrument change to synthesizer
        for (let channel = 0; channel < 16; channel++) {
          player.midiEventsPlayedFilter.push({
            channel: channel,
            command: 0xC0, // Program Change
            data1: instrument.program,
            data2: 0,
          });
        }
      }
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (api && (api as any).player) {
      (api as any).masterVolume = value[0] / 100;
    }
  };

  const formatTime = (ticks: number) => {
    const seconds = Math.floor(ticks / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-lg border text-card-foreground shadow-sm p-0 bg-card border-border overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={stop} variant="ghost" size="icon" title="Stop" disabled={!api}>
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            onClick={togglePlayPause}
            variant="default"
            size="icon"
            title="Play/Pause"
            disabled={!api}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                {playbackSpeed}x
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {[0.25, 0.5, 0.75, 0.9, 1, 1.25, 1.5, 2].map((speed) => (
                <DropdownMenuItem key={speed} onClick={() => handleSpeedChange(speed)}>
                  {speed}x
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden md:flex items-center gap-2 text-sm px-2">
            <span className="font-semibold text-foreground">{title}</span>
          </div>

          <div className="text-sm text-muted-foreground px-2">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={toggleCountIn}
            variant="ghost"
            size="icon"
            title="Count-In"
            className={countIn ? "bg-accent" : ""}
          >
            <Timer className="h-4 w-4" />
          </Button>

          <Button
            onClick={toggleMetronome}
            variant="ghost"
            size="icon"
            title="Metronome"
            className={metronome ? "bg-accent" : ""}
          >
            <Timer className="h-4 w-4" />
          </Button>

          <Button
            onClick={toggleLoop}
            variant="ghost"
            size="icon"
            title="Loop"
            className={loop ? "bg-accent" : ""}
          >
            <Repeat className="h-4 w-4" />
          </Button>

          <Button onClick={handleDownload} variant="ghost" size="icon" title="Download">
            <Download className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <Guitar className="h-4 w-4" />
                <span className="hidden sm:inline">Synth</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-80 overflow-y-auto">
              {INSTRUMENTS.map((instrument) => (
                <DropdownMenuItem
                  key={instrument.program}
                  onClick={() => handleSynthInstrumentChange(instrument)}
                  className={currentInstrument.program === instrument.program ? "bg-accent" : ""}
                >
                  {instrument.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {tracks.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Music2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Track</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {tracks.map((track, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => handleInstrumentChange(index)}
                    className={selectedInstrument === index ? "bg-accent" : ""}
                  >
                    {track.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <ZoomIn className="h-4 w-4" />
                {zoom}%
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {[25, 50, 75, 90, 100, 110, 125, 150, 200].map((zoomLevel) => (
                <DropdownMenuItem key={zoomLevel} onClick={() => handleZoomChange(zoomLevel)}>
                  {zoomLevel}%
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Layout">
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleLayoutChange(0)}>Page Layout</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleLayoutChange(1)}>Horizontal</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleLayoutChange(2)}>
                Horizontal (Bar-Wise)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden lg:flex items-center gap-2 px-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground min-w-[3ch]">{volume}%</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 bg-muted/20 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          💡 Tip: Click directly on the rendered tablature to start playback
        </p>
      </div>
    </div>
  );
};

export default AlphaTabControls;
