import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Maximize2 } from "lucide-react";
import AlphaTabPlayer from "@/components/AlphaTabPlayer";
import { EditableItemText } from "@/components/EditableItemText";
import { CommentSection } from "@/components/CommentSection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

interface GuitarEmbed {
  id: string;
  title: string;
  embed_code: string | null;
  file_url: string | null;
  description: string | null;
  default_instrument: { name: string; program: number } | null;
}

const GuitarDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [containerWidth, setContainerWidth] = useState<"narrow" | "normal" | "wide" | "full">("normal");

  const widthClasses = {
    narrow: "max-w-4xl",
    normal: "max-w-6xl",
    wide: "max-w-7xl",
    full: "max-w-none px-8",
  };

  const { data: embed, isLoading } = useQuery({
    queryKey: ["guitar-embed", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guitar_embeds")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return {
        ...data,
        default_instrument: data.default_instrument as { name: string; program: number } | null,
      } as GuitarEmbed;
    },
    enabled: !!id,
  });

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className={`container mx-auto px-4 ${widthClasses[containerWidth]}`}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/guitar">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Guitar Pro
            </Button>
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Maximize2 className="h-4 w-4" />
                <span className="hidden sm:inline">Width: {containerWidth}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setContainerWidth("narrow")}>
                Narrow
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setContainerWidth("normal")}>
                Normal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setContainerWidth("wide")}>
                Wide
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setContainerWidth("full")}>
                Full Width
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <Card className="p-6">
            <Skeleton className="h-10 w-3/4 mb-4" />
            <Skeleton className="h-4 w-full mb-6" />
            <Skeleton className="h-[600px] w-full" />
          </Card>
        ) : embed ? (
          <div>
            <Card className="p-6 mb-6 bg-card/50 backdrop-blur">
              <EditableItemText
                table="guitar_embeds"
                itemId={embed.id}
                field="title"
                value={embed.title}
                className="text-3xl font-bold mb-2"
                as="h1"
                queryKey={["guitar-embed", id]}
              />
              <EditableItemText
                table="guitar_embeds"
                itemId={embed.id}
                field="description"
                value={embed.description}
                className="text-muted-foreground"
                as="p"
                queryKey={["guitar-embed", id]}
              />
            </Card>
            
            {embed.file_url ? (
              <>
                <div className="space-y-6">
                  <AlphaTabPlayer 
                    fileUrl={embed.file_url} 
                    title={embed.title}
                    defaultInstrument={embed.default_instrument}
                  />
                </div>
                <Card className="p-6 mt-6 bg-card/50 backdrop-blur">
                  <CommentSection
                    contentType="guitar_embed"
                    contentId={embed.id}
                  />
                </Card>
              </>
            ) : embed.embed_code ? (
              <>
                <Card className="p-6 bg-card/50 backdrop-blur">
                  <div 
                    className="w-full min-h-[600px] rounded-lg overflow-hidden border border-border"
                    dangerouslySetInnerHTML={{ __html: embed.embed_code }}
                  />
                </Card>
                <Card className="p-6 mt-6 bg-card/50 backdrop-blur">
                  <CommentSection
                    contentType="guitar_embed"
                    contentId={embed.id}
                  />
                </Card>
              </>
            ) : (
              <Card className="p-12 text-center bg-card/50 backdrop-blur">
                <p className="text-lg text-muted-foreground">
                  No content available for this tab.
                </p>
              </Card>
            )}
          </div>
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
