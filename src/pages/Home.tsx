import { Music2, Guitar, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";

const Home = () => {
  return (
    <main className="min-h-screen bg-background">
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/50 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.1),transparent_50%)]" />
        
        <div className="relative z-10 container mx-auto px-4 text-center">
          <div className="inline-block mb-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <Music2 className="h-16 w-16 text-primary mx-auto" />
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold mb-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-100">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-300% animate-gradient">
              Zsandor
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            Musician, guitarist, and creative soul exploring the art of sound and taste
          </p>
          
          <div className="flex flex-wrap gap-4 justify-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
            <Link to="/guitar">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/50 transition-all">
                <Guitar className="h-5 w-5" />
                View Guitar Work
              </Button>
            </Link>
            <Link to="/food">
              <Button size="lg" variant="outline" className="gap-2 hover:bg-primary/10">
                <Camera className="h-5 w-5" />
                Explore Food Gallery
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="p-8 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-card/50 backdrop-blur">
            <Guitar className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-2xl font-bold mb-3">Guitar Pro</h3>
            <p className="text-muted-foreground mb-4">
              Explore my guitar compositions and tablatures. Each piece tells a story through strings.
            </p>
            <Link to="/guitar">
              <Button variant="ghost" className="group">
                View Collection
                <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </Button>
            </Link>
          </Card>

          <Card className="p-8 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-card/50 backdrop-blur">
            <Camera className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-2xl font-bold mb-3">Culinary Art</h3>
            <p className="text-muted-foreground mb-4">
              A visual journey through my culinary creations. Food as art, crafted with passion.
            </p>
            <Link to="/food">
              <Button variant="ghost" className="group">
                Browse Gallery
                <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </Button>
            </Link>
          </Card>

          <Card className="p-8 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-card/50 backdrop-blur">
            <Music2 className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-2xl font-bold mb-3">Music Player</h3>
            <p className="text-muted-foreground mb-4">
              Listen to my compositions. The music player in the corner brings my work to your ears.
            </p>
            <Button variant="ghost" disabled className="opacity-50">
              Playing Now
            </Button>
          </Card>
        </div>
      </section>
    </main>
  );
};

export default Home;