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
  ChevronUp,
  ChevronDown,
  FileDown,
  ScrollText,
  CircleDot,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";

interface AlphaTabControlsProps {
  api: any;
  isPlaying: boolean;
  title?: string;
  artist?: string;
  fileUrl?: string;
  onOpenFile?: () => void;
  tracks?: any[];
  defaultInstrument?: { name: string; program: number } | null;
}

// Common MIDI instruments
const INSTRUMENTS = [
  { name: "Violin", program: 40 },
  { name: "Viola", program: 41 },
  { name: "Cello", program: 42 },
  { name: "Contrabass", program: 43 },
  { name: "Acoustic Guitar (nylon)", program: 24 },
  { name: "Acoustic Guitar (steel)", program: 25 },
  { name: "Electric Guitar (jazz)", program: 26 },
  { name: "Electric Guitar (clean)", program: 27 },
  { name: "Electric Guitar (muted)", program: 28 },
  { name: "Overdriven Guitar", program: 29 },
  { name: "Distortion Guitar", program: 30 },
  { name: "Guitar Harmonics", program: 31 },
  { name: "Acoustic Bass", program: 32 },
  { name: "Electric Bass (finger)", program: 33 },
  { name: "Electric Bass (pick)", program: 34 },
  { name: "Fretless Bass", program: 35 },
  { name: "Piano", program: 0 },
  { name: "Electric Piano", program: 4 },
  { name: "Harpsichord", program: 6 },
  { name: "Organ", program: 16 },
  { name: "Accordion", program: 21 },
  { name: "Strings Ensemble", program: 48 },
  { name: "Synth Strings", program: 50 },
  { name: "Choir Aahs", program: 52 },
  { name: "Trumpet", program: 56 },
  { name: "Trombone", program: 57 },
  { name: "French Horn", program: 60 },
  { name: "Saxophone", program: 65 },
  { name: "Flute", program: 73 },
  { name: "Synth Lead", program: 80 },
  { name: "Synth Pad", program: 88 },
];

