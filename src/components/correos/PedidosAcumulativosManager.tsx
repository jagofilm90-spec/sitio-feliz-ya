import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, MapPin, Calendar, Trash2, Check, CheckSquare, Square, AlertTriangle, Edit2, Save, X, Lock, Unlock, Zap } from "lucide-react";
import { VerificacionRapidaLecaroz } from "./VerificacionRapidaLecaroz";
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

// Productos que SIEMPRE requieren verificación manual obligatoria
const PRODUCTOS_VERIFICACION_OBLIGATORIA = [
  'piloncillo',
  'canela molida',
  'anís',
  'anis',
  'bicarbonato'
];

// Helper para detectar productos que requieren verificación manual obligatoria
const esProductoVerificable = (nombre: string) => {
  const nombreLower = nombre?.toLowerCase() || '';
  return PRODUCTOS_VERIFICACION_OBLIGATORIA.some(p => nombreLower.includes(p));
};

// Determinar tipo de unidad según producto
const getTipoUnidad = (nombre: string): 'caja' | 'bolsa' => {
  const nombreLower = nombre?.toLowerCase() || '';
  // Piloncillo = cajas, todo lo demás = bolsas
  if (nombreLower.includes('piloncillo')) {
    return 'caja';
  }
  return 'bolsa';
};

// Obtener nombre amigable del producto para verificación
const getNombreProductoVerificacion = (nombre: string): string => {
  const nombreLower = nombre?.toLowerCase() || '';
  if (nombreLower.includes('piloncillo')) return 'Piloncillo';
  if (nombreLower.includes('canela molida')) return 'Canela Molida';
  if (nombreLower.includes('anís') || nombreLower.includes('anis')) return 'Anís';
  if (nombreLower.includes('bicarbonato')) return 'Bicarbonato';
  return nombre;
};

// Formatear término de crédito
const getTerminoCreditoLabel = (termino: string | null): string => {
  switch (termino) {
    case 'contado': return 'Contado';
    case '8_dias': return '8 días';
    case '15_dias': return '15 días';
    case '30_dias': return '30 días';
    default: return 'N/A';
  }
};

// Tipo para el estado de verificación de productos
interface VerificacionProducto {
  detalleId: string;
  verificado: boolean;
  cantidadUnidades: number;
  cantidadKg: number;
  tipoUnidad: 'caja' | 'bolsa';
}

