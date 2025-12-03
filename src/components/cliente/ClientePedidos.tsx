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
import { Button } from "@/components/ui/button";
import { Eye, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ordenarProductosAzucarPrimero } from "@/lib/calculos";

interface ClientePedidosProps {
  clienteId: string;
}

const ClientePedidos = ({ clienteId }: ClientePedidosProps) => {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPedido, setExpandedPedido] = useState<string | null>(null);
  const [detallesPedidos, setDetallesPedidos] = useState<Record<string, any[]>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadPedidos();
  }, [clienteId]);

  const loadPedidos = async () => {
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select(`
          *,
          profiles:vendedor_id (full_name)
        `)
        .eq("cliente_id", clienteId)
        .order("fecha_pedido", { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los pedidos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDetallesPedido = async (pedidoId: string) => {
    if (detallesPedidos[pedidoId]) {
      return; // Ya está cargado
    }

    try {
      const { data, error } = await supabase
        .from("pedidos_detalles")
        .select(`
          *,
          productos (nombre, codigo, unidad)
        `)
        .eq("pedido_id", pedidoId);

      if (error) throw error;
      
      setDetallesPedidos(prev => ({
        ...prev,
        [pedidoId]: data || []
      }));
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles del pedido",
        variant: "destructive",
      });
    }
  };

  const togglePedido = (pedidoId: string) => {
    if (expandedPedido === pedidoId) {
      setExpandedPedido(null);
    } else {
      setExpandedPedido(pedidoId);
      loadDetallesPedido(pedidoId);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pendiente: "secondary",
      en_ruta: "default",
      entregado: "default",
      cancelado: "destructive",
    };

    const labels: Record<string, string> = {
      pendiente: "Pendiente",
      en_ruta: "En Ruta",
      entregado: "Entregado",
      cancelado: "Cancelado",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">Cargando pedidos...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Pedidos</CardTitle>
      </CardHeader>
      <CardContent>
        {pedidos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No tienes pedidos registrados
          </div>
        ) : (
          <div className="space-y-4">
            {pedidos.map((pedido) => (
              <Collapsible
                key={pedido.id}
                open={expandedPedido === pedido.id}
                onOpenChange={() => togglePedido(pedido.id)}
              >
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <p className="font-semibold">Folio: {pedido.folio}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(pedido.fecha_pedido).toLocaleDateString()}
                          </p>
                        </div>
                        {getStatusBadge(pedido.status)}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold">Total: ${pedido.total?.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">
                            Vendedor: {pedido.profiles?.full_name || "—"}
                          </p>
                        </div>
                        {expandedPedido === pedido.id ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      {detallesPedidos[pedido.id] ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Producto</TableHead>
                              <TableHead>Código</TableHead>
                              <TableHead className="text-right">Cantidad</TableHead>
                              <TableHead className="text-right">Precio Unit.</TableHead>
                              <TableHead className="text-right">Subtotal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ordenarProductosAzucarPrimero(detallesPedidos[pedido.id], (d) => d.productos?.nombre || '').map((detalle) => (
                              <TableRow key={detalle.id}>
                                <TableCell>{detalle.productos?.nombre}</TableCell>
                                <TableCell>{detalle.productos?.codigo}</TableCell>
                                <TableCell className="text-right">
                                  {detalle.cantidad} {detalle.productos?.unidad}
                                </TableCell>
                                <TableCell className="text-right">
                                  ${detalle.precio_unitario.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  ${detalle.subtotal.toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-4">Cargando detalles...</div>
                      )}
                      {pedido.notas && (
                        <div className="mt-4 p-3 bg-muted rounded-md">
                          <p className="text-sm font-medium mb-1">Notas:</p>
                          <p className="text-sm text-muted-foreground">{pedido.notas}</p>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientePedidos;
