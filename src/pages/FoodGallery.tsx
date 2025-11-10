import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface FoodItem {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string;
}

const FoodGallery = () => {
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

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Culinary Gallery
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A visual journey through my culinary creations
          </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {foodItems.map((item) => (
              <Card 
                key={item.id} 
                className="overflow-hidden group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-card/50 backdrop-blur"
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
                    {item.title && (
                      <h3 className="text-lg font-semibold mb-1">{item.title}</h3>
                    )}
                    {item.description && (
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
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