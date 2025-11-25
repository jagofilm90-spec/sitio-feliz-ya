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

interface ClienteEstadoCuentaProps {
  clienteId: string;
}

const ClienteEstadoCuenta = ({ clienteId }: ClienteEstadoCuentaProps) => {
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadFacturas();
  }, [clienteId]);

  const loadFacturas = async () => {
    try {
      const { data, error } = await supabase
        .from("facturas")
        .select(`
          *,
          pedidos (folio)
        `)
        .eq("cliente_id", clienteId)
        .order("fecha_emision", { ascending: false });

      if (error) throw error;
      setFacturas(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las facturas",
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

  const totalPendiente = facturas
    .filter(f => !f.pagada)
    .reduce((sum, f) => sum + f.total, 0);

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
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total de Facturas</p>
              <p className="text-2xl font-bold">{facturas.length}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Facturas Pendientes</p>
              <p className="text-2xl font-bold text-orange-600">
                {facturas.filter(f => !f.pagada).length}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Saldo Total Pendiente</p>
              <p className="text-2xl font-bold text-destructive">
                ${totalPendiente.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                          ${factura.total.toFixed(2)}
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
    </div>
  );
};

export default ClienteEstadoCuenta;
