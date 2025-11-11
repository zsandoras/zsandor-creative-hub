import { Link, useLocation } from "react-router-dom";
import { Music2, Guitar, UtensilsCrossed, Shield, Edit3, Disc3 } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "./ui/switch";
import { EditableText } from "./EditableText";

export const Navigation = () => {
  const location = useLocation();
  const { isAdmin, isEditMode, setIsEditMode } = useAuth();
  
  const navItems = [
    { path: "/", label: "Home", icon: null },
    { path: "/guitar", label: "Guitar Pro", icon: Guitar },
    { path: "/recordings", label: "Recordings", icon: Disc3 },
    { path: "/food", label: "Food Gallery", icon: UtensilsCrossed },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Music2 className="h-6 w-6 text-primary" />
            <EditableText
              pageKey="navigation"
              contentKey="brand_name"
              defaultValue="Zsandor"
              className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
              as="span"
            />
          </Link>

          <div className="flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                  location.pathname === item.path
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                <EditableText
                  pageKey="navigation"
                  contentKey={`nav_${item.path.replace(/\//g, '_') || 'home'}`}
                  defaultValue={item.label}
                  className="inline"
                  as="span"
                />
              </Link>
            ))}
            
            {isAdmin && (
              <>
                <div className="flex items-center gap-2 border-l pl-6 border-border">
                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                  <EditableText
                    pageKey="navigation"
                    contentKey="edit_mode_label"
                    defaultValue="Edit Mode"
                    className="text-sm text-muted-foreground inline"
                    as="span"
                  />
                  <Switch checked={isEditMode} onCheckedChange={setIsEditMode} />
                </div>
                
                <Link to="/admin">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Shield className="h-4 w-4" />
                    <EditableText
                      pageKey="navigation"
                      contentKey="admin_button"
                      defaultValue="Admin"
                      className="inline"
                      as="span"
                    />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};