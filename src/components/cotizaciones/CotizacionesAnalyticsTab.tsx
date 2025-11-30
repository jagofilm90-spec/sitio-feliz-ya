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
import { Loader2, TrendingUp, TrendingDown, Minus, BarChart3, Users } from "lucide-react";
import { format, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
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

  // Fetch summary stats
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["cotizaciones-stats", mesesAtras],
    queryFn: async () => {
      const meses = parseInt(mesesAtras);
      const fechaInicio = subMonths(new Date(), meses);

      // Get cotizaciones count per client
      const { data: cotizaciones, error } = await supabase
        .from("cotizaciones")
        .select(`
          id,
          cliente_id,
          cliente:clientes(nombre, codigo),
          total,
          fecha_creacion,
          status
        `)
        .gte("fecha_creacion", fechaInicio.toISOString())
        .order("fecha_creacion", { ascending: false });

      if (error) throw error;

      // Aggregate by client
      const clienteStats = new Map<string, {
        cliente_id: string;
        nombre: string;
        codigo: string;
        totalCotizaciones: number;
        montoTotal: number;
        enviadas: number;
        aceptadas: number;
      }>();

      cotizaciones?.forEach((cot: any) => {
        if (!cot.cliente) return;
        const key = cot.cliente_id;
        if (!clienteStats.has(key)) {
          clienteStats.set(key, {
            cliente_id: cot.cliente_id,
            nombre: cot.cliente.nombre,
            codigo: cot.cliente.codigo,
            totalCotizaciones: 0,
            montoTotal: 0,
            enviadas: 0,
            aceptadas: 0,
          });
        }
        const stat = clienteStats.get(key)!;
        stat.totalCotizaciones++;
        stat.montoTotal += cot.total || 0;
        if (cot.status === "enviada" || cot.status === "autorizada") stat.enviadas++;
        if (cot.status === "aceptada") stat.aceptadas++;
      });

      return Array.from(clienteStats.values()).sort((a, b) => b.totalCotizaciones - a.totalCotizaciones);
    },
  });

  if (loadingClientes || loadingStats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Análisis de Cotizaciones
          </h3>
          <p className="text-sm text-muted-foreground">
            Historial de precios y cantidades por cliente
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
                  <TableHead className="text-center">Cotizaciones</TableHead>
                  <TableHead className="text-center">Enviadas</TableHead>
                  <TableHead className="text-center">Aceptadas</TableHead>
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
                      <Badge variant="secondary">{stat.totalCotizaciones}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-blue-500/20 text-blue-700">{stat.enviadas}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-green-500/20 text-green-700">{stat.aceptadas}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${formatCurrency(stat.montoTotal)}
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
              No hay cotizaciones en el período seleccionado.
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
