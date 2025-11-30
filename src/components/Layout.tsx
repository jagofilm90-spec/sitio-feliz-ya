import { ReactNode, useEffect, useState, useMemo } from "react";
import { useNavigate, Link, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useUnreadEmails } from "@/hooks/useUnreadEmails";
import { useUserRoles, MODULE_PERMISSIONS } from "@/hooks/useUserRoles";
import { CentroNotificaciones } from "@/components/CentroNotificaciones";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoAlmasa from "@/assets/logo-almasa.png";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Package,
  Users,
  ShoppingCart,
  Warehouse,
  Truck,
  FileText,
  ClipboardList,
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
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [emailMenuOpen, setEmailMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const unreadCount = useUnreadMessages();
  const { counts: emailCounts, cuentas: emailCuentas, totalUnread: totalUnreadEmails } = useUnreadEmails();
  const { roles, isLoading: rolesLoading } = useUserRoles();

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

  const allMenuItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    { icon: Package, label: "Productos", path: "/productos" },
    { icon: Bug, label: "Fumigaciones", path: "/fumigaciones" },
    { icon: Users, label: "Clientes", path: "/clientes" },
    { icon: ShoppingCart, label: "Pedidos", path: "/pedidos" },
    { icon: ShoppingBag, label: "Compras", path: "/compras" },
    { icon: Warehouse, label: "Inventario", path: "/inventario" },
    { icon: PieChart, label: "Rentabilidad", path: "/rentabilidad" },
    { icon: Truck, label: "Rutas y Entregas", path: "/rutas" },
    { icon: ClipboardList, label: "Remisiones", path: "/remisiones" },
    { icon: FileText, label: "Facturación", path: "/facturas" },
    { icon: UserCog, label: "Empleados", path: "/empleados" },
    { icon: Shield, label: "Usuarios", path: "/usuarios" },
    { icon: MessageCircle, label: "Chat", path: "/chat" },
  ];

  // Filtrar menú según los roles del usuario
  const menuItems = useMemo(() => {
    if (rolesLoading || roles.length === 0) return allMenuItems;
    
    return allMenuItems.filter(item => {
      const allowedRoles = MODULE_PERMISSIONS[item.path] || [];
      return roles.some(role => allowedRoles.includes(role));
    });
  }, [roles, rolesLoading]);

  // Verificar si el usuario puede ver correos
  const canViewEmails = useMemo(() => {
    const allowedRoles = MODULE_PERMISSIONS['/correos'] || [];
    return roles.some(role => allowedRoles.includes(role));
  }, [roles]);

  const handleEmailAccountClick = (email: string, isMobile: boolean) => {
    navigate(`/correos?cuenta=${encodeURIComponent(email)}`);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const renderEmailMenuItem = (isMobile: boolean = false) => {
    const isActive = location.pathname === "/correos";
    
    return (
      <Collapsible open={emailMenuOpen} onOpenChange={setEmailMenuOpen}>
        <div className="space-y-1">
          <div className="flex items-center">
            <Link 
              to="/correos" 
              className="flex-1"
              onClick={isMobile ? () => setMobileMenuOpen(false) : undefined}
            >
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <Mail className="h-4 w-4 mr-2" />
                Correos
                {totalUnreadEmails > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="ml-auto mr-2 h-5 min-w-5 flex items-center justify-center px-1.5"
                  >
                    {totalUnreadEmails > 99 ? "99+" : totalUnreadEmails}
                  </Badge>
                )}
              </Button>
            </Link>
            {emailCuentas.length > 0 && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  {emailMenuOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
          <CollapsibleContent className="pl-6 space-y-1">
            {emailCuentas.map((cuenta) => (
              <div 
                key={cuenta.id} 
                onClick={() => handleEmailAccountClick(cuenta.email, isMobile)}
                className="flex items-center justify-between py-1.5 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
              >
                <span className="truncate max-w-[140px]" title={cuenta.email}>
                  {cuenta.nombre}
                </span>
                {(emailCounts[cuenta.email] || 0) > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="h-5 min-w-5 flex items-center justify-center px-1.5 bg-primary/10 text-primary"
                  >
                    {emailCounts[cuenta.email]}
                  </Badge>
                )}
              </div>
            ))}
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

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
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link to="/dashboard" className="flex items-center gap-3">
              <img src={logoAlmasa} alt="ALMASA" className="h-10" />
              <span className="text-sm text-muted-foreground hidden lg:inline">
                Abarrotes la Manita SA de CV
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
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
                    className="w-full justify-start relative group hover:bg-accent/80 hover:translate-x-1 transition-all duration-200"
                  >
                    <Icon className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
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
            {canViewEmails && renderEmailMenuItem(false)}
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
                        className="w-full justify-start relative group hover:bg-accent/80 hover:translate-x-1 transition-all duration-200"
                      >
                        <Icon className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
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
                {canViewEmails && renderEmailMenuItem(true)}
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