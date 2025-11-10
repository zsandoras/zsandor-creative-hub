import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Music, Image, FileText, LogOut } from "lucide-react";

const Dashboard = () => {
  const { isAdmin, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">Manage your website content</p>
          </div>
          <Button onClick={signOut} variant="outline" className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Link to="/admin/music">
            <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1 bg-card/50 backdrop-blur cursor-pointer">
              <Music className="h-12 w-12 text-primary mb-4" />
              <h2 className="text-2xl font-bold mb-2">Music Tracks</h2>
              <p className="text-muted-foreground">Upload and manage MP3 files for the music player</p>
            </Card>
          </Link>

          <Link to="/admin/food">
            <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1 bg-card/50 backdrop-blur cursor-pointer">
              <Image className="h-12 w-12 text-primary mb-4" />
              <h2 className="text-2xl font-bold mb-2">Food Gallery</h2>
              <p className="text-muted-foreground">Add and organize food photography</p>
            </Card>
          </Link>

          <Link to="/admin/guitar">
            <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1 bg-card/50 backdrop-blur cursor-pointer">
              <FileText className="h-12 w-12 text-primary mb-4" />
              <h2 className="text-2xl font-bold mb-2">Guitar Embeds</h2>
              <p className="text-muted-foreground">Manage Guitar Pro file embeds</p>
            </Card>
          </Link>
        </div>
      </div>
    </main>
  );
};

export default Dashboard;