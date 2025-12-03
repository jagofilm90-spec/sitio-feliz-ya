import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Productos from "./pages/Productos";
import Clientes from "./pages/Clientes";
import Pedidos from "./pages/Pedidos";
import Inventario from "./pages/Inventario";
import Rutas from "./pages/Rutas";
import Facturas from "./pages/Facturas";
import PortalCliente from "./pages/PortalCliente";
import Usuarios from "./pages/Usuarios";
import Empleados from "./pages/Empleados";
import Chat from "./pages/Chat";
import Compras from "./pages/Compras";
import Rentabilidad from "./pages/Rentabilidad";
import Fumigaciones from "./pages/Fumigaciones";
import CorreosCorporativos from "./pages/CorreosCorporativos";
import PushNotificationSetup from "./components/PushNotificationSetup";
import { initPushNotifications, isNativePlatform } from "./services/pushNotifications";
import { supabase } from "./integrations/supabase/client";

const queryClient = new QueryClient();

// Componente interno para manejar la inicialización de push notifications
const PushNotificationInitializer = () => {
  useEffect(() => {
    const initPush = async () => {
      // Solo inicializar si estamos en plataforma nativa
      if (!isNativePlatform()) return;

      // Esperar a que haya una sesión activa
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await initPushNotifications();
      }
    };

    initPush();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await initPushNotifications();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return <PushNotificationSetup />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PushNotificationInitializer />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/rutas" element={<Rutas />} />
          <Route path="/facturas" element={<Facturas />} />
          <Route path="/portal-cliente" element={<PortalCliente />} />
          <Route path="/empleados" element={<Empleados />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/compras" element={<Compras />} />
          <Route path="/rentabilidad" element={<Rentabilidad />} />
          <Route path="/fumigaciones" element={<Fumigaciones />} />
          <Route path="/correos" element={<CorreosCorporativos />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
