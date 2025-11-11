import { useState, useRef, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Card } from "./ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Track {
  id: string;
  title: string;
  artist: string | null;
  file_url: string;
  duration: number | null;
}

export const MusicPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const { data: tracks = [] } = useQuery({
    queryKey: ["music-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("music_tracks")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as Track[];
    },
  });

  const currentTrack = tracks[currentTrackIndex];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleNext);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleNext);
    };
  }, [currentTrackIndex, tracks]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleNext = () => {
    if (tracks.length > 0) {
      setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
      setIsPlaying(true);
    }
  };

  const handlePrevious = () => {
    if (tracks.length > 0) {
      setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
      setIsPlaying(true);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const [isExpanded, setIsExpanded] = useState(false);

  if (!tracks.length) return null;

  return (
    <Card 
      className="fixed bottom-6 right-6 bg-card/95 backdrop-blur-lg border-border shadow-2xl transition-all duration-300"
      style={{ width: isExpanded ? '320px' : '280px' }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <audio ref={audioRef} src={currentTrack?.file_url} />
      
      <div className="p-3">
        {/* Compact header with play button and title */}
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="default"
            size="icon"
            onClick={togglePlay}
            className="h-9 w-9 shrink-0"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{currentTrack?.title}</h3>
            {currentTrack?.artist && (
              <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMute}>
              {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {/* Expanded track list */}
        {isExpanded && tracks.length > 1 && (
          <div className="mb-3 max-h-48 overflow-y-auto space-y-1 animate-fade-in">
            {tracks.map((track, index) => (
              <button
                key={track.id}
                onClick={() => {
                  setCurrentTrackIndex(index);
                  setIsPlaying(true);
                }}
                className={cn(
                  "w-full text-left p-2 rounded text-xs transition-colors",
                  index === currentTrackIndex 
                    ? "bg-primary/20 text-primary" 
                    : "hover:bg-secondary text-muted-foreground"
                )}
              >
                <div className="truncate font-medium">{track.title}</div>
                {track.artist && <div className="truncate text-[10px]">{track.artist}</div>}
              </button>
            ))}
          </div>
        )}

        {/* Expanded controls */}
        {isExpanded && (
          <div className="flex items-center justify-center gap-2 mb-3 animate-fade-in">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrevious}
              disabled={tracks.length <= 1}
            >
              <SkipBack className="h-3 w-3" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNext}
              disabled={tracks.length <= 1}
            >
              <SkipForward className="h-3 w-3" />
            </Button>

            <div className="flex-1">
              <Slider
                value={[isMuted ? 0 : volume]}
                max={100}
                step={1}
                onValueChange={(value) => setVolume(value[0])}
              />
            </div>
          </div>
        )}

        {/* Progress bar at bottom */}
        <div className="space-y-1">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
};