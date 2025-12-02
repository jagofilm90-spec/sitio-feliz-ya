import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, MapPin, Calendar, Trash2, Check, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

export function PedidosAcumulativosManager() {
  const [selectedPedido, setSelectedPedido] = useState<string | null>(null);
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch pedidos acumulativos en borrador
  const { data: pedidosAcumulativos, isLoading } = useQuery({
    queryKey: ["pedidos-acumulativos", "borrador"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_acumulativos")
        .select(`
          *,
          clientes:cliente_id(nombre, codigo),
          cliente_sucursales:sucursal_id(nombre, direccion)
        `)
        .eq("status", "borrador")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch detalles del pedido seleccionado
  const { data: detalles } = useQuery({
    queryKey: ["pedidos-acumulativos-detalles", selectedPedido],
    enabled: !!selectedPedido,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_acumulativos_detalles")
        .select(`
          *,
          productos:producto_id(codigo, nombre, unidad)
        `)
        .eq("pedido_acumulativo_id", selectedPedido);

      if (error) throw error;
      return data;
    },
  });

  // Mutation para recalcular todos los pedidos acumulativos
  const recalcularMutation = useMutation({
    mutationFn: async () => {
      // Obtener todos los pedidos acumulativos en borrador
      const { data: pedidos, error: pedidosError } = await supabase
        .from("pedidos_acumulativos")
        .select("id")
        .eq("status", "borrador");

      if (pedidosError) throw pedidosError;
      if (!pedidos || pedidos.length === 0) return { updated: 0 };

      let updatedCount = 0;

      // Procesar cada pedido
      for (const pedido of pedidos) {
        // Obtener detalles del pedido
        const { data: detalles, error: detallesError } = await supabase
          .from("pedidos_acumulativos_detalles")
          .select(`
            *,
            productos:producto_id(precio_por_kilo, aplica_iva, aplica_ieps)
          `)
          .eq("pedido_acumulativo_id", pedido.id);

        if (detallesError) throw detallesError;
        if (!detalles || detalles.length === 0) continue;

        // Recalcular subtotales de cada detalle
        const detallesUpdates = [];
        for (const detalle of detalles) {
          const producto = detalle.productos;
          
          // Calcular subtotal correcto
          const lineSubtotal = detalle.cantidad * detalle.precio_unitario;
          
          if (lineSubtotal !== detalle.subtotal) {
            detallesUpdates.push({
              id: detalle.id,
              subtotal: lineSubtotal
            });
          }
        }

        // Actualizar detalles si hay cambios
        for (const update of detallesUpdates) {
          const { error } = await supabase
            .from("pedidos_acumulativos_detalles")
            .update({ subtotal: update.subtotal })
            .eq("id", update.id);
          
          if (error) throw error;
        }

        // Recalcular totales del pedido
        const { data: detallesActualizados, error: detallesActError } = await supabase
          .from("pedidos_acumulativos_detalles")
          .select(`
            *,
            productos:producto_id(aplica_iva, aplica_ieps)
          `)
          .eq("pedido_acumulativo_id", pedido.id);

        if (detallesActError) throw detallesActError;

        let subtotalTotal = 0;
        let ivaTotal = 0;
        let iepsTotal = 0;

        for (const detalle of detallesActualizados) {
          const producto = detalle.productos;
          const lineSubtotal = detalle.subtotal;

          // Calcular base sin impuestos
          let divisor = 1;
          if (producto.aplica_iva && producto.aplica_ieps) {
            divisor = 1 + 0.16 + 0.08; // 1.24
          } else if (producto.aplica_iva) {
            divisor = 1.16;
          } else if (producto.aplica_ieps) {
            divisor = 1.08;
          }

          const baseAmount = lineSubtotal / divisor;

          // Calcular impuestos sobre la base
          const lineIva = producto.aplica_iva ? baseAmount * 0.16 : 0;
          const lineIeps = producto.aplica_ieps ? baseAmount * 0.08 : 0;

          subtotalTotal += baseAmount;
          ivaTotal += lineIva;
          iepsTotal += lineIeps;
        }

        const totalImpuestos = ivaTotal + iepsTotal;
        const totalGeneral = subtotalTotal + totalImpuestos;

        // Actualizar pedido acumulativo
        const { error: updateError } = await supabase
          .from("pedidos_acumulativos")
          .update({
            subtotal: subtotalTotal,
            impuestos: totalImpuestos,
            total: totalGeneral
          })
          .eq("id", pedido.id);

        if (updateError) throw updateError;
        updatedCount++;
      }

      return { updated: updatedCount };
    },
    onSuccess: (result) => {
      toast.success(`${result.updated} pedido${result.updated !== 1 ? 's' : ''} recalculado${result.updated !== 1 ? 's' : ''}`);
      queryClient.invalidateQueries({ queryKey: ["pedidos-acumulativos"] });
    },
    onError: (error: any) => {
      toast.error("Error al recalcular: " + error.message);
    },
  });

  // Mutation para eliminar pedido acumulativo
  const deleteMutation = useMutation({
    mutationFn: async (pedidoId: string) => {
      const { error } = await supabase
        .from("pedidos_acumulativos")
        .delete()
        .eq("id", pedidoId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido acumulativo eliminado");
      queryClient.invalidateQueries({ queryKey: ["pedidos-acumulativos"] });
    },
    onError: (error: any) => {
      toast.error("Error al eliminar: " + error.message);
    },
  });

  // Mutation para generar múltiples pedidos
  const finalizarMultipleMutation = useMutation({
    mutationFn: async (pedidoIds: string[]) => {
      // Obtener ID del usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      // Obtener todos los pedidos acumulativos
      const { data: pedidosAcumulativos, error: fetchError } = await supabase
        .from("pedidos_acumulativos")
        .select("*, pedidos_acumulativos_detalles(*)")
        .in("id", pedidoIds);

      if (fetchError) throw fetchError;

      // Generar folios secuencialmente para evitar duplicados
      const currentDate = new Date();
      const yearMonth = `${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
      const { data: lastPedido } = await supabase
        .from("pedidos")
        .select("folio")
        .like("folio", `PED-${yearMonth}-%`)
        .order("folio", { ascending: false })
        .limit(1)
        .single();

      let nextFolioNumber = 1;
      if (lastPedido?.folio) {
        const match = lastPedido.folio.match(/PED-\d{6}-(\d{4})/);
        if (match) {
          nextFolioNumber = parseInt(match[1]) + 1;
        }
      }

      // Asignar folios únicos a cada pedido
      const pedidosConFolio = pedidosAcumulativos?.map((pedidoAcum) => ({
        pedidoAcum,
        folio: `PED-${yearMonth}-${String(nextFolioNumber++).padStart(4, "0")}`,
      })) || [];

      // Procesar cada pedido con su folio pre-asignado
      const results = [];
      for (const { pedidoAcum, folio } of pedidosConFolio) {
        try {
          // Crear pedido final
          const { data: newPedido, error: pedidoInsertError } = await supabase
            .from("pedidos")
            .insert({
              folio,
              cliente_id: pedidoAcum.cliente_id,
              sucursal_id: pedidoAcum.sucursal_id,
              vendedor_id: user.id,
              fecha_pedido: new Date().toISOString(),
              fecha_entrega_estimada: pedidoAcum.fecha_entrega,
              subtotal: pedidoAcum.subtotal,
              impuestos: pedidoAcum.impuestos,
              total: pedidoAcum.total,
              notas: pedidoAcum.notas || "Pedido consolidado de Lecaroz",
              status: "pendiente",
            })
            .select()
            .single();

          if (pedidoInsertError) throw pedidoInsertError;

          // Insertar detalles del pedido
          const detallesInsert = pedidoAcum.pedidos_acumulativos_detalles.map((det: any) => ({
            pedido_id: newPedido.id,
            producto_id: det.producto_id,
            cantidad: det.cantidad,
            precio_unitario: det.precio_unitario,
            subtotal: det.subtotal,
          }));

          const { error: detallesError } = await supabase
            .from("pedidos_detalles")
            .insert(detallesInsert);

          if (detallesError) throw detallesError;

          // Marcar pedido acumulativo como finalizado
          const { error: updateError } = await supabase
            .from("pedidos_acumulativos")
            .update({ status: "finalizado" })
            .eq("id", pedidoAcum.id);

          if (updateError) throw updateError;

          results.push({ success: true, pedido: newPedido });
        } catch (error: any) {
          results.push({ success: false, error: error.message });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      if (failCount === 0) {
        toast.success(`${successCount} pedido${successCount > 1 ? 's' : ''} generado${successCount > 1 ? 's' : ''} exitosamente`);
      } else {
        toast.warning(`${successCount} exitosos, ${failCount} fallidos`);
      }
      
      queryClient.invalidateQueries({ queryKey: ["pedidos-acumulativos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      setSelectedForBatch(new Set());
    },
    onError: (error: any) => {
      toast.error("Error al generar pedidos: " + error.message);
    },
  });

  // Mutation para generar pedido final
  const finalizarMutation = useMutation({
    mutationFn: async (pedidoAcumulativoId: string) => {
      // Obtener pedido acumulativo y sus detalles
      const { data: pedidoAcum, error: pedidoError } = await supabase
        .from("pedidos_acumulativos")
        .select("*, pedidos_acumulativos_detalles(*)")
        .eq("id", pedidoAcumulativoId)
        .single();

      if (pedidoError) throw pedidoError;

      // Obtener ID del usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      // Generar folio para el pedido
      const currentDate = new Date();
      const yearMonth = `${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
      const { data: lastPedido } = await supabase
        .from("pedidos")
        .select("folio")
        .like("folio", `PED-${yearMonth}-%`)
        .order("folio", { ascending: false })
        .limit(1)
        .single();

      let newFolioNumber = 1;
      if (lastPedido?.folio) {
        const match = lastPedido.folio.match(/PED-\d{6}-(\d{4})/);
        if (match) {
          newFolioNumber = parseInt(match[1]) + 1;
        }
      }
      const folio = `PED-${yearMonth}-${String(newFolioNumber).padStart(4, "0")}`;

      // Crear pedido final
      const { data: newPedido, error: pedidoInsertError } = await supabase
        .from("pedidos")
        .insert({
          folio,
          cliente_id: pedidoAcum.cliente_id,
          sucursal_id: pedidoAcum.sucursal_id,
          vendedor_id: user.id,
          fecha_pedido: new Date().toISOString(),
          fecha_entrega_estimada: pedidoAcum.fecha_entrega,
          subtotal: pedidoAcum.subtotal,
          impuestos: pedidoAcum.impuestos,
          total: pedidoAcum.total,
          notas: pedidoAcum.notas || "Pedido consolidado de Lecaroz",
          status: "pendiente",
        })
        .select()
        .single();

      if (pedidoInsertError) throw pedidoInsertError;

      // Insertar detalles del pedido
      const detallesInsert = pedidoAcum.pedidos_acumulativos_detalles.map((det: any) => ({
        pedido_id: newPedido.id,
        producto_id: det.producto_id,
        cantidad: det.cantidad,
        precio_unitario: det.precio_unitario,
        subtotal: det.subtotal,
      }));

      const { error: detallesError } = await supabase
        .from("pedidos_detalles")
        .insert(detallesInsert);

      if (detallesError) throw detallesError;

      // Marcar pedido acumulativo como finalizado
      const { error: updateError } = await supabase
        .from("pedidos_acumulativos")
        .update({ status: "finalizado" })
        .eq("id", pedidoAcumulativoId);

      if (updateError) throw updateError;

      return { pedido: newPedido };
    },
    onSuccess: (data) => {
      toast.success(`Pedido ${data.pedido.folio} generado exitosamente`);
      queryClient.invalidateQueries({ queryKey: ["pedidos-acumulativos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      setSelectedPedido(null);
    },
    onError: (error: any) => {
      toast.error("Error al generar pedido: " + error.message);
    },
  });

  const toggleSelection = (pedidoId: string) => {
    setSelectedForBatch(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pedidoId)) {
        newSet.delete(pedidoId);
      } else {
        newSet.add(pedidoId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedForBatch.size === pedidosAcumulativos?.length) {
      setSelectedForBatch(new Set());
    } else {
      setSelectedForBatch(new Set(pedidosAcumulativos?.map((p: any) => p.id) || []));
    }
  };

  const handleGenerateBatch = () => {
    if (selectedForBatch.size === 0) {
      toast.error("Selecciona al menos un pedido");
      return;
    }
    finalizarMultipleMutation.mutate(Array.from(selectedForBatch));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Pedidos Acumulativos de Lecaroz</h3>
          <p className="text-sm text-muted-foreground">
            Gestiona pedidos en borrador por sucursal
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {pedidosAcumulativos && pedidosAcumulativos.length > 0 && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => recalcularMutation.mutate()}
                disabled={recalcularMutation.isPending}
              >
                {recalcularMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Recalcular todos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
              >
                {selectedForBatch.size === pedidosAcumulativos.length ? (
                  <CheckSquare className="h-4 w-4 mr-1" />
                ) : (
                  <Square className="h-4 w-4 mr-1" />
                )}
                Seleccionar {selectedForBatch.size === pedidosAcumulativos.length ? 'ninguno' : 'todos'}
              </Button>
              {selectedForBatch.size > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleGenerateBatch}
                  disabled={finalizarMultipleMutation.isPending}
                >
                  {finalizarMultipleMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  Generar {selectedForBatch.size} pedido{selectedForBatch.size > 1 ? 's' : ''}
                </Button>
              )}
            </>
          )}
          <Badge variant="secondary">
            {pedidosAcumulativos?.length || 0} en borrador
          </Badge>
        </div>
      </div>

      {!pedidosAcumulativos || pedidosAcumulativos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No hay pedidos acumulativos en borrador
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pedidosAcumulativos.map((pedido: any) => (
            <Card key={pedido.id} className={selectedForBatch.has(pedido.id) ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3 flex-1">
                    <Checkbox
                      checked={selectedForBatch.has(pedido.id)}
                      onCheckedChange={() => toggleSelection(pedido.id)}
                      className="mt-1"
                    />
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        {pedido.clientes?.nombre || "Cliente desconocido"}
                      </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {pedido.cliente_sucursales?.nombre || "Sin sucursal"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(pedido.fecha_entrega), "dd MMM yyyy", { locale: es })}
                      </span>
                    </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {pedido.correos_procesados?.length || 0} correos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="text-2xl font-bold">
                    ${pedido.total?.toFixed(2) || "0.00"}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPedido(pedido.id)}
                    >
                      Ver detalles
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => finalizarMutation.mutate(pedido.id)}
                      disabled={finalizarMutation.isPending}
                    >
                      {finalizarMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      Generar pedido final
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(pedido.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para ver detalles */}
      <Dialog open={!!selectedPedido} onOpenChange={() => setSelectedPedido(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalles del Pedido Acumulativo</DialogTitle>
            <DialogDescription>
              Productos incluidos en este pedido
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] pr-4">
            {detalles && detalles.length > 0 ? (
              <div className="space-y-2">
                {detalles.map((detalle: any, idx: number) => (
                  <div key={detalle.id}>
                    {idx > 0 && <Separator className="my-2" />}
                    <div className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">
                          {detalle.productos?.codigo} - {detalle.productos?.nombre}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {detalle.cantidad} {detalle.productos?.unidad} × ${detalle.precio_unitario.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right font-semibold">
                        ${detalle.subtotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground p-8">
                No hay productos en este pedido
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
