import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Receipt } from "lucide-react";

interface ClienteEstadoCuentaProps {
  clienteId: string;
}

const ClienteEstadoCuenta = ({ clienteId }: ClienteEstadoCuentaProps) => {
  const [facturas, setFacturas] = useState<any[]>([]);
  const [pedidosPendientes, setPedidosPendientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [clienteId]);

  const loadData = async () => {
    try {
      // Load facturas
      const { data: facturasData, error: facturasError } = await supabase
        .from("facturas")
        .select(`
          *,
          pedidos (folio)
        `)
        .eq("cliente_id", clienteId)
        .order("fecha_emision", { ascending: false });

      if (facturasError) throw facturasError;
      setFacturas(facturasData || []);

      // Load pedidos not invoiced (facturado = false)
      const { data: pedidosData, error: pedidosError } = await supabase
        .from("pedidos")
        .select(`
          id,
          folio,
          fecha_pedido,
          total,
          status,
          facturado
        `)
        .eq("cliente_id", clienteId)
        .eq("facturado", false)
        .not("status", "eq", "cancelado")
        .order("fecha_pedido", { ascending: false });

      if (pedidosError) throw pedidosError;
      setPedidosPendientes(pedidosData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calcularDiasVencimiento = (fechaVencimiento: string | null) => {
    if (!fechaVencimiento) return null;
    
    const hoy = new Date();
    const vencimiento = new Date(fechaVencimiento);
    const diffTime = vencimiento.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const getEstadoBadge = (pagada: boolean, diasVencimiento: number | null) => {
    if (pagada) {
      return <Badge variant="default" className="bg-green-600">Pagada</Badge>;
    }
    
    if (diasVencimiento === null) {
      return <Badge variant="secondary">Pendiente</Badge>;
    }
    
    if (diasVencimiento < 0) {
      return <Badge variant="destructive">Vencida ({Math.abs(diasVencimiento)} días)</Badge>;
    }
    
    if (diasVencimiento <= 3) {
      return <Badge variant="secondary" className="bg-orange-600">Por vencer ({diasVencimiento} días)</Badge>;
    }
    
    return <Badge variant="secondary">Pendiente ({diasVencimiento} días)</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      pendiente: { label: "Pendiente", className: "bg-yellow-500/20 text-yellow-700" },
      por_autorizar: { label: "Por Autorizar", className: "bg-orange-500/20 text-orange-700" },
      procesando: { label: "Procesando", className: "bg-blue-500/20 text-blue-700" },
      en_ruta: { label: "En Ruta", className: "bg-purple-500/20 text-purple-700" },
      entregado: { label: "Entregado", className: "bg-green-500/20 text-green-700" },
    };
    const config = statusMap[status] || { label: status, className: "bg-gray-500/20 text-gray-700" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // Calculate totals
  const totalPendientePago = facturas
    .filter(f => !f.pagada)
    .reduce((sum, f) => sum + (f.total || 0), 0);

  const totalPendienteFacturar = pedidosPendientes
    .reduce((sum, p) => sum + (p.total || 0), 0);

  const saldoTotal = totalPendientePago + totalPendienteFacturar;

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">Cargando estado de cuenta...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Pedidos sin Facturar</p>
              <p className="text-2xl font-bold text-orange-600">
                ${totalPendienteFacturar.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">{pedidosPendientes.length} pedidos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Facturas Pendientes</p>
              <p className="text-2xl font-bold text-red-600">
                ${totalPendientePago.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">{facturas.filter(f => !f.pagada).length} facturas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Saldo Total</p>
              <p className="text-2xl font-bold text-destructive">
                ${saldoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">Por facturar + por pagar</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Facturas</p>
              <p className="text-2xl font-bold">{facturas.length}</p>
              <p className="text-xs text-muted-foreground">{facturas.filter(f => f.pagada).length} pagadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Pedidos and Facturas */}
      <Tabs defaultValue="pedidos" className="w-full">
        <TabsList>
          <TabsTrigger value="pedidos" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Pedidos sin Facturar ({pedidosPendientes.length})
          </TabsTrigger>
          <TabsTrigger value="facturas" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Facturas ({facturas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos Pendientes de Facturar</CardTitle>
            </CardHeader>
            <CardContent>
              {pedidosPendientes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay pedidos pendientes de facturar
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Folio</TableHead>
                        <TableHead>Fecha Pedido</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidosPendientes.map((pedido) => (
                        <TableRow key={pedido.id}>
                          <TableCell className="font-medium">{pedido.folio}</TableCell>
                          <TableCell>
                            {new Date(pedido.fecha_pedido).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{getStatusBadge(pedido.status)}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${(pedido.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="facturas">
          <Card>
            <CardHeader>
              <CardTitle>Facturas</CardTitle>
            </CardHeader>
            <CardContent>
              {facturas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tienes facturas registradas
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Folio</TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Fecha Emisión</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facturas.map((factura) => {
                        const diasVencimiento = calcularDiasVencimiento(factura.fecha_vencimiento);
                        return (
                          <TableRow key={factura.id}>
                            <TableCell className="font-medium">{factura.folio}</TableCell>
                            <TableCell>{factura.pedidos?.folio || "—"}</TableCell>
                            <TableCell>
                              {new Date(factura.fecha_emision).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {factura.fecha_vencimiento
                                ? new Date(factura.fecha_vencimiento).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${factura.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              {getEstadoBadge(factura.pagada, diasVencimiento)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClienteEstadoCuenta;
