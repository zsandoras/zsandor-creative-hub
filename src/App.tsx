import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import { MusicPlayer } from "./components/MusicPlayer";
import { AuthProvider } from "./hooks/useAuth";
import Home from "./pages/Home";
import GuitarPro from "./pages/GuitarPro";
import FoodGallery from "./pages/FoodGallery";
import Auth from "./pages/Auth";
import Dashboard from "./pages/admin/Dashboard";
import MusicManager from "./pages/admin/MusicManager";
import FoodManager from "./pages/admin/FoodManager";
import GuitarManager from "./pages/admin/GuitarManager";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Navigation />
          <MusicPlayer />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/guitar" element={<GuitarPro />} />
            <Route path="/food" element={<FoodGallery />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/music" element={<MusicManager />} />
            <Route path="/admin/food" element={<FoodManager />} />
            <Route path="/admin/guitar" element={<GuitarManager />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;