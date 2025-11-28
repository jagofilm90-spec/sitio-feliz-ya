import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  Package, 
  AlertTriangle, 
  Calendar,
  Loader2,
  Truck
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface RecepcionProducto {
  detalle_id: string;
  producto_id: string;
  producto_nombre: string;
  producto_codigo: string;
  cantidad_ordenada: number;
  cantidad_recibida_anterior: number;
  cantidad_pendiente: number;
  cantidad_recibida_ahora: number;
}

interface RegistrarRecepcionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orden: any;
}

const RegistrarRecepcionDialog = ({ open, onOpenChange, orden }: RegistrarRecepcionDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [guardando, setGuardando] = useState(false);
  const [productos, setProductos] = useState<RecepcionProducto[]>([]);
  const [fechaNuevaEntrega, setFechaNuevaEntrega] = useState("");
  const [notasRecepcion, setNotasRecepcion] = useState("");

  // Initialize products when dialog opens
  useEffect(() => {
    if (open && orden?.ordenes_compra_detalles) {
      const productosIniciales = orden.ordenes_compra_detalles.map((d: any) => ({
        detalle_id: d.id,
        producto_id: d.producto_id,
        producto_nombre: d.productos?.nombre || "Producto",
        producto_codigo: d.productos?.codigo || "-",
        cantidad_ordenada: d.cantidad_ordenada,
        cantidad_recibida_anterior: d.cantidad_recibida || 0,
        cantidad_pendiente: d.cantidad_ordenada - (d.cantidad_recibida || 0),
        cantidad_recibida_ahora: 0,
      }));
      setProductos(productosIniciales);
      setFechaNuevaEntrega("");
      setNotasRecepcion("");
    }
  }, [open, orden]);

  const handleCantidadChange = (detalleId: string, cantidad: number) => {
    setProductos(prev => prev.map(p => {
      if (p.detalle_id === detalleId) {
        // Can't receive more than what's pending
        const cantidadValida = Math.min(Math.max(0, cantidad), p.cantidad_pendiente);
        return { ...p, cantidad_recibida_ahora: cantidadValida };
      }
      return p;
    }));
  };

  const handleRecibirTodo = (detalleId: string) => {
    setProductos(prev => prev.map(p => {
      if (p.detalle_id === detalleId) {
        return { ...p, cantidad_recibida_ahora: p.cantidad_pendiente };
      }
      return p;
    }));
  };

  const totalRecibidoAhora = productos.reduce((sum, p) => sum + p.cantidad_recibida_ahora, 0);
  const totalPendienteOriginal = productos.reduce((sum, p) => sum + p.cantidad_pendiente, 0);
  const quedaPendiente = productos.some(p => 
    p.cantidad_pendiente - p.cantidad_recibida_ahora > 0
  );
  const hayProductosConPendiente = productos.filter(p => 
    p.cantidad_pendiente - p.cantidad_recibida_ahora > 0
  );

  const handleGuardar = async () => {
    if (totalRecibidoAhora === 0) {
      toast({
        title: "Sin cambios",
        description: "Indica la cantidad recibida de al menos un producto",
        variant: "destructive",
      });
      return;
    }

    if (quedaPendiente && !fechaNuevaEntrega) {
      toast({
        title: "Fecha requerida",
        description: "Indica cuándo llegará la mercancía pendiente",
        variant: "destructive",
      });
      return;
    }

    setGuardando(true);
    try {
      // Update cantidad_recibida for each product
      for (const producto of productos) {
        if (producto.cantidad_recibida_ahora > 0) {
          const nuevaCantidadRecibida = producto.cantidad_recibida_anterior + producto.cantidad_recibida_ahora;
          
          const { error } = await supabase
            .from("ordenes_compra_detalles")
            .update({ cantidad_recibida: nuevaCantidadRecibida })
            .eq("id", producto.detalle_id);
          
          if (error) throw error;
        }
      }

      // Check if order is now complete or partial
      const todoRecibido = !quedaPendiente;
      
      if (todoRecibido) {
        // Mark order as fully received
        await supabase
          .from("ordenes_compra")
          .update({ 
            status: "recibida",
            fecha_entrega_real: new Date().toISOString().split('T')[0]
          })
          .eq("id", orden.id);
      } else {
        // Mark as partially received and schedule next delivery
        await supabase
          .from("ordenes_compra")
          .update({ 
            status: "parcial",
            fecha_entrega_programada: fechaNuevaEntrega
          })
          .eq("id", orden.id);

        // Create entry in entregas for tracking
        const cantidadBultosPendientes = hayProductosConPendiente.reduce(
          (sum, p) => sum + (p.cantidad_pendiente - p.cantidad_recibida_ahora), 
          0
        );

        // Check if we need to create/update delivery record
        if (orden.entregas_multiples) {
          // Find next available entrega number
          const { data: existingEntregas } = await supabase
            .from("ordenes_compra_entregas")
            .select("numero_entrega")
            .eq("orden_compra_id", orden.id)
            .order("numero_entrega", { ascending: false })
            .limit(1);

          const nextNumero = (existingEntregas?.[0]?.numero_entrega || 0) + 1;

          await supabase
            .from("ordenes_compra_entregas")
            .insert({
              orden_compra_id: orden.id,
              numero_entrega: nextNumero,
              cantidad_bultos: cantidadBultosPendientes,
              fecha_programada: fechaNuevaEntrega,
              status: "programada",
              notas: notasRecepcion || `Entrega pendiente programada - ${cantidadBultosPendientes} unidades restantes`
            });
        }

        // Notify supplier about new delivery date
        if (orden?.proveedores?.email) {
          const productosInfo = hayProductosConPendiente.map(p => 
            `${p.producto_nombre}: ${p.cantidad_pendiente - p.cantidad_recibida_ahora} unidades`
          ).join(", ");

          try {
            await supabase.functions.invoke("gmail-api", {
              body: {
                action: "send",
                email: "compras@almasa.com.mx",
                to: orden.proveedores.email,
                subject: `Entrega pendiente reprogramada - ${orden.folio}`,
                body: `
                  <h2>Entrega Parcial Registrada</h2>
                  <p>Le informamos que hemos recibido una entrega parcial de la orden <strong>${orden.folio}</strong>.</p>
                  <p><strong>Productos pendientes:</strong> ${productosInfo}</p>
                  <p><strong>Nueva fecha programada:</strong> ${new Date(fechaNuevaEntrega).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  ${notasRecepcion ? `<p><strong>Notas:</strong> ${notasRecepcion}</p>` : ''}
                  <p>Saludos cordiales,<br>Abarrotes La Manita</p>
                `
              }
            });
          } catch (emailError) {
            console.error("Error sending email:", emailError);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["ordenes_calendario"] });
      queryClient.invalidateQueries({ queryKey: ["entregas-oc", orden?.id] });

      toast({
        title: todoRecibido ? "Orden completada" : "Recepción parcial registrada",
        description: todoRecibido 
          ? "Toda la mercancía ha sido recibida" 
          : `Queda mercancía pendiente para el ${new Date(fechaNuevaEntrega).toLocaleDateString('es-MX')}`,
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGuardando(false);
    }
  };

  if (!orden) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Registrar Recepción
            <Badge variant="outline">{orden.folio}</Badge>
          </DialogTitle>
          <DialogDescription>
            Indica las cantidades recibidas. Si hay entregas parciales, programa la siguiente entrega.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Proveedor</p>
              <p className="font-medium">{orden.proveedores?.nombre}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Estado Actual</p>
              <Badge variant={orden.status === 'parcial' ? 'secondary' : 'outline'}>
                {orden.status === 'parcial' ? 'Recepción Parcial' : orden.status}
              </Badge>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Products to receive */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Productos en la Orden
            </h4>
            
            {productos.map((producto) => (
              <div 
                key={producto.detalle_id} 
                className={`p-4 rounded-lg border ${
                  producto.cantidad_pendiente === 0 
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200' 
                    : 'bg-muted/30 border-border'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">{producto.producto_nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      Código: {producto.producto_codigo}
                    </p>
                  </div>
                  {producto.cantidad_pendiente === 0 && (
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Completo
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 text-sm mt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Ordenado</p>
                    <p className="font-medium">{producto.cantidad_ordenada.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Recibido antes</p>
                    <p className="font-medium">{producto.cantidad_recibida_anterior.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pendiente</p>
                    <p className={`font-medium ${producto.cantidad_pendiente > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {producto.cantidad_pendiente.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Recibir ahora</p>
                    {producto.cantidad_pendiente > 0 ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={producto.cantidad_pendiente}
                          value={producto.cantidad_recibida_ahora || ""}
                          onChange={(e) => handleCantidadChange(producto.detalle_id, parseInt(e.target.value) || 0)}
                          className="h-8 w-20"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs px-2"
                          onClick={() => handleRecibirTodo(producto.detalle_id)}
                        >
                          Todo
                        </Button>
                      </div>
                    ) : (
                      <p className="text-green-600">—</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          {totalRecibidoAhora > 0 && (
            <>
              <Separator className="my-4" />
              <div className="p-4 bg-primary/5 rounded-lg">
                <h4 className="font-medium mb-2">Resumen de esta recepción</h4>
                <p className="text-sm">
                  Recibirás <strong>{totalRecibidoAhora.toLocaleString()}</strong> unidades de {totalPendienteOriginal.toLocaleString()} pendientes.
                </p>
                {quedaPendiente && (
                  <p className="text-sm text-amber-600 mt-1">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    Quedarán {(totalPendienteOriginal - totalRecibidoAhora).toLocaleString()} unidades pendientes.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Schedule next delivery if partial */}
          {quedaPendiente && totalRecibidoAhora > 0 && (
            <>
              <Separator className="my-4" />
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200">
                <h4 className="font-medium mb-3 flex items-center gap-2 text-amber-700">
                  <Calendar className="h-4 w-4" />
                  Programar entrega del restante
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label>Nueva fecha de entrega *</Label>
                    <Input
                      type="date"
                      value={fechaNuevaEntrega}
                      onChange={(e) => setFechaNuevaEntrega(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <Label>Notas (opcional)</Label>
                    <Input
                      value={notasRecepcion}
                      onChange={(e) => setNotasRecepcion(e.target.value)}
                      placeholder="ej: Proveedor entregará en 5 días"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </ScrollArea>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            className="flex-1"
            onClick={handleGuardar}
            disabled={guardando || totalRecibidoAhora === 0}
          >
            {guardando ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            {quedaPendiente && totalRecibidoAhora > 0 
              ? "Registrar Parcial" 
              : "Registrar Recepción"
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrarRecepcionDialog;
