import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Sparkles,
  Building2,
  Package,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ParsedProduct {
  nombre_producto: string;
  cantidad: number;
  unidad_mencionada_cliente?: string; // Unidad que menciona el cliente (KILOS, PIEZAS, etc.) - solo referencia
  unidad?: string; // Unidad final del producto (del catálogo) - se calcula en el frontend
  precio_sugerido?: number | null;
  notas?: string;
  producto_id?: string;
  precio_unitario?: number;
  producto_cotizado_id?: string; // ID del producto si la AI hizo match con cotización
  // Campos para productos por kg
  precio_por_kilo?: boolean;
  kg_por_unidad?: number;
  aplica_iva?: boolean;
  aplica_ieps?: boolean;
  match_type?: 'exact' | 'synonym' | 'none'; // Tipo de coincidencia
  unidad_comercial?: string; // Unidad del catálogo (bulto, caja, kg, etc.)
}

interface ParsedSucursal {
  nombre_sucursal: string;
  fecha_entrega_solicitada?: string | null;
  productos: ParsedProduct[];
  sucursal_id?: string;
}

interface ParsedOrder {
  sucursales: ParsedSucursal[];
  notas_generales?: string;
  confianza: number;
}

interface ProcesarPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailBody: string;
  emailSubject: string;
  emailFrom: string;
  emailId: string;
  onSuccess?: () => void;
}

// Progressive rendering batch size
const BATCH_SIZE = 15;

