import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Package, Users, ShoppingCart, TrendingUp } from "lucide-react";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalProductos: 0,
    totalClientes: 0,
    pedidosPendientes: 0,
    stockBajo: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [productos, clientes, pedidos, stockBajo] = await Promise.all([
        supabase.from("productos").select("id", { count: "exact", head: true }),
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("status", "pendiente"),
        supabase.from("productos").select("id", { count: "exact", head: true }).filter("stock_actual", "lte", "stock_minimo"),
      ]);

      setStats({
        totalProductos: productos.count || 0,
        totalClientes: clientes.count || 0,
        pedidosPendientes: pedidos.count || 0,
        stockBajo: stockBajo.count || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const statCards = [
    {
      title: "Total Productos",
      value: stats.totalProductos,
      description: "Productos en catálogo",
      icon: Package,
      color: "text-blue-600",
    },
    {
      title: "Total Clientes",
      value: stats.totalClientes,
      description: "Clientes registrados",
      icon: Users,
      color: "text-green-600",
    },
    {
      title: "Pedidos Pendientes",
      value: stats.pedidosPendientes,
      description: "Requieren atención",
      icon: ShoppingCart,
      color: "text-orange-600",
    },
    {
      title: "Stock Bajo",
      value: stats.stockBajo,
      description: "Productos bajo mínimo",
      icon: TrendingUp,
      color: "text-red-600",
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Resumen general del sistema</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Bienvenido al ERP</CardTitle>
              <CardDescription>
                Sistema de gestión empresarial para comercializadora de abarrotes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Este sistema te permite gestionar:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Catálogo de productos con control de caducidades</li>
                <li>Inventario en tiempo real</li>
                <li>Clientes y términos de crédito</li>
                <li>Pedidos digitales (reemplaza papel)</li>
                <li>Rutas de entrega y seguimiento</li>
                <li>Facturación y control de pagos</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accesos Rápidos</CardTitle>
              <CardDescription>Funciones principales del sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Card className="cursor-pointer hover:bg-accent transition-colors">
                  <CardContent className="p-4 text-center">
                    <Package className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium">Productos</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent transition-colors">
                  <CardContent className="p-4 text-center">
                    <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium">Clientes</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent transition-colors">
                  <CardContent className="p-4 text-center">
                    <ShoppingCart className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium">Pedidos</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent transition-colors">
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium">Inventario</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;