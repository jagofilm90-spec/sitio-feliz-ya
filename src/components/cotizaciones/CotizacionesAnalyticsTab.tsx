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
import { Loader2, BarChart3, Users } from "lucide-react";
import { subMonths } from "date-fns";
import ClienteHistorialAnalytics from "@/components/analytics/ClienteHistorialAnalytics";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Cliente {
  id: string;
  nombre: string;
  codigo: string;
}

const CotizacionesAnalyticsTab = () => {
  const [mesesAtras, setMesesAtras] = useState("6");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  // Fetch clientes with cotizaciones
  const { data: clientes, isLoading: loadingClientes } = useQuery({
    queryKey: ["clientes-con-cotizaciones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nombre, codigo")
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;
      return data as Cliente[];
    },
  });

  // Fetch summary stats from PEDIDOS (real sales) instead of cotizaciones
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["pedidos-stats-by-client", mesesAtras],
    queryFn: async () => {
      const meses = parseInt(mesesAtras);
      const fechaInicio = subMonths(new Date(), meses);

      // Get pedidos (real orders) per client
      const { data: pedidos, error: pedidosError } = await supabase
        .from("pedidos")
        .select(`
          id,
          cliente_id,
          cliente:clientes(nombre, codigo),
          total,
          fecha_pedido,
          status,
          facturado
        `)
        .gte("fecha_pedido", fechaInicio.toISOString())
        .not("status", "eq", "cancelado")
        .order("fecha_pedido", { ascending: false });

      if (pedidosError) throw pedidosError;

      // Also get cotizaciones count for reference
      const { data: cotizaciones, error: cotError } = await supabase
        .from("cotizaciones")
        .select("id, cliente_id, status")
        .gte("fecha_creacion", fechaInicio.toISOString());

      if (cotError) throw cotError;

      // Count cotizaciones per client
      const cotizacionesPorCliente = new Map<string, number>();
      cotizaciones?.forEach((cot: any) => {
        const count = cotizacionesPorCliente.get(cot.cliente_id) || 0;
        cotizacionesPorCliente.set(cot.cliente_id, count + 1);
      });

      // Aggregate pedidos by client
      const clienteStats = new Map<string, {
        cliente_id: string;
        nombre: string;
        codigo: string;
        totalPedidos: number;
        montoTotal: number;
        entregados: number;
        facturados: number;
        cotizaciones: number;
      }>();

      pedidos?.forEach((pedido: any) => {
        if (!pedido.cliente) return;
        const key = pedido.cliente_id;
        if (!clienteStats.has(key)) {
          clienteStats.set(key, {
            cliente_id: pedido.cliente_id,
            nombre: pedido.cliente.nombre,
            codigo: pedido.cliente.codigo,
            totalPedidos: 0,
            montoTotal: 0,
            entregados: 0,
            facturados: 0,
            cotizaciones: cotizacionesPorCliente.get(pedido.cliente_id) || 0,
          });
        }
        const stat = clienteStats.get(key)!;
        stat.totalPedidos++;
        stat.montoTotal += pedido.total || 0;
        if (pedido.status === "entregado") stat.entregados++;
        if (pedido.facturado) stat.facturados++;
      });

      return Array.from(clienteStats.values()).sort((a, b) => b.montoTotal - a.montoTotal);
    },
  });

  if (loadingClientes || loadingStats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate totals
  const totalGeneral = stats?.reduce((sum, s) => sum + s.montoTotal, 0) || 0;
  const totalPedidos = stats?.reduce((sum, s) => sum + s.totalPedidos, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Análisis de Ventas por Cliente
          </h3>
          <p className="text-sm text-muted-foreground">
            Historial de pedidos, precios y cantidades por cliente
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Vendido</p>
              <p className="text-2xl font-bold text-green-600">
                ${totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Pedidos</p>
              <p className="text-2xl font-bold">{totalPedidos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Clientes Activos</p>
              <p className="text-2xl font-bold">{stats?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5" />
            Resumen por Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats && stats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-center">Pedidos</TableHead>
                  <TableHead className="text-center">Entregados</TableHead>
                  <TableHead className="text-center">Facturados</TableHead>
                  <TableHead className="text-center">Cotizaciones</TableHead>
                  <TableHead className="text-right">Monto Total</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((stat) => (
                  <TableRow key={stat.cliente_id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{stat.nombre}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {stat.codigo}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{stat.totalPedidos}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-green-500/20 text-green-700">{stat.entregados}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-blue-500/20 text-blue-700">{stat.facturados}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{stat.cotizaciones}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      ${stat.montoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCliente({
                          id: stat.cliente_id,
                          nombre: stat.nombre,
                          codigo: stat.codigo,
                        })}
                      >
                        Ver historial
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No hay pedidos en el período seleccionado.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick access to all clients */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value=""
            onValueChange={(value) => {
              const cliente = clientes?.find(c => c.id === value);
              if (cliente) setSelectedCliente(cliente);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un cliente para ver su historial..." />
            </SelectTrigger>
            <SelectContent>
              {clientes?.map((cliente) => (
                <SelectItem key={cliente.id} value={cliente.id}>
                  {cliente.nombre} ({cliente.codigo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Client detail dialog */}
      <Dialog open={!!selectedCliente} onOpenChange={() => setSelectedCliente(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Historial de {selectedCliente?.nombre}
            </DialogTitle>
          </DialogHeader>
          {selectedCliente && (
            <ClienteHistorialAnalytics
              clienteId={selectedCliente.id}
              clienteNombre={selectedCliente.nombre}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CotizacionesAnalyticsTab;
