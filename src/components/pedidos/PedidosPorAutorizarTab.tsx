import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  History,
  Edit2,
  Save,
  X
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";

interface PedidoPorAutorizar {
  id: string;
  folio: string;
  fecha_pedido: string;
  fecha_entrega_estimada: string | null;
  total: number;
  notas: string | null;
  clientes: { id: string; nombre: string; email: string | null } | null;
  cliente_sucursales: { id: string; nombre: string } | null;
  pedidos_detalles: {
    id: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    productos: {
      id: string;
      nombre: string;
      codigo: string;
      precio_venta: number;
      unidad: string;
      kg_por_unidad: number | null;
      precio_por_kilo: boolean;
    } | null;
  }[];
}

// Calcular peso total de un pedido
const calcularPesoTotalPedido = (detalles: PedidoPorAutorizar["pedidos_detalles"]) => {
  let pesoTotal = 0;
  for (const det of detalles) {
    const precioPorKilo = det.productos?.precio_por_kilo ?? false;
    const kgPorUnidad = det.productos?.kg_por_unidad ?? 1;
    
    if (precioPorKilo) {
      pesoTotal += det.cantidad;
    } else {
      pesoTotal += det.cantidad * kgPorUnidad;
    }
  }
  return Math.round(pesoTotal * 100) / 100;
};

interface PrecioHistorialProducto {
  fecha: string;
  precio: number;
  fuente: "cotizacion" | "pedido";
}