export default function ProcesarPedidoDialog({
  open,
  onOpenChange,
  emailBody,
  emailSubject,
  emailFrom,
  emailId,
  onSuccess,
}: ProcesarPedidoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [parsedOrder, setParsedOrder] = useState<ParsedOrder | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [selectedCotizacionId, setSelectedCotizacionId] = useState<string>("__all__");
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [existingOrders, setExistingOrders] = useState<Map<string, { id: string; folio: string }>>(new Map());
  const [emailAlreadyProcessed, setEmailAlreadyProcessed] = useState<boolean>(false);
  const [processedOrdersInfo, setProcessedOrdersInfo] = useState<{ folio: string; tipo: string }[]>([]);
  const [isLecarozEmail, setIsLecarozEmail] = useState(false);
  const [acumulativoMode, setAcumulativoMode] = useState(false);

  // Fetch clientes
  const { data: clientes } = useQuery({
    queryKey: ["clientes-activos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nombre, codigo")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // Fetch sucursales for selected cliente
  const { data: sucursales } = useQuery({
    queryKey: ["cliente-sucursales", selectedClienteId],
    queryFn: async () => {
      if (!selectedClienteId) return [];
      const { data, error } = await supabase
        .from("cliente_sucursales")
        .select("id, nombre, direccion")
        .eq("cliente_id", selectedClienteId)
        .eq("activo", true);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClienteId,
  });

  // Fetch productos
  const { data: productos } = useQuery({
    queryKey: ["productos-activos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("id, nombre, codigo, precio_venta, unidad, precio_por_kilo, kg_por_unidad, aplica_iva, aplica_ieps")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // Fetch cotizaciones recientes del cliente (últimos 90 días)
  const { data: cotizacionesRecientes } = useQuery({
    queryKey: ["cotizaciones-cliente", selectedClienteId],
    queryFn: async () => {
      if (!selectedClienteId) return [];
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - 90);
      
      const { data, error } = await supabase
        .from("cotizaciones")
        .select(`
          id,
          folio,
          nombre,
          fecha_creacion,
          status,
          cotizaciones_detalles (
            producto_id,
            cantidad,
            precio_unitario,
            tipo_precio,
            productos (
              id,
              nombre,
              codigo,
              unidad,
              precio_por_kilo,
              kg_por_unidad,
              aplica_iva,
              aplica_ieps
            )
          )
        `)
        .eq("cliente_id", selectedClienteId)
        .in("status", ["autorizada", "enviada"])
        .gte("fecha_creacion", fechaLimite.toISOString().split('T')[0])
        .order("fecha_creacion", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClienteId,
  });

  // Reset cotizacion selection when cliente changes
  useEffect(() => {
    setSelectedCotizacionId("__all__");
  }, [selectedClienteId]);

  // Verificar si el correo ya fue procesado al abrir el diálogo
  useEffect(() => {
    if (open) {
      setParsedOrder(null);
      setError(null);
      setVisibleCount(BATCH_SIZE);
      setEmailAlreadyProcessed(false);
      setProcessedOrdersInfo([]);
      checkIfEmailAlreadyProcessed();
    }
  }, [open, emailId]);

  const checkIfEmailAlreadyProcessed = async () => {
    if (!emailId) return;
    
    try {
      // Verificar en pedidos finales a través de las notas
      const { data: pedidosData, error: pedidosError } = await supabase
        .from("pedidos")
        .select("folio, notas")
        .ilike("notas", `%${emailId}%`);

      if (pedidosError) throw pedidosError;

      const processedInfo: { folio: string; tipo: string }[] = [];

      // Solo bloquear si hay pedidos finales creados
      if (pedidosData && pedidosData.length > 0) {
        pedidosData.forEach(pedido => {
          processedInfo.push({
            folio: pedido.folio,
            tipo: "Pedido Final"
          });
        });
      }

      console.log(`Email ${emailId} check:`, processedInfo.length > 0 ? "Final orders exist" : "No final orders");

      // Solo marcar como procesado si hay pedidos finales
      // Los pedidos acumulativos en borrador no bloquean el reprocesamiento
      if (processedInfo.length > 0) {
        setEmailAlreadyProcessed(true);
        setProcessedOrdersInfo(processedInfo);
      } else {
        setEmailAlreadyProcessed(false);
        setProcessedOrdersInfo([]);
      }
    } catch (error) {
      console.error("Error checking if email was processed:", error);
      // En caso de error, permitir el procesamiento
      setEmailAlreadyProcessed(false);
      setProcessedOrdersInfo([]);
    }
  };


  // Reset visible count when new order is parsed
  useEffect(() => {
    if (parsedOrder) {
      setVisibleCount(BATCH_SIZE);
    }
  }, [parsedOrder?.sucursales.length]);

  // Auto-detect cliente from email
  useEffect(() => {
    if (open && clientes && emailFrom) {
      const emailLower = emailFrom.toLowerCase();
      // Try to match cliente by email or name in the from field
      const matchedCliente = clientes.find(c => 
        emailLower.includes(c.nombre.toLowerCase()) ||
        emailLower.includes(c.codigo.toLowerCase())
      );
      if (matchedCliente) {
        setSelectedClienteId(matchedCliente.id);
      }
    }
  }, [open, clientes, emailFrom]);

  const handleParse = async () => {
    // Detectar si es correo de Lecaroz
    const isLecaroz = emailSubject?.toUpperCase().includes("LECAROZ") || false;
    setIsLecarozEmail(isLecaroz);
    setAcumulativoMode(isLecaroz); // Activar modo acumulativo para Lecaroz
    
    setParsing(true);
    setError(null);
    setParsedOrder(null);

    try {
      // Si hay una cotización seleccionada, usar solo esos productos
      // Si no, usar todas las cotizaciones recientes
      let cotizacionesParaUsar = cotizacionesRecientes || [];
      if (selectedCotizacionId && selectedCotizacionId !== "__all__") {
        cotizacionesParaUsar = cotizacionesRecientes?.filter(c => c.id === selectedCotizacionId) || [];
      }

      // Preparar productos de cotizaciones como contexto para la AI
      const productosCotizados = cotizacionesParaUsar.flatMap(cot => 
        cot.cotizaciones_detalles?.map((det: any) => ({
          producto_id: det.producto_id,
          nombre: det.productos?.nombre,
          codigo: det.productos?.codigo,
          unidad: det.productos?.unidad,
          precio_cotizado: det.precio_unitario,
          precio_por_kilo: det.productos?.precio_por_kilo,
          kg_por_unidad: det.productos?.kg_por_unidad,
          aplica_iva: det.productos?.aplica_iva,
          aplica_ieps: det.productos?.aplica_ieps,
          tipo_precio: det.tipo_precio, // "por_kilo", "por_bulto", "por_caja", etc.
        }))
      ).filter(Boolean) || [];

      // Eliminar duplicados por producto_id (mantener el primero = cotización más reciente)
      const productosUnicos = productosCotizados.reduce((acc: any[], prod: any) => {
        if (!acc.find(p => p.producto_id === prod.producto_id)) {
          acc.push(prod);
        }
        return acc;
      }, []);

      // Preparar lista de sucursales registradas para validación estricta
      const sucursalesRegistradas = (sucursales || []).map(s => ({
        id: s.id,
        nombre: s.nombre,
      }));

      const { data, error } = await supabase.functions.invoke("parse-order-email", {
        body: {
          emailBody,
          emailSubject,
          emailFrom,
          clienteId: selectedClienteId,
          productosCotizados: productosUnicos,
          sucursalesRegistradas, // Send registered branches for strict validation
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setParsedOrder(data.order);

      // Try to match products and sucursales
      if (data.order && productos) {
        const matchedOrder = { ...data.order };
        
        // Check for existing orders for today - CRITICAL for partial order handling
        const today = new Date().toISOString().split('T')[0];
        const existingOrdersMap = new Map<string, { id: string; folio: string }>();
        
        for (const suc of matchedOrder.sucursales) {
          // Auto-match sucursal by name or use parser-provided ID
          let matchedSucursalId = suc.sucursal_id;
          if (!matchedSucursalId && sucursales && sucursales.length > 0) {
            const sucursalNormalizada = suc.nombre_sucursal.toLowerCase().trim();
            const matchedSucursal = sucursales.find(s => {
              const nombreDb = s.nombre.toLowerCase().trim();
              // Exact match or partial match
              return nombreDb === sucursalNormalizada ||
                     nombreDb.includes(sucursalNormalizada) ||
                     sucursalNormalizada.includes(nombreDb);
            });
            if (matchedSucursal) {
              matchedSucursalId = matchedSucursal.id;
            }
          }
          
          // Check for existing order TODAY for this sucursal
          if (matchedSucursalId) {
            const { data: existingOrder } = await supabase
              .from("pedidos")
              .select("id, folio")
              .eq("cliente_id", selectedClienteId)
              .eq("sucursal_id", matchedSucursalId)
              .eq("fecha_pedido", today)
              .eq("status", "pendiente")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (existingOrder) {
              existingOrdersMap.set(matchedSucursalId, {
                id: existingOrder.id,
                folio: existingOrder.folio,
              });
              console.log(`✓ Existing order found for ${suc.nombre_sucursal}: ${existingOrder.folio}`);
            }
          }
        }
        
        setExistingOrders(existingOrdersMap);
        
        matchedOrder.sucursales = matchedOrder.sucursales.map((suc: ParsedSucursal) => {
          // Auto-match sucursal by name or use parser-provided ID
          let matchedSucursalId = suc.sucursal_id;
          if (!matchedSucursalId && sucursales && sucursales.length > 0) {
            const sucursalNormalizada = suc.nombre_sucursal.toLowerCase().trim();
            const matchedSucursal = sucursales.find(s => {
              const nombreDb = s.nombre.toLowerCase().trim();
              // Exact match or partial match
              return nombreDb === sucursalNormalizada ||
                     nombreDb.includes(sucursalNormalizada) ||
                     sucursalNormalizada.includes(nombreDb);
            });
            if (matchedSucursal) {
              matchedSucursalId = matchedSucursal.id;
            }
          }
          
            return {
              ...suc,
              sucursal_id: matchedSucursalId,
              productos: suc.productos.map((prod: ParsedProduct) => {
              if (prod.producto_cotizado_id) {
                const matchedByCotizacion = productos.find(p => p.id === prod.producto_cotizado_id);
                if (matchedByCotizacion) {
                  // Buscar precio de cotización si existe en las cotizaciones seleccionadas
                  const precioCotizacion = productosUnicos.find(
                    (pc: any) => pc.producto_id === prod.producto_cotizado_id
                  )?.precio_cotizado;
                  
                  // CRITICAL FIX: Si no hay precio de cotización, usar precio_venta del producto
                  const precioFinal = precioCotizacion !== undefined && precioCotizacion !== null 
                    ? precioCotizacion 
                    : matchedByCotizacion.precio_venta;

                  const unidadCatalogo = matchedByCotizacion.unidad;
                  const kgPorUnidad = matchedByCotizacion.kg_por_unidad;
                  const unidadVentaLower = (unidadCatalogo || '').toLowerCase();

                  // Determinar cuántos KILOS pidió el cliente
                  const kilosDelCorreo = typeof (prod as any).cantidad_original_kg === 'number'
                    ? (prod as any).cantidad_original_kg
                    : prod.unidad_mencionada_cliente?.toLowerCase().startsWith('kilo')
                      ? prod.cantidad
                      : undefined;

                  let cantidadFinal = prod.cantidad;
                  let notasFinal = prod.notas;
                  let unidadFinal = unidadCatalogo;

                  // NUEVA REGLA: si el producto es precio_por_kilo, SIEMPRE trabajamos en KILOS
                  if (matchedByCotizacion.precio_por_kilo) {
                    const kilos = typeof kilosDelCorreo === 'number' ? kilosDelCorreo : prod.cantidad;
                    cantidadFinal = kilos;
                    unidadFinal = 'kg';
                    notasFinal = notasFinal || undefined;
                  } else if (
                    unidadVentaLower !== 'kg' &&
                    unidadVentaLower !== 'kilo' &&
                    unidadVentaLower !== 'kilos' &&
                    kgPorUnidad &&
                    kgPorUnidad > 0 &&
                    typeof kilosDelCorreo === 'number'
                  ) {
                    // Producto NO es por kilo: convertir kilos del correo a unidades comerciales
                    const unidades = kilosDelCorreo / kgPorUnidad;
                    const unidadesRedondeadas = Math.round(unidades); // Redondear a entero
                    cantidadFinal = unidadesRedondeadas;
                    notasFinal = `${kilosDelCorreo} kg`;
                  }

                  console.log('CONVERSIÓN FINAL BY-ID (RESPETANDO CATÁLOGO/PRECIO_KG)', {
                    producto: matchedByCotizacion.nombre,
                    cantidad_original_ai: prod.cantidad,
                    kilos_del_correo: kilosDelCorreo,
                    cantidad_final: cantidadFinal,
                    unidad_catalogo: unidadCatalogo,
                    unidad_final: unidadFinal,
                    kg_por_unidad: kgPorUnidad,
                    precio_por_kilo: matchedByCotizacion.precio_por_kilo,
                  });
                  
                  return {
                    ...prod,
                    cantidad: cantidadFinal,
                    unidad: unidadFinal,
                    unidad_comercial: unidadCatalogo,
                    producto_id: matchedByCotizacion.id,
                    precio_unitario: precioFinal,
                    precio_por_kilo: matchedByCotizacion.precio_por_kilo,
                    kg_por_unidad: kgPorUnidad,
                    aplica_iva: matchedByCotizacion.aplica_iva,
                    aplica_ieps: matchedByCotizacion.aplica_ieps,
                    cantidad_original_kg: typeof kilosDelCorreo === 'number' ? kilosDelCorreo : (prod as any).cantidad_original_kg,
                    notas: notasFinal,
                  };
                }
              }
              
              // Fallback: buscar por nombre similar
              // PRIMERO: Buscar en cotizaciones seleccionadas productos que contengan palabras clave
              let matched = null;
              let precioCotizacionPorNombre = undefined;
              
              if (productosUnicos.length > 0) {
                // Extraer palabras clave del nombre parseado (ignorar palabras cortas)
                const palabrasClave = prod.nombre_producto.toLowerCase()
                  .split(/[\s,]+/)
                  .filter(p => p.length > 3);
                
                // Buscar en productos de las cotizaciones
                const productoMatch = productosUnicos.find((pc: any) => {
                  const producto = productos.find(p => p.id === pc.producto_id);
                  if (!producto) return false;
                  
                  const nombreProducto = producto.nombre.toLowerCase();
                  // Verificar si el producto contiene alguna palabra clave del nombre parseado
                  return palabrasClave.some(palabra => nombreProducto.includes(palabra));
                });
                
                if (productoMatch) {
                  matched = productos.find(p => p.id === productoMatch.producto_id);
                  precioCotizacionPorNombre = productoMatch.precio_cotizado;
                }
              }
              
              // SEGUNDO: Si no encontró en cotizaciones, buscar en todos los productos
              if (!matched) {
                matched = productos.find(p => 
                  p.nombre.toLowerCase().includes(prod.nombre_producto.toLowerCase()) ||
                  prod.nombre_producto.toLowerCase().includes(p.nombre.toLowerCase())
                );
                
                // Si encontró match y hay cotizaciones, buscar precio
                if (matched) {
                  const precioEnCot = productosUnicos.find(
                    (pc: any) => pc.producto_id === matched.id
                  )?.precio_cotizado;
                  if (precioEnCot !== undefined) {
                    precioCotizacionPorNombre = precioEnCot;
                  }
                }
              }
              
              // REGLA: la unidad SIEMPRE viene del catálogo, pero si es precio_por_kilo trabajamos en kilos
              const unidadCatalogo = matched?.unidad;
              const kgPorUnidad = matched?.kg_por_unidad;
              const unidadVentaLower = (unidadCatalogo || '').toLowerCase();

              // Determinar cuántos KILOS pidió el cliente
              const kilosDelCorreo = typeof (prod as any).cantidad_original_kg === 'number'
                ? (prod as any).cantidad_original_kg
                : prod.unidad_mencionada_cliente?.toLowerCase().startsWith('kilo')
                  ? prod.cantidad
                  : undefined;

              let cantidadFinal = prod.cantidad;
              let notasFinal = prod.notas;
              let unidadFinal = unidadCatalogo;

              if (matched?.precio_por_kilo) {
                const kilos = typeof kilosDelCorreo === 'number' ? kilosDelCorreo : prod.cantidad;
                cantidadFinal = kilos;
                unidadFinal = 'kg';
                notasFinal = notasFinal || undefined;
              } else if (
                unidadVentaLower !== 'kg' &&
                unidadVentaLower !== 'kilo' &&
                unidadVentaLower !== 'kilos' &&
                kgPorUnidad &&
                kgPorUnidad > 0 &&
                typeof kilosDelCorreo === 'number'
              ) {
                const unidades = kilosDelCorreo / kgPorUnidad;
                const unidadesRedondeadas = Math.round(unidades); // Redondear a entero
                cantidadFinal = unidadesRedondeadas;
                notasFinal = `${kilosDelCorreo} kg`;
              }

              console.log('CONVERSIÓN FINAL BY-NAME (RESPETANDO CATÁLOGO/PRECIO_KG)', {
                producto: matched?.nombre,
                cantidad_original_ai: prod.cantidad,
                kilos_del_correo: kilosDelCorreo,
                cantidad_final: cantidadFinal,
                unidad_catalogo: unidadCatalogo,
                unidad_final: unidadFinal,
                kg_por_unidad: kgPorUnidad,
                precio_por_kilo: matched?.precio_por_kilo,
              });

              return {
                ...prod,
                cantidad: cantidadFinal,
                unidad: unidadFinal,
                unidad_comercial: unidadCatalogo,
                producto_id: matched?.id,
                precio_unitario: precioCotizacionPorNombre || matched?.precio_venta || prod.precio_sugerido,
                precio_por_kilo: matched?.precio_por_kilo,
                kg_por_unidad: kgPorUnidad,
                aplica_iva: matched?.aplica_iva,
                aplica_ieps: matched?.aplica_ieps,
                cantidad_original_kg: typeof kilosDelCorreo === 'number' ? kilosDelCorreo : (prod as any).cantidad_original_kg,
                notas: notasFinal,
              };
            }),
          };
        });
        setParsedOrder(matchedOrder);
      }

      toast({
        title: "Correo procesado",
        description: `Se detectaron ${data.order.sucursales.length} sucursal(es) con productos`,
      });
    } catch (err: any) {
      console.error("Error parsing:", err);
      setError(err.message || "Error al procesar el correo");
      toast({
        title: "Error",
        description: err.message || "No se pudo procesar el correo",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const handleAddToAcumulativo = async () => {
    if (!parsedOrder || !selectedClienteId) return;

    setCreating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuario no autenticado");

      const today = new Date().toISOString().split('T')[0];
      
      for (const suc of parsedOrder.sucursales) {
        const validProducts = suc.productos.filter(p => p.producto_id && p.cantidad > 0);
        if (validProducts.length === 0) continue;

        // Buscar pedido acumulativo existente para esta sucursal HOY
        const { data: existingAcumulativo } = await supabase
          .from("pedidos_acumulativos")
          .select("*")
          .eq("cliente_id", selectedClienteId)
          .eq("sucursal_id", suc.sucursal_id || null)
          .eq("fecha_entrega", suc.fecha_entrega_solicitada || today)
          .eq("status", "borrador")
          .maybeSingle();

        let subtotal = 0;
        let impuestos = 0;

        // Calcular totales
        for (const prod of validProducts) {
          const cantidadEntera = Math.round(prod.cantidad);
          let lineSubtotal: number;

          // NUEVA REGLA GLOBAL: si es precio_por_kilo, la cantidad SIEMPRE son KILOS
          if (prod.precio_por_kilo) {
            lineSubtotal = cantidadEntera * (prod.precio_unitario || 0);
          } else if (prod.kg_por_unidad) {
            // Productos por bulto/caja: cantidad (bultos) × kg_por_unidad × precio_por_kg
            lineSubtotal = cantidadEntera * prod.kg_por_unidad * (prod.precio_unitario || 0);
          } else {
            // Productos normales por pieza/caja
            lineSubtotal = cantidadEntera * (prod.precio_unitario || 0);
          }
          subtotal += lineSubtotal;

          // Calcular impuestos por producto
          if (prod.aplica_iva) {
            const baseIva = lineSubtotal / 1.16;
            impuestos += lineSubtotal - baseIva;
          }
          if (prod.aplica_ieps) {
            const baseIeps = lineSubtotal / 1.08;
            impuestos += lineSubtotal - baseIeps;
          }
        }

        const total = subtotal + impuestos;

        if (existingAcumulativo) {
          // ACTUALIZAR acumulativo existente
          const updatedSubtotal = (existingAcumulativo.subtotal || 0) + subtotal;
          const updatedImpuestos = (existingAcumulativo.impuestos || 0) + impuestos;
          const updatedTotal = (existingAcumulativo.total || 0) + total;

          // Agregar emailId al array correos_procesados
          const correosProcesados = existingAcumulativo.correos_procesados || [];
          if (!correosProcesados.includes(emailId)) {
            correosProcesados.push(emailId);
          }

          await supabase
            .from("pedidos_acumulativos")
            .update({
              subtotal: Math.round(updatedSubtotal * 100) / 100,
              impuestos: Math.round(updatedImpuestos * 100) / 100,
              total: Math.round(updatedTotal * 100) / 100,
              correos_procesados: correosProcesados,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingAcumulativo.id);

          // OPTIMIZADO: Obtener TODOS los detalles existentes de una vez
          const { data: existingDetalles } = await supabase
            .from("pedidos_acumulativos_detalles")
            .select("*")
            .eq("pedido_acumulativo_id", existingAcumulativo.id);

          // Preparar updates e inserts
          const updates: Array<{ id: string; cantidad: number; subtotal: number }> = [];
          const inserts: Array<any> = [];

          for (const prod of validProducts) {
            const cantidadEntera = Math.round(prod.cantidad);
            let lineSubtotal: number;
            if (prod.precio_por_kilo) {
              lineSubtotal = cantidadEntera * (prod.precio_unitario || 0);
            } else if (prod.kg_por_unidad) {
              lineSubtotal = cantidadEntera * prod.kg_por_unidad * (prod.precio_unitario || 0);
            } else {
              lineSubtotal = cantidadEntera * (prod.precio_unitario || 0);
            }

            const existingDetalle = existingDetalles?.find(d => d.producto_id === prod.producto_id);

            if (existingDetalle) {
              updates.push({
                id: existingDetalle.id,
                cantidad: existingDetalle.cantidad + cantidadEntera,
                subtotal: Math.round((existingDetalle.subtotal + lineSubtotal) * 100) / 100,
              });
            } else {
              inserts.push({
                pedido_acumulativo_id: existingAcumulativo.id,
                producto_id: prod.producto_id!,
                cantidad: cantidadEntera,
                precio_unitario: prod.precio_unitario || 0,
                subtotal: Math.round(lineSubtotal * 100) / 100,
              });
            }
          }

          // Ejecutar updates en batch
          for (const update of updates) {
            await supabase
              .from("pedidos_acumulativos_detalles")
              .update({
                cantidad: update.cantidad,
                subtotal: update.subtotal,
              })
              .eq("id", update.id);
          }

          // Ejecutar todos los inserts de una vez
          if (inserts.length > 0) {
            await supabase
              .from("pedidos_acumulativos_detalles")
              .insert(inserts);
          }
        } else {
          // CREAR nuevo pedido acumulativo
          const { data: acumulativo, error: acumulativoError } = await supabase
            .from("pedidos_acumulativos")
            .insert({
              cliente_id: selectedClienteId,
              sucursal_id: suc.sucursal_id || null,
              fecha_entrega: suc.fecha_entrega_solicitada || today,
              subtotal: Math.round(subtotal * 100) / 100,
              impuestos: Math.round(impuestos * 100) / 100,
              total: Math.round(total * 100) / 100,
              status: "borrador",
              correos_procesados: [emailId],
              notas: parsedOrder.notas_generales 
                ? `[Desde correo] ${parsedOrder.notas_generales}` 
                : `[Procesado desde correo: ${emailSubject}]`,
            })
            .select()
            .single();

          if (acumulativoError) throw acumulativoError;

          // Insertar detalles
          const detalles = validProducts.map(p => {
            const cantidadEntera = Math.round(p.cantidad);
            let lineSubtotal: number;
            if (p.precio_por_kilo) {
              lineSubtotal = cantidadEntera * (p.precio_unitario || 0);
            } else if (p.kg_por_unidad) {
              lineSubtotal = cantidadEntera * p.kg_por_unidad * (p.precio_unitario || 0);
            } else {
              lineSubtotal = cantidadEntera * (p.precio_unitario || 0);
            }
            return {
              pedido_acumulativo_id: acumulativo.id,
              producto_id: p.producto_id!,
              cantidad: cantidadEntera,
              precio_unitario: p.precio_unitario || 0,
              subtotal: Math.round(lineSubtotal * 100) / 100,
            };
          });

          await supabase
            .from("pedidos_acumulativos_detalles")
            .insert(detalles);
        }
      }

      toast({
        title: "Agregado a pedidos acumulativos",
        description: `Productos agregados exitosamente. Ve a la pestaña "Pedidos Acumulativos" para revisar.`,
      });

      queryClient.invalidateQueries({ queryKey: ["pedidos-acumulativos"] });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Error adding to acumulativo:", err);
      toast({
        title: "Error",
        description: err.message || "No se pudo agregar al pedido acumulativo",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateOrders = async () => {
    if (!parsedOrder || !selectedClienteId) return;

    setCreating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuario no autenticado");

      const today = new Date().toISOString().split('T')[0];
      let ordersCreated = 0;
      let ordersUpdated = 0;

      for (const suc of parsedOrder.sucursales) {
        // Skip sucursales without products
        const validProducts = suc.productos.filter(p => p.producto_id && p.cantidad > 0);
        if (validProducts.length === 0) continue;

        // CRITICAL: Check for existing order for this sucursal TODAY
        // This implements the "pedidos parciales" requirement
        let existingPedido = null;
        if (suc.sucursal_id) {
          const { data: pedidoExistente } = await supabase
            .from("pedidos")
            .select("id, subtotal, impuestos, total")
            .eq("cliente_id", selectedClienteId)
            .eq("sucursal_id", suc.sucursal_id)
            .eq("fecha_pedido", today)
            .eq("status", "pendiente")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          existingPedido = pedidoExistente;
          
          if (existingPedido) {
            console.log(`✓ EXISTING ORDER FOUND for sucursal ${suc.nombre_sucursal}: ${existingPedido.id}`);
          }
        }

        // Calculate totals - handling precio_por_kilo and tax-inclusive prices
        let totalIva = 0;
        let totalIeps = 0;
        let subtotalNeto = 0;

        validProducts.forEach(p => {
          // IMPORTANTE: Usar cantidad redondeada para todos los cálculos
          const cantidadEntera = Math.round(p.cantidad);
          // Calcular subtotal bruto según tipo de precio
          let lineSubtotal: number;
          if (p.precio_por_kilo) {
            // Productos precio por kilo: cantidad SIEMPRE en kilos
            lineSubtotal = cantidadEntera * (p.precio_unitario || 0);
          } else if (p.kg_por_unidad) {
            // Productos por bulto/caja con kg_por_unidad definido
            lineSubtotal = cantidadEntera * p.kg_por_unidad * (p.precio_unitario || 0);
          } else {
            // Productos normales por pieza/caja
            lineSubtotal = cantidadEntera * (p.precio_unitario || 0);
          }

          // Desagregar impuestos (precios ya incluyen impuestos)
          let divisor = 1;
          if (p.aplica_iva) divisor += 0.16;
          if (p.aplica_ieps) divisor += 0.08;
          
          const baseNeto = lineSubtotal / divisor;
          const ivaLinea = p.aplica_iva ? baseNeto * 0.16 : 0;
          const iepsLinea = p.aplica_ieps ? baseNeto * 0.08 : 0;

          subtotalNeto += baseNeto;
          totalIva += ivaLinea;
          totalIeps += iepsLinea;
        });

        const subtotal = Math.round(subtotalNeto * 100) / 100;
        const impuestos = Math.round((totalIva + totalIeps) * 100) / 100;
        const total = subtotal + impuestos;

        if (existingPedido) {
          // UPDATE EXISTING ORDER - Add/update products
          console.log(`→ UPDATING existing order ${existingPedido.id}`);
          
          // Fetch existing products
          const { data: existingDetalles } = await supabase
            .from("pedidos_detalles")
            .select("*")
            .eq("pedido_id", existingPedido.id);

          // Merge products: update quantities if product exists, add if new
          for (const newProd of validProducts) {
            const cantidadEntera = Math.round(newProd.cantidad);
            let lineSubtotal: number;
            if (newProd.precio_por_kilo) {
              lineSubtotal = cantidadEntera * (newProd.precio_unitario || 0);
            } else if (newProd.kg_por_unidad) {
              lineSubtotal = cantidadEntera * newProd.kg_por_unidad * (newProd.precio_unitario || 0);
            } else {
              lineSubtotal = cantidadEntera * (newProd.precio_unitario || 0);
            }

            const existingDetalle = existingDetalles?.find(d => d.producto_id === newProd.producto_id);
            
            if (existingDetalle) {
              // Update existing product - ADD quantities
              const nuevaCantidad = existingDetalle.cantidad + cantidadEntera;
              const nuevoSubtotal = Math.round(
                (existingDetalle.subtotal + lineSubtotal) * 100
              ) / 100;
              
              await supabase
                .from("pedidos_detalles")
                .update({
                  cantidad: nuevaCantidad,
                  subtotal: nuevoSubtotal,
                })
                .eq("id", existingDetalle.id);
              
              console.log(`  ↳ Updated product ${newProd.producto_id}: ${existingDetalle.cantidad} + ${cantidadEntera} = ${nuevaCantidad}`);
            } else {
              // Insert new product
              await supabase
                .from("pedidos_detalles")
                .insert({
                  pedido_id: existingPedido.id,
                  producto_id: newProd.producto_id!,
                  cantidad: cantidadEntera,
                  precio_unitario: newProd.precio_unitario || 0,
                  subtotal: Math.round(lineSubtotal * 100) / 100,
                });
              
              console.log(`  ↳ Added new product ${newProd.producto_id}: ${cantidadEntera}`);
            }
          }

          // Update pedido totals - ADD to existing totals
          const updatedSubtotal = existingPedido.subtotal + subtotal;
          const updatedImpuestos = existingPedido.impuestos + impuestos;
          const updatedTotal = existingPedido.total + total;

          await supabase
            .from("pedidos")
            .update({
              subtotal: Math.round(updatedSubtotal * 100) / 100,
              impuestos: Math.round(updatedImpuestos * 100) / 100,
              total: Math.round(updatedTotal * 100) / 100,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingPedido.id);

          ordersUpdated++;
        } else {
          // CREATE NEW ORDER
          console.log(`→ CREATING new order for ${suc.nombre_sucursal}`);
          
          // Generate folio
          const currentDate = new Date();
          const yearMonth = `${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
          const { data: lastPedido } = await supabase
            .from("pedidos")
            .select("folio")
            .like("folio", `PED-${yearMonth}-%`)
            .order("folio", { ascending: false })
            .limit(1)
            .single();

          let nextNumber = 1;
          if (lastPedido?.folio) {
            const lastNum = parseInt(lastPedido.folio.split('-')[2], 10);
            nextNumber = lastNum + 1;
          }
          const folio = `PED-${yearMonth}-${String(nextNumber).padStart(4, '0')}`;

          // Create pedido
          const { data: pedido, error: pedidoError } = await supabase
            .from("pedidos")
            .insert({
              folio,
              cliente_id: selectedClienteId,
              sucursal_id: suc.sucursal_id || null,
              vendedor_id: userData.user.id,
              fecha_pedido: today,
              fecha_entrega_estimada: suc.fecha_entrega_solicitada || null,
              subtotal,
              impuestos,
              total,
              status: "pendiente",
              notas: parsedOrder.notas_generales 
                ? `[Desde correo] ${parsedOrder.notas_generales}` 
                : `[Procesado desde correo: ${emailSubject}]`,
            })
            .select()
            .single();

          if (pedidoError) throw pedidoError;

          // Create pedido detalles - calcular subtotal según tipo de producto
          const detalles = validProducts.map(p => {
            // IMPORTANTE: Redondear cantidad a entero para la base de datos
            const cantidadEntera = Math.round(p.cantidad);
            let lineSubtotal: number;
            if (p.precio_por_kilo && p.kg_por_unidad) {
              lineSubtotal = cantidadEntera * p.kg_por_unidad * (p.precio_unitario || 0);
            } else {
              lineSubtotal = cantidadEntera * (p.precio_unitario || 0);
            }
            return {
              pedido_id: pedido.id,
              producto_id: p.producto_id!,
              cantidad: cantidadEntera,
              precio_unitario: p.precio_unitario || 0,
              subtotal: Math.round(lineSubtotal * 100) / 100,
            };
          });

          const { error: detallesError } = await supabase
            .from("pedidos_detalles")
            .insert(detalles);

          if (detallesError) throw detallesError;

          ordersCreated++;
        }
      }

      const successMessage = ordersUpdated > 0
        ? `${ordersCreated} pedido(s) nuevo(s) + ${ordersUpdated} pedido(s) actualizado(s)`
        : `${ordersCreated} pedido(s) creado(s)`;

      toast({
        title: "Pedidos procesados",
        description: successMessage,
      });

      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Error creating orders:", err);
      toast({
        title: "Error",
        description: err.message || "No se pudieron crear los pedidos",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const updateProductMatch = (sucIndex: number, prodIndex: number, productoId: string) => {
    if (!parsedOrder) return;
    
    const producto = productos?.find(p => p.id === productoId);
    if (!producto) return;

    // Nombre "cliente" que viene del correo (ej: "azucar de segunda")
    const targetName = parsedOrder.sucursales[sucIndex].productos[prodIndex].nombre_producto;

    const updated: ParsedOrder = {
      ...parsedOrder,
      sucursales: parsedOrder.sucursales.map((suc) => ({
        ...suc,
        productos: suc.productos.map((prod) => {
          // Aplicar el mismo match a TODAS las líneas con el mismo nombre del correo
          if (prod.nombre_producto === targetName && (!prod.producto_id || prod.producto_id === productoId)) {
            return {
              ...prod,
              producto_id: productoId,
              precio_unitario: producto.precio_venta,
              // FUENTE DE VERDAD: Base de datos
              precio_por_kilo: producto.precio_por_kilo,
              kg_por_unidad: producto.kg_por_unidad,
              aplica_iva: producto.aplica_iva,
              aplica_ieps: producto.aplica_ieps,
              unidad: producto.unidad,
              unidad_comercial: producto.unidad,
            };
          }

          return prod;
        }),
      })),
    };

    setParsedOrder(updated);
  };
  const updateProductQuantity = (sucIndex: number, prodIndex: number, cantidad: number) => {
    if (!parsedOrder) return;
    const updated = { ...parsedOrder };
    updated.sucursales[sucIndex].productos[prodIndex].cantidad = cantidad;
    setParsedOrder(updated);
  };
 
  const getDisplayUnit = (prod: ParsedProduct): string => {
    // FUENTE DE VERDAD: Base de datos
    // Si el precio es por kilo, SIEMPRE mostrar kilos (sin importar la unidad comercial)
    if (prod.precio_por_kilo) return "kg";

    // Si no es precio por kilo, usar la unidad comercial del catálogo
    const producto = productos?.find((p) => p.id === prod.producto_id);
    return producto?.unidad || prod.unidad || prod.unidad_comercial || "";
  };
 
  const updateProductPrice = (sucIndex: number, prodIndex: number, precio: number) => {
    if (!parsedOrder) return;
    const updated = { ...parsedOrder };
    updated.sucursales[sucIndex].productos[prodIndex].precio_unitario = precio;
    setParsedOrder(updated);
  };
 
  const removeProduct = (sucIndex: number, prodIndex: number) => {
    if (!parsedOrder) return;
    const updated = { ...parsedOrder };
    updated.sucursales[sucIndex].productos.splice(prodIndex, 1);
    setParsedOrder(updated);
  };
 
  const updateSucursalMatch = (sucIndex: number, sucursalId: string) => {
    if (!parsedOrder) return;
    const updated = { ...parsedOrder };
    updated.sucursales[sucIndex].sucursal_id = sucursalId;
    setParsedOrder(updated);
  };
 
  // VALIDACIÓN ESTRICTA - Contar productos coincidentes vs sin resolver
  const { matchedCount, unmatchedCount } = useMemo(() => {
    if (!parsedOrder) return { matchedCount: 0, unmatchedCount: 0 };
    let matched = 0;
    let unmatched = 0;
    for (const suc of parsedOrder.sucursales) {
      for (const prod of suc.productos) {
        if (prod.producto_id) {
          matched++;
        } else {
          unmatched++;
        }
      }
    }
    return { matchedCount: matched, unmatchedCount: unmatched };
  }, [parsedOrder]);

  const hasUnmatchedProducts = unmatchedCount > 0;
  const totalProducts = matchedCount;
  const canCreateOrders = !hasUnmatchedProducts && totalProducts > 0;

  // Progressive rendering - only show visibleCount sucursales
  const visibleSucursales = useMemo(() => {
    if (!parsedOrder) return [];
    return parsedOrder.sucursales.slice(0, visibleCount);
  }, [parsedOrder, visibleCount]);

  const hasMoreSucursales = parsedOrder ? visibleCount < parsedOrder.sucursales.length : false;
  const remainingCount = parsedOrder ? parsedOrder.sucursales.length - visibleCount : 0;

  const loadMoreSucursales = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + BATCH_SIZE, parsedOrder?.sucursales.length || 0));
  }, [parsedOrder?.sucursales.length]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Procesar Pedido desde Correo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cliente selector */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes?.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.codigo} - {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cotización selector */}
          {selectedClienteId && cotizacionesRecientes && cotizacionesRecientes.length > 0 && (
            <div className="space-y-2">
              <Label>Vincular a cotización (opcional)</Label>
              <Select value={selectedCotizacionId} onValueChange={setSelectedCotizacionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Usar todas las cotizaciones recientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Usar todas las cotizaciones recientes</SelectItem>
                  {cotizacionesRecientes.map(cot => (
                    <SelectItem key={cot.id} value={cot.id}>
                      {cot.folio} - {cot.nombre || new Date(cot.fecha_creacion).toLocaleDateString('es-MX')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCotizacionId && selectedCotizacionId !== "__all__" && (
                <p className="text-xs text-muted-foreground">
                  Se usarán los productos y precios de esta cotización específica
                </p>
              )}
            </div>
          )}

          {/* Parse button */}
          {/* Alerta de correo ya procesado */}
          {emailAlreadyProcessed && (
            <div className="p-4 bg-amber-50 border-2 border-amber-500 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-amber-800 font-semibold">
                <AlertCircle className="h-5 w-5" />
                <span>⚠️ Este correo ya fue procesado</span>
              </div>
              <p className="text-sm text-amber-700">
                Este correo ya generó los siguientes pedidos:
              </p>
              <div className="space-y-2">
                {processedOrdersInfo.map((info, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="bg-white">
                      {info.folio}
                    </Badge>
                    <span className="text-amber-600">({info.tipo})</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-amber-700 font-medium">
                Si procesas este correo nuevamente, crearás pedidos duplicados.
              </p>
            </div>
          )}

          {!parsedOrder && (
            <Button 
              onClick={handleParse} 
              disabled={parsing || !selectedClienteId || emailAlreadyProcessed}
              className="w-full"
            >
              {parsing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analizando correo con IA...
                </>
              ) : emailAlreadyProcessed ? (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Correo Ya Procesado
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analizar Correo
                </>
              )}
            </Button>
          )}

          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Parsed results */}
          {parsedOrder && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {/* VALIDACIÓN DETERMINISTA - Sin porcentajes, solo estados claros */}
                <div className="p-3 rounded-lg border space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    {matchedCount > 0 && (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {matchedCount} productos coinciden exactamente
                      </Badge>
                    )}
                    {unmatchedCount > 0 && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {unmatchedCount} requieren selección manual
                      </Badge>
                    )}
                  </div>
                  {hasUnmatchedProducts && (
                    <p className="text-sm text-destructive font-medium">
                      ⚠️ No se puede crear el pedido hasta resolver todos los productos marcados en rojo
                    </p>
                  )}
                  {!hasUnmatchedProducts && matchedCount > 0 && (
                    <p className="text-sm text-green-600 font-medium">
                      ✓ Todos los productos coinciden - Listo para crear pedido
                    </p>
                  )}
                </div>

                {/* Sucursales - Progressive rendering */}
                {visibleSucursales.map((suc, sucIndex) => {
                  const willUpdate = suc.sucursal_id && existingOrders.has(suc.sucursal_id);
                  const existingOrder = suc.sucursal_id ? existingOrders.get(suc.sucursal_id) : undefined;
                  
                  return (
                  <Card key={sucIndex}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        <Building2 className="h-4 w-4" />
                        {suc.nombre_sucursal}
                        
                        {/* Action badge - CREATE or UPDATE */}
                        {suc.sucursal_id ? (
                          willUpdate ? (
                            <Badge className="bg-amber-500 hover:bg-amber-600">
                              ACTUALIZAR PEDIDO {existingOrder?.folio}
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-500 hover:bg-blue-600">
                              CREAR NUEVO PEDIDO
                            </Badge>
                          )
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            SUCURSAL NO ENCONTRADA
                          </Badge>
                        )}
                        
                        <Badge variant="outline" className="ml-auto">
                          {sucIndex + 1}/{parsedOrder?.sucursales.length}
                        </Badge>
                      </CardTitle>
                      {sucursales && sucursales.length > 0 && (
                        <Select 
                          value={suc.sucursal_id || ""} 
                          onValueChange={(v) => updateSucursalMatch(sucIndex, v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Vincular a sucursal registrada..." />
                          </SelectTrigger>
                          <SelectContent>
                            {sucursales.map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="space-y-2">
                        {suc.productos.map((prod, prodIndex) => {
                          const isUnmatched = !prod.producto_id;
                          return (
                          <div 
                            key={prodIndex} 
                            className={`flex items-center gap-2 p-2 rounded-md border ${
                              isUnmatched 
                                ? 'bg-destructive/10 border-destructive' 
                                : 'bg-muted/50 border-transparent'
                            }`}
                          >
                            <Package className={`h-4 w-4 shrink-0 ${isUnmatched ? 'text-destructive' : 'text-muted-foreground'}`} />
                            
                            {/* Product selector */}
                            <Select
                              value={prod.producto_id || ""}
                              onValueChange={(v) => updateProductMatch(sucIndex, prodIndex, v)}
                            >
                              <SelectTrigger className={`flex-1 min-w-[200px] ${isUnmatched ? 'border-destructive' : ''}`}>
                                <SelectValue placeholder={`⚠️ ${prod.nombre_producto} - SELECCIONAR`} />
                              </SelectTrigger>
                              <SelectContent>
                                {productos?.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.codigo} - {p.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Quantity */}
                            <Input
                              type="number"
                              value={prod.cantidad}
                              onChange={(e) => updateProductQuantity(sucIndex, prodIndex, parseFloat(e.target.value) || 0)}
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground w-16">
                              {getDisplayUnit(prod)}
                            </span>

                            {/* Price */}
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-muted-foreground">$</span>
                              <Input
                                type="number"
                                value={prod.precio_unitario || ""}
                                onChange={(e) => updateProductPrice(sucIndex, prodIndex, parseFloat(e.target.value) || 0)}
                                className="w-24"
                                placeholder="Precio"
                              />
                            </div>

                            {/* Status indicator */}
                            {prod.producto_id ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                            )}

                            {/* Remove button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeProduct(sucIndex, prodIndex)}
                              className="h-8 w-8 shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )})}
                      </div>
                    </CardContent>
                  </Card>
                )})}

                {/* Load more button */}
                {hasMoreSucursales && (
                  <Button 
                    variant="outline" 
                    onClick={loadMoreSucursales}
                    className="w-full"
                  >
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Cargar {Math.min(BATCH_SIZE, remainingCount)} sucursales más ({remainingCount} restantes)
                  </Button>
                )}

                {/* Notes */}
                {parsedOrder.notas_generales && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      <strong>Notas:</strong> {parsedOrder.notas_generales}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <Separator />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {parsedOrder && acumulativoMode && (
            <Button
              onClick={handleAddToAcumulativo}
              disabled={creating || !canCreateOrders}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Agregar a Pedido Acumulativo
                </>
              )}
            </Button>
          )}
          {parsedOrder && !acumulativoMode && (
            <Button
              onClick={handleCreateOrders}
              disabled={creating || !canCreateOrders}
              variant={hasUnmatchedProducts ? "outline" : "default"}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar y {existingOrders.size > 0 ? 'Crear/Actualizar' : 'Crear'} Pedidos
                </>
              )}
            </Button>
          )}
         </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
