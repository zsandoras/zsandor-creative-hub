import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { EditableText } from "@/components/EditableText";
import { EditableItemText } from "@/components/EditableItemText";
import { useAuth } from "@/hooks/useAuth";

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

  // Notify MusicPlayer component to play a specific track
  const handlePlay = (trackId: string) => {
    const trackIndex = recordings?.findIndex(r => r.id === trackId);
    if (trackIndex !== undefined && trackIndex !== -1) {
      // Dispatch custom event for MusicPlayer to listen to
      window.dispatchEvent(new CustomEvent('playTrack', { detail: { index: trackIndex } }));
      setCurrentlyPlaying(trackId);
    }
  };

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto px-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <div className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        ) : recordings && recordings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {recordings.map((recording) => (
              <Card 
                key={recording.id} 
                className="overflow-hidden group hover:shadow-2xl transition-all duration-300 bg-card/50 backdrop-blur"
              >
                <div className="relative aspect-square overflow-hidden bg-secondary">
                  {recording.cover_image_url ? (
                    <img
                      src={recording.cover_image_url}
                      alt={recording.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                      <div className="text-6xl text-primary/50">♪</div>
                    </div>
                  )}
                  
                  {/* Play button overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Button
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-16 w-16 rounded-full"
                      onClick={() => handlePlay(recording.id)}
                    >
                      {currentlyPlaying === recording.id ? (
                        <Pause className="h-8 w-8" />
                      ) : (
                        <Play className="h-8 w-8" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="p-4">
                  <EditableItemText
                    table="music_tracks"
                    itemId={recording.id}
                    field="title"
                    value={recording.title}
                    className="text-lg font-semibold mb-1 truncate"
                    as="h3"
                    queryKey={["recordings"]}
                  />
                  {(recording.artist || (isAdmin && isEditMode)) && (
                    <EditableItemText
                      table="music_tracks"
                      itemId={recording.id}
                      field="artist"
                      value={recording.artist}
                      className="text-sm text-muted-foreground truncate"
                      as="p"
                      queryKey={["recordings"]}
                    />
                  )}
                </div>
              </Card>
            ))}
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
