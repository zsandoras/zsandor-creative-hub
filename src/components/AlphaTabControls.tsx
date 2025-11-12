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
  Menu,
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
import { INSTRUMENTS, INSTRUMENT_CATEGORIES, getInstrumentsByCategory } from "@/constants/instruments";

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
  const lastTimeRef = useRef(0);
  const ignoreBackwardOnPauseRef = useRef(false);
  const resumeGuardRef = useRef(false);
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Load default instrument from prop or fallback to settings
    if (defaultInstrument) {
      // Find the matching instrument from our full list by program number
      const matchingInstrument = INSTRUMENTS.find(i => i.program === defaultInstrument.program);
      if (matchingInstrument) {
        setCurrentInstrument(matchingInstrument);
      }
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
      // Guard against resume jumps across repeats: if first position after resume is backwards, force our last position
      if (resumeGuardRef.current && isPlaying && typeof e.currentTime === 'number' && e.currentTime < lastTimeRef.current - 500) {
        try {
          api.timePosition = lastTimeRef.current;
        } catch {}
        resumeGuardRef.current = false;
        return;
      }
      // Ignore a single backward jump that can occur immediately after pausing
      if (!isPlaying && ignoreBackwardOnPauseRef.current && typeof e.currentTime === 'number' && e.currentTime < lastTimeRef.current) {
        ignoreBackwardOnPauseRef.current = false;
        return;
      }
      // Freeze scrubber updates when paused (unless it's a manual seek)
      if (!isPlaying && !(e && e.isSeek)) {
        return;
      }
      if (typeof e.currentTime === 'number') {
        lastTimeRef.current = e.currentTime;
        setCurrentTime(e.currentTime);
        // Clear resume guard once we see a normal forward/same update
        resumeGuardRef.current = false;
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
      if (!isPlaying) {
        // We're resuming: ensure we start exactly where we paused
        try {
          api.timePosition = Math.max(0, lastTimeRef.current);
        } catch {}
        window.dispatchEvent(new CustomEvent('alphaTabPlay'));
        resumeGuardRef.current = true;
        api.playPause();
        // Enforce the resume position once more right after starting
        setTimeout(() => {
          try { api.timePosition = lastTimeRef.current; } catch {}
        }, 30);
      } else {
        // We're about to pause; ignore the backward jump emitted by repeats
        ignoreBackwardOnPauseRef.current = true;
        api.playPause();
      }
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
      lastTimeRef.current = value[0];
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

  // Determine sizing based on scaleControls
  const iconSize = scaleControls ? "h-4 w-4" : "h-3.5 w-3.5";
  const buttonSize = scaleControls ? "icon" : "sm";
  const spacing = scaleControls ? "gap-2" : "gap-1";
  const padding = scaleControls ? "p-4" : "p-2";

  return (
    <div className="rounded-lg border text-card-foreground shadow-sm p-0 bg-card border-border overflow-hidden">
      {/* Mobile View */}
      <div className="md:hidden">
        {/* Compact control row */}
        <div className={`flex items-center justify-between ${padding} bg-muted/30`}>
          {/* Left: Play controls */}
          <div className="flex items-center gap-1">
            <Button onClick={stop} variant="ghost" size="sm" title="Stop" disabled={!api}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              onClick={togglePlayPause}
              variant="default"
              size="sm"
              title="Play/Pause"
              disabled={!api}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          </div>

          {/* Center: BPM */}
          <div className="flex items-center gap-0.5 px-2 border-l border-r">
            <Button
              onClick={() => handleBPMChange(-1)}
              variant="ghost"
              size="icon"
              disabled={!api || !currentBPM}
              className="h-7 w-7"
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[3ch] text-center font-mono">
              {currentBPM ? Math.round(currentBPM) : "---"}
            </span>
            <Button
              onClick={() => handleBPMChange(1)}
              variant="ghost"
              size="icon"
              disabled={!api || !currentBPM}
              className="h-7 w-7"
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
          </div>

          {/* Right: Menu */}
          <Button onClick={() => setMenuOpen(!menuOpen)} variant="ghost" size="sm">
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="border-t border-border bg-muted/20 p-3 space-y-3">
            {/* Playback options */}
            <div className="flex items-center justify-around gap-2">
              <Button
                onClick={toggleCountIn}
                variant="ghost"
                size="sm"
                className={countIn ? "bg-accent" : ""}
              >
                <CircleDot className="h-4 w-4 mr-1" />
                <span className="text-xs">Count</span>
              </Button>
              <Button
                onClick={toggleMetronome}
                variant="ghost"
                size="sm"
                className={metronome ? "bg-accent" : ""}
              >
                <Timer className="h-4 w-4 mr-1" />
                <span className="text-xs">Metro</span>
              </Button>
              <Button
                onClick={toggleLoop}
                variant="ghost"
                size="sm"
                className={loop ? "bg-accent" : ""}
              >
                <Repeat className="h-4 w-4 mr-1" />
                <span className="text-xs">Loop</span>
              </Button>
              <Button
                onClick={toggleAutoScroll}
                variant="ghost"
                size="sm"
                className={autoScroll ? "bg-accent" : ""}
              >
                <ScrollText className="h-4 w-4 mr-1" />
                <span className="text-xs">Scroll</span>
              </Button>
            </div>

            {/* Transpose & Instrument */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">Transpose:</span>
                <Button
                  onClick={() => handleTranspose("down")}
                  variant="ghost"
                  size="sm"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[3ch] text-center">
                  {transpose > 0 ? `+${transpose}` : transpose}
                </span>
                <Button
                  onClick={() => handleTranspose("up")}
                  variant="ghost"
                  size="sm"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs">
                    <Guitar className="h-4 w-4 mr-1" />
                    {currentInstrument.name}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-60 overflow-y-auto z-50 bg-popover">
                  <div className="px-2 py-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900 sticky top-0 z-10">
                    ⚠️ Some instruments may be silent depending on your soundfont
                  </div>
                  {INSTRUMENT_CATEGORIES.map((category) => (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                        {category}
                      </div>
                      {getInstrumentsByCategory(category).map((instrument) => (
                        <DropdownMenuItem
                          key={instrument.program}
                          onClick={() => handleSynthInstrumentChange(instrument)}
                          className={currentInstrument.program === instrument.program ? "bg-accent" : ""}
                        >
                          <span className="text-xs text-muted-foreground mr-2 w-6">{instrument.program}</span>
                          {instrument.name}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-2">
              <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Slider
                value={[zoom]}
                onValueChange={(value) => handleZoomChange(value[0])}
                min={25}
                max={300}
                step={5}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground min-w-[4ch] text-right">{zoom}%</span>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Slider
                value={[volume]}
                onValueChange={handleVolumeChange}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground min-w-[3ch]">{volume}%</span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-around gap-2">
              <Button onClick={handleDownload} variant="ghost" size="sm">
                <Download className="h-4 w-4 mr-1" />
                <span className="text-xs">Download</span>
              </Button>
              <Button onClick={handleExportPDF} variant="ghost" size="sm">
                <FileDown className="h-4 w-4 mr-1" />
                <span className="text-xs">PDF</span>
              </Button>
              {onToggleScale && (
                <Button
                  onClick={onToggleScale}
                  variant="ghost"
                  size="sm"
                  className={scaleControls ? "bg-accent" : ""}
                >
                  <Maximize2 className="h-4 w-4 mr-1" />
                  <span className="text-xs">Scale</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Scrubber */}
        <div className="flex items-center gap-2 p-2 bg-muted/20 border-t border-border">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatTime(currentTime)}
          </span>
          <Slider
            value={[currentTime]}
            onValueChange={handleSeek}
            max={duration}
            step={100}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        {/* Main control bar */}
        <div className={`flex flex-wrap items-center ${spacing} ${padding} bg-muted/30`}>
          {/* Left Section: Playback Controls + BPM + Title */}
          <div className={`flex items-center ${spacing}`}>
            {/* Playback buttons */}
            <div className={`flex items-center gap-0.5`}>
              <Button onClick={stop} variant="ghost" size={buttonSize} title="Stop" disabled={!api}>
                <SkipBack className={iconSize} />
              </Button>
              <Button
                onClick={togglePlayPause}
                variant="default"
                size={buttonSize}
                title="Play/Pause"
                disabled={!api}
              >
                {isPlaying ? <Pause className={iconSize} /> : <Play className={iconSize} />}
              </Button>
            </div>

            {/* BPM controls */}
            <div className={`flex items-center gap-0.5 border-l border-r ${scaleControls ? 'px-2 mx-1' : 'px-1 mx-0.5'}`}>
              <Button
                onClick={() => handleBPMChange(-5)}
                variant="ghost"
                size="icon"
                title="Decrease BPM by 5"
                disabled={!api || !currentBPM}
                className={scaleControls ? "h-8 w-8" : "h-7 w-7"}
              >
                <ChevronsDown className={iconSize} />
              </Button>
              <Button
                onClick={() => handleBPMChange(-1)}
                variant="ghost"
                size="icon"
                title="Decrease BPM by 1"
                disabled={!api || !currentBPM}
                className={scaleControls ? "h-8 w-8" : "h-7 w-7"}
              >
                <ChevronDown className={iconSize} />
              </Button>
              <span className={`${scaleControls ? 'text-xs' : 'text-[10px]'} text-muted-foreground min-w-[3ch] text-center font-mono px-1`}>
                {currentBPM ? Math.round(currentBPM) : "---"}
              </span>
              <Button
                onClick={() => handleBPMChange(1)}
                variant="ghost"
                size="icon"
                title="Increase BPM by 1"
                disabled={!api || !currentBPM}
                className={scaleControls ? "h-8 w-8" : "h-7 w-7"}
              >
                <ChevronUp className={iconSize} />
              </Button>
              <Button
                onClick={() => handleBPMChange(5)}
                variant="ghost"
                size="icon"
                title="Increase BPM by 5"
                disabled={!api || !currentBPM}
                className={scaleControls ? "h-8 w-8" : "h-7 w-7"}
              >
                <ChevronsUp className={iconSize} />
              </Button>
            </div>

            {/* Title */}
            <div className={`flex items-center ${scaleControls ? 'px-2' : 'px-1'}`}>
              <span className={`font-semibold text-foreground whitespace-nowrap ${scaleControls ? 'text-sm' : 'text-xs'}`}>{title}</span>
            </div>
          </div>

          {/* Middle Section: Playback Options */}
          <div className={`flex items-center ${spacing} ${scaleControls ? 'px-2 mx-1' : 'px-1 mx-0.5'} border-l`}>
            <Button
              onClick={toggleCountIn}
              variant="ghost"
              size={buttonSize}
              title="Count-In"
              className={countIn ? "bg-accent" : ""}
            >
              <CircleDot className={iconSize} />
            </Button>
            <Button
              onClick={toggleMetronome}
              variant="ghost"
              size={buttonSize}
              title="Metronome"
              className={metronome ? "bg-accent" : ""}
            >
              <Timer className={iconSize} />
            </Button>
            <Button
              onClick={toggleLoop}
              variant="ghost"
              size={buttonSize}
              title="Loop"
              className={loop ? "bg-accent" : ""}
            >
              <Repeat className={iconSize} />
            </Button>
            <Button
              onClick={toggleAutoScroll}
              variant="ghost"
              size={buttonSize}
              title="Auto-scroll"
              className={autoScroll ? "bg-accent" : ""}
            >
              <ScrollText className={iconSize} />
            </Button>
          </div>

          {/* Music Controls Section: Transpose + Instruments */}
          <div className={`flex items-center ${spacing} ${scaleControls ? 'px-2 mx-1' : 'px-1 mx-0.5'} border-l`}>
            {/* Transpose */}
            <div className={`flex items-center gap-0.5`}>
              <Button
                onClick={() => handleTranspose("down")}
                variant="ghost"
                size={buttonSize}
                title="Transpose down"
              >
                <ChevronDown className={iconSize} />
              </Button>
              <span className={`${scaleControls ? 'text-xs' : 'text-[10px]'} text-muted-foreground min-w-[3ch] text-center`}>
                {transpose > 0 ? `+${transpose}` : transpose}
              </span>
              <Button
                onClick={() => handleTranspose("up")}
                variant="ghost"
                size={buttonSize}
                title="Transpose up"
              >
                <ChevronUp className={iconSize} />
              </Button>
            </div>

            {/* Synth Instrument */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size={buttonSize} className={`gap-1 ${scaleControls ? 'ml-1' : 'ml-0.5'}`}>
                  <Guitar className={`${iconSize} flex-shrink-0`} />
                  <span className={`hidden lg:inline ${scaleControls ? '' : 'text-xs'}`}>{currentInstrument.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-80 overflow-y-auto z-50 bg-popover">
                <div className="px-2 py-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900 sticky top-0 z-10">
                  ⚠️ Some instruments may be silent depending on your soundfont
                </div>
                {INSTRUMENT_CATEGORIES.map((category) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                      {category}
                    </div>
                    {getInstrumentsByCategory(category).map((instrument) => (
                      <DropdownMenuItem
                        key={instrument.program}
                        onClick={() => handleSynthInstrumentChange(instrument)}
                        className={currentInstrument.program === instrument.program ? "bg-accent" : ""}
                      >
                        <span className="text-xs text-muted-foreground mr-2 w-6">{instrument.program}</span>
                        {instrument.name}
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Track selector */}
            {tracks.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size={buttonSize} className="gap-1">
                    <Music2 className={iconSize} />
                    <span className={`hidden lg:inline ${scaleControls ? '' : 'text-xs'}`}>Track</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-50 bg-popover">
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
          </div>

          {/* Zoom & Volume Section */}
          <div className={`flex items-center ${spacing} flex-1 min-w-[200px]`}>
            {/* Zoom */}
            <div className={`flex items-center ${spacing} ${scaleControls ? 'px-3' : 'px-2'} border-l flex-1 min-w-[120px]`}>
              <ZoomIn className={`${iconSize} text-muted-foreground flex-shrink-0`} />
              <Slider
                value={[zoom]}
                onValueChange={(value) => handleZoomChange(value[0])}
                min={25}
                max={300}
                step={5}
                className="flex-1 min-w-[60px]"
              />
              <span className={`${scaleControls ? 'text-xs' : 'text-[10px]'} text-muted-foreground min-w-[4ch] text-right`}>{zoom}%</span>
            </div>

            {/* Volume */}
            <div className={`flex items-center ${spacing} ${scaleControls ? 'px-3' : 'px-2'} border-l flex-1 min-w-[120px]`}>
              <Volume2 className={`${iconSize} text-muted-foreground flex-shrink-0`} />
              <Slider
                value={[volume]}
                onValueChange={handleVolumeChange}
                max={100}
                step={1}
                className="flex-1 min-w-[60px]"
              />
              <span className={`${scaleControls ? 'text-xs' : 'text-[10px]'} text-muted-foreground min-w-[3ch]`}>{volume}%</span>
            </div>
          </div>

          {/* File actions */}
          <div className={`flex items-center gap-0.5 ${scaleControls ? 'px-2 ml-1' : 'px-1 ml-0.5'} border-l`}>
            <Button onClick={handleDownload} variant="ghost" size={buttonSize} title="Download">
              <Download className={iconSize} />
            </Button>
            <Button onClick={handleExportPDF} variant="ghost" size={buttonSize} title="Export PDF">
              <FileDown className={iconSize} />
            </Button>
            {onToggleScale && (
              <Button
                onClick={onToggleScale}
                variant="ghost"
                size={buttonSize}
                title={scaleControls ? "Fixed width" : "Auto scale"}
                className={scaleControls ? "bg-accent" : ""}
              >
                <Maximize2 className={iconSize} />
              </Button>
            )}
          </div>
        </div>

        {/* Bottom row: Full-width scrubber */}
        <div className={`flex items-center ${spacing} ${padding} ${scaleControls ? 'py-3' : 'py-2'} bg-muted/20 border-t border-border`}>
          <span className={`${scaleControls ? 'text-sm' : 'text-xs'} text-muted-foreground whitespace-nowrap`}>
            {formatTime(currentTime)}
          </span>
          <Slider
            value={[currentTime]}
            onValueChange={handleSeek}
            max={duration}
            step={100}
            className="flex-1"
          />
          <span className={`${scaleControls ? 'text-sm' : 'text-xs'} text-muted-foreground whitespace-nowrap`}>
            {formatTime(duration)}
          </span>
        </div>

        <div className={`${padding} ${scaleControls ? 'py-2' : 'py-1'} bg-muted/20 border-t border-border`}>
          <p className={`${scaleControls ? 'text-xs' : 'text-[10px]'} text-muted-foreground text-center`}>
            💡 Tip: Click directly on the rendered tablature to start playback
          </p>
        </div>
      </div>
    </div>
  );
};

export default AlphaTabControls;
