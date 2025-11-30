import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, TrendingDown, Minus, Package, DollarSign, Calendar } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";

interface ClienteHistorialAnalyticsProps {
  clienteId: string;
  clienteNombre: string;
}

interface PrecioHistorial {
  producto_id: string;
  producto_nombre: string;
  producto_codigo: string;
  mes: string;
  precio: number;
  cantidad: number;
  fuente: "cotizacion" | "pedido";
}

const ClienteHistorialAnalytics = ({ clienteId, clienteNombre }: ClienteHistorialAnalyticsProps) => {
  const [mesesAtras, setMesesAtras] = useState("6");

  // Fetch price and quantity history from cotizaciones and pedidos
  const { data: historialData, isLoading } = useQuery({
    queryKey: ["cliente-historial", clienteId, mesesAtras],
    queryFn: async () => {
      const meses = parseInt(mesesAtras);
      const fechaInicio = startOfMonth(subMonths(new Date(), meses));

      // Get cotizaciones data
      const { data: cotizaciones, error: cotError } = await supabase
        .from("cotizaciones")
        .select(`
          id,
          fecha_creacion,
          cotizaciones_detalles (
            producto_id,
            cantidad,
            precio_unitario,
            producto:productos (nombre, codigo)
          )
        `)
        .eq("cliente_id", clienteId)
        .gte("fecha_creacion", fechaInicio.toISOString())
        .order("fecha_creacion", { ascending: false });

      if (cotError) throw cotError;

      // Get pedidos data
      const { data: pedidos, error: pedError } = await supabase
        .from("pedidos")
        .select(`
          id,
          fecha_pedido,
          pedidos_detalles (
            producto_id,
            cantidad,
            precio_unitario,
            producto:productos (nombre, codigo)
          )
        `)
        .eq("cliente_id", clienteId)
        .gte("fecha_pedido", fechaInicio.toISOString())
        .order("fecha_pedido", { ascending: false });

      if (pedError) throw pedError;

      // Process data by product and month
      const historialMap = new Map<string, PrecioHistorial[]>();

      // Process cotizaciones
      cotizaciones?.forEach((cot: any) => {
        const mes = format(new Date(cot.fecha_creacion), "yyyy-MM");
        cot.cotizaciones_detalles?.forEach((det: any) => {
          if (!det.producto) return;
          const key = det.producto_id;
          if (!historialMap.has(key)) {
            historialMap.set(key, []);
          }
          historialMap.get(key)!.push({
            producto_id: det.producto_id,
            producto_nombre: det.producto.nombre,
            producto_codigo: det.producto.codigo,
            mes,
            precio: det.precio_unitario,
            cantidad: det.cantidad,
            fuente: "cotizacion",
          });
        });
      });

      // Process pedidos
      pedidos?.forEach((ped: any) => {
        const mes = format(new Date(ped.fecha_pedido), "yyyy-MM");
        ped.pedidos_detalles?.forEach((det: any) => {
          if (!det.producto) return;
          const key = det.producto_id;
          if (!historialMap.has(key)) {
            historialMap.set(key, []);
          }
          historialMap.get(key)!.push({
            producto_id: det.producto_id,
            producto_nombre: det.producto.nombre,
            producto_codigo: det.producto.codigo,
            mes,
            precio: det.precio_unitario,
            cantidad: det.cantidad,
            fuente: "pedido",
          });
        });
      });

      return historialMap;
    },
  });

  // Aggregate data by product
  const productosAgregados = historialData
    ? Array.from(historialData.entries()).map(([productoId, registros]) => {
        // Group by month
        const porMes = new Map<string, { precios: number[]; cantidades: number[] }>();
        registros.forEach((r) => {
          if (!porMes.has(r.mes)) {
            porMes.set(r.mes, { precios: [], cantidades: [] });
          }
          porMes.get(r.mes)!.precios.push(r.precio);
          porMes.get(r.mes)!.cantidades.push(r.cantidad);
        });

        // Calculate monthly averages
        const mesesOrdenados = Array.from(porMes.entries())
          .sort((a, b) => b[0].localeCompare(a[0])) // Most recent first
          .map(([mes, data]) => ({
            mes,
            mesLabel: format(new Date(mes + "-01"), "MMM yyyy", { locale: es }),
            precioPromedio: data.precios.reduce((a, b) => a + b, 0) / data.precios.length,
            cantidadTotal: data.cantidades.reduce((a, b) => a + b, 0),
          }));

        const primerRegistro = registros[0];
        const ultimoPrecio = mesesOrdenados[0]?.precioPromedio || 0;
        const penultimoPrecio = mesesOrdenados[1]?.precioPromedio || ultimoPrecio;
        const tendencia = ultimoPrecio > penultimoPrecio ? "up" : ultimoPrecio < penultimoPrecio ? "down" : "stable";

        return {
          producto_id: productoId,
          producto_nombre: primerRegistro.producto_nombre,
          producto_codigo: primerRegistro.producto_codigo,
          meses: mesesOrdenados,
          ultimoPrecio,
          tendencia,
          cantidadTotalGlobal: mesesOrdenados.reduce((acc, m) => acc + m.cantidadTotal, 0),
        };
      })
    : [];

  // Sort by most recent activity
  productosAgregados.sort((a, b) => {
    const mesA = a.meses[0]?.mes || "";
    const mesB = b.meses[0]?.mes || "";
    return mesB.localeCompare(mesA);
  });

  const getTrendIcon = (tendencia: string) => {
    if (tendencia === "up") return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (tendencia === "down") return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Historial de {clienteNombre}</h3>
          <p className="text-sm text-muted-foreground">
            Precios y cantidades de cotizaciones y pedidos
          </p>
        </div>
        <Select value={mesesAtras} onValueChange={setMesesAtras}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Último año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {productosAgregados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay historial de cotizaciones o pedidos para este cliente en el período seleccionado.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="precios" className="space-y-4">
          <TabsList>
            <TabsTrigger value="precios" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Historial de Precios
            </TabsTrigger>
            <TabsTrigger value="cantidades" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Cantidades por Mes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="precios">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Precios por Producto y Mes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Último Precio</TableHead>
                      <TableHead className="text-center">Tendencia</TableHead>
                      {/* Dynamic month columns - show last 6 months max */}
                      {Array.from({ length: Math.min(parseInt(mesesAtras), 6) }, (_, i) => {
                        const fecha = subMonths(new Date(), i);
                        return (
                          <TableHead key={i} className="text-right">
                            {format(fecha, "MMM yy", { locale: es })}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productosAgregados.map((prod) => (
                      <TableRow key={prod.producto_id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{prod.producto_nombre}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {prod.producto_codigo}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          ${formatCurrency(prod.ultimoPrecio)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getTrendIcon(prod.tendencia)}
                        </TableCell>
                        {Array.from({ length: Math.min(parseInt(mesesAtras), 6) }, (_, i) => {
                          const fecha = subMonths(new Date(), i);
                          const mesKey = format(fecha, "yyyy-MM");
                          const datoMes = prod.meses.find((m) => m.mes === mesKey);
                          return (
                            <TableCell key={i} className="text-right font-mono">
                              {datoMes ? (
                                `$${formatCurrency(datoMes.precioPromedio)}`
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cantidades">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Cantidades Ordenadas por Mes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Total Global</TableHead>
                      {/* Dynamic month columns */}
                      {Array.from({ length: Math.min(parseInt(mesesAtras), 6) }, (_, i) => {
                        const fecha = subMonths(new Date(), i);
                        return (
                          <TableHead key={i} className="text-right">
                            {format(fecha, "MMM yy", { locale: es })}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productosAgregados.map((prod) => (
                      <TableRow key={prod.producto_id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{prod.producto_nombre}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {prod.producto_codigo}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          <Badge variant="secondary">
                            {prod.cantidadTotalGlobal.toLocaleString()}
                          </Badge>
                        </TableCell>
                        {Array.from({ length: Math.min(parseInt(mesesAtras), 6) }, (_, i) => {
                          const fecha = subMonths(new Date(), i);
                          const mesKey = format(fecha, "yyyy-MM");
                          const datoMes = prod.meses.find((m) => m.mes === mesKey);
                          return (
                            <TableCell key={i} className="text-right font-mono">
                              {datoMes ? (
                                datoMes.cantidadTotal.toLocaleString()
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default ClienteHistorialAnalytics;
