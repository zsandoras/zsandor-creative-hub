import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { EditableText } from "@/components/EditableText";
import { EditableItemText } from "@/components/EditableItemText";
import { useAuth } from "@/hooks/useAuth";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { RecordingSkeleton } from "@/components/LoadingSkeleton";
import { cn } from "@/lib/utils";
import { CommentSection } from "@/components/CommentSection";

interface Recording {
  id: string;
  title: string;
  artist: string | null;
  file_url: string;
  cover_image_url: string | null;
  duration: number | null;
  display_order: number;
}

const Recordings = () => {
  const { isAdmin, isEditMode } = useAuth();
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<{ [key: string]: number }>({});

  const { data: recordings, isLoading } = useQuery({
    queryKey: ["recordings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("music_tracks")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as unknown as Recording[];
    },
  });

  useEffect(() => {
    // Listen for playback progress and playing state from MusicPlayer
    const handleProgress = (e: CustomEvent) => {
      const { trackId, progress } = e.detail;
      setPlaybackProgress(prev => ({ ...prev, [trackId]: progress }));
    };

    const handlePlayingState = (e: CustomEvent) => {
      const { trackId, isPlaying } = e.detail;
      if (isPlaying) {
        setCurrentlyPlaying(trackId);
      } else if (currentlyPlaying === trackId) {
        setCurrentlyPlaying(null);
      }
    };

    window.addEventListener("playbackProgress", handleProgress as EventListener);
    window.addEventListener("playingStateChange", handlePlayingState as EventListener);
    
    return () => {
      window.removeEventListener("playbackProgress", handleProgress as EventListener);
      window.removeEventListener("playingStateChange", handlePlayingState as EventListener);
    };
  }, [currentlyPlaying]);

  const handlePlay = (trackId: string, index: number) => {
    const isCurrentlyPlaying = currentlyPlaying === trackId;
    
    if (isCurrentlyPlaying) {
      // Pause current track
      window.dispatchEvent(new CustomEvent('togglePlayback'));
      setCurrentlyPlaying(null);
    } else {
      // Play selected track
      window.dispatchEvent(new CustomEvent('playTrack', { detail: { index } }));
      setCurrentlyPlaying(trackId);
    }
  };

  const formatTime = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimeAgo = () => {
    return "4 years ago"; // Placeholder - would calculate actual time
  };

  return (
    <main className="min-h-screen bg-background pt-24 pb-32">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-12">
          <EditableText
            pageKey="recordings"
            contentKey="page_title"
            defaultValue="Recordings"
            className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
            as="h1"
          />
          <EditableText
            pageKey="recordings"
            contentKey="page_subtitle"
            defaultValue="Listen to my musical recordings"
            className="text-xl text-muted-foreground max-w-2xl mx-auto"
            as="p"
          />
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <RecordingSkeleton key={i} />
            ))}
          </div>
        ) : recordings && recordings.length > 0 ? (
          <div className="space-y-6">
            {recordings.map((recording, index) => {
              const isPlaying = currentlyPlaying === recording.id;
              const progress = playbackProgress[recording.id] || 0;

              return (
                <Card 
                  key={recording.id} 
                  className="overflow-hidden group hover:shadow-xl transition-all duration-300 bg-card/80 backdrop-blur border-border/50"
                >
                  <div className="flex gap-4 p-4">
                    {/* Album Art / Thumbnail */}
                    <div className="relative w-32 h-32 shrink-0 rounded overflow-hidden bg-secondary">
                      {recording.cover_image_url ? (
                        <img
                          src={recording.cover_image_url}
                          alt={recording.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                          <div className="text-4xl text-primary/50">♪</div>
                        </div>
                      )}
                      
                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                        <Button
                          size="icon"
                          variant="default"
                          className={cn(
                            "opacity-0 group-hover:opacity-100 transition-opacity h-12 w-12 rounded-full",
                            isPlaying && "opacity-100"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlay(recording.id, index);
                          }}
                        >
                          {isPlaying ? (
                            <Pause className="h-6 w-6" />
                          ) : (
                            <Play className="h-6 w-6 ml-0.5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <EditableItemText
                              table="music_tracks"
                              itemId={recording.id}
                              field="artist"
                              value={recording.artist}
                              className="text-sm text-muted-foreground"
                              as="span"
                              queryKey={["recordings"]}
                            />
                          </div>
                          <EditableItemText
                            table="music_tracks"
                            itemId={recording.id}
                            field="title"
                            value={recording.title}
                            className="text-lg font-semibold truncate block"
                            as="h3"
                            queryKey={["recordings"]}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground shrink-0">
                          {formatTimeAgo()}
                        </span>
                      </div>

                      {/* Waveform */}
                      <div className="flex-1 flex items-center relative group/wave">
                        <div className="w-full h-20 relative">
                          <WaveformVisualizer
                            audioUrl={recording.file_url}
                            isPlaying={isPlaying}
                            progress={progress}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Comments Section */}
                  <div className="px-4 pb-4 border-t border-border/50 pt-4">
                    <CommentSection
                      contentType="music_track"
                      contentId={recording.id}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center max-w-2xl mx-auto bg-card/50 backdrop-blur">
            <p className="text-lg text-muted-foreground">
              No recordings available yet. Check back soon!
            </p>
          </Card>
        )}
      </div>
    </main>
  );
};

export default Recordings;