export function PedidosAcumulativosManager() {
  const [selectedPedido, setSelectedPedido] = useState<string | null>(null);
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());
  const [editingDetalle, setEditingDetalle] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ cantidadKg: number; cantidadUnidades: number }>({ cantidadKg: 0, cantidadUnidades: 1 });
  const [showVerificacionRapida, setShowVerificacionRapida] = useState(false);
  
  // Estado para rastrear verificaciones de productos especiales por pedido
  const [verificaciones, setVerificaciones] = useState<Record<string, Record<string, VerificacionProducto>>>({});
  
  const queryClient = useQueryClient();

  // Fetch pedidos acumulativos en borrador
  const { data: pedidosAcumulativos, isLoading } = useQuery({
    queryKey: ["pedidos-acumulativos", "borrador"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_acumulativos")
        .select(`
          *,
          clientes:cliente_id(nombre, codigo, termino_credito),
          cliente_sucursales:sucursal_id(nombre, direccion, codigo_sucursal)
        `)
        .eq("status", "borrador");

      if (error) throw error;
      
      return data?.sort((a: any, b: any) => {
        const codigoA = a.cliente_sucursales?.codigo_sucursal || '';
        const codigoB = b.cliente_sucursales?.codigo_sucursal || '';
        const numA = parseInt(codigoA);
        const numB = parseInt(codigoB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return codigoA.localeCompare(codigoB);
      }) || [];
    },
  });

  // Fetch detalles del pedido seleccionado
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

  // Fetch all details for verification detection
  const { data: allDetallesForVerificacion } = useQuery({
    queryKey: ["pedidos-acumulativos-all-detalles-verificacion"],
    enabled: !!pedidosAcumulativos && pedidosAcumulativos.length > 0,
    queryFn: async () => {
      const pedidoIds = pedidosAcumulativos?.map((p: any) => p.id) || [];
      if (pedidoIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("pedidos_acumulativos_detalles")
        .select(`
          id,
          pedido_acumulativo_id,
          cantidad,
          verificado,
          productos:producto_id(nombre)
        `)
        .in("pedido_acumulativo_id", pedidoIds);

      if (error) throw error;
      return data;
    },
  });

  // Inicializar estado de verificaciones cuando se cargan los detalles
  useEffect(() => {
    if (allDetallesForVerificacion) {
      const nuevasVerificaciones: Record<string, Record<string, VerificacionProducto>> = {};
      
      allDetallesForVerificacion.forEach((det: any) => {
        if (esProductoVerificable(det.productos?.nombre)) {
          if (!nuevasVerificaciones[det.pedido_acumulativo_id]) {
            nuevasVerificaciones[det.pedido_acumulativo_id] = {};
          }
          // Inicializar desde BD (verificado viene de la BD ahora)
          nuevasVerificaciones[det.pedido_acumulativo_id][det.id] = {
            detalleId: det.id,
            verificado: det.verificado || false,
            cantidadUnidades: 1,
            cantidadKg: det.cantidad || 0,
            tipoUnidad: getTipoUnidad(det.productos?.nombre)
          };
        }
      });
      
      setVerificaciones(prev => ({ ...prev, ...nuevasVerificaciones }));
    }
  }, [allDetallesForVerificacion]);

  // Calcular pedidos que requieren verificación y cuáles están completos
  const pedidosVerificacionStatus = useMemo(() => {
    const status: Record<string, { requiere: boolean; completo: boolean; pendientes: number }> = {};
    
    if (!allDetallesForVerificacion) return status;
    
    pedidosAcumulativos?.forEach((pedido: any) => {
      const detallesDelPedido = allDetallesForVerificacion.filter(
        (det: any) => det.pedido_acumulativo_id === pedido.id && esProductoVerificable(det.productos?.nombre)
      );
      
      const requiere = detallesDelPedido.length > 0;
      const verificados = detallesDelPedido.filter(
        (det: any) => verificaciones[pedido.id]?.[det.id]?.verificado
      ).length;
      
      status[pedido.id] = {
        requiere,
        completo: requiere ? verificados === detallesDelPedido.length : true,
        pendientes: detallesDelPedido.length - verificados
      };
    });
    
    return status;
  }, [allDetallesForVerificacion, verificaciones, pedidosAcumulativos]);

  // Contar pedidos que requieren verificación
  const pedidosConVerificacionCount = useMemo(() => {
    return Object.values(pedidosVerificacionStatus).filter(s => s.requiere && !s.completo).length;
  }, [pedidosVerificacionStatus]);

  // Detectar productos verificables en el pedido actual
  const detallesConVerificacion = useMemo(() => {
    if (!detalles) return [];
    return detalles.filter((det: any) => esProductoVerificable(det.productos?.nombre));
  }, [detalles]);

  // Verificar si el pedido actual tiene todas las verificaciones completas
  const pedidoActualVerificado = useMemo(() => {
    if (!selectedPedido || !detallesConVerificacion.length) return true;
    return detallesConVerificacion.every((det: any) => 
      verificaciones[selectedPedido]?.[det.id]?.verificado
    );
  }, [selectedPedido, detallesConVerificacion, verificaciones]);

  // Mutation para recalcular todos los pedidos
  const recalcularMutation = useMutation({
    mutationFn: async () => {
      const { data: pedidos, error: pedidosError } = await supabase
        .from("pedidos_acumulativos")
        .select("id")
        .eq("status", "borrador");

      if (pedidosError) throw pedidosError;
      if (!pedidos || pedidos.length === 0) return { updated: 0 };

      let updatedCount = 0;
      let totalLinesFixed = 0;

      for (const pedido of pedidos) {
        const { data: detalles, error: detallesError } = await supabase
          .from("pedidos_acumulativos_detalles")
          .select(`*, productos:producto_id(nombre, precio_por_kilo, aplica_iva, aplica_ieps)`)
          .eq("pedido_acumulativo_id", pedido.id);

        if (detallesError) throw detallesError;
        if (!detalles || detalles.length === 0) continue;

        const detallesUpdates = [];
        for (const detalle of detalles) {
          const resultado = calcularSubtotal({
            cantidad: detalle.cantidad,
            precio_unitario: detalle.precio_unitario,
            nombre_producto: detalle.productos?.nombre || 'Producto desconocido'
          });

          if (!resultado.valido) continue;

          if (Math.abs(resultado.subtotal - detalle.subtotal) > 0.01) {
            detallesUpdates.push({ id: detalle.id, subtotal: resultado.subtotal });
            totalLinesFixed++;
          }
        }

        for (const update of detallesUpdates) {
          await supabase.from("pedidos_acumulativos_detalles").update({ subtotal: update.subtotal }).eq("id", update.id);
        }

        const { data: detallesActualizados } = await supabase
          .from("pedidos_acumulativos_detalles")
          .select(`*, productos:producto_id(nombre, aplica_iva, aplica_ieps)`)
          .eq("pedido_acumulativo_id", pedido.id);

        let subtotalTotal = 0, ivaTotal = 0, iepsTotal = 0;

        for (const detalle of detallesActualizados || []) {
          const desglose = calcularDesgloseImpuestosNuevo({
            precio_con_impuestos: detalle.subtotal,
            aplica_iva: detalle.productos?.aplica_iva || false,
            aplica_ieps: detalle.productos?.aplica_ieps || false,
            nombre_producto: detalle.productos?.nombre || ''
          });
          subtotalTotal += desglose.base;
          ivaTotal += desglose.iva;
          iepsTotal += desglose.ieps;
        }

        await supabase.from("pedidos_acumulativos").update({
          subtotal: redondear(subtotalTotal),
          impuestos: redondear(ivaTotal + iepsTotal),
          total: redondear(subtotalTotal + ivaTotal + iepsTotal)
        }).eq("id", pedido.id);

        updatedCount++;
      }

      return { updated: updatedCount, linesFixed: totalLinesFixed };
    },
    onSuccess: (result) => {
      toast.success(`${result.updated} pedidos recalculados • ${result.linesFixed} líneas corregidas`);
      queryClient.invalidateQueries({ queryKey: ["pedidos-acumulativos"] });
    },
    onError: (error: any) => {
      toast.error("Error al recalcular: " + error.message);
    },
  });

  // Mutation para eliminar pedido
  const deleteMutation = useMutation({
    mutationFn: async (pedidoId: string) => {
      const { error } = await supabase.from("pedidos_acumulativos").delete().eq("id", pedidoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido acumulativo eliminado");
      queryClient.invalidateQueries({ queryKey: ["pedidos-acumulativos"] });
      queryClient.invalidateQueries({ queryKey: ["correos-procesados"] });
    },
    onError: (error: any) => {
      toast.error("Error al eliminar: " + error.message);
    },
  });

  // Mutation para actualizar cantidad de un detalle
  const updateDetalleMutation = useMutation({
    mutationFn: async ({ detalleId, nuevaCantidad }: { detalleId: string; nuevaCantidad: number }) => {
      const { data: detalle, error: fetchError } = await supabase
        .from("pedidos_acumulativos_detalles")
        .select(`*, productos:producto_id(aplica_iva, aplica_ieps, nombre)`)
        .eq("id", detalleId)
        .single();

      if (fetchError) throw fetchError;

      const nuevoSubtotal = nuevaCantidad * detalle.precio_unitario;

      await supabase.from("pedidos_acumulativos_detalles")
        .update({ cantidad: nuevaCantidad, subtotal: nuevoSubtotal })
        .eq("id", detalleId);

      const { data: todosDetalles } = await supabase
        .from("pedidos_acumulativos_detalles")
        .select(`*, productos:producto_id(aplica_iva, aplica_ieps, nombre)`)
        .eq("pedido_acumulativo_id", detalle.pedido_acumulativo_id);

      let subtotalTotal = 0, ivaTotal = 0, iepsTotal = 0;

      for (const det of todosDetalles || []) {
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

      await supabase.from("pedidos_acumulativos").update({
        subtotal: redondear(subtotalTotal),
        impuestos: redondear(ivaTotal + iepsTotal),
        total: redondear(subtotalTotal + ivaTotal + iepsTotal)
      }).eq("id", detalle.pedido_acumulativo_id);

      return { pedidoId: detalle.pedido_acumulativo_id, detalleId };
    },
    onSuccess: (data) => {
      toast.success("Cantidad actualizada");
      setEditingDetalle(null);
      refetchDetalles();
      queryClient.invalidateQueries({ queryKey: ["pedidos-acumulativos"] });
      
      // Marcar como verificado
      setVerificaciones(prev => ({
        ...prev,
        [data.pedidoId]: {
          ...prev[data.pedidoId],
          [data.detalleId]: {
            ...prev[data.pedidoId]?.[data.detalleId],
            verificado: true
          }
        }
      }));
    },
    onError: (error: any) => {
      toast.error("Error al actualizar: " + error.message);
    }
  });

  // Mutation para generar pedido final (solo si está verificado)
  const finalizarMutation = useMutation({
    mutationFn: async (pedidoAcumulativoId: string) => {
      // Verificar que todos los productos especiales estén verificados
      const status = pedidosVerificacionStatus[pedidoAcumulativoId];
      if (status?.requiere && !status?.completo) {
        throw new Error("Debes verificar todos los productos especiales antes de generar la remisión");
      }

      const { data: pedidoAcum, error: pedidoError } = await supabase
        .from("pedidos_acumulativos")
        .select(`
          *, 
          pedidos_acumulativos_detalles(
            *,
            productos:producto_id(nombre)
          )
        `)
        .eq("id", pedidoAcumulativoId)
        .single();

      if (pedidoError) throw pedidoError;

      // *** ALERTA PARA CANELA MOLIDA / ANÍS >12 KG ***
      const detallesSospechosos = pedidoAcum.pedidos_acumulativos_detalles.filter((det: any) => {
        const nombreLower = det.productos?.nombre?.toLowerCase() || '';
        const esCanelaoAnis = nombreLower.includes('canela molida') || 
                             nombreLower.includes('anís') || 
                             nombreLower.includes('anis');
        return esCanelaoAnis && det.cantidad > 12;
      });

      if (detallesSospechosos.length > 0) {
        const productos = detallesSospechosos.map((d: any) => 
          `• ${d.productos?.nombre || 'Producto'}: ${d.cantidad} kg`
        ).join('\n');
        
        const confirmar = window.confirm(
          `⚠️ ALERTA: Cantidades inusuales detectadas\n\n` +
          `${productos}\n\n` +
          `Normalmente las panaderías no piden más de 12 kg de estos productos.\n` +
          `¿Deseas continuar de todos modos?`
        );

        if (!confirmar) {
          throw new Error("Pedido cancelado - revisar cantidades de Canela/Anís");
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

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
        if (match) newFolioNumber = parseInt(match[1]) + 1;
      }
      const folio = `PED-${yearMonth}-${String(newFolioNumber).padStart(4, "0")}`;

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

      const detallesInsert = pedidoAcum.pedidos_acumulativos_detalles.map((det: any) => ({
        pedido_id: newPedido.id,
        producto_id: det.producto_id,
        cantidad: det.cantidad,
        precio_unitario: det.precio_unitario,
        subtotal: det.subtotal,
        unidades_manual: det.unidades_manual,
      }));

      const { error: detallesError } = await supabase.from("pedidos_detalles").insert(detallesInsert);
      if (detallesError) throw detallesError;

      await supabase.from("pedidos_acumulativos").update({ status: "finalizado" }).eq("id", pedidoAcumulativoId);

      return { pedido: newPedido };
    },
    onSuccess: (data) => {
      toast.success(`Pedido ${data.pedido.folio} generado exitosamente`);
      queryClient.invalidateQueries({ queryKey: ["pedidos-acumulativos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      setSelectedPedido(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Mutation para generar múltiples pedidos
  const finalizarMultipleMutation = useMutation({
    mutationFn: async (pedidoIds: string[]) => {
      // Verificar que todos los pedidos seleccionados estén verificados
      const noVerificados = pedidoIds.filter(id => {
        const status = pedidosVerificacionStatus[id];
        return status?.requiere && !status?.completo;
      });

      if (noVerificados.length > 0) {
        throw new Error(`${noVerificados.length} pedido(s) requieren verificación de productos especiales`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const { data: pedidosAcumulativos, error: fetchError } = await supabase
        .from("pedidos_acumulativos")
        .select(`
          *, 
          pedidos_acumulativos_detalles(
            *,
            productos:producto_id(nombre)
          )
        `)
        .in("id", pedidoIds);

      if (fetchError) throw fetchError;

      // *** ALERTA PARA CANELA MOLIDA / ANÍS >12 KG EN MÚLTIPLES PEDIDOS ***
      const todosDetallesSospechosos: Array<{ sucursal: string; producto: string; cantidad: number }> = [];
      
      for (const pedido of pedidosAcumulativos || []) {
        for (const det of pedido.pedidos_acumulativos_detalles || []) {
          const nombreLower = det.productos?.nombre?.toLowerCase() || '';
          const esCanelaoAnis = nombreLower.includes('canela molida') || 
                               nombreLower.includes('anís') || 
                               nombreLower.includes('anis');
          if (esCanelaoAnis && det.cantidad > 12) {
            todosDetallesSospechosos.push({
              sucursal: pedido.id,
              producto: det.productos?.nombre || 'Producto',
              cantidad: det.cantidad
            });
          }
        }
      }

      if (todosDetallesSospechosos.length > 0) {
        const listaProductos = todosDetallesSospechosos.map(d => 
          `• ${d.producto}: ${d.cantidad} kg`
        ).join('\n');
        
        const confirmar = window.confirm(
          `⚠️ ALERTA: Cantidades inusuales detectadas en ${todosDetallesSospechosos.length} producto(s)\n\n` +
          `${listaProductos}\n\n` +
          `Normalmente las panaderías no piden más de 12 kg de Canela Molida o Anís.\n` +
          `¿Deseas continuar de todos modos?`
        );

        if (!confirmar) {
          throw new Error("Generación cancelada - revisar cantidades de Canela/Anís");
        }
      }

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
        if (match) nextFolioNumber = parseInt(match[1]) + 1;
      }

      const results = [];
      for (const pedidoAcum of pedidosAcumulativos || []) {
        const folio = `PED-${yearMonth}-${String(nextFolioNumber++).padStart(4, "0")}`;
        
        try {
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

          const detallesInsert = pedidoAcum.pedidos_acumulativos_detalles.map((det: any) => ({
            pedido_id: newPedido.id,
            producto_id: det.producto_id,
            cantidad: det.cantidad,
            precio_unitario: det.precio_unitario,
            subtotal: det.subtotal,
            unidades_manual: det.unidades_manual,
          }));

          await supabase.from("pedidos_detalles").insert(detallesInsert);
          await supabase.from("pedidos_acumulativos").update({ status: "finalizado" }).eq("id", pedidoAcum.id);

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
        toast.success(`${successCount} pedido${successCount > 1 ? 's' : ''} generado${successCount > 1 ? 's' : ''}`);
      } else {
        toast.warning(`${successCount} exitosos, ${failCount} fallidos`);
      }
      
      queryClient.invalidateQueries({ queryKey: ["pedidos-acumulativos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      setSelectedForBatch(new Set());
    },
    onError: (error: any) => {
      toast.error(error.message);
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

  const startEditing = (detalle: any) => {
    setEditingDetalle(detalle.id);
    setEditValues({
      cantidadKg: detalle.cantidad || 0,
      cantidadUnidades: 1
    });
  };

  const cancelEditing = () => {
    setEditingDetalle(null);
    setEditValues({ cantidadKg: 0, cantidadUnidades: 1 });
  };

  const saveEditing = (detalleId: string) => {
    updateDetalleMutation.mutate({
      detalleId,
      nuevaCantidad: editValues.cantidadKg
    });
  };

  // Los pedidos seleccionados sin verificar
  const pedidosSeleccionadosSinVerificar = useMemo(() => {
    return Array.from(selectedForBatch).filter(id => {
      const status = pedidosVerificacionStatus[id];
      return status?.requiere && !status?.completo;
    }).length;
  }, [selectedForBatch, pedidosVerificacionStatus]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Show quick verification view
  if (showVerificacionRapida) {
    return <VerificacionRapidaLecaroz onClose={() => setShowVerificacionRapida(false)} />;
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
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {selectedForBatch.size === pedidosAcumulativos.length ? (
                  <CheckSquare className="h-4 w-4 mr-1" />
                ) : (
                  <Square className="h-4 w-4 mr-1" />
                )}
                {selectedForBatch.size === pedidosAcumulativos.length ? 'Deseleccionar' : 'Seleccionar todos'}
              </Button>
              {selectedForBatch.size > 0 && (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(`¿Eliminar ${selectedForBatch.size} pedido${selectedForBatch.size > 1 ? 's' : ''} seleccionado${selectedForBatch.size > 1 ? 's' : ''}?`)) {
                        Array.from(selectedForBatch).forEach(id => deleteMutation.mutate(id));
                        setSelectedForBatch(new Set());
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Borrar {selectedForBatch.size}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleGenerateBatch}
                    disabled={finalizarMultipleMutation.isPending || pedidosSeleccionadosSinVerificar > 0}
                    title={pedidosSeleccionadosSinVerificar > 0 ? `${pedidosSeleccionadosSinVerificar} pedido(s) sin verificar` : ''}
                  >
                    {finalizarMultipleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : pedidosSeleccionadosSinVerificar > 0 ? (
                      <Lock className="h-4 w-4 mr-1" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Generar {selectedForBatch.size} pedido{selectedForBatch.size > 1 ? 's' : ''}
                    {pedidosSeleccionadosSinVerificar > 0 && ` (${pedidosSeleccionadosSinVerificar} bloqueados)`}
                  </Button>
                </>
              )}
            </>
          )}
          {pedidosConVerificacionCount > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowVerificacionRapida(true)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Zap className="h-4 w-4 mr-1" />
              Verificación Rápida ({pedidosConVerificacionCount})
            </Button>
          )}
          <Badge variant="secondary">
            {pedidosAcumulativos?.length || 0} en borrador
          </Badge>
        </div>
      </div>

      {/* Alerta de verificación obligatoria */}
      {pedidosConVerificacionCount > 0 && (
        <Alert variant="destructive" className="border-red-500 bg-red-50 dark:bg-red-950/30">
          <Lock className="h-4 w-4" />
          <AlertTitle className="text-red-800 dark:text-red-200">
            🔒 {pedidosConVerificacionCount} pedido{pedidosConVerificacionCount > 1 ? 's' : ''} BLOQUEADO{pedidosConVerificacionCount > 1 ? 'S' : ''}
          </AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-300">
            <strong>No puedes generar remisiones</strong> hasta que verifiques manualmente: Piloncillo, Canela Molida, Anís y/o Bicarbonato.
            <br />
            Haz clic en "Editar" para ajustar cajas/bolsas y kilos de cada producto.
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
            const status = pedidosVerificacionStatus[pedido.id];
            const bloqueado = status?.requiere && !status?.completo;
            
            return (
              <Card key={pedido.id} className={`
                ${selectedForBatch.has(pedido.id) ? "border-primary" : ""} 
                ${bloqueado ? "border-l-4 border-l-red-500" : status?.requiere && status?.completo ? "border-l-4 border-l-green-500" : ""}
              `}>
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
                          {pedido.cliente_sucursales?.codigo_sucursal && (
                            <Badge variant="outline" className="mr-1">
                              #{pedido.cliente_sucursales.codigo_sucursal}
                            </Badge>
                          )}
                          {pedido.cliente_sucursales?.nombre || "Sin sucursal"}
                          {bloqueado && (
                            <Badge variant="destructive" className="text-xs">
                              <Lock className="h-3 w-3 mr-1" />
                              {status.pendientes} verificación{status.pendientes > 1 ? 'es' : ''} pendiente{status.pendientes > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {status?.requiere && status?.completo && (
                            <Badge variant="default" className="bg-green-600 text-xs">
                              <Unlock className="h-3 w-3 mr-1" />
                              Verificado
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-4 mt-2">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {pedido.clientes?.nombre || "Cliente"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(pedido.fecha_entrega), "dd MMM yyyy", { locale: es })}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            Crédito: {getTerminoCreditoLabel(pedido.clientes?.termino_credito)}
                          </Badge>
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
                      {formatCurrency(pedido.total || 0)}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={bloqueado ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => setSelectedPedido(pedido.id)}
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        {bloqueado ? "⚠️ Editar (obligatorio)" : "Editar"}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => finalizarMutation.mutate(pedido.id)}
                        disabled={finalizarMutation.isPending || bloqueado}
                        title={bloqueado ? "Verifica los productos especiales primero" : ""}
                      >
                        {finalizarMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : bloqueado ? (
                          <Lock className="h-4 w-4 mr-1" />
                        ) : (
                          <Check className="h-4 w-4 mr-1" />
                        )}
                        {bloqueado ? "Bloqueado" : "Generar remisión"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm('¿Eliminar este pedido acumulativo?')) {
                            deleteMutation.mutate(pedido.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Borrar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog para editar pedido */}
      <Dialog open={!!selectedPedido} onOpenChange={() => { setSelectedPedido(null); setEditingDetalle(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Editar Pedido Acumulativo
              {!pedidoActualVerificado && (
                <Badge variant="destructive">
                  <Lock className="h-3 w-3 mr-1" />
                  Verificación pendiente
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {detallesConVerificacion.length > 0 
                ? "🔒 Debes verificar y ajustar los productos marcados antes de generar la remisión."
                : "Revisa los productos del pedido"
              }
            </DialogDescription>
          </DialogHeader>
          
          {/* Alerta de verificación obligatoria */}
          {detallesConVerificacion.length > 0 && !pedidoActualVerificado && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>⚠️ Verificación obligatoria</AlertTitle>
              <AlertDescription>
                Este pedido contiene productos que requieren verificación manual:
                <ul className="list-disc ml-4 mt-1">
                  {detallesConVerificacion.map((det: any) => (
                    <li key={det.id}>
                      <strong>{getNombreProductoVerificacion(det.productos?.nombre)}</strong>: 
                      {verificaciones[selectedPedido!]?.[det.id]?.verificado 
                        ? " ✅ Verificado" 
                        : " ❌ Pendiente de verificar"
                      }
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          <ScrollArea className="h-[450px] pr-4">
            {detalles && detalles.length > 0 ? (
              <div className="space-y-2">
                {detalles.map((detalle: any, idx: number) => {
                  const requiereVerificacion = esProductoVerificable(detalle.productos?.nombre);
                  const tipoUnidadProducto = getTipoUnidad(detalle.productos?.nombre);
                  const isEditing = editingDetalle === detalle.id;
                  const estaVerificado = verificaciones[selectedPedido!]?.[detalle.id]?.verificado;
                  
                  return (
                    <div key={detalle.id}>
                      {idx > 0 && <Separator className="my-2" />}
                      <div className={`p-3 rounded-lg ${
                        requiereVerificacion 
                          ? estaVerificado 
                            ? 'bg-green-50 dark:bg-green-950/30 border border-green-300' 
                            : 'bg-red-50 dark:bg-red-950/30 border border-red-400 border-2'
                          : 'bg-muted/50'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium flex items-center gap-2 flex-wrap">
                              <span className="text-muted-foreground text-sm">{detalle.productos?.codigo}</span>
                              {detalle.productos?.nombre}
                              {requiereVerificacion && (
                                estaVerificado ? (
                                  <Badge variant="default" className="bg-green-600 text-xs">
                                    <Check className="h-3 w-3 mr-1" />
                                    Verificado
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-xs animate-pulse">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    ¡Verificar {tipoUnidadProducto === 'caja' ? 'cajas' : 'bolsas'} y kg!
                                  </Badge>
                                )
                              )}
                            </div>
                            
                            {isEditing ? (
                              <div className="mt-3 p-4 bg-amber-100/80 dark:bg-amber-900/40 rounded-lg border border-amber-300">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-sm font-medium">
                                      {tipoUnidadProducto === 'caja' ? 'Número de CAJAS:' : 'Número de BOLSAS:'}
                                    </Label>
                                    <Input
                                      type="number"
                                      step="1"
                                      min="1"
                                      value={editValues.cantidadUnidades}
                                      onChange={(e) => setEditValues(prev => ({ 
                                        ...prev, 
                                        cantidadUnidades: parseInt(e.target.value) || 1 
                                      }))}
                                      className="mt-1 h-10 text-lg font-bold"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Ingresa la cantidad exacta de {tipoUnidadProducto === 'caja' ? 'cajas' : 'bolsas'}
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">Peso total en KG:</Label>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0.1"
                                      value={editValues.cantidadKg}
                                      onChange={(e) => setEditValues(prev => ({ 
                                        ...prev, 
                                        cantidadKg: parseFloat(e.target.value) || 0 
                                      }))}
                                      className="mt-1 h-10 text-lg font-bold"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Ingresa el peso real verificado
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    onClick={() => saveEditing(detalle.id)}
                                    disabled={updateDetalleMutation.isPending}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    {updateDetalleMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                    ) : (
                                      <Save className="h-4 w-4 mr-1" />
                                    )}
                                    Guardar y verificar
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={cancelEditing}>
                                    <X className="h-4 w-4 mr-1" />
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-4">
                                <span><strong>{detalle.cantidad}</strong> kg</span>
                                <span>× ${detalle.precio_unitario?.toFixed(2)}</span>
                                <span>= <strong>{formatCurrency(detalle.subtotal)}</strong></span>
                                {requiereVerificacion && verificaciones[selectedPedido!]?.[detalle.id] && (
                                  <span className="text-xs">
                                    ({verificaciones[selectedPedido!][detalle.id].cantidadUnidades} {tipoUnidadProducto === 'caja' ? 'cajas' : 'bolsas'})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {!isEditing && (
                            <Button
                              size="sm"
                              variant={requiereVerificacion && !estaVerificado ? "destructive" : "outline"}
                              onClick={() => startEditing(detalle)}
                              className={requiereVerificacion && !estaVerificado ? "animate-pulse" : ""}
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              {requiereVerificacion && !estaVerificado ? "¡Verificar!" : "Editar"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay productos en este pedido
              </p>
            )}
          </ScrollArea>
          
          <DialogFooter className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {detallesConVerificacion.length > 0 && (
                <span className={pedidoActualVerificado ? "text-green-600" : "text-red-600"}>
                  {pedidoActualVerificado 
                    ? "✅ Todos los productos verificados" 
                    : `❌ ${detallesConVerificacion.filter((d: any) => !verificaciones[selectedPedido!]?.[d.id]?.verificado).length} producto(s) pendiente(s)`
                  }
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedPedido(null)}>
                Cerrar
              </Button>
              <Button
                onClick={() => selectedPedido && finalizarMutation.mutate(selectedPedido)}
                disabled={finalizarMutation.isPending || !pedidoActualVerificado}
              >
                {finalizarMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : !pedidoActualVerificado ? (
                  <Lock className="h-4 w-4 mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                {pedidoActualVerificado ? "Generar remisión" : "Verificación pendiente"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
