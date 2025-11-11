import { useState, useEffect } from "react";
import {
  FolderOpen,
  SkipBack,
  Play,
  Pause,
  Timer,
  Edit3,
  Repeat,
  Printer,
  Download,
  ZoomIn,
  LayoutGrid,
  Music2,
  Guitar,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import "./AlphaTabControls.css";

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

  const formatTime = (ticks: number) => {
    const seconds = Math.floor(ticks / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="alphatab-controls">
      <div className="alphatab-controls-left">
        <button
          onClick={onOpenFile}
          className="control-btn"
          title="Open File"
        >
          <FolderOpen className="h-4 w-4" />
        </button>

        <button onClick={stop} className="control-btn" title="Stop">
          <SkipBack className="h-4 w-4" />
        </button>

        <button
          onClick={togglePlayPause}
          className="control-btn control-btn-primary"
          title="Play/Pause"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="control-dropdown-trigger">
            <span>{playbackSpeed}x</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="control-dropdown-menu">
            {[0.25, 0.5, 0.75, 0.9, 1, 1.25, 1.5, 2].map((speed) => (
              <DropdownMenuItem
                key={speed}
                onClick={() => handleSpeedChange(speed)}
              >
                {speed}x
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="song-info">
          <span className="song-title">{title}</span>
          <span className="song-separator">-</span>
          <span className="song-artist">{artist}</span>
        </div>

        <div className="time-position">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      <div className="alphatab-controls-right">
        <button
          onClick={toggleCountIn}
          className={`control-btn ${countIn ? "active" : ""}`}
          title="Count-In"
        >
          <Timer className="h-4 w-4" />
        </button>

        <button
          onClick={toggleMetronome}
          className={`control-btn ${metronome ? "active" : ""}`}
          title="Metronome"
        >
          <Edit3 className="h-4 w-4" />
        </button>

        <button
          onClick={toggleLoop}
          className={`control-btn ${loop ? "active" : ""}`}
          title="Loop"
        >
          <Repeat className="h-4 w-4" />
        </button>

        <button onClick={handlePrint} className="control-btn" title="Print">
          <Printer className="h-4 w-4" />
        </button>

        <button
          onClick={handleDownload}
          className="control-btn"
          title="Download"
        >
          <Download className="h-4 w-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="control-dropdown-trigger">
            <Guitar className="h-4 w-4 mr-1" />
            <span>Synth</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="control-dropdown-menu max-h-80 overflow-y-auto">
            {INSTRUMENTS.map((instrument) => (
              <DropdownMenuItem
                key={instrument.program}
                onClick={() => handleSynthInstrumentChange(instrument)}
                className={currentInstrument.program === instrument.program ? "bg-primary/20" : ""}
              >
                {instrument.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {tracks.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger className="control-dropdown-trigger">
              <Music2 className="h-4 w-4 mr-1" />
              <span>Track</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="control-dropdown-menu">
              {tracks.map((track, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={() => handleInstrumentChange(index)}
                >
                  {track.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className="control-dropdown-trigger">
            <ZoomIn className="h-4 w-4 mr-1" />
            <span>{zoom}%</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="control-dropdown-menu">
            {[25, 50, 75, 90, 100, 110, 125, 150, 200].map((zoomLevel) => (
              <DropdownMenuItem
                key={zoomLevel}
                onClick={() => handleZoomChange(zoomLevel)}
              >
                {zoomLevel}%
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="control-dropdown-trigger">
            <LayoutGrid className="h-4 w-4 mr-1" />
            <span>Layout</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="control-dropdown-menu">
            <DropdownMenuItem onClick={() => handleLayoutChange(0)}>
              Page Layout
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLayoutChange(1)}>
              Horizontal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLayoutChange(2)}>
              Horizontal (Bar-Wise)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default AlphaTabControls;
