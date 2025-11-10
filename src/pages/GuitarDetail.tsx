import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

interface GuitarEmbed {
  id: string;
  title: string;
  embed_code: string;
  description: string | null;
}

const GuitarDetail = () => {
  const { id } = useParams<{ id: string }>();

  const { data: embed, isLoading } = useQuery({
    queryKey: ["guitar-embed", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guitar_embeds")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data as GuitarEmbed;
    },
    enabled: !!id,
  });

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link to="/guitar">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Guitar Pro
          </Button>
        </Link>

        {isLoading ? (
          <Card className="p-6">
            <Skeleton className="h-10 w-3/4 mb-4" />
            <Skeleton className="h-4 w-full mb-6" />
            <Skeleton className="h-[600px] w-full" />
          </Card>
        ) : embed ? (
          <Card className="p-6 bg-card/50 backdrop-blur">
            <h1 className="text-3xl font-bold mb-2">{embed.title}</h1>
            {embed.description && (
              <p className="text-muted-foreground mb-6">{embed.description}</p>
            )}
            <div 
              className="w-full min-h-[600px] rounded-lg overflow-hidden border border-border"
              dangerouslySetInnerHTML={{ __html: embed.embed_code }}
            />
          </Card>
        ) : (
          <Card className="p-12 text-center bg-card/50 backdrop-blur">
            <p className="text-lg text-muted-foreground">
              Guitar tab not found.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
};

export default GuitarDetail;
