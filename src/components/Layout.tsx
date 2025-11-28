import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { CentroNotificaciones } from "@/components/CentroNotificaciones";
import {
  Package,
  Users,
  ShoppingCart,
  Warehouse,
  Truck,
  FileText,
  LogOut,
  Menu,
  X,
  Home,
  Shield,
  UserCog,
  MessageCircle,
  ShoppingBag,
  PieChart,
  Bug,
  Mail,
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const unreadCount = useUnreadMessages();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión correctamente",
    });
  };

  const menuItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    { icon: Package, label: "Productos", path: "/productos" },
    { icon: Bug, label: "Fumigaciones", path: "/fumigaciones" },
    { icon: Users, label: "Clientes", path: "/clientes" },
    { icon: ShoppingCart, label: "Pedidos", path: "/pedidos" },
    { icon: ShoppingBag, label: "Compras", path: "/compras" },
    { icon: Warehouse, label: "Inventario", path: "/inventario" },
    { icon: PieChart, label: "Rentabilidad", path: "/rentabilidad" },
    { icon: Truck, label: "Rutas y Entregas", path: "/rutas" },
    { icon: FileText, label: "Facturación", path: "/facturas" },
    { icon: UserCog, label: "Empleados", path: "/empleados" },
    { icon: Shield, label: "Usuarios", path: "/usuarios" },
    { icon: MessageCircle, label: "Chat", path: "/chat" },
    { icon: Mail, label: "Correos", path: "/correos" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h1 className="text-xl font-bold">Abarrotes La Manita</h1>
          </div>
          <div className="flex items-center gap-2">
            <CentroNotificaciones />
            <span className="text-sm text-muted-foreground hidden md:inline">
              {user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 min-h-[calc(100vh-4rem)] border-r bg-card">
          <nav className="flex flex-col w-full p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const showBadge = item.path === "/chat" && unreadCount > 0;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start relative"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                    {showBadge && (
                      <Badge 
                        variant="destructive" 
                        className="ml-auto h-5 min-w-5 flex items-center justify-center px-1.5"
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden">
            <aside className="fixed left-0 top-16 bottom-0 w-64 border-r bg-card overflow-y-auto">
              <nav className="flex flex-col p-4 pb-24 space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  const showBadge = item.path === "/chat" && unreadCount > 0;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className="w-full justify-start relative"
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {item.label}
                        {showBadge && (
                          <Badge 
                            variant="destructive" 
                            className="ml-auto h-5 min-w-5 flex items-center justify-center px-1.5"
                          >
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default Layout;