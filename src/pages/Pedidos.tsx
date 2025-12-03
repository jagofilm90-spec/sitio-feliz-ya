import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, ShoppingCart, FileText, Link2, Printer, Receipt, Send, CheckCircle2, Clock, BarChart3, Trash2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import CotizacionesTab from "@/components/cotizaciones/CotizacionesTab";
import CotizacionesAnalyticsTab from "@/components/cotizaciones/CotizacionesAnalyticsTab";
import { PedidosPorAutorizarTab } from "@/components/pedidos/PedidosPorAutorizarTab";
import CotizacionDetalleDialog from "@/components/cotizaciones/CotizacionDetalleDialog";
import { ImprimirRemisionDialog } from "@/components/remisiones/ImprimirRemisionDialog";
import EditarEmailClienteDialog from "@/components/pedidos/EditarEmailClienteDialog";
import NuevoPedidoDialog from "@/components/pedidos/NuevoPedidoDialog";
import PedidoDetalleDialog from "@/components/pedidos/PedidoDetalleDialog";
import { formatCurrency } from "@/lib/utils";

interface PedidoConCotizacion {
  id: string;
  folio: string;
  fecha_pedido: string;
  total: number;
  peso_total_kg: number | null;
  status: string;
  requiere_factura: boolean;
  facturado: boolean;
  factura_enviada_al_cliente: boolean;
  clientes: { id: string; nombre: string; email: string | null } | null;
  profiles: { full_name: string } | null;
  cotizacion_origen?: { id: string; folio: string } | null;
  sucursal?: { nombre: string; email_facturacion: string | null; codigo_sucursal: string | null } | null;
}

