import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Package, Users, ShoppingCart, TrendingUp, AlertTriangle, TrendingDown, DollarSign } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { NotificacionesSistema } from "@/components/NotificacionesSistema";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalProductos: 0,
    totalClientes: 0,
    pedidosPendientes: 0,
    stockBajo: 0,
  });

  const [movimientosData, setMovimientosData] = useState<any[]>([]);
  const [costosData, setCostosData] = useState<any[]>([]);
  const [productosStockData, setProductosStockData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      await Promise.all([
        loadStats(),
        loadMovimientos(),
        loadCostos(),
        loadProductosStock(),
      ]);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const loadMovimientos = async () => {
    try {
      // Obtener movimientos de los últimos 30 días
      const fecha30Dias = new Date();
      fecha30Dias.setDate(fecha30Dias.getDate() - 30);

      const { data, error } = await supabase
        .from("inventario_movimientos")
        .select("tipo_movimiento, cantidad, created_at")
        .gte("created_at", fecha30Dias.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Agrupar por día y tipo
      const agrupado: Record<string, { fecha: string; entradas: number; salidas: number }> = {};

      data?.forEach((mov) => {
        const fecha = new Date(mov.created_at).toLocaleDateString("es-MX", { month: "short", day: "numeric" });
        
        if (!agrupado[fecha]) {
          agrupado[fecha] = { fecha, entradas: 0, salidas: 0 };
        }

        if (mov.tipo_movimiento === "entrada") {
          agrupado[fecha].entradas += mov.cantidad;
        } else if (mov.tipo_movimiento === "salida") {
          agrupado[fecha].salidas += mov.cantidad;
        }
      });

      setMovimientosData(Object.values(agrupado).slice(-15)); // Últimos 15 días
    } catch (error) {
      console.error("Error loading movimientos:", error);
    }
  };

  const loadCostos = async () => {
    try {
      // Obtener órdenes de compra de los últimos 60 días
      const fecha60Dias = new Date();
      fecha60Dias.setDate(fecha60Dias.getDate() - 60);

      const { data, error } = await supabase
        .from("ordenes_compra")
        .select("fecha_orden, total")
        .gte("fecha_orden", fecha60Dias.toISOString())
        .order("fecha_orden", { ascending: true });

      if (error) throw error;

      // Agrupar por semana
      const agrupado: Record<string, { semana: string; total: number; count: number }> = {};

      data?.forEach((orden) => {
        const fecha = new Date(orden.fecha_orden);
        const semana = `Sem ${Math.ceil(fecha.getDate() / 7)} ${fecha.toLocaleDateString("es-MX", { month: "short" })}`;
        
        if (!agrupado[semana]) {
          agrupado[semana] = { semana, total: 0, count: 0 };
        }

        agrupado[semana].total += orden.total;
        agrupado[semana].count += 1;
      });

      const costosFormateados = Object.values(agrupado).map(item => ({
        semana: item.semana,
        costo: Math.round(item.total),
        promedio: Math.round(item.total / item.count),
      }));

      setCostosData(costosFormateados);
    } catch (error) {
      console.error("Error loading costos:", error);
    }
  };

  const loadProductosStock = async () => {
    try {
      const { data, error } = await supabase
        .from("productos")
        .select("nombre, codigo, stock_actual, stock_minimo")
        .gt("stock_actual", 0)
        .order("stock_actual", { ascending: false })
        .limit(10);

      if (error) throw error;

      const formateado = data?.map(p => ({
        nombre: `${p.codigo}`,
        stock: p.stock_actual,
        minimo: p.stock_minimo,
      })) || [];

      setProductosStockData(formateado);
    } catch (error) {
      console.error("Error loading productos stock:", error);
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
      icon: AlertTriangle,
      color: "text-red-600",
    },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Ejecutivo</h1>
          <p className="text-muted-foreground">Análisis y tendencias del negocio</p>
        </div>

        <NotificacionesSistema />

        {/* Stats Cards */}
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

        {/* Gráficos principales */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Movimientos de Inventario */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Movimientos de Inventario (15 días)
              </CardTitle>
              <CardDescription>Entradas vs Salidas</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Cargando datos...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={movimientosData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" style={{ fontSize: '12px' }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="entradas" stroke="#10b981" strokeWidth={2} name="Entradas" />
                    <Line type="monotone" dataKey="salidas" stroke="#ef4444" strokeWidth={2} name="Salidas" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Tendencias de Costos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Costos de Compras (Semanal)
              </CardTitle>
              <CardDescription>Tendencias de gasto en compras</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Cargando datos...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={costosData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="semana" style={{ fontSize: '12px' }} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                    />
                    <Legend />
                    <Bar dataKey="costo" fill="#3b82f6" name="Total Comprado" />
                    <Bar dataKey="promedio" fill="#8b5cf6" name="Promedio por Orden" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Productos por Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Top 10 Productos por Stock
            </CardTitle>
            <CardDescription>Productos con mayor inventario actual</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Cargando datos...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productosStockData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="nombre" type="category" width={80} style={{ fontSize: '11px' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="stock" fill="#10b981" name="Stock Actual" />
                  <Bar dataKey="minimo" fill="#f59e0b" name="Stock Mínimo" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;
