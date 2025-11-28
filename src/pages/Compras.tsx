import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Layout from "@/components/Layout";
import { Package, Truck, Calendar, BarChart3 } from "lucide-react";
import ProveedoresTab from "@/components/compras/ProveedoresTab";
import OrdenesCompraTab from "@/components/compras/OrdenesCompraTab";
import CalendarioEntregasTab from "@/components/compras/CalendarioEntregasTab";
import ComprasAnalyticsTab from "@/components/compras/ComprasAnalyticsTab";
import { supabase } from "@/integrations/supabase/client";

const Compras = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("proveedores");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  // Fetch count of authorized OCs pending to send (for current user)
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["oc-pending-send-count", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return 0;

      const { count, error } = await supabase
        .from("ordenes_compra")
        .select("*", { count: "exact", head: true })
        .eq("creado_por", currentUserId)
        .eq("status", "autorizada");

      if (error) {
        console.error("Error fetching pending OC count:", error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!currentUserId,
    refetchInterval: 30000,
  });

  // Auto-switch to ordenes tab when ?aprobar= param is present
  useEffect(() => {
    if (searchParams.get("aprobar")) {
      setActiveTab("ordenes");
    }
  }, [searchParams]);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Compras</h1>
          <p className="text-muted-foreground">
            Gestión de proveedores, órdenes de compra y calendario de entregas
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="proveedores" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Proveedores
            </TabsTrigger>
            <TabsTrigger value="ordenes" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Órdenes de Compra
              {pendingCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-1 h-5 min-w-5 px-1.5 text-xs font-bold animate-pulse"
                >
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="calendario" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendario
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proveedores">
            <ProveedoresTab />
          </TabsContent>

          <TabsContent value="ordenes">
            <OrdenesCompraTab />
          </TabsContent>

          <TabsContent value="calendario">
            <CalendarioEntregasTab />
          </TabsContent>

          <TabsContent value="analytics">
            <ComprasAnalyticsTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Compras;
