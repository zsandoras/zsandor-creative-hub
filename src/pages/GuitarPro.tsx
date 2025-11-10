import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface GuitarEmbed {
  id: string;
  title: string;
  embed_code: string;
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
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Guitar Pro Collection
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Explore my guitar tablatures and compositions
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-8 max-w-4xl mx-auto">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-8 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-6" />
                <Skeleton className="h-96 w-full" />
              </Card>
            ))}
          </div>
        ) : embeds && embeds.length > 0 ? (
          <div className="grid gap-8 max-w-4xl mx-auto">
            {embeds.map((embed) => (
              <Card key={embed.id} className="p-6 bg-card/50 backdrop-blur hover:shadow-xl transition-shadow">
                <h2 className="text-2xl font-bold mb-2">{embed.title}</h2>
                {embed.description && (
                  <p className="text-muted-foreground mb-4">{embed.description}</p>
                )}
                <div 
                  className="w-full min-h-[400px] rounded-lg overflow-hidden border border-border"
                  dangerouslySetInnerHTML={{ __html: embed.embed_code }}
                />
              </Card>
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