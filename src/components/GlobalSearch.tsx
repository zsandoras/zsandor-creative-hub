import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const { data: results = [] } = useQuery({
    queryKey: ["global-search", query],
    queryFn: async () => {
      if (!query.trim()) return [];
      
      const searchTerm = `%${query.toLowerCase()}%`;
      
      const [music, guitar, food] = await Promise.all([
        supabase
          .from("music_tracks")
          .select("id, title, artist")
          .or(`title.ilike.${searchTerm},artist.ilike.${searchTerm}`)
          .limit(5),
        supabase
          .from("guitar_embeds")
          .select("id, title, description")
          .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
          .limit(5),
        supabase
          .from("food_gallery")
          .select("id, title, description")
          .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
          .limit(5),
      ]);

      return [
        ...(music.data?.map(item => ({ ...item, type: "music" })) || []),
        ...(guitar.data?.map(item => ({ ...item, type: "guitar" })) || []),
        ...(food.data?.map(item => ({ ...item, type: "food" })) || []),
      ];
    },
    enabled: query.length > 0,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (item: any) => {
    if (item.type === "music") navigate("/recordings");
    else if (item.type === "guitar") navigate("/guitar");
    else if (item.type === "food") navigate("/food");
    setOpen(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px] p-0">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search music, guitar tabs, food... (Ctrl+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0"
          />
          {query && (
            <button onClick={() => setQuery("")}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {query && (
          <div className="max-h-[400px] overflow-y-auto p-2">
            {results.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No results found</p>
            ) : (
              results.map((item: any) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "w-full text-left p-3 rounded hover:bg-accent transition-colors",
                    "flex flex-col gap-1"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground uppercase">{item.type}</span>
                    <span className="font-medium">{item.title}</span>
                  </div>
                  {(item.artist || item.description) && (
                    <span className="text-sm text-muted-foreground line-clamp-1">
                      {item.artist || item.description}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
