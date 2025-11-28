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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  CheckCircle, 
  Package, 
  AlertTriangle, 
  Calendar,
  Loader2,
  Truck,
  Lock,
  CalendarClock
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
  maneja_caducidad: boolean;
  fecha_caducidad: string;
  razon_diferencia: string;
}

interface RegistrarRecepcionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orden: any;
}

const RAZONES_DIFERENCIA = [
  { value: "devolucion", label: "Devolución" },
  { value: "roto", label: "Producto roto/dañado" },
  { value: "no_llego", label: "No llegó" },
  { value: "error_cantidad", label: "Error del proveedor en cantidad" },
  { value: "rechazado", label: "Rechazado por calidad" },
  { value: "otro", label: "Otro" },
];

const RegistrarRecepcionDialog = ({ open, onOpenChange, orden }: RegistrarRecepcionDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [guardando, setGuardando] = useState(false);
  const [productos, setProductos] = useState<RecepcionProducto[]>([]);
  const [fechaNuevaEntrega, setFechaNuevaEntrega] = useState("");
  const [notasRecepcion, setNotasRecepcion] = useState("");
  
  // New security/control fields
  const [numeroSellos, setNumeroSellos] = useState("");
  const [nombreEntregador, setNombreEntregador] = useState("");

  // Fetch product details to check maneja_caducidad
  const { data: productosInfo } = useQuery({
    queryKey: ["productos-caducidad", orden?.id],
    queryFn: async () => {
      if (!orden?.ordenes_compra_detalles) return {};
      
      const productoIds = orden.ordenes_compra_detalles.map((d: any) => d.producto_id);
      const { data, error } = await supabase
        .from("productos")
        .select("id, maneja_caducidad")
        .in("id", productoIds);
      
      if (error) throw error;
      
      return data.reduce((acc: any, p: any) => {
        acc[p.id] = p.maneja_caducidad;
        return acc;
      }, {});
    },
    enabled: open && !!orden?.ordenes_compra_detalles,
  });

  // Initialize products when dialog opens
  useEffect(() => {
    if (open && orden?.ordenes_compra_detalles && productosInfo) {
      const productosIniciales = orden.ordenes_compra_detalles.map((d: any) => ({
        detalle_id: d.id,
        producto_id: d.producto_id,
        producto_nombre: d.productos?.nombre || "Producto",
        producto_codigo: d.productos?.codigo || "-",
        cantidad_ordenada: d.cantidad_ordenada,
        cantidad_recibida_anterior: d.cantidad_recibida || 0,
        cantidad_pendiente: d.cantidad_ordenada - (d.cantidad_recibida || 0),
        cantidad_recibida_ahora: 0,
        maneja_caducidad: productosInfo[d.producto_id] || false,
        fecha_caducidad: "",
        razon_diferencia: "",
      }));
      setProductos(productosIniciales);
      setFechaNuevaEntrega("");
      setNotasRecepcion("");
      setNumeroSellos("");
      setNombreEntregador(orden.proveedores?.nombre || "");
    }
  }, [open, orden, productosInfo]);

  const handleCantidadChange = (detalleId: string, cantidad: number) => {
    setProductos(prev => prev.map(p => {
      if (p.detalle_id === detalleId) {
        // Can't receive more than what's pending
        const cantidadValida = Math.min(Math.max(0, cantidad), p.cantidad_pendiente);
        return { 
          ...p, 
          cantidad_recibida_ahora: cantidadValida,
          // Reset razon if receiving full amount
          razon_diferencia: cantidadValida === p.cantidad_pendiente ? "" : p.razon_diferencia
        };
      }
      return p;
    }));
  };

  const handleRecibirTodo = (detalleId: string) => {
    setProductos(prev => prev.map(p => {
      if (p.detalle_id === detalleId) {
        return { 
          ...p, 
          cantidad_recibida_ahora: p.cantidad_pendiente,
          razon_diferencia: "" // No need for reason if receiving all
        };
      }
      return p;
    }));
  };

  const handleFechaCaducidadChange = (detalleId: string, fecha: string) => {
    setProductos(prev => prev.map(p => {
      if (p.detalle_id === detalleId) {
        return { ...p, fecha_caducidad: fecha };
      }
      return p;
    }));
  };

  const handleRazonDiferenciaChange = (detalleId: string, razon: string) => {
    setProductos(prev => prev.map(p => {
      if (p.detalle_id === detalleId) {
        return { ...p, razon_diferencia: razon };
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

  // Validation function
  const validarFormulario = (): string | null => {
    // 1. Validate nombre del entregador
    if (!nombreEntregador.trim()) {
      return "Indica el nombre de quien entrega la mercancía";
    }

    // 2. Validate número de sellos
    if (!numeroSellos.trim()) {
      return "Indica el número de sellos de seguridad del camión";
    }

    // 3. Validate at least one product is being received
    if (totalRecibidoAhora === 0) {
      return "Indica la cantidad recibida de al menos un producto";
    }

    // 4. Validate fecha de caducidad for products that require it
    for (const producto of productos) {
      if (producto.cantidad_recibida_ahora > 0) {
        if (producto.maneja_caducidad && !producto.fecha_caducidad) {
          return `Indica la fecha de caducidad para "${producto.producto_nombre}"`;
        }
      }
    }

    // 5. Validate razon_diferencia when cantidad doesn't match
    for (const producto of productos) {
      if (producto.cantidad_recibida_ahora > 0 && 
          producto.cantidad_recibida_ahora < producto.cantidad_pendiente &&
          !producto.razon_diferencia) {
        return `Indica la razón de la diferencia para "${producto.producto_nombre}" (esperados: ${producto.cantidad_pendiente}, recibidos: ${producto.cantidad_recibida_ahora})`;
      }
    }

    // 6. Validate fecha nueva entrega if there's pending merchandise
    if (quedaPendiente && !fechaNuevaEntrega) {
      return "Indica cuándo llegará la mercancía pendiente";
    }

    return null;
  };

  const handleGuardar = async () => {
    const errorValidacion = validarFormulario();
    if (errorValidacion) {
      toast({
        title: "Datos incompletos",
        description: errorValidacion,
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
      
      // Build reception notes with control info
      const notasControlInterno = [
        `Entregado por: ${nombreEntregador}`,
        `Sellos de seguridad: ${numeroSellos}`,
        notasRecepcion ? `Notas: ${notasRecepcion}` : null,
        // Add any difference reasons
        ...productos
          .filter(p => p.razon_diferencia && p.cantidad_recibida_ahora < p.cantidad_pendiente)
          .map(p => `${p.producto_nombre}: ${RAZONES_DIFERENCIA.find(r => r.value === p.razon_diferencia)?.label || p.razon_diferencia} (faltaron ${p.cantidad_pendiente - p.cantidad_recibida_ahora})`)
      ].filter(Boolean).join(" | ");
      
      if (todoRecibido) {
        // Mark order as fully received
        await supabase
          .from("ordenes_compra")
          .update({ 
            status: "recibida",
            fecha_entrega_real: new Date().toISOString().split('T')[0],
            notas: orden.notas 
              ? `${orden.notas}\n\n[RECEPCIÓN ${new Date().toLocaleDateString('es-MX')}] ${notasControlInterno}`
              : `[RECEPCIÓN ${new Date().toLocaleDateString('es-MX')}] ${notasControlInterno}`
          })
          .eq("id", orden.id);
      } else {
        // Mark as partially received and schedule next delivery
        await supabase
          .from("ordenes_compra")
          .update({ 
            status: "parcial",
            fecha_entrega_programada: fechaNuevaEntrega,
            notas: orden.notas 
              ? `${orden.notas}\n\n[RECEPCIÓN PARCIAL ${new Date().toLocaleDateString('es-MX')}] ${notasControlInterno}`
              : `[RECEPCIÓN PARCIAL ${new Date().toLocaleDateString('es-MX')}] ${notasControlInterno}`
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
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Registrar Recepción
            <Badge variant="outline">{orden.folio}</Badge>
          </DialogTitle>
          <DialogDescription>
            Registra los datos de control de la entrega. Todos los campos marcados con * son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {/* Control Data Section - NEW */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 mb-4">
            <h4 className="font-medium mb-3 flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Lock className="h-4 w-4" />
              Datos de Control de Recepción
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">
                  Nombre de quien entrega *
                </Label>
                <Input
                  value={nombreEntregador}
                  onChange={(e) => setNombreEntregador(e.target.value)}
                  placeholder="ej: Juan Pérez (chofer)"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Nombre del chofer o persona que entrega
                </p>
              </div>
              <div>
                <Label className="text-sm">
                  Número de sellos de seguridad *
                </Label>
                <Input
                  value={numeroSellos}
                  onChange={(e) => setNumeroSellos(e.target.value)}
                  placeholder="ej: 123456, 789012"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Números de los sellos del camión
                </p>
              </div>
            </div>
          </div>

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
            
            {productos.map((producto) => {
              const hayDiferencia = producto.cantidad_recibida_ahora > 0 && 
                                   producto.cantidad_recibida_ahora < producto.cantidad_pendiente;
              
              return (
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
                        {producto.maneja_caducidad && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            <CalendarClock className="h-3 w-3 mr-1" />
                            Requiere caducidad
                          </Badge>
                        )}
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

                  {/* Additional fields when receiving this product */}
                  {producto.cantidad_recibida_ahora > 0 && (
                    <div className="mt-3 pt-3 border-t border-dashed space-y-3">
                      {/* Fecha de caducidad - only if product requires it */}
                      {producto.maneja_caducidad && (
                        <div className="flex items-center gap-3">
                          <Label className="text-sm whitespace-nowrap min-w-[140px]">
                            Fecha de caducidad *
                          </Label>
                          <Input
                            type="date"
                            value={producto.fecha_caducidad}
                            onChange={(e) => handleFechaCaducidadChange(producto.detalle_id, e.target.value)}
                            className="h-8 max-w-[180px]"
                            min={new Date().toISOString().split('T')[0]}
                          />
                          {!producto.fecha_caducidad && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Requerido
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Razón de diferencia - only if cantidad doesn't match */}
                      {hayDiferencia && (
                        <div className="flex items-center gap-3">
                          <Label className="text-sm whitespace-nowrap min-w-[140px]">
                            Razón del faltante *
                          </Label>
                          <Select
                            value={producto.razon_diferencia}
                            onValueChange={(value) => handleRazonDiferenciaChange(producto.detalle_id, value)}
                          >
                            <SelectTrigger className="h-8 max-w-[220px]">
                              <SelectValue placeholder="Selecciona razón..." />
                            </SelectTrigger>
                            <SelectContent>
                              {RAZONES_DIFERENCIA.map((razon) => (
                                <SelectItem key={razon.value} value={razon.value}>
                                  {razon.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Badge variant="outline" className="text-xs text-amber-600">
                            Faltan {producto.cantidad_pendiente - producto.cantidad_recibida_ahora}
                          </Badge>
                          {!producto.razon_diferencia && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Requerido
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
                    <Label>Notas adicionales (opcional)</Label>
                    <Textarea
                      value={notasRecepcion}
                      onChange={(e) => setNotasRecepcion(e.target.value)}
                      placeholder="ej: Proveedor entregará en 5 días, producto llegó mojado, etc."
                      rows={2}
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