export function PedidosPorAutorizarTab() {
  const [selectedPedido, setSelectedPedido] = useState<PedidoPorAutorizar | null>(null);
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [expandedHistorial, setExpandedHistorial] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pedidos por autorizar
  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["pedidos-por-autorizar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select(`
          id,
          folio,
          fecha_pedido,
          fecha_entrega_estimada,
          total,
          notas,
          clientes (id, nombre, email),
          cliente_sucursales:sucursal_id (id, nombre),
          pedidos_detalles (
            id,
            cantidad,
            precio_unitario,
            subtotal,
            productos (id, nombre, codigo, precio_venta, unidad, kg_por_unidad, precio_por_kilo)
          )
        `)
        .eq("status", "por_autorizar")
        .order("fecha_pedido", { ascending: false });

      if (error) throw error;
      return data as unknown as PedidoPorAutorizar[];
    },
  });

  // Fetch price history for a specific client and product
  const fetchPriceHistory = async (clienteId: string, productoId: string): Promise<PrecioHistorialProducto[]> => {
    const fechaInicio = subMonths(new Date(), 6);
    
    // Get from cotizaciones
    const { data: cotData } = await supabase
      .from("cotizaciones_detalles")
      .select(`
        precio_unitario,
        cotizacion:cotizaciones!inner (
          fecha_creacion,
          cliente_id
        )
      `)
      .eq("producto_id", productoId)
      .eq("cotizacion.cliente_id", clienteId)
      .gte("cotizacion.fecha_creacion", fechaInicio.toISOString())
      .order("cotizacion(fecha_creacion)", { ascending: false })
      .limit(5);

    // Get from pedidos
    const { data: pedData } = await supabase
      .from("pedidos_detalles")
      .select(`
        precio_unitario,
        pedido:pedidos!inner (
          fecha_pedido,
          cliente_id,
          status
        )
      `)
      .eq("producto_id", productoId)
      .eq("pedido.cliente_id", clienteId)
      .neq("pedido.status", "por_autorizar")
      .gte("pedido.fecha_pedido", fechaInicio.toISOString())
      .order("pedido(fecha_pedido)", { ascending: false })
      .limit(5);

    const historial: PrecioHistorialProducto[] = [];
    
    cotData?.forEach((item: any) => {
      historial.push({
        fecha: item.cotizacion.fecha_creacion,
        precio: item.precio_unitario,
        fuente: "cotizacion",
      });
    });
    
    pedData?.forEach((item: any) => {
      historial.push({
        fecha: item.pedido.fecha_pedido,
        precio: item.precio_unitario,
        fuente: "pedido",
      });
    });

    // Sort by date desc
    historial.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    
    return historial.slice(0, 5);
  };

  // Query for expanded product history
  const { data: historialData } = useQuery({
    queryKey: ["historial-producto", selectedPedido?.clientes?.id, expandedHistorial],
    queryFn: () => {
      if (!selectedPedido?.clientes?.id || !expandedHistorial) return [];
      return fetchPriceHistory(selectedPedido.clientes.id, expandedHistorial);
    },
    enabled: !!selectedPedido?.clientes?.id && !!expandedHistorial,
  });

  // Mutation to authorize order
  const authorizeMutation = useMutation({
    mutationFn: async (pedidoId: string) => {
      if (!selectedPedido) throw new Error("No hay pedido seleccionado");
      
      // Track which prices were changed
      const preciosOriginales: Record<string, number> = {};
      selectedPedido.pedidos_detalles.forEach(d => {
        preciosOriginales[d.id] = d.precio_unitario;
      });

      let ajustesPrecio = 0;
      
      // Update prices if edited
      if (Object.keys(editingPrices).length > 0) {
        for (const [detalleId, newPrice] of Object.entries(editingPrices)) {
          const detalle = selectedPedido.pedidos_detalles.find(d => d.id === detalleId);
          if (detalle && newPrice !== detalle.precio_unitario) {
            ajustesPrecio++;
            const newSubtotal = detalle.cantidad * newPrice;
            await supabase
              .from("pedidos_detalles")
              .update({ 
                precio_unitario: newPrice,
                subtotal: newSubtotal 
              })
              .eq("id", detalleId);
          }
        }
        
        // Recalculate total
        const { data: detalles } = await supabase
          .from("pedidos_detalles")
          .select("subtotal")
          .eq("pedido_id", pedidoId);
        
        const newTotal = detalles?.reduce((sum, d) => sum + d.subtotal, 0) || 0;
        const pesoTotal = calcularPesoTotalPedido(selectedPedido.pedidos_detalles);
        
        await supabase
          .from("pedidos")
          .update({ total: newTotal, status: "pendiente", peso_total_kg: pesoTotal > 0 ? pesoTotal : null })
          .eq("id", pedidoId);
      } else {
        const pesoTotal = calcularPesoTotalPedido(selectedPedido.pedidos_detalles);
        await supabase
          .from("pedidos")
          .update({ status: "pendiente", peso_total_kg: pesoTotal > 0 ? pesoTotal : null })
          .eq("id", pedidoId);
      }

      // Send notification email to client if email exists
      const clienteEmail = selectedPedido.clientes?.email;
      if (clienteEmail) {
        try {
          const detallesEmail = selectedPedido.pedidos_detalles.map(d => {
            const precioOriginal = preciosOriginales[d.id];
            const precioNuevo = editingPrices[d.id] ?? d.precio_unitario;
            const fueAjustado = precioNuevo !== precioOriginal;
            return {
              producto: d.productos?.nombre || "Producto",
              cantidad: d.cantidad,
              unidad: d.productos?.unidad || "pza",
              precioUnitario: precioNuevo,
              subtotal: d.cantidad * precioNuevo,
              precioAnterior: fueAjustado ? precioOriginal : undefined,
              fueAjustado
            };
          });

          const newTotal = detallesEmail.reduce((sum, d) => sum + d.subtotal, 0);

          await supabase.functions.invoke("send-order-authorized-email", {
            body: {
              clienteEmail,
              clienteNombre: selectedPedido.clientes?.nombre || "Cliente",
              pedidoFolio: selectedPedido.folio,
              total: newTotal,
              fechaEntrega: selectedPedido.fecha_entrega_estimada || new Date().toISOString(),
              ajustesPrecio,
              detalles: detallesEmail
            }
          });
          console.log("Email de autorización enviado al cliente");
        } catch (emailError) {
          console.error("Error enviando email:", emailError);
          // Don't fail the mutation if email fails
        }
      }

      return { ajustesPrecio };
    },
    onSuccess: (result) => {
      const msg = result.ajustesPrecio > 0 
        ? `Pedido autorizado con ${result.ajustesPrecio} ajuste${result.ajustesPrecio > 1 ? 's' : ''} de precio` 
        : "Pedido autorizado";
      toast({ title: msg, description: "El cliente será notificado por correo" });
      queryClient.invalidateQueries({ queryKey: ["pedidos-por-autorizar"] });
      setSelectedPedido(null);
      setEditingPrices({});
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo autorizar el pedido", variant: "destructive" });
    },
  });

  // Mutation to reject order
  const rejectMutation = useMutation({
    mutationFn: async ({ pedidoId, reason }: { pedidoId: string; reason: string }) => {
      await supabase
        .from("pedidos")
        .update({ 
          status: "cancelado",
          notas: `[RECHAZADO] ${reason}\n${selectedPedido?.notas || ""}`
        })
        .eq("id", pedidoId);
    },
    onSuccess: () => {
      toast({ title: "Pedido rechazado" });
      queryClient.invalidateQueries({ queryKey: ["pedidos-por-autorizar"] });
      setSelectedPedido(null);
      setRejectDialogOpen(false);
      setRejectReason("");
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo rechazar el pedido", variant: "destructive" });
    },
  });

  const handleStartEditing = () => {
    if (!selectedPedido) return;
    const prices: Record<string, number> = {};
    selectedPedido.pedidos_detalles.forEach(d => {
      prices[d.id] = d.precio_unitario;
    });
    setEditingPrices(prices);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setEditingPrices({});
    setIsEditing(false);
  };

  const handlePriceChange = (detalleId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditingPrices(prev => ({ ...prev, [detalleId]: numValue }));
  };

  const calculateNewTotal = () => {
    if (!selectedPedido) return 0;
    return selectedPedido.pedidos_detalles.reduce((sum, d) => {
      const price = editingPrices[d.id] ?? d.precio_unitario;
      return sum + (d.cantidad * price);
    }, 0);
  };

  const getPriceComparison = (detalle: PedidoPorAutorizar["pedidos_detalles"][0]) => {
    const currentPrice = editingPrices[detalle.id] ?? detalle.precio_unitario;
    const listPrice = detalle.productos?.precio_venta || 0;
    
    if (currentPrice > listPrice) return { icon: TrendingUp, color: "text-red-500", label: "Mayor al precio lista" };
    if (currentPrice < listPrice) return { icon: TrendingDown, color: "text-green-500", label: "Menor al precio lista" };
    return { icon: Minus, color: "text-muted-foreground", label: "Igual al precio lista" };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pedidos || pedidos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-semibold">Sin pedidos pendientes</h3>
          <p className="text-muted-foreground">No hay pedidos esperando autorización de precios</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          {pedidos.length} por autorizar
        </Badge>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead className="text-right">Peso</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedidos.map((pedido) => (
              <TableRow key={pedido.id}>
                <TableCell className="font-mono font-medium">{pedido.folio}</TableCell>
                <TableCell>{pedido.clientes?.nombre || "—"}</TableCell>
                <TableCell className="text-sm">{pedido.cliente_sucursales?.nombre || "—"}</TableCell>
                <TableCell>{format(new Date(pedido.fecha_pedido), "dd/MM/yyyy", { locale: es })}</TableCell>
                <TableCell>
                  <Badge variant="outline">{pedido.pedidos_detalles.length} productos</Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-blue-600">
                  {calcularPesoTotalPedido(pedido.pedidos_detalles).toLocaleString()} kg
                </TableCell>
                <TableCell className="text-right font-mono">${formatCurrency(pedido.total)}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPedido(pedido)}
                  >
                    Revisar precios
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog de revisión de precios */}
      <Dialog open={!!selectedPedido} onOpenChange={(open) => !open && setSelectedPedido(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Autorizar Pedido {selectedPedido?.folio}</span>
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={handleStartEditing}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    Editar precios
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleCancelEditing}>
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  </>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedPedido && (
            <div className="space-y-4">
              {/* Info del cliente */}
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Cliente:</span>
                      <p className="font-medium">{selectedPedido.clientes?.nombre}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sucursal:</span>
                      <p className="font-medium">{selectedPedido.cliente_sucursales?.nombre || "Principal"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fecha:</span>
                      <p className="font-medium">{format(new Date(selectedPedido.fecha_pedido), "PPP", { locale: es })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabla de productos con precios */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Precio Lista</TableHead>
                      <TableHead className="text-right">Precio Solicitado</TableHead>
                      <TableHead className="text-center">Comparación</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPedido.pedidos_detalles.map((detalle) => {
                      const comparison = getPriceComparison(detalle);
                      const ComparisonIcon = comparison.icon;
                      const currentPrice = editingPrices[detalle.id] ?? detalle.precio_unitario;
                      const subtotal = detalle.cantidad * currentPrice;

                      return (
                        <>
                          <TableRow key={detalle.id}>
                            <TableCell>
                              <div>
                                <span className="font-medium">{detalle.productos?.nombre}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  {detalle.productos?.codigo}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {detalle.cantidad} {detalle.productos?.unidad}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              ${formatCurrency(detalle.productos?.precio_venta || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={currentPrice}
                                  onChange={(e) => handlePriceChange(detalle.id, e.target.value)}
                                  className="w-28 text-right font-mono"
                                />
                              ) : (
                                <span className="font-mono font-medium">${formatCurrency(currentPrice)}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className={`flex items-center justify-center gap-1 ${comparison.color}`}>
                                <ComparisonIcon className="h-4 w-4" />
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              ${formatCurrency(subtotal)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setExpandedHistorial(
                                  expandedHistorial === detalle.productos?.id ? null : detalle.productos?.id || null
                                )}
                              >
                                <History className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          
                          {/* Historial expandido */}
                          {expandedHistorial === detalle.productos?.id && historialData && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/50">
                                <div className="py-2 px-4">
                                  <p className="text-sm font-medium mb-2">Historial de precios para este cliente:</p>
                                  {historialData.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Primera compra de este producto</p>
                                  ) : (
                                    <div className="flex gap-4 flex-wrap">
                                      {historialData.map((h, idx) => (
                                        <div key={idx} className="text-sm">
                                          <Badge variant={h.fuente === "pedido" ? "default" : "secondary"} className="mr-2">
                                            {h.fuente === "pedido" ? "Pedido" : "Cotización"}
                                          </Badge>
                                          <span className="font-mono">${formatCurrency(h.precio)}</span>
                                          <span className="text-muted-foreground ml-1">
                                            ({format(new Date(h.fecha), "dd/MM/yy")})
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Total */}
              <div className="flex justify-end">
                <Card className="w-64">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="text-xl font-bold font-mono">
                        ${formatCurrency(isEditing ? calculateNewTotal() : selectedPedido.total)}
                      </span>
                    </div>
                    {isEditing && calculateNewTotal() !== selectedPedido.total && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Original: ${formatCurrency(selectedPedido.total)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Notas */}
              {selectedPedido.notas && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Notas del pedido</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{selectedPedido.notas}</p>
                  </CardContent>
                </Card>
              )}

              {/* Acciones */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={authorizeMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rechazar
                </Button>
                <Button
                  onClick={() => authorizeMutation.mutate(selectedPedido.id)}
                  disabled={authorizeMutation.isPending}
                >
                  {authorizeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Autorizar Pedido
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de rechazo */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresa el motivo del rechazo. El cliente será notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo del rechazo..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedPedido && rejectMutation.mutate({ 
                pedidoId: selectedPedido.id, 
                reason: rejectReason 
              })}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Rechazo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}