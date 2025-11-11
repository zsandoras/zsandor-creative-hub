import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { EditableText } from "@/components/EditableText";
import { EditableItemText } from "@/components/EditableItemText";

interface GuitarEmbed {
  id: string;
  title: string;
  embed_code: string | null;
  file_url: string | null;
  description: string | null;
}

const GuitarPro = () => {
  const { data: embeds, isLoading } = useQuery({
    queryKey: ["guitar-embeds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guitar_embeds")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as GuitarEmbed[];
    },
  });

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <EditableText
            pageKey="guitar"
            contentKey="page_title"
            defaultValue="Guitar Pro Collection"
            className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
            as="h1"
          />
          <EditableText
            pageKey="guitar"
            contentKey="page_subtitle"
            defaultValue="Explore my guitar tablatures and compositions"
            className="text-xl text-muted-foreground max-w-2xl mx-auto"
            as="p"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4 max-w-2xl mx-auto">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-8 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </Card>
            ))}
          </div>
        ) : embeds && embeds.length > 0 ? (
          <div className="grid gap-4 max-w-2xl mx-auto">
            {embeds.map((embed) => (
              <Link key={embed.id} to={`/guitar/${embed.id}`}>
                <Card className="p-6 bg-card/50 backdrop-blur hover:shadow-xl transition-all hover:-translate-y-1 group">
                  <div className="flex items-center justify-between">
                    <div className="flex-1" onClick={(e) => e.preventDefault()}>
                      <EditableItemText
                        table="guitar_embeds"
                        itemId={embed.id}
                        field="title"
                        value={embed.title}
                        className="text-xl font-bold mb-1 group-hover:text-primary transition-colors"
                        as="h2"
                        queryKey={["guitar-embeds"]}
                      />
                      <EditableItemText
                        table="guitar_embeds"
                        itemId={embed.id}
                        field="description"
                        value={embed.description}
                        className="text-sm text-muted-foreground"
                        as="p"
                        queryKey={["guitar-embeds"]}
                      />
                    </div>
                    <ChevronRight className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center max-w-2xl mx-auto bg-card/50 backdrop-blur">
            <p className="text-lg text-muted-foreground">
              No guitar tabs available yet. Check back soon for new compositions!
            </p>
          </Card>
        )}
      </div>
    </main>
  );
};

export default GuitarPro;