const Pedidos = () => {
  const [pedidos, setPedidos] = useState<PedidoConCotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pedidos");
  const [selectedCotizacionId, setSelectedCotizacionId] = useState<string | null>(null);
  const [remisionDialogOpen, setRemisionDialogOpen] = useState(false);
  const [selectedPedidoData, setSelectedPedidoData] = useState<any>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedPedidoForEmail, setSelectedPedidoForEmail] = useState<PedidoConCotizacion | null>(null);
  const [nuevoPedidoDialogOpen, setNuevoPedidoDialogOpen] = useState(false);
  const [selectedPedidoId, setSelectedPedidoId] = useState<string | null>(null);
  const [pedidoDetalleOpen, setPedidoDetalleOpen] = useState(false);
  const [selectedPedidos, setSelectedPedidos] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadPedidos();
  }, []);

  const loadPedidos = async () => {
    try {
      // First get pedidos
      const { data: pedidosData, error: pedidosError } = await supabase
        .from("pedidos")
        .select(`
          id,
          folio,
          fecha_pedido,
          total,
          peso_total_kg,
          status,
          requiere_factura,
          facturado,
          factura_enviada_al_cliente,
          sucursal_id,
          clientes (id, nombre, email),
          profiles:vendedor_id (full_name),
          cliente_sucursales:sucursal_id (nombre, email_facturacion, codigo_sucursal)
        `)
        .order("fecha_pedido", { ascending: false });

      if (pedidosError) throw pedidosError;

      // Get cotizaciones that have pedido_id (created from cotizacion)
      const { data: cotizacionesData, error: cotizacionesError } = await supabase
        .from("cotizaciones")
        .select("id, folio, pedido_id")
        .not("pedido_id", "is", null);

      if (cotizacionesError) throw cotizacionesError;

      // Create map of pedido_id to cotizacion
      const cotizacionMap = new Map<string, { id: string; folio: string }>();
      cotizacionesData?.forEach((cot) => {
        if (cot.pedido_id) {
          cotizacionMap.set(cot.pedido_id, { id: cot.id, folio: cot.folio });
        }
      });

      // Merge data
      const pedidosConCotizacion: PedidoConCotizacion[] = (pedidosData || []).map((p: any) => ({
        ...p,
        cotizacion_origen: cotizacionMap.get(p.id) || null,
        sucursal: p.cliente_sucursales,
      }));

      // Ordenar por código de sucursal (numérico)
      pedidosConCotizacion.sort((a, b) => {
        const codigoA = a.sucursal?.codigo_sucursal || '';
        const codigoB = b.sucursal?.codigo_sucursal || '';
        
        // Extraer números del código
        const numA = parseInt(codigoA) || 0;
        const numB = parseInt(codigoB) || 0;
        
        return numA - numB;
      });

      setPedidos(pedidosConCotizacion);
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

  const filteredPedidos = pedidos.filter(
    (p) =>
      p.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.clientes?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cotizacion_origen?.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sucursal?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPedidos(new Set(filteredPedidos.map(p => p.id)));
    } else {
      setSelectedPedidos(new Set());
    }
  };

  const handleSelectPedido = (pedidoId: string, checked: boolean) => {
    const newSelected = new Set(selectedPedidos);
    if (checked) {
      newSelected.add(pedidoId);
    } else {
      newSelected.delete(pedidoId);
    }
    setSelectedPedidos(newSelected);
  };

  // Navegación entre pedidos
  const handleNavigateNextPedido = () => {
    if (!selectedPedidoId) return;
    const currentIndex = filteredPedidos.findIndex(p => p.id === selectedPedidoId);
    if (currentIndex < filteredPedidos.length - 1) {
      setSelectedPedidoId(filteredPedidos[currentIndex + 1].id);
    }
  };

  const handleNavigatePreviousPedido = () => {
    if (!selectedPedidoId) return;
    const currentIndex = filteredPedidos.findIndex(p => p.id === selectedPedidoId);
    if (currentIndex > 0) {
      setSelectedPedidoId(filteredPedidos[currentIndex - 1].id);
    }
  };

  const currentPedidoIndex = selectedPedidoId 
    ? filteredPedidos.findIndex(p => p.id === selectedPedidoId)
    : -1;
  const canNavigateNext = currentPedidoIndex >= 0 && currentPedidoIndex < filteredPedidos.length - 1;
  const canNavigatePrevious = currentPedidoIndex > 0;

  const handleDeleteSelected = async () => {
    if (selectedPedidos.size === 0) return;
    
    setDeleting(true);
    try {
      const ids = Array.from(selectedPedidos);
      
      // Delete related records first
      await supabase.from("pedidos_detalles").delete().in("pedido_id", ids);
      await supabase.from("entregas").delete().in("pedido_id", ids);
      
      // Delete pedidos
      const { error } = await supabase.from("pedidos").delete().in("id", ids);
      
      if (error) throw error;
      
      toast({
        title: "Pedidos eliminados",
        description: `Se eliminaron ${ids.length} pedido(s) correctamente`,
      });
      
      setSelectedPedidos(new Set());
      loadPedidos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron eliminar los pedidos",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const allSelected = filteredPedidos.length > 0 && filteredPedidos.every(p => selectedPedidos.has(p.id));
  const someSelected = filteredPedidos.some(p => selectedPedidos.has(p.id));

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      por_autorizar: "outline",
      pendiente: "secondary",
      en_ruta: "default",
      entregado: "default",
      cancelado: "destructive",
    };

    const labels: Record<string, string> = {
      por_autorizar: "Por Autorizar",
      pendiente: "Pendiente",
      en_ruta: "En Ruta",
      entregado: "Entregado",
      cancelado: "Cancelado",
    };

    return (
      <Badge variant={variants[status] || "default"} className={status === "por_autorizar" ? "border-amber-500 text-amber-600" : ""}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getFacturaBadge = (pedido: PedidoConCotizacion) => {
    if (pedido.factura_enviada_al_cliente) {
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle2 className="h-3 w-3" />
          Enviada
        </Badge>
      );
    }
    if (pedido.facturado) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Por enviar
        </Badge>
      );
    }
    if (pedido.requiere_factura) {
      return (
        <Badge variant="outline" className="gap-1">
          <FileText className="h-3 w-3" />
          Pendiente
        </Badge>
      );
    }
    return (
      <span className="text-muted-foreground text-xs">Remisión</span>
    );
  };

  const getCreditLabel = (term: string) => {
    const labels: Record<string, string> = {
      contado: "Contado",
      "8_dias": "8 días",
      "15_dias": "15 días",
      "30_dias": "30 días",
    };
    return labels[term] || term;
  };

  const handleFacturarPedido = async (pedidoId: string) => {
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ facturado: true })
        .eq("id", pedidoId);

      if (error) throw error;

      toast({ title: "Pedido marcado como facturado" });
      loadPedidos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo facturar el pedido",
        variant: "destructive",
      });
    }
  };

  const getEmailForPedido = (pedido: PedidoConCotizacion): string | null => {
    // First check sucursal email_facturacion
    if (pedido.sucursal?.email_facturacion) {
      return pedido.sucursal.email_facturacion;
    }
    // Fall back to client email
    if (pedido.clientes?.email) {
      return pedido.clientes.email;
    }
    return null;
  };

  const handleEnviarFactura = async (pedido: PedidoConCotizacion) => {
    const email = getEmailForPedido(pedido);
    
    if (!email) {
      setSelectedPedidoForEmail(pedido);
      setEmailDialogOpen(true);
      return;
    }

    try {
      // Call edge function to send email
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          pedidoId: pedido.id,
          clienteEmail: email,
          clienteNombre: pedido.clientes?.nombre || 'Cliente',
          pedidoFolio: pedido.folio,
          total: pedido.total,
          fechaPedido: pedido.fecha_pedido,
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Error al enviar factura');
      }

      toast({ 
        title: "Factura enviada",
        description: `Se envió la factura a ${email}`,
      });
      loadPedidos();
    } catch (error: any) {
      console.error('Error sending invoice:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar la factura",
        variant: "destructive",
      });
    }
  };

  const handlePrintRemision = async (pedidoId: string) => {
    try {
      // Fetch full pedido data
      const { data: pedido, error } = await supabase
        .from("pedidos")
        .select(`
          *,
          clientes (
            id, nombre, codigo, rfc, direccion, telefono, termino_credito
          ),
          cliente_sucursales (
            id, nombre, direccion
          ),
          profiles:vendedor_id (
            full_name
          ),
          pedidos_detalles (
            id, cantidad, precio_unitario, subtotal, unidades_manual,
            productos (
              id, codigo, nombre, marca, presentacion, unidad, aplica_iva, kg_por_unidad, precio_por_kilo
            )
          )
        `)
        .eq("id", pedidoId)
        .single();

      if (error) throw error;

      // Prepare data for remision
      // Detectar si es cliente Lecaroz para reglas especiales de presentación
      const esLecaroz = pedido.clientes?.nombre?.toLowerCase().includes('lecaroz');
      
      // Función para pluralizar correctamente en español
      const pluralizar = (unidad: string, cantidad: number): string => {
        if (cantidad === 1) return unidad;
        if (unidad === 'balón') return 'balones';
        if (unidad.endsWith('z')) return unidad.slice(0, -1) + 'ces';
        return unidad + 's';
      };
      
      // Función para formatear cantidad manteniendo decimales
      const formatearCantidad = (cantidad: number): string => {
        return cantidad % 1 === 0 ? String(cantidad) : cantidad.toFixed(2);
      };
      
      const productos = pedido.pedidos_detalles.map((detalle: any) => {
        const producto = detalle.productos;
        const descripcion = `${producto.nombre}${producto.marca ? ` ${producto.marca}` : ''}${producto.presentacion ? ` (${producto.presentacion}KG)` : ''}`;
        const nombreLower = producto.nombre.toLowerCase();
        const cantidadNum = Number(detalle.cantidad);
        
        // Calcular presentación para bodegueros - SIEMPRE en unidades comerciales, nunca solo kg
        let presentacion = "";
        let unidadComercial = producto.unidad || 'pza';
        
        // Reglas especiales para Lecaroz
        if (esLecaroz) {
          // Anís y Canela Molida siempre se muestran como "bolsa"
          if (nombreLower.includes('anís') || nombreLower.includes('anis') || nombreLower.includes('canela molida')) {
            unidadComercial = 'bolsa';
          }
          
          // Arándano Nutri Grand y Avellana Sin Cascara siempre se muestran como "caja"
          if (nombreLower.includes('arándano') || nombreLower.includes('arandano') || nombreLower.includes('avellana')) {
            unidadComercial = 'caja';
          }
        }
        
        // Regla especial para Coco: siempre caja con 20 kg
        if (nombreLower.includes('coco')) {
          unidadComercial = 'caja';
        }
        
        // *** REGLA ESPECIAL LINAZA: Redondear kg a múltiplos de 10 ***
        // Residuo 1-5 kg redondea abajo, residuo 6-9 kg redondea arriba
        // Ejemplo: 21-25kg → 20kg (2 bultos), 26-29kg → 30kg (3 bultos)
        let cantidadParaCalculo = cantidadNum;
        if (nombreLower.includes('linaza')) {
          cantidadParaCalculo = Math.floor((cantidadNum + 4) / 10) * 10;
        }
        
        // Mostrar cantidad con su unidad original - SIN REDONDEAR (excepto Linaza)
        let cantidadDisplay = "";
        if (producto.precio_por_kilo) {
          // Para Linaza, mostrar kg redondeados
          cantidadDisplay = nombreLower.includes('linaza') 
            ? `${formatearCantidad(cantidadParaCalculo)} kg`
            : `${formatearCantidad(cantidadNum)} kg`;
        } else {
          cantidadDisplay = `${formatearCantidad(cantidadNum)} ${pluralizar(unidadComercial, cantidadNum)}`;
        }
        
        // *** PRIORIDAD MÁXIMA: Si tiene unidades_manual guardadas, usarlas directamente ***
        if (detalle.unidades_manual && detalle.unidades_manual > 0) {
          presentacion = `${detalle.unidades_manual} ${pluralizar(unidadComercial, detalle.unidades_manual)}`;
        }
        // *** REGLA ESPECIAL LINAZA: 10 kg por bulto ***
        else if (nombreLower.includes('linaza')) {
          const numBultos = cantidadParaCalculo / 10;
          presentacion = `${numBultos} ${pluralizar('bulto', numBultos)}`;
        }
        // Calcular presentación para bodegueros - SIEMPRE unidades comerciales, SIN "de X kg"
        // Regla especial para ALMENDRA FILETEADA (11.34 kg/caja) - PRIORIDAD ALTA
        else if (nombreLower.includes('almendra fileteada')) {
          const kgPorCaja = producto.kg_por_unidad || 11.34;
          const numCajas = Math.ceil(cantidadNum / kgPorCaja);
          presentacion = `${numCajas} ${pluralizar('caja', numCajas)}`;
        }
        // Regla especial para COCO RALLADO LAS PALMAS (20 kg/caja)
        else if (nombreLower.includes('coco rallado') || nombreLower.includes('coco')) {
          const kgPorCaja = producto.kg_por_unidad || 20;
          const numCajas = Math.ceil(cantidadNum / kgPorCaja);
          presentacion = `${numCajas} ${pluralizar('caja', numCajas)}`;
        }
        // Regla especial Lecaroz: Arándano y Avellana
        else if (esLecaroz && (nombreLower.includes('arándano') || nombreLower.includes('arandano') || nombreLower.includes('avellana'))) {
          const kgPorCaja = producto.kg_por_unidad || 11.34;
          const numCajas = Math.ceil(cantidadNum / kgPorCaja);
          presentacion = `${numCajas} ${pluralizar('caja', numCajas)}`;
        }
        // Producto vendido por kilo con conversión conocida
        else if (producto.precio_por_kilo && producto.kg_por_unidad && producto.kg_por_unidad > 0) {
          const unidadesComerciales = Math.ceil(cantidadNum / producto.kg_por_unidad);
          presentacion = `${unidadesComerciales} ${pluralizar(unidadComercial, unidadesComerciales)}`;
        } 
        // Producto vendido por kilo sin conversión fija - SOLO mostrar unidad, SIN "de X kg"
        else if (producto.precio_por_kilo && (!producto.kg_por_unidad || producto.kg_por_unidad === 0)) {
          presentacion = `1 ${unidadComercial}`;
        } 
        // Producto vendido por unidad comercial directamente
        else {
          presentacion = `${Math.round(cantidadNum)} ${pluralizar(unidadComercial, cantidadNum)}`;
        }
        
        return {
          cantidad: detalle.cantidad,
          cantidadDisplay, // Cantidad con unidad original (ej: "45 kg")
          unidad: presentacion, // Presentación calculada para bodegueros (ej: "2 cajas")
          descripcion,
          precio_unitario: detalle.precio_unitario,
          total: detalle.subtotal,
        };
      });

      let subtotalConIva = 0;
      let subtotalSinIva = 0;
      
      pedido.pedidos_detalles.forEach((detalle: any) => {
        if (detalle.productos?.aplica_iva) {
          subtotalConIva += detalle.subtotal;
        } else {
          subtotalSinIva += detalle.subtotal;
        }
      });

      const baseConIva = subtotalConIva / 1.16;
      const ivaCalculado = subtotalConIva - baseConIva;
      const subtotalReal = baseConIva + subtotalSinIva;

      const datosRemision = {
        folio: `REM-${pedido.folio}`,
        fecha: pedido.fecha_pedido,
        cliente: {
          nombre: pedido.clientes?.nombre || 'Sin nombre',
          rfc: pedido.clientes?.rfc,
          direccion_fiscal: pedido.clientes?.direccion,
          telefono: pedido.clientes?.telefono,
        },
        sucursal: pedido.cliente_sucursales ? {
          nombre: pedido.cliente_sucursales.nombre,
          direccion: pedido.cliente_sucursales.direccion,
        } : undefined,
        productos,
        subtotal: subtotalReal,
        iva: ivaCalculado,
        total: pedido.total || (subtotalReal + ivaCalculado),
        condiciones_credito: getCreditLabel(pedido.clientes?.termino_credito || 'contado'),
        vendedor: pedido.profiles?.full_name,
        notas: pedido.notas,
      };

      setSelectedPedidoData(datosRemision);
      setRemisionDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo cargar el pedido para imprimir",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pedidos y Cotizaciones</h1>
          <p className="text-muted-foreground">
            Gestión de pedidos de clientes y cotizaciones
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="por-autorizar" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              Por Autorizar
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="cotizaciones" className="gap-2">
              <FileText className="h-4 w-4" />
              Cotizaciones
            </TabsTrigger>
            <TabsTrigger value="analisis" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Análisis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pedidos" className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por folio o cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {selectedPedidos.size > 0 && (
                  <Button 
                    variant="destructive" 
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar ({selectedPedidos.size})
                  </Button>
                )}
              </div>
              <Button onClick={() => setNuevoPedidoDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Pedido
              </Button>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Seleccionar todos"
                      />
                    </TableHead>
                    <TableHead>Folio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Peso Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : filteredPedidos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center">
                        No hay pedidos registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPedidos.map((pedido) => (
                      <TableRow key={pedido.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedPedidos.has(pedido.id)}
                            onCheckedChange={(checked) => handleSelectPedido(pedido.id, !!checked)}
                            aria-label={`Seleccionar ${pedido.folio}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium font-mono">{pedido.folio}</TableCell>
                        <TableCell>{pedido.clientes?.nombre || "—"}</TableCell>
                        <TableCell className="text-sm">{pedido.sucursal?.nombre || "—"}</TableCell>
                        <TableCell>{pedido.profiles?.full_name || "—"}</TableCell>
                        <TableCell>
                          {new Date(pedido.fecha_pedido).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-mono">${formatCurrency(pedido.total)}</TableCell>
                        <TableCell className="font-mono">
                          {pedido.peso_total_kg ? (
                            <span className="text-sm">
                              {formatCurrency(pedido.peso_total_kg)} kg
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(pedido.status)}</TableCell>
                        <TableCell>{getFacturaBadge(pedido)}</TableCell>
                        <TableCell>
                          {pedido.cotizacion_origen ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1 text-primary hover:text-primary/80 p-1 h-auto"
                                    onClick={() => setSelectedCotizacionId(pedido.cotizacion_origen!.id)}
                                  >
                                    <Link2 className="h-3 w-3" />
                                    <span className="font-mono text-xs">{pedido.cotizacion_origen.folio}</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Ver cotización origen</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground text-xs">Directo</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => {
                                      setSelectedPedidoId(pedido.id);
                                      setPedidoDetalleOpen(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver detalles</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handlePrintRemision(pedido.id)}
                                  >
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Imprimir Remisión</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            {/* Facturar Pedido - Only show if not facturado */}
                            {!pedido.facturado && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => handleFacturarPedido(pedido.id)}
                                    >
                                      <Receipt className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Facturar Pedido</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            {/* Enviar Factura - Only show if facturado but not sent */}
                            {pedido.facturado && !pedido.factura_enviada_al_cliente && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => handleEnviarFactura(pedido)}
                                    >
                                      <Send className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Enviar Factura al Cliente</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="por-autorizar" className="mt-6">
            <PedidosPorAutorizarTab />
          </TabsContent>

          <TabsContent value="cotizaciones" className="mt-6">
            <CotizacionesTab />
          </TabsContent>

          <TabsContent value="analisis" className="mt-6">
            <CotizacionesAnalyticsTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog para ver cotización origen */}
      {selectedCotizacionId && (
        <CotizacionDetalleDialog
          cotizacionId={selectedCotizacionId}
          open={!!selectedCotizacionId}
          onOpenChange={(open) => !open && setSelectedCotizacionId(null)}
          onUpdate={() => loadPedidos()}
        />
      )}

      {/* Dialog para imprimir remisión */}
      <ImprimirRemisionDialog
        open={remisionDialogOpen}
        onOpenChange={setRemisionDialogOpen}
        datos={selectedPedidoData}
      />

      {/* Dialog para agregar email de cliente */}
      {selectedPedidoForEmail && (
        <EditarEmailClienteDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          clienteId={selectedPedidoForEmail.clientes?.id || ""}
          clienteNombre={selectedPedidoForEmail.clientes?.nombre || "Sin nombre"}
          sucursalId={selectedPedidoForEmail.sucursal ? undefined : undefined}
          onEmailUpdated={() => {
            loadPedidos();
            setSelectedPedidoForEmail(null);
          }}
        />
      )}

      <NuevoPedidoDialog
        open={nuevoPedidoDialogOpen}
        onOpenChange={setNuevoPedidoDialogOpen}
        onPedidoCreated={loadPedidos}
      />

      <PedidoDetalleDialog
        pedidoId={selectedPedidoId}
        open={pedidoDetalleOpen}
        onOpenChange={setPedidoDetalleOpen}
        onNavigateNext={handleNavigateNextPedido}
        onNavigatePrevious={handleNavigatePreviousPedido}
        canNavigateNext={canNavigateNext}
        canNavigatePrevious={canNavigatePrevious}
      />

      {/* Alert Dialog para confirmar eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente {selectedPedidos.size} pedido(s) seleccionado(s) 
              junto con sus detalles y entregas asociadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Pedidos;