const AlphaTabControls = ({
  api,
  isPlaying,
  title = "Untitled",
  artist = "Unknown Artist",
  fileUrl,
  onOpenFile,
  tracks = [],
  defaultInstrument,
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
  const [transpose, setTranspose] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const [tabWidth, setTabWidth] = useState(100);

  useEffect(() => {
    // Load default instrument from prop or fallback to settings
    if (defaultInstrument) {
      setCurrentInstrument(defaultInstrument);
    } else {
      loadDefaultInstrument();
    }
  }, [defaultInstrument]);

  const loadDefaultInstrument = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "default_instrument")
        .maybeSingle();

      if (data?.value && typeof data.value === 'object' && 'program' in data.value) {
        const defaultInst = INSTRUMENTS.find((i) => i.program === (data.value as any).program);
        if (defaultInst) {
          setCurrentInstrument(defaultInst);
        }
      }
    } catch (error) {
      console.error("Error loading default instrument:", error);
    }
  };

  useEffect(() => {
    if (!api) return;

    // Listen to player position changes for time tracking
    const positionHandler = (e: any) => {
      setCurrentTime(e.currentTime);
      setDuration(e.endTime);
    };

    api.playerPositionChanged.on(positionHandler);

    return () => {
      if (api.playerPositionChanged) {
        api.playerPositionChanged.off(positionHandler);
      }
    };
  }, [api]);

  const togglePlayPause = () => {
    if (api) {
      // If starting playback, notify MP3 player to stop
      if (!isPlaying) {
        window.dispatchEvent(new CustomEvent('alphaTabPlay'));
      }
      api.playPause();
    }
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
    if (api && typeof api.print === 'function') {
      const originalOpen = window.open;
      let popup: Window | null = null;
      // Intercept the popup to auto-open the browser print dialog
      (window as any).open = (...args: any[]) => {
        const win = originalOpen.apply(window, args as any);
        popup = win;
        try {
          win?.addEventListener('load', () => {
            try {
              // Wait for fonts to load before printing
              if (win.document.fonts && win.document.fonts.ready) {
                win.document.fonts.ready.then(() => {
                  setTimeout(() => {
                    win.focus();
                    win.print();
                  }, 500);
                });
              } else {
                setTimeout(() => {
                  win.focus();
                  win.print();
                }, 1000);
              }
            } catch {
              // Fallback if fonts API not available
              setTimeout(() => {
                win.focus();
                win.print();
              }, 1000);
            }
          });
        } catch {
          // ignore
        }
        return win as Window | null;
      };
      try {
        api.print();
      } finally {
        // Restore and fallback trigger in case load didn’t fire
        (window as any).open = originalOpen;
        if (popup) {
          setTimeout(() => {
            try {
              popup!.focus();
              popup!.print();
            } catch {
              // ignore
            }
          }, 1500);
        }
      }
    }
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
    if (api) {
      const program = instrument.program;
      const wasPlaying = isPlaying;

      // Prepare handler to rewrite all Program Change events except drums (channel 9)
      const midiLoadHandler = (file: any) => {
        try {
          const MidiEventType = (window as any).alphaTab?.midi?.MidiEventType;
          const events = file?.events ?? [];
          for (const ev of events) {
            const isProgramChange = MidiEventType
              ? ev.type === MidiEventType.ProgramChange || ev.command === MidiEventType.ProgramChange
              : ev.command === 0xC0;
            if (isProgramChange && ev.channel !== 9) {
              if (typeof ev.program === "number") ev.program = program;
              if (typeof ev.data1 === "number") ev.data1 = program;
            }
          }
        } catch (err) {
          console.warn("Failed to rewrite MIDI program changes:", err);
        }
      };

      // Remove old handler if any, then attach the new one
      if ((api as any)._midiLoadHandler) {
        api.midiLoad.off((api as any)._midiLoadHandler);
      }
      (api as any)._midiLoadHandler = midiLoadHandler;
      api.midiLoad.on(midiLoadHandler);

      // Regenerate and reload the MIDI
      if (typeof api.loadMidiForScore === "function") {
        api.loadMidiForScore();
        // Resume playback if it was playing before
        if (wasPlaying) {
          setTimeout(() => {
            api.play();
          }, 100);
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

  const handleTranspose = (direction: "up" | "down") => {
    const newTranspose = direction === "up" ? transpose + 1 : transpose - 1;
    setTranspose(newTranspose);
    
    if (api && (api as any).score) {
      const wasPlaying = isPlaying;
      if (wasPlaying) api.stop();
      
      // Transpose all tracks - need to set both transpositionPitch (audio) and displayTranspositionPitch (visual)
      // Note: transpositionPitch is negated because AlphaTab's internal direction is opposite to UI expectation
      for (const track of (api as any).score.tracks) {
        for (const staff of track.staves) {
          staff.transpositionPitch = -newTranspose;
          staff.displayTranspositionPitch = newTranspose;
        }
      }
      
      // Regenerate MIDI with new transposition
      api.render();
      if (typeof api.loadMidiForScore === "function") {
        api.loadMidiForScore();
      }
      
      if (wasPlaying) setTimeout(() => api.play(), 300);
    }
  };

  const handleExportPDF = () => {
    // Use AlphaTab print popup and auto-trigger the system print dialog (user can choose "Save as PDF")
    handlePrint();
  };

  const handleSeek = (value: number[]) => {
    if (api) {
      api.timePosition = value[0];
    }
  };

  const toggleAutoScroll = () => {
    const newAutoScroll = !autoScroll;
    setAutoScroll(newAutoScroll);
    if (api && (api as any).settings) {
      const ScrollMode = (window as any).alphaTab?.ScrollMode;
      if (ScrollMode) {
        (api as any).settings.player.scrollMode = newAutoScroll ? ScrollMode.Continuous : ScrollMode.Off;
        api.updateSettings();
      }
    }
  };

  const handleTabWidthChange = (value: number[]) => {
    const newWidth = value[0];
    setTabWidth(newWidth);
    if (api && (api as any).settings) {
      // Adjust stretchForce: higher = more stretched/wider bars
      (api as any).settings.display.stretchForce = newWidth / 100;
      api.updateSettings();
      api.render();
    }
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
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

          {/* Audio scrubbing slider - Note: This controls AlphaTab's MIDI synthesis only.
              It cannot sync with the separate MP3 player (MusicPlayer component) because they use
              different audio sources and AlphaTab unmounts when navigating away from this page. */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-2xl">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              onValueChange={handleSeek}
              max={duration}
              step={100}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={toggleCountIn}
            variant="ghost"
            size="icon"
            title="Count-In (plays 1-2-3-4 before playback starts)"
            className={countIn ? "bg-accent" : ""}
          >
            <CircleDot className="h-4 w-4" />
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

          <Button
            onClick={toggleAutoScroll}
            variant="ghost"
            size="icon"
            title="Auto-scroll (Page follows playback)"
            className={autoScroll ? "bg-accent" : ""}
          >
            <ScrollText className="h-4 w-4" />
          </Button>

          <Button onClick={handleDownload} variant="ghost" size="icon" title="Download">
            <Download className="h-4 w-4" />
          </Button>

          <Button onClick={handleExportPDF} variant="ghost" size="icon" title="Export as PDF">
            <FileDown className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1 border-l pl-2">
            <Button
              onClick={() => handleTranspose("down")}
              variant="ghost"
              size="icon"
              title="Transpose down"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[3ch] text-center">
              {transpose > 0 ? `+${transpose}` : transpose}
            </span>
            <Button
              onClick={() => handleTranspose("up")}
              variant="ghost"
              size="icon"
              title="Transpose up"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 max-w-[180px]">
                <Guitar className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline truncate">{currentInstrument.name}</span>
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

          <div className="hidden lg:flex items-center gap-2 px-2 border-l">
            <Maximize2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[tabWidth]}
              onValueChange={handleTabWidthChange}
              min={50}
              max={150}
              step={5}
              className="w-24"
              title="Tab Width"
            />
            <span className="text-xs text-muted-foreground min-w-[3ch]">{tabWidth}%</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 px-2 border-l">
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
