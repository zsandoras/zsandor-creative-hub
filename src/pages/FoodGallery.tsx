import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { EditableText } from "@/components/EditableText";
import { EditableItemText } from "@/components/EditableItemText";

interface FoodItem {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string;
}

const FoodGallery = () => {
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

  const { data: foodItems, isLoading } = useQuery({
    queryKey: ["food-gallery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_gallery")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as FoodItem[];
    },
  });

  const handleNext = () => {
    if (fullscreenIndex !== null && foodItems) {
      setFullscreenIndex((fullscreenIndex + 1) % foodItems.length);
    }
  };

  const handlePrevious = () => {
    if (fullscreenIndex !== null && foodItems) {
      setFullscreenIndex((fullscreenIndex - 1 + foodItems.length) % foodItems.length);
    }
  };

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <EditableText
            pageKey="food"
            contentKey="page_title"
            defaultValue="Culinary Gallery"
            className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
            as="h1"
          />
          <EditableText
            pageKey="food"
            contentKey="page_subtitle"
            defaultValue="A visual journey through my culinary creations"
            className="text-xl text-muted-foreground max-w-2xl mx-auto"
            as="p"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-64 w-full" />
                <div className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : foodItems && foodItems.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {foodItems.map((item, index) => (
                <Card 
                  key={item.id} 
                  className="overflow-hidden group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-card/50 backdrop-blur cursor-pointer"
                  onClick={() => setFullscreenIndex(index)}
                >
                  <div className="relative overflow-hidden aspect-square">
                    <img
                      src={item.image_url}
                      alt={item.title || "Food creation"}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {(item.title || item.description) && (
                    <div className="p-4">
                      <EditableItemText
                        table="food_gallery"
                        itemId={item.id}
                        field="title"
                        value={item.title}
                        className="text-lg font-semibold mb-1"
                        as="h3"
                        queryKey={["food-gallery"]}
                      />
                      <EditableItemText
                        table="food_gallery"
                        itemId={item.id}
                        field="description"
                        value={item.description}
                        className="text-sm text-muted-foreground"
                        as="p"
                        queryKey={["food-gallery"]}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>

            <Dialog open={fullscreenIndex !== null} onOpenChange={(open) => !open && setFullscreenIndex(null)}>
              <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-lg">
                {fullscreenIndex !== null && foodItems[fullscreenIndex] && (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-4 right-4 z-50 bg-background/50 hover:bg-background/80"
                      onClick={() => setFullscreenIndex(null)}
                    >
                      <X className="h-6 w-6" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-50 bg-background/50 hover:bg-background/80"
                      onClick={handlePrevious}
                      disabled={foodItems.length <= 1}
                    >
                      <ChevronLeft className="h-8 w-8" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-50 bg-background/50 hover:bg-background/80"
                      onClick={handleNext}
                      disabled={foodItems.length <= 1}
                    >
                      <ChevronRight className="h-8 w-8" />
                    </Button>

                    <div className="flex flex-col items-center justify-center w-full h-full p-8">
                      <img
                        src={foodItems[fullscreenIndex].image_url}
                        alt={foodItems[fullscreenIndex].title || "Food creation"}
                        className="max-w-full max-h-[80vh] object-contain"
                      />
                      {(foodItems[fullscreenIndex].title || foodItems[fullscreenIndex].description) && (
                        <div className="mt-6 text-center max-w-2xl">
                          <EditableItemText
                            table="food_gallery"
                            itemId={foodItems[fullscreenIndex].id}
                            field="title"
                            value={foodItems[fullscreenIndex].title}
                            className="text-2xl font-bold mb-2"
                            as="h3"
                            queryKey={["food-gallery"]}
                          />
                          <EditableItemText
                            table="food_gallery"
                            itemId={foodItems[fullscreenIndex].id}
                            field="description"
                            value={foodItems[fullscreenIndex].description}
                            className="text-muted-foreground"
                            as="p"
                            queryKey={["food-gallery"]}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <Card className="p-12 text-center max-w-2xl mx-auto bg-card/50 backdrop-blur">
            <p className="text-lg text-muted-foreground">
              No culinary creations to display yet. Check back soon!
            </p>
          </Card>
        )}
      </div>
    </main>
  );
};

export default FoodGallery;