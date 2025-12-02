import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, MapPin, Calendar, Trash2, Check, CheckSquare, Square, AlertTriangle, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { calcularSubtotal, calcularDesgloseImpuestos as calcularDesgloseImpuestosNuevo, redondear } from "@/lib/calculos";
import { formatCurrency } from "@/lib/utils";

export function PedidosAcumulativosManager() {
  const [selectedPedido, setSelectedPedido] = useState<string | null>(null);
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());
  const [editingDetalle, setEditingDetalle] = useState<{ 
    id: string; 
    cantidadKg: number; 
    cantidadCajas: number;
    kgPorCaja: number;
  } | null>(null);
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
          cliente_sucursales:sucursal_id(nombre, direccion, codigo_sucursal)
        `)
        .eq("status", "borrador");

      if (error) throw error;
      
      // Ordenar por código de sucursal (número)
      return data?.sort((a: any, b: any) => {
        const codigoA = a.cliente_sucursales?.codigo_sucursal || '';
        const codigoB = b.cliente_sucursales?.codigo_sucursal || '';
        // Intentar ordenar numéricamente si son números
        const numA = parseInt(codigoA);
        const numB = parseInt(codigoB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return codigoA.localeCompare(codigoB);
      }) || [];
    },
  });

  // Fetch detalles del pedido seleccionado con info de producto completa
  const { data: detalles, refetch: refetchDetalles } = useQuery({
    queryKey: ["pedidos-acumulativos-detalles", selectedPedido],
    enabled: !!selectedPedido,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_acumulativos_detalles")
        .select(`
          *,
          productos:producto_id(codigo, nombre, unidad, precio_por_kilo, kg_por_unidad, aplica_iva, aplica_ieps)
        `)
        .eq("pedido_acumulativo_id", selectedPedido);

      if (error) throw error;
      return data;
    },
  });

  // Detectar pedidos con piloncillo
  const pedidosConPiloncillo = useMemo(() => {
    if (!pedidosAcumulativos) return [];
    return pedidosAcumulativos.filter((pedido: any) => {
      // Need to check if any detail has piloncillo - for now we mark all and check details when viewing
      return true; // Will be filtered more accurately when we have all details
    });
  }, [pedidosAcumulativos]);

  // Fetch all details for piloncillo detection
  const { data: allDetallesForPiloncillo } = useQuery({
    queryKey: ["pedidos-acumulativos-all-detalles-piloncillo"],
    enabled: !!pedidosAcumulativos && pedidosAcumulativos.length > 0,
    queryFn: async () => {
      const pedidoIds = pedidosAcumulativos?.map((p: any) => p.id) || [];
      if (pedidoIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("pedidos_acumulativos_detalles")
        .select(`
          pedido_acumulativo_id,
          productos:producto_id(nombre)
        `)
        .in("pedido_acumulativo_id", pedidoIds);

      if (error) throw error;
      return data;
    },
  });

  // Contar pedidos que tienen piloncillo
  const pedidosConPiloncilloCount = useMemo(() => {
    if (!allDetallesForPiloncillo) return 0;
    const pedidoIdsConPiloncillo = new Set<string>();
    allDetallesForPiloncillo.forEach((det: any) => {
      if (det.productos?.nombre?.toLowerCase().includes('piloncillo')) {
        pedidoIdsConPiloncillo.add(det.pedido_acumulativo_id);
      }
    });
    return pedidoIdsConPiloncillo.size;
  }, [allDetallesForPiloncillo]);

  // Detectar si el detalle actual tiene piloncillo
  const detallesConPiloncillo = useMemo(() => {
    if (!detalles) return [];
    return detalles.filter((det: any) => 
      det.productos?.nombre?.toLowerCase().includes('piloncillo')
    );
  }, [detalles]);

  // Mutation para recalcular todos los pedidos acumulativos
  const recalcularMutation = useMutation({
    mutationFn: async () => {
      console.log("🔄 Iniciando recálculo de pedidos acumulativos...");
      
      // Obtener todos los pedidos acumulativos en borrador
      const { data: pedidos, error: pedidosError } = await supabase
        .from("pedidos_acumulativos")
        .select("id")
        .eq("status", "borrador");

      if (pedidosError) throw pedidosError;
      if (!pedidos || pedidos.length === 0) return { updated: 0 };

      let updatedCount = 0;
      let totalLinesFixed = 0;

      // Procesar cada pedido
      for (const pedido of pedidos) {
        // Obtener detalles del pedido
        const { data: detalles, error: detallesError } = await supabase
          .from("pedidos_acumulativos_detalles")
          .select(`
            *,
            productos:producto_id(nombre, precio_por_kilo, aplica_iva, aplica_ieps)
          `)
          .eq("pedido_acumulativo_id", pedido.id);

        if (detallesError) throw detallesError;
        if (!detalles || detalles.length === 0) continue;

        // Recalcular subtotales de cada detalle usando sistema centralizado
        const detallesUpdates = [];
        for (const detalle of detalles) {
          // USAR SISTEMA CENTRALIZADO: calcularSubtotal con validación
          const resultado = calcularSubtotal({
            cantidad: detalle.cantidad,
            precio_unitario: detalle.precio_unitario,
            nombre_producto: detalle.productos?.nombre || 'Producto desconocido'
          });

          if (!resultado.valido) {
            console.error(`❌ Error al calcular subtotal:`, resultado.error);
            continue;
          }

          const lineSubtotalCorrecto = resultado.subtotal;
          
          if (Math.abs(lineSubtotalCorrecto - detalle.subtotal) > 0.01) {
            console.log(`🔧 Corrigiendo línea: ${detalle.cantidad} × ${detalle.precio_unitario} = ${lineSubtotalCorrecto} (antes: ${detalle.subtotal})`);
            detallesUpdates.push({
              id: detalle.id,
              subtotal: lineSubtotalCorrecto
            });
            totalLinesFixed++;
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

        // Recalcular totales del pedido usando sistema centralizado
        const { data: detallesActualizados, error: detallesActError } = await supabase
          .from("pedidos_acumulativos_detalles")
          .select(`
            *,
            productos:producto_id(nombre, aplica_iva, aplica_ieps)
          `)
          .eq("pedido_acumulativo_id", pedido.id);

        if (detallesActError) throw detallesActError;

        let subtotalTotal = 0;
        let ivaTotal = 0;
        let iepsTotal = 0;

        for (const detalle of detallesActualizados) {
          const producto = detalle.productos;
          const lineSubtotal = detalle.subtotal;

          // Usar sistema centralizado para desagregar impuestos
          const desglose = calcularDesgloseImpuestosNuevo({
            precio_con_impuestos: lineSubtotal,
            aplica_iva: producto.aplica_iva,
            aplica_ieps: producto.aplica_ieps,
            nombre_producto: producto.nombre
          });

          if (!desglose.valido) {
            console.error(`❌ Error al calcular impuestos:`, desglose.error);
          }

          subtotalTotal += desglose.base;
          ivaTotal += desglose.iva;
          iepsTotal += desglose.ieps;
        }

        const subtotalRedondeado = redondear(subtotalTotal);
        const impuestosRedondeado = redondear(ivaTotal + iepsTotal);
        const totalRedondeado = redondear(subtotalTotal + ivaTotal + iepsTotal);

        console.log(`✅ Pedido ${pedido.id}: Subtotal=${subtotalRedondeado}, Impuestos=${impuestosRedondeado}, Total=${totalRedondeado}`);

        // Actualizar pedido acumulativo
        const { error: updateError } = await supabase
          .from("pedidos_acumulativos")
          .update({
            subtotal: subtotalRedondeado,
            impuestos: impuestosRedondeado,
            total: totalRedondeado
          })
          .eq("id", pedido.id);

        if (updateError) throw updateError;
        updatedCount++;
      }

      console.log(`✅ Recálculo completo: ${updatedCount} pedidos actualizados, ${totalLinesFixed} líneas corregidas`);
      return { updated: updatedCount, linesFixed: totalLinesFixed };
    },
    onSuccess: (result) => {
      toast.success(`✅ ${result.updated} pedido${result.updated !== 1 ? 's' : ''} recalculado${result.updated !== 1 ? 's' : ''} • ${result.linesFixed} línea${result.linesFixed !== 1 ? 's' : ''} corregida${result.linesFixed !== 1 ? 's' : ''}`);
      queryClient.invalidateQueries({ queryKey: ["pedidos-acumulativos"] });
    },
    onError: (error: any) => {
      console.error("❌ Error al recalcular:", error);
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
      // Invalidar también la query de correos procesados para quitar badge "Procesado" de emails
      queryClient.invalidateQueries({ queryKey: ["correos-procesados"] });
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

  // Mutation para actualizar cantidad de un detalle (piloncillo)
  const updateDetalleMutation = useMutation({
    mutationFn: async ({ detalleId, nuevaCantidad }: { detalleId: string; nuevaCantidad: number }) => {
      // Obtener detalle actual para recalcular
      const { data: detalle, error: fetchError } = await supabase
        .from("pedidos_acumulativos_detalles")
        .select(`*, productos:producto_id(aplica_iva, aplica_ieps, nombre)`)
        .eq("id", detalleId)
        .single();

      if (fetchError) throw fetchError;

      const nuevoSubtotal = nuevaCantidad * detalle.precio_unitario;

      // Actualizar detalle
      const { error: updateError } = await supabase
        .from("pedidos_acumulativos_detalles")
        .update({ cantidad: nuevaCantidad, subtotal: nuevoSubtotal })
        .eq("id", detalleId);

      if (updateError) throw updateError;

      // Recalcular totales del pedido
      const { data: todosDetalles, error: detallesError } = await supabase
        .from("pedidos_acumulativos_detalles")
        .select(`*, productos:producto_id(aplica_iva, aplica_ieps, nombre)`)
        .eq("pedido_acumulativo_id", detalle.pedido_acumulativo_id);

      if (detallesError) throw detallesError;

      let subtotalTotal = 0;
      let ivaTotal = 0;
      let iepsTotal = 0;

      for (const det of todosDetalles) {
        const desglose = calcularDesgloseImpuestosNuevo({
          precio_con_impuestos: det.subtotal,
          aplica_iva: det.productos?.aplica_iva || false,
          aplica_ieps: det.productos?.aplica_ieps || false,
          nombre_producto: det.productos?.nombre || ''
        });
        subtotalTotal += desglose.base;
        ivaTotal += desglose.iva;
        iepsTotal += desglose.ieps;
      }

      const { error: pedidoError } = await supabase
        .from("pedidos_acumulativos")
        .update({
          subtotal: redondear(subtotalTotal),
          impuestos: redondear(ivaTotal + iepsTotal),
          total: redondear(subtotalTotal + ivaTotal + iepsTotal)
        })
        .eq("id", detalle.pedido_acumulativo_id);

      if (pedidoError) throw pedidoError;

      return { success: true };
    },
    onSuccess: () => {
      toast.success("Peso actualizado correctamente");
      setEditingDetalle(null);
      refetchDetalles();
      queryClient.invalidateQueries({ queryKey: ["pedidos-acumulativos"] });
    },
    onError: (error: any) => {
      toast.error("Error al actualizar: " + error.message);
    }
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

  const handleSavePiloncilloWeight = () => {
    if (!editingDetalle) return;
    updateDetalleMutation.mutate({
      detalleId: editingDetalle.id,
      nuevaCantidad: editingDetalle.cantidadKg
    });
  };

  const handleKgChange = (kg: number) => {
    if (!editingDetalle) return;
    const cajas = editingDetalle.kgPorCaja > 0 ? Math.ceil(kg / editingDetalle.kgPorCaja) : 1;
    setEditingDetalle({ ...editingDetalle, cantidadKg: kg, cantidadCajas: cajas });
  };

  const handleCajasChange = (cajas: number) => {
    if (!editingDetalle) return;
    // Al cambiar cajas, recalcular kg (pero dejar que el usuario ajuste manualmente si quiere)
    setEditingDetalle({ ...editingDetalle, cantidadCajas: cajas });
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

      {/* Alerta de pedidos con piloncillo */}
      {pedidosConPiloncilloCount > 0 && (
        <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            ⚠️ {pedidosConPiloncilloCount} pedido{pedidosConPiloncilloCount > 1 ? 's' : ''} con piloncillo requiere{pedidosConPiloncilloCount > 1 ? 'n' : ''} verificación de peso
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Antes de generar los pedidos finales, revisa y ajusta el peso del piloncillo en cada pedido haciendo clic en "Ver detalles".
          </AlertDescription>
        </Alert>
      )}

      {!pedidosAcumulativos || pedidosAcumulativos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No hay pedidos acumulativos en borrador
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pedidosAcumulativos.map((pedido: any) => {
            // Verificar si este pedido tiene piloncillo
            const tienePiloncillo = allDetallesForPiloncillo?.some(
              (det: any) => det.pedido_acumulativo_id === pedido.id && 
                det.productos?.nombre?.toLowerCase().includes('piloncillo')
            );
            
            return (
              <Card key={pedido.id} className={`${selectedForBatch.has(pedido.id) ? "border-primary" : ""} ${tienePiloncillo ? "border-l-4 border-l-amber-500" : ""}`}>
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
                          {tienePiloncillo && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">
                              ⚠️ Piloncillo
                            </Badge>
                          )}
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
                        variant={tienePiloncillo ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedPedido(pedido.id)}
                        className={tienePiloncillo ? "bg-amber-600 hover:bg-amber-700" : ""}
                      >
                        {tienePiloncillo ? "⚠️ Verificar peso" : "Ver detalles"}
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
            );
          })}
        </div>
      )}

      {/* Dialog para ver detalles con edición de piloncillo */}
      <Dialog open={!!selectedPedido} onOpenChange={() => { setSelectedPedido(null); setEditingDetalle(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalles del Pedido Acumulativo</DialogTitle>
            <DialogDescription>
              {detallesConPiloncillo.length > 0 
                ? "⚠️ Este pedido contiene piloncillo. Ajusta el peso antes de generar el pedido final."
                : "Productos incluidos en este pedido"
              }
            </DialogDescription>
          </DialogHeader>
          
          {/* Alerta de piloncillo en el dialog */}
          {detallesConPiloncillo.length > 0 && (
            <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                Haz clic en el botón de editar junto al piloncillo para ajustar el peso real de la caja.
              </AlertDescription>
            </Alert>
          )}
          
          <ScrollArea className="h-[400px] pr-4">
            {detalles && detalles.length > 0 ? (
              <div className="space-y-2">
                {detalles.map((detalle: any, idx: number) => {
                  const esPiloncillo = detalle.productos?.nombre?.toLowerCase().includes('piloncillo');
                  const isEditing = editingDetalle?.id === detalle.id;
                  
                  return (
                    <div key={detalle.id}>
                      {idx > 0 && <Separator className="my-2" />}
                      <div className={`flex justify-between items-start p-3 rounded-lg ${esPiloncillo ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-300' : 'bg-muted/50'}`}>
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            {detalle.productos?.codigo} - {detalle.productos?.nombre}
                            {esPiloncillo && (
                              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-400 text-xs">
                                ⚠️ Verificar peso
                              </Badge>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="flex flex-col gap-3 mt-2 p-3 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Label htmlFor="edit-cajas" className="text-sm font-medium whitespace-nowrap">Cajas:</Label>
                                  <Input
                                    id="edit-cajas"
                                    type="number"
                                    step="1"
                                    min="1"
                                    value={editingDetalle.cantidadCajas}
                                    onChange={(e) => handleCajasChange(parseInt(e.target.value) || 1)}
                                    className="w-20 h-8"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label htmlFor="edit-kg" className="text-sm font-medium whitespace-nowrap">Peso total (kg):</Label>
                                  <Input
                                    id="edit-kg"
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    value={editingDetalle.cantidadKg}
                                    onChange={(e) => handleKgChange(parseFloat(e.target.value) || 0)}
                                    className="w-24 h-8"
                                  />
                                </div>
                              </div>
                              <div className="text-xs text-amber-700 dark:text-amber-300">
                                = {editingDetalle.cantidadCajas} caja{editingDetalle.cantidadCajas !== 1 ? 's' : ''} de {editingDetalle.kgPorCaja > 0 ? (editingDetalle.cantidadKg / editingDetalle.cantidadCajas).toFixed(2) : '?'} kg c/u
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handleSavePiloncilloWeight} disabled={updateDetalleMutation.isPending}>
                                  {updateDetalleMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingDetalle(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              {detalle.cantidad} {detalle.productos?.unidad} × ${detalle.precio_unitario.toFixed(2)}
                              {esPiloncillo && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-6 px-2 text-xs border-amber-400 text-amber-700 hover:bg-amber-100"
                                  onClick={() => {
                                    const kgPorCaja = detalle.productos?.kg_por_unidad || 10;
                                    const cantidadKg = detalle.cantidad;
                                    const cantidadCajas = kgPorCaja > 0 ? Math.ceil(cantidadKg / kgPorCaja) : 1;
                                    setEditingDetalle({ 
                                      id: detalle.id, 
                                      cantidadKg,
                                      cantidadCajas,
                                      kgPorCaja
                                    });
                                  }}
                                >
                                  <Edit2 className="h-3 w-3 mr-1" />
                                  Editar peso
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right font-semibold">
                          ${detalle.subtotal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground p-8">
                No hay productos en este pedido
              </div>
            )}
          </ScrollArea>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPedido(null)}>
              Cerrar
            </Button>
            {selectedPedido && (
              <Button 
                onClick={() => {
                  finalizarMutation.mutate(selectedPedido);
                  setSelectedPedido(null);
                }}
                disabled={finalizarMutation.isPending}
              >
                {finalizarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Generar pedido final
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
