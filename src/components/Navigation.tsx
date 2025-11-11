import { Link, useLocation } from "react-router-dom";
import { Music2, Guitar, UtensilsCrossed, Shield, Edit3, Disc3, Menu, LogIn, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "./ui/switch";
import { EditableText } from "./EditableText";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { GlobalSearch } from "./GlobalSearch";

export const Navigation = () => {
  const location = useLocation();
  const { user, isAdmin, isEditMode, setIsEditMode, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const navItems = [
    { path: "/", label: "Home", icon: null },
    { path: "/guitar", label: "Guitar Pro", icon: Guitar },
    { path: "/recordings", label: "Recordings", icon: Disc3 },
    { path: "/food", label: "Food Gallery", icon: UtensilsCrossed },
    { path: "/guestbook", label: "Guest Book", icon: null },
  ];

  return (
    <>
      <GlobalSearch />
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

          {/* Desktop Navigation */}
          {!isMobile && (
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
              
              <div className="flex items-center gap-4 border-l pl-6 border-border">
                {user ? (
                  <>
                    {isAdmin && (
                      <>
                        <div className="flex items-center gap-2">
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
                    
                    <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <Link to="/auth">
                    <Button variant="outline" size="sm" className="gap-2">
                      <LogIn className="h-4 w-4" />
                      Sign In
                    </Button>
                  </Link>
                )}
              </div>
              
              <ThemeToggle />
            </div>
          )}

          {/* Mobile Navigation */}
          {isMobile && (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col gap-6 mt-8">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 text-base font-medium transition-colors hover:text-primary",
                        location.pathname === item.path
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    >
                      {item.icon && <item.icon className="h-5 w-5" />}
                      <EditableText
                        pageKey="navigation"
                        contentKey={`nav_${item.path.replace(/\//g, '_') || 'home'}`}
                        defaultValue={item.label}
                        className="inline"
                        as="span"
                      />
                    </Link>
                  ))}
                  
                  <div className="border-t border-border pt-6 flex flex-col gap-4">
                    {user ? (
                      <>
                        {isAdmin && (
                          <>
                            <div className="flex items-center gap-3">
                              <Edit3 className="h-5 w-5 text-muted-foreground" />
                              <EditableText
                                pageKey="navigation"
                                contentKey="edit_mode_label"
                                defaultValue="Edit Mode"
                                className="text-sm text-muted-foreground inline flex-1"
                                as="span"
                              />
                              <Switch checked={isEditMode} onCheckedChange={setIsEditMode} />
                            </div>
                            
                            <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                              <Button variant="outline" size="sm" className="gap-2 w-full">
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
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            signOut();
                            setMobileMenuOpen(false);
                          }}
                          className="gap-2 w-full"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </Button>
                      </>
                    ) : (
                      <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="outline" size="sm" className="gap-2 w-full">
                          <LogIn className="h-4 w-4" />
                          Sign In
                        </Button>
                      </Link>
                    )}
                  </div>
                  
                  <div className="border-t border-border pt-4">
                    <ThemeToggle />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </nav>
    </>
  );
};