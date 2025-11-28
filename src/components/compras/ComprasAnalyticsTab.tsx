import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format, subMonths, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Package, DollarSign, Truck, BarChart3 } from "lucide-react";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const ComprasAnalyticsTab = () => {
  const [selectedProducto, setSelectedProducto] = useState<string>("all");
  const [selectedProveedor, setSelectedProveedor] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("6");

  // Fetch all purchase orders with details
  const { data: ordenesData = [] } = useQuery({
    queryKey: ["ordenes-compra-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordenes_compra")
        .select(`
          *,
          proveedor:proveedores(id, nombre),
          detalles:ordenes_compra_detalles(
            cantidad_ordenada,
            precio_unitario_compra,
            subtotal,
            producto:productos(id, nombre, codigo)
          )
        `)
        .order("fecha_orden", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch products for filter
  const { data: productos = [] } = useQuery({
    queryKey: ["productos-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("id, nombre, codigo")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // Fetch suppliers for filter
  const { data: proveedores = [] } = useQuery({
    queryKey: ["proveedores-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proveedores")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // Filter data by time range
  const filteredOrdenes = useMemo(() => {
    const months = parseInt(timeRange);
    const cutoffDate = subMonths(new Date(), months);
    return ordenesData.filter(
      (orden) => parseISO(orden.fecha_orden) >= cutoffDate
    );
  }, [ordenesData, timeRange]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalGastado = filteredOrdenes.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrdenes = filteredOrdenes.length;
    const promedioOrden = totalOrdenes > 0 ? totalGastado / totalOrdenes : 0;
    
    // Calculate trend (compare current period with previous)
    const halfPeriod = parseInt(timeRange) / 2;
    const midDate = subMonths(new Date(), halfPeriod);
    const recentOrders = filteredOrdenes.filter(o => parseISO(o.fecha_orden) >= midDate);
    const olderOrders = filteredOrdenes.filter(o => parseISO(o.fecha_orden) < midDate);
    
    const recentTotal = recentOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const olderTotal = olderOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const tendencia = olderTotal > 0 ? ((recentTotal - olderTotal) / olderTotal) * 100 : 0;

    return { totalGastado, totalOrdenes, promedioOrden, tendencia };
  }, [filteredOrdenes, timeRange]);

  // Price history by product
  const priceHistoryData = useMemo(() => {
    const priceMap = new Map<string, Array<{ fecha: string; precio: number; proveedor: string }>>();
    
    filteredOrdenes.forEach((orden) => {
      orden.detalles?.forEach((detalle: any) => {
        if (!detalle.producto) return;
        if (selectedProducto !== "all" && detalle.producto.id !== selectedProducto) return;
        if (selectedProveedor !== "all" && orden.proveedor?.id !== selectedProveedor) return;

        const key = detalle.producto.nombre;
        if (!priceMap.has(key)) {
          priceMap.set(key, []);
        }
        priceMap.get(key)?.push({
          fecha: format(parseISO(orden.fecha_orden), "MMM yyyy", { locale: es }),
          precio: Number(detalle.precio_unitario_compra),
          proveedor: orden.proveedor?.nombre || "N/A",
        });
      });
    });

    // Group by month and calculate average price
    const chartData: any[] = [];
    const monthMap = new Map<string, Map<string, number[]>>();

    priceMap.forEach((prices, producto) => {
      prices.forEach(({ fecha, precio }) => {
        if (!monthMap.has(fecha)) {
          monthMap.set(fecha, new Map());
        }
        if (!monthMap.get(fecha)?.has(producto)) {
          monthMap.get(fecha)?.set(producto, []);
        }
        monthMap.get(fecha)?.get(producto)?.push(precio);
      });
    });

    monthMap.forEach((productos, fecha) => {
      const dataPoint: any = { fecha };
      productos.forEach((precios, producto) => {
        dataPoint[producto] = precios.reduce((a, b) => a + b, 0) / precios.length;
      });
      chartData.push(dataPoint);
    });

    // Sort by date
    chartData.sort((a, b) => {
      const dateA = new Date(a.fecha);
      const dateB = new Date(b.fecha);
      return dateA.getTime() - dateB.getTime();
    });

    const productNames = Array.from(priceMap.keys()).slice(0, 5); // Limit to 5 products for readability
    return { chartData, productNames };
  }, [filteredOrdenes, selectedProducto, selectedProveedor]);

  // Supplier comparison for same products
  const supplierComparisonData = useMemo(() => {
    const productPrices = new Map<string, Map<string, number[]>>();

    filteredOrdenes.forEach((orden) => {
      if (!orden.proveedor) return;
      orden.detalles?.forEach((detalle: any) => {
        if (!detalle.producto) return;
        if (selectedProducto !== "all" && detalle.producto.id !== selectedProducto) return;

        const producto = detalle.producto.nombre;
        const proveedor = orden.proveedor.nombre;

        if (!productPrices.has(producto)) {
          productPrices.set(producto, new Map());
        }
        if (!productPrices.get(producto)?.has(proveedor)) {
          productPrices.get(producto)?.set(proveedor, []);
        }
        productPrices.get(producto)?.get(proveedor)?.push(Number(detalle.precio_unitario_compra));
      });
    });

    const chartData: any[] = [];
    productPrices.forEach((proveedores, producto) => {
      if (proveedores.size > 1) { // Only show products with multiple suppliers
        const dataPoint: any = { producto };
        proveedores.forEach((precios, proveedor) => {
          dataPoint[proveedor] = precios.reduce((a, b) => a + b, 0) / precios.length;
        });
        chartData.push(dataPoint);
      }
    });

    const supplierNames = new Set<string>();
    chartData.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (key !== "producto") supplierNames.add(key);
      });
    });

    return { chartData: chartData.slice(0, 10), supplierNames: Array.from(supplierNames) };
  }, [filteredOrdenes, selectedProducto]);

  // Spending by supplier (pie chart)
  const spendingBySupplierData = useMemo(() => {
    const supplierTotals = new Map<string, number>();
    
    filteredOrdenes.forEach((orden) => {
      const nombre = orden.proveedor?.nombre || "Sin proveedor";
      supplierTotals.set(nombre, (supplierTotals.get(nombre) || 0) + Number(orden.total));
    });

    return Array.from(supplierTotals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredOrdenes]);

  // Monthly spending trend
  const monthlySpendingData = useMemo(() => {
    const monthlyTotals = new Map<string, number>();
    
    filteredOrdenes.forEach((orden) => {
      const month = format(parseISO(orden.fecha_orden), "MMM yyyy", { locale: es });
      monthlyTotals.set(month, (monthlyTotals.get(month) || 0) + Number(orden.total));
    });

    return Array.from(monthlyTotals.entries())
      .map(([mes, total]) => ({ mes, total }))
      .sort((a, b) => {
        const dateA = new Date(a.mes);
        const dateB = new Date(b.mes);
        return dateA.getTime() - dateB.getTime();
      });
  }, [filteredOrdenes]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Análisis de Compras
          </CardTitle>
          <CardDescription>
            Visualiza tendencias de precios, comparativos y métricas clave
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Período</label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Últimos 3 meses</SelectItem>
                  <SelectItem value="6">Últimos 6 meses</SelectItem>
                  <SelectItem value="12">Último año</SelectItem>
                  <SelectItem value="24">Últimos 2 años</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Producto</label>
              <Select value={selectedProducto} onValueChange={setSelectedProducto}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Todos los productos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los productos</SelectItem>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo} - {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Proveedor</label>
              <Select value={selectedProveedor} onValueChange={setSelectedProveedor}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todos los proveedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proveedores</SelectItem>
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Gastado</p>
                <p className="text-2xl font-bold">
                  ${kpis.totalGastado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Órdenes</p>
                <p className="text-2xl font-bold">{kpis.totalOrdenes}</p>
              </div>
              <Truck className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Promedio por Orden</p>
                <p className="text-2xl font-bold">
                  ${kpis.promedioOrden.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tendencia</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">
                    {Math.abs(kpis.tendencia).toFixed(1)}%
                  </p>
                  {kpis.tendencia >= 0 ? (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Subió
                    </Badge>
                  ) : (
                    <Badge className="bg-green-500 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" /> Bajó
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price History */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Precios</CardTitle>
            <CardDescription>
              Evolución del precio de compra por producto
            </CardDescription>
          </CardHeader>
          <CardContent>
            {priceHistoryData.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={priceHistoryData.chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="fecha" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `$${v}`} />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))" 
                    }}
                  />
                  <Legend />
                  {priceHistoryData.productNames.map((name, index) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay datos para mostrar
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spending by Supplier */}
        <Card>
          <CardHeader>
            <CardTitle>Gasto por Proveedor</CardTitle>
            <CardDescription>
              Distribución del gasto entre proveedores
            </CardDescription>
          </CardHeader>
          <CardContent>
            {spendingBySupplierData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={spendingBySupplierData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {spendingBySupplierData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString("es-MX")}`, "Total"]}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))" 
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay datos para mostrar
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Spending */}
        <Card>
          <CardHeader>
            <CardTitle>Gasto Mensual</CardTitle>
            <CardDescription>
              Evolución del gasto total por mes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlySpendingData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlySpendingData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString("es-MX")}`, "Total"]}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))" 
                    }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay datos para mostrar
              </div>
            )}
          </CardContent>
        </Card>

        {/* Supplier Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Comparativo de Proveedores</CardTitle>
            <CardDescription>
              Precios promedio del mismo producto entre proveedores
            </CardDescription>
          </CardHeader>
          <CardContent>
            {supplierComparisonData.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={supplierComparisonData.chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="producto" className="text-xs" width={100} />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))" 
                    }}
                  />
                  <Legend />
                  {supplierComparisonData.supplierNames.map((name, index) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      fill={COLORS[index % COLORS.length]}
                      radius={[0, 4, 4, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay productos con múltiples proveedores para comparar
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ComprasAnalyticsTab;
