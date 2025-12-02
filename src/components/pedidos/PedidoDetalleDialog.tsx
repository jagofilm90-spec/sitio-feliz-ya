import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface PedidoDetalleDialogProps {
  pedidoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateNext?: () => void;
  onNavigatePrevious?: () => void;
  canNavigateNext?: boolean;
  canNavigatePrevious?: boolean;
}

interface PedidoDetalle {
  id: string;
  folio: string;
  fecha_pedido: string;
  subtotal: number;
  impuestos: number;
  total: number;
  status: string;
  notas: string | null;
  clientes: { nombre: string; codigo: string } | null;
  profiles: { full_name: string } | null;
  cliente_sucursales: { nombre: string } | null;
  pedidos_detalles: Array<{
    id: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    productos: {
      codigo: string;
      nombre: string;
      marca: string | null;
      unidad: string;
      kg_por_unidad: number | null;
      precio_por_kilo: boolean;
    };
  }>;
}

export default function PedidoDetalleDialog({
  pedidoId,
  open,
  onOpenChange,
  onNavigateNext,
  onNavigatePrevious,
  canNavigateNext = false,
  canNavigatePrevious = false,
}: PedidoDetalleDialogProps) {
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pedidoId && open) {
      loadPedido();
    }
  }, [pedidoId, open]);

  // Navegación con teclado: Flecha derecha = siguiente, Flecha izquierda = anterior
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && canNavigateNext && onNavigateNext) {
        e.preventDefault();
        onNavigateNext();
      } else if (e.key === "ArrowLeft" && canNavigatePrevious && onNavigatePrevious) {
        e.preventDefault();
        onNavigatePrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, canNavigateNext, canNavigatePrevious, onNavigateNext, onNavigatePrevious]);

  const loadPedido = async () => {
    if (!pedidoId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select(`
          id,
          folio,
          fecha_pedido,
          subtotal,
          impuestos,
          total,
          status,
          notas,
          clientes (nombre, codigo),
          profiles:vendedor_id (full_name),
          cliente_sucursales:sucursal_id (nombre),
          pedidos_detalles (
            id,
            cantidad,
            precio_unitario,
            subtotal,
            productos (
              codigo,
              nombre,
              marca,
              unidad,
              kg_por_unidad,
              precio_por_kilo
            )
          )
        `)
        .eq("id", pedidoId)
        .single();

      if (error) throw error;
      setPedido(data as any);
    } catch (error) {
      console.error("Error loading pedido:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const labels: Record<string, string> = {
      pendiente: "Pendiente",
      en_ruta: "En Ruta",
      entregado: "Entregado",
      cancelado: "Cancelado",
    };
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pendiente: "secondary",
      en_ruta: "default",
      entregado: "default",
      cancelado: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Detalle del Pedido {pedido?.folio}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : pedido ? (
          <div className="space-y-6">
            {/* Información general */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{pedido.clientes?.nombre || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sucursal</p>
                <p className="font-medium">{pedido.cliente_sucursales?.nombre || "Principal"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vendedor</p>
                <p className="font-medium">{pedido.profiles?.full_name || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fecha</p>
                <p className="font-medium">{new Date(pedido.fecha_pedido).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                {getStatusBadge(pedido.status)}
              </div>
            </div>

            {/* Notas */}
            {pedido.notas && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Notas</p>
                <p className="text-sm">{pedido.notas}</p>
              </div>
            )}

            {/* Productos */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">P. Unitario</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedido.pedidos_detalles.map((detalle) => {
                    const producto = detalle.productos;
                    const unidadDisplay = producto.precio_por_kilo ? "kg" : (producto.unidad || "pza");
                    return (
                      <TableRow key={detalle.id}>
                        <TableCell className="font-mono text-sm">{producto.codigo}</TableCell>
                        <TableCell>
                          {producto.nombre}
                          {producto.marca && <span className="text-muted-foreground ml-1">({producto.marca})</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {detalle.cantidad} {unidadDisplay !== "kg" ? producto.unidad : "bultos"}
                          {producto.kg_por_unidad && !producto.precio_por_kilo && (
                            <span className="text-muted-foreground text-xs ml-1">
                              ({detalle.cantidad * producto.kg_por_unidad} kg)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${formatCurrency(detalle.precio_unitario)}
                          {producto.precio_por_kilo && <span className="text-xs text-muted-foreground">/kg</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono">${formatCurrency(detalle.subtotal)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Totales */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-mono">${formatCurrency(pedido.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Impuestos:</span>
                  <span className="font-mono">${formatCurrency(pedido.impuestos || 0)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span className="font-mono">${formatCurrency(pedido.total)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No se encontró el pedido</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
