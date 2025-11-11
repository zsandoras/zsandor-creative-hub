import { useState, useEffect, useRef } from "react";
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
  ChevronsUp,
  ChevronsDown,
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
  scaleControls?: boolean;
  onToggleScale?: () => void;
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
  scaleControls = false,
  onToggleScale,
}: AlphaTabControlsProps) => {
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [originalBPM, setOriginalBPM] = useState<number | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number | null>(null);
  const [timeOffset, setTimeOffset] = useState(0);
  const lastTimeRef = useRef(0);
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

  // Apply the current instrument when API is ready and instrument changes
  useEffect(() => {
    if (!api || !currentInstrument) return;
    
    const program = currentInstrument.program;
    
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
    }
  }, [api, currentInstrument]);

  useEffect(() => {
    if (!api) return;

    // Listen to player position changes for time tracking
    const positionHandler = (e: any) => {
      // Freeze scrubber updates when paused (unless it's a manual seek)
      if (!isPlaying && !(e && e.isSeek)) {
        return;
      }
      if (typeof e.currentTime === 'number') {
        // Only detect repeats when playing to avoid false positives during pause
        if (isPlaying && lastTimeRef.current > 0 && e.currentTime < lastTimeRef.current - 1000) {
          // Add the last time to offset to make scrubber monotonic
          setTimeOffset(prev => prev + lastTimeRef.current);
        }
        lastTimeRef.current = e.currentTime;
        setCurrentTime(e.currentTime);
      }
      if (typeof e.endTime === 'number') {
        setDuration(e.endTime);
      }
    };

    api.playerPositionChanged.on(positionHandler);

    // Get the original BPM from the score
    if (api.score && api.score.masterBars && api.score.masterBars.length > 0) {
      const firstBar = api.score.masterBars[0];
      if (firstBar.tempoAutomation && firstBar.tempoAutomation.value) {
        const bpm = firstBar.tempoAutomation.value;
        setOriginalBPM(bpm);
        setCurrentBPM(bpm);
      }
    }

    return () => {
      if (api.playerPositionChanged) {
        api.playerPositionChanged.off(positionHandler);
      }
    };
  }, [api, isPlaying]);

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

  const handleBPMChange = (change: number) => {
    if (!originalBPM || !currentBPM || !api) return;
    
    const newBPM = Math.max(20, Math.min(300, currentBPM + change));
    setCurrentBPM(newBPM);
    
    // Update playback speed based on BPM ratio (no render, no MIDI reload)
    const speed = newBPM / originalBPM;
    setPlaybackSpeed(speed);
    api.playbackSpeed = speed;
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
      const seekTime = value[0] - timeOffset;
      api.timePosition = Math.max(0, seekTime);
      // Reset offset on manual seek
      setTimeOffset(0);
      lastTimeRef.current = seekTime;
    }
  };

  const toggleAutoScroll = () => {
    const newAutoScroll = !autoScroll;
    setAutoScroll(newAutoScroll);
    if (api && (api as any).settings) {
      const ScrollMode = (window as any).alphaTab?.ScrollMode;
      if (ScrollMode) {
        // OffScreen mode keeps scrolling within the scrollElement (the tab container)
        (api as any).settings.player.scrollMode = newAutoScroll ? ScrollMode.OffScreen : ScrollMode.Off;
        api.updateSettings();
      }
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
      {/* Top row: Playback controls, title, and right-side controls */}
      <div className="flex items-center justify-between gap-4 p-4 bg-muted/30">
        <div className="flex items-center gap-2 flex-shrink-0">
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

          <div className="flex items-center gap-0.5 border-r pr-2">
            <Button
              onClick={() => handleBPMChange(-5)}
              variant="ghost"
              size="icon"
              title="Decrease BPM by 5"
              disabled={!api || !currentBPM}
              className="h-8 w-8"
            >
              <ChevronsDown className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => handleBPMChange(-1)}
              variant="ghost"
              size="icon"
              title="Decrease BPM by 1"
              disabled={!api || !currentBPM}
              className="h-8 w-8"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[3ch] text-center font-mono px-1">
              {currentBPM ? Math.round(currentBPM) : "---"}
            </span>
            <Button
              onClick={() => handleBPMChange(1)}
              variant="ghost"
              size="icon"
              title="Increase BPM by 1"
              disabled={!api || !currentBPM}
              className="h-8 w-8"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => handleBPMChange(5)}
              variant="ghost"
              size="icon"
              title="Increase BPM by 5"
              disabled={!api || !currentBPM}
              className="h-8 w-8"
            >
              <ChevronsUp className="h-4 w-4" />
            </Button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-sm px-2">
            <span className="font-semibold text-foreground">{title}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
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

          <div className="flex items-center gap-2 px-2 border-l">
            <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[zoom]}
              onValueChange={(value) => handleZoomChange(value[0])}
              min={25}
              max={300}
              step={5}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground min-w-[4ch] text-right">{zoom}%</span>
          </div>

          {onToggleScale && (
            <Button
              onClick={onToggleScale}
              variant="ghost"
              size="icon"
              title={scaleControls ? "Fixed width (1400px)" : "Scale with tab width"}
              className={scaleControls ? "bg-accent" : ""}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}

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

      {/* Bottom row: Full-width scrubber */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/20 border-t border-border">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatTime(currentTime + timeOffset)}
        </span>
        <Slider
          value={[currentTime + timeOffset]}
          onValueCommit={handleSeek}
          max={Math.max(duration, currentTime + timeOffset)}
          step={100}
          className="flex-1"
        />
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatTime(duration)}
        </span>
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
