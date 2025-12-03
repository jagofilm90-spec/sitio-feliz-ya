import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, ShoppingCart, Search, MapPin, Calendar, Star, ChevronDown, Package } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { calcularDesgloseImpuestos, redondear, validarAntesDeGuardar, LineaPedido } from "@/lib/calculos";
import { format, addDays, isWeekend } from "date-fns";
import { es } from "date-fns/locale";

interface ClienteNuevoPedidoProps {
  clienteId: string;
  limiteCredito: number;
  saldoPendiente: number;
}

interface DetalleProducto {
  productoId: string;
  nombre: string;
  codigo: string;
  unidad: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
  aplica_iva: boolean;
  aplica_ieps: boolean;
}

interface Sucursal {
  id: string;
  nombre: string;
  direccion: string;
  contacto: string | null;
  telefono: string | null;
}

interface ProductoFrecuente {
  id: string;
  producto_id: string;
  es_especial: boolean;
  ultimo_precio?: number;
  producto: {
    id: string;
    nombre: string;
    codigo: string;
    unidad: string;
    precio_venta: number;
    stock_actual: number;
    aplica_iva: boolean;
    aplica_ieps: boolean;
    kg_por_unidad: number | null;
    precio_por_kilo: boolean;
  };
}

const ClienteNuevoPedido = ({ clienteId, limiteCredito, saldoPendiente }: ClienteNuevoPedidoProps) => {
  const [productos, setProductos] = useState<any[]>([]);
  const [productosFrecuentes, setProductosFrecuentes] = useState<ProductoFrecuente[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [selectedSucursalId, setSelectedSucursalId] = useState<string>("");
  const [detalles, setDetalles] = useState<DetalleProducto[]>([]);
  const [notas, setNotas] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [especialesOpen, setEspecialesOpen] = useState(false);
  const [otrosOpen, setOtrosOpen] = useState(false);
  const { toast } = useToast();

  // Generate available delivery dates (next 7 business days)
  const fechasDisponibles = () => {
    const fechas: string[] = [];
    let date = addDays(new Date(), 1); // Start from tomorrow
    while (fechas.length < 7) {
      if (!isWeekend(date) || date.getDay() === 6) { // Monday-Saturday
        fechas.push(format(date, "yyyy-MM-dd"));
      }
      date = addDays(date, 1);
    }
    return fechas;
  };

  useEffect(() => {
    loadProductos();
    loadProductosFrecuentes();
    loadSucursales();
  }, [clienteId]);

  const loadProductos = async () => {
    try {
      const { data, error } = await supabase
        .from("productos")
        .select("id, nombre, codigo, unidad, precio_venta, stock_actual, aplica_iva, aplica_ieps, kg_por_unidad, precio_por_kilo")
        .eq("activo", true)
        .gt("stock_actual", 0)
        .order("nombre");

      if (error) throw error;
      setProductos(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos",
        variant: "destructive",
      });
    }
  };

  const loadProductosFrecuentes = async () => {
    try {
      // Get frequent products
      const { data, error } = await supabase
        .from("cliente_productos_frecuentes")
        .select(`
          id,
          producto_id,
          es_especial,
          producto:productos(id, nombre, codigo, unidad, precio_venta, stock_actual, aplica_iva, aplica_ieps, kg_por_unidad, precio_por_kilo)
        `)
        .eq("cliente_id", clienteId)
        .eq("activo", true)
        .order("orden_display");

      if (error) throw error;
      
      // Get last prices paid by this client for each product
      const { data: ultimosPrecios } = await supabase
        .from("pedidos_detalles")
        .select(`
          producto_id,
          precio_unitario,
          pedido:pedidos!inner(
            cliente_id,
            status,
            fecha_pedido
          )
        `)
        .eq("pedido.cliente_id", clienteId)
        .neq("pedido.status", "por_autorizar")
        .neq("pedido.status", "cancelado")
        .order("pedido(fecha_pedido)", { ascending: false });

      // Create a map of producto_id -> last price
      const preciosPorProducto: Record<string, number> = {};
      (ultimosPrecios || []).forEach((item: any) => {
        if (!preciosPorProducto[item.producto_id]) {
          preciosPorProducto[item.producto_id] = item.precio_unitario;
        }
      });

      setProductosFrecuentes((data || []).map(d => ({
        ...d,
        producto: d.producto as unknown as ProductoFrecuente['producto'],
        ultimo_precio: preciosPorProducto[d.producto_id]
      })));
    } catch (error: any) {
      console.error("Error loading frequent products:", error);
    }
  };

  const loadSucursales = async () => {
    try {
      const { data, error } = await supabase
        .from("cliente_sucursales")
        .select("id, nombre, direccion, contacto, telefono")
        .eq("cliente_id", clienteId)
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;
      
      const sucursalesData = data || [];
      setSucursales(sucursalesData);
      
      if (sucursalesData.length === 1) {
        setSelectedSucursalId(sucursalesData[0].id);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las sucursales",
        variant: "destructive",
      });
    }
  };

  const productosFiltrados = productos.filter(
    (p) =>
      (p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase())) &&
      !productosFrecuentes.some(pf => pf.producto_id === p.id)
  );

  const agregarProductoDesdeGrid = (item: ProductoFrecuente, cantidad: number) => {
    if (cantidad <= 0) return;
    
    const producto = item.producto;
    const precio = item.ultimo_precio || producto.precio_venta;
    const existe = detalles.find((d) => d.productoId === producto.id);
    
    if (existe) {
      actualizarCantidad(producto.id, cantidad);
      return;
    }

    const nuevoDetalle: DetalleProducto = {
      productoId: producto.id,
      nombre: producto.nombre,
      codigo: producto.codigo,
      unidad: producto.unidad,
      precioUnitario: precio,
      cantidad,
      subtotal: precio * cantidad,
      aplica_iva: producto.aplica_iva || false,
      aplica_ieps: producto.aplica_ieps || false,
    };

    setDetalles([...detalles, nuevoDetalle]);
  };

  const agregarProducto = (producto: any) => {
    const existe = detalles.find((d) => d.productoId === producto.id);
    
    if (existe) {
      toast({
        title: "Producto ya agregado",
        description: "Modifica la cantidad en la tabla",
        variant: "destructive",
      });
      return;
    }

    const nuevoDetalle: DetalleProducto = {
      productoId: producto.id,
      nombre: producto.nombre,
      codigo: producto.codigo,
      unidad: producto.unidad,
      precioUnitario: producto.precio_venta,
      cantidad: 1,
      subtotal: producto.precio_venta,
      aplica_iva: producto.aplica_iva || false,
      aplica_ieps: producto.aplica_ieps || false,
    };

    setDetalles([...detalles, nuevoDetalle]);
    setSearchTerm("");
  };

  const actualizarCantidad = (productoId: string, cantidad: number) => {
    if (cantidad <= 0) {
      eliminarProducto(productoId);
      return;
    }

    const existe = detalles.find(d => d.productoId === productoId);
    if (existe) {
      setDetalles(
        detalles.map((d) =>
          d.productoId === productoId
            ? { ...d, cantidad, subtotal: d.precioUnitario * cantidad }
            : d
        )
      );
    }
  };

  const eliminarProducto = (productoId: string) => {
    setDetalles(detalles.filter((d) => d.productoId !== productoId));
  };

  const getLineasPedido = (): LineaPedido[] => {
    return detalles.map(d => ({
      producto_id: d.productoId,
      nombre_producto: d.nombre,
      cantidad: d.cantidad,
      precio_unitario: d.precioUnitario,
      aplica_iva: d.aplica_iva,
      aplica_ieps: d.aplica_ieps
    }));
  };

  const calcularTotales = () => {
    let subtotalNeto = 0;
    let totalIva = 0;
    let totalIeps = 0;

    detalles.forEach((d) => {
      const resultado = calcularDesgloseImpuestos({
        precio_con_impuestos: d.subtotal,
        aplica_iva: d.aplica_iva,
        aplica_ieps: d.aplica_ieps,
        nombre_producto: d.nombre
      });
      subtotalNeto += resultado.base;
      totalIva += resultado.iva;
      totalIeps += resultado.ieps;
    });

    return { 
      subtotal: redondear(subtotalNeto), 
      iva: redondear(totalIva),
      ieps: redondear(totalIeps),
      impuestos: redondear(totalIva + totalIeps), 
      total: redondear(subtotalNeto + totalIva + totalIeps)
    };
  };

  const calcularPesoTotal = () => {
    let pesoTotal = 0;
    detalles.forEach(d => {
      const producto = productosFrecuentes.find(pf => pf.producto_id === d.productoId)?.producto;
      if (producto) {
        if (producto.precio_por_kilo) {
          pesoTotal += d.cantidad;
        } else {
          pesoTotal += d.cantidad * (producto.kg_por_unidad || 1);
        }
      } else {
        // Fallback: buscar en productos generales
        const prod = productos.find(p => p.id === d.productoId);
        if (prod) {
          if (prod.precio_por_kilo) {
            pesoTotal += d.cantidad;
          } else {
            pesoTotal += d.cantidad * (prod.kg_por_unidad || 1);
          }
        }
      }
    });
    return Math.round(pesoTotal * 100) / 100;
  };

  const validarCredito = () => {
    const { total } = calcularTotales();
    const creditoDisponible = limiteCredito - saldoPendiente;
    
    if (total > creditoDisponible) {
      toast({
        title: "Crédito insuficiente",
        description: `Tu crédito disponible es $${creditoDisponible.toFixed(2)}`,
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  const crearPedido = async () => {
    if (detalles.length === 0) {
      toast({
        title: "Pedido vacío",
        description: "Agrega al menos un producto al pedido",
        variant: "destructive",
      });
      return;
    }

    if (sucursales.length > 0 && !selectedSucursalId) {
      toast({
        title: "Selecciona una sucursal",
        description: "Debes seleccionar una sucursal de entrega",
        variant: "destructive",
      });
      return;
    }

    if (!fechaEntrega) {
      toast({
        title: "Selecciona fecha de entrega",
        description: "Debes seleccionar una fecha de entrega",
        variant: "destructive",
      });
      return;
    }

    const validacion = validarAntesDeGuardar(getLineasPedido());
    if (!validacion.puede_guardar) {
      toast({ 
        title: "Error en cálculos", 
        description: validacion.errores.join(". "),
        variant: "destructive" 
      });
      return;
    }

    if (!validarCredito()) return;

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuario no autenticado");

      const totalesGuardar = calcularTotales();
      const pesoTotal = calcularPesoTotal();
      
      const timestamp = Date.now().toString().slice(-6);
      const folio = `PED-CLI-${timestamp}`;

      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          folio,
          cliente_id: clienteId,
          vendedor_id: user.user.id,
          sucursal_id: selectedSucursalId || null,
          fecha_pedido: new Date().toISOString(),
          fecha_entrega_estimada: fechaEntrega,
          subtotal: totalesGuardar.subtotal,
          impuestos: totalesGuardar.impuestos,
          total: totalesGuardar.total,
          peso_total_kg: pesoTotal > 0 ? pesoTotal : null,
          status: "por_autorizar",
          notas: notas || null,
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      const detallesInsert = detalles.map((d) => ({
        pedido_id: pedido.id,
        producto_id: d.productoId,
        cantidad: d.cantidad,
        precio_unitario: d.precioUnitario,
        subtotal: d.subtotal,
      }));

      const { error: detallesError } = await supabase
        .from("pedidos_detalles")
        .insert(detallesInsert);

      if (detallesError) throw detallesError;

      // Enviar notificación push a admins y secretarias
      try {
        const { sendPushNotification } = await import('@/services/pushNotifications');
        await sendPushNotification({
          roles: ['admin', 'secretaria'],
          title: '🛒 Nuevo Pedido del Portal',
          body: `Pedido ${folio} - ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalesGuardar.total)}`,
          data: {
            type: 'nuevo_pedido',
            pedido_id: pedido.id,
            folio: folio
          }
        });
      } catch (pushError) {
        console.error('Error enviando notificación push:', pushError);
        // No interrumpir el flujo si falla la notificación
      }

      toast({
        title: "Pedido enviado",
        description: `Tu pedido ${folio} ha sido enviado para autorización. Fecha de entrega: ${format(new Date(fechaEntrega), "EEEE d 'de' MMMM", { locale: es })}`,
      });

      setDetalles([]);
      setNotas("");
      setFechaEntrega("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo crear el pedido: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totales = calcularTotales();
  const { subtotal, iva, ieps, total } = totales;
  const creditoDisponible = limiteCredito - saldoPendiente;
  const selectedSucursal = sucursales.find(s => s.id === selectedSucursalId);

  const productosRegulares = productosFrecuentes.filter(p => !p.es_especial);
  const productosEspeciales = productosFrecuentes.filter(p => p.es_especial);
  const tieneProductosFrecuentes = productosFrecuentes.length > 0;

  const getCantidadEnPedido = (productoId: string) => {
    const detalle = detalles.find(d => d.productoId === productoId);
    return detalle?.cantidad || 0;
  };

  return (
    <div className="space-y-6">
      {/* Selector de Sucursal y Fecha */}
      <div className="grid gap-4 md:grid-cols-2">
        {sucursales.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                Dirección de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sucursales.length === 1 ? (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium">{sucursales[0].nombre}</p>
                  <p className="text-muted-foreground">{sucursales[0].direccion}</p>
                </div>
              ) : (
                <Select value={selectedSucursalId} onValueChange={setSelectedSucursalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map((sucursal) => (
                      <SelectItem key={sucursal.id} value={sucursal.id}>
                        {sucursal.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Fecha de Entrega
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={fechaEntrega} onValueChange={setFechaEntrega}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona fecha" />
              </SelectTrigger>
              <SelectContent>
                {fechasDisponibles().map((fecha) => (
                  <SelectItem key={fecha} value={fecha}>
                    {format(new Date(fecha + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {sucursales.length === 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Sin dirección de entrega</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Contacta a tu vendedor para configurar tu dirección de entrega
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Productos Frecuentes Grid */}
      {tieneProductosFrecuentes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Tus Productos
            </CardTitle>
            <CardDescription>
              Ingresa las cantidades y se agregarán a tu pedido
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Productos Regulares */}
            {productosRegulares.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {productosRegulares.map((item) => {
                  const cantidadActual = getCantidadEnPedido(item.producto.id);
                  const precioMostrar = item.ultimo_precio || item.producto.precio_venta;
                  const esUltimoPrecio = !!item.ultimo_precio;
                  return (
                    <div 
                      key={item.id} 
                      className={`p-3 border rounded-lg transition-colors ${
                        cantidadActual > 0 ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.producto.nombre}</p>
                          <p className="text-xs text-muted-foreground">{item.producto.codigo}</p>
                        </div>
                        <div className="ml-2 text-right space-y-0.5">
                          {item.ultimo_precio ? (
                            <>
                              <Badge variant="secondary" className="shrink-0">
                                ${item.ultimo_precio.toFixed(2)}
                              </Badge>
                              <p className="text-[10px] text-muted-foreground">tu último precio</p>
                            </>
                          ) : (
                            <>
                              <Badge variant="outline" className="shrink-0 text-muted-foreground">
                                Por cotizar
                              </Badge>
                              <p className="text-[10px] text-muted-foreground">sin historial</p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={cantidadActual || ""}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            agregarProductoDesdeGrid(item, val);
                          }}
                          className="h-8 text-center"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {item.producto.unidad}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Productos Especiales Collapsible */}
            {productosEspeciales.length > 0 && (
              <Collapsible open={especialesOpen} onOpenChange={setEspecialesOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500" />
                      <span>Productos Especiales</span>
                      <Badge variant="outline" className="border-amber-500 text-amber-600">
                        {productosEspeciales.length}
                      </Badge>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${especialesOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {productosEspeciales.map((item) => {
                      const cantidadActual = getCantidadEnPedido(item.producto.id);
                      const precioMostrar = item.ultimo_precio || item.producto.precio_venta;
                      const esUltimoPrecio = !!item.ultimo_precio;
                      return (
                        <div 
                          key={item.id} 
                          className={`p-3 border rounded-lg border-amber-200 dark:border-amber-800 transition-colors ${
                            cantidadActual > 0 ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-amber-50/50 dark:hover:bg-amber-950/20'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.producto.nombre}</p>
                              <p className="text-xs text-muted-foreground">{item.producto.codigo}</p>
                            </div>
                            <div className="ml-2 text-right space-y-0.5">
                              {item.ultimo_precio ? (
                                <>
                                  <Badge variant="secondary" className="shrink-0">
                                    ${item.ultimo_precio.toFixed(2)}
                                  </Badge>
                                  <p className="text-[10px] text-muted-foreground">tu último precio</p>
                                </>
                              ) : (
                                <>
                                  <Badge variant="outline" className="shrink-0 text-muted-foreground">
                                    Por cotizar
                                  </Badge>
                                  <p className="text-[10px] text-muted-foreground">sin historial</p>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={cantidadActual || ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                agregarProductoDesdeGrid(item, val);
                              }}
                              className="h-8 text-center"
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {item.producto.unidad}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}

      {/* Buscador de Otros Productos */}
      <Collapsible open={otrosOpen || !tieneProductosFrecuentes} onOpenChange={setOtrosOpen}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  {tieneProductosFrecuentes ? "Buscar Otros Productos" : "Buscar Productos"}
                </CardTitle>
                {tieneProductosFrecuentes && (
                  <ChevronDown className={`h-4 w-4 transition-transform ${otrosOpen ? 'rotate-180' : ''}`} />
                )}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchTerm && productosFiltrados.length > 0 && (
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {productosFiltrados.slice(0, 15).map((producto) => (
                    <div
                      key={producto.id}
                      className="p-3 hover:bg-muted cursor-pointer flex justify-between items-center border-b last:border-b-0"
                      onClick={() => agregarProducto(producto)}
                    >
                      <div>
                        <p className="font-medium">{producto.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {producto.codigo} - Stock: {producto.stock_actual} {producto.unidad}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${producto.precio_venta.toFixed(2)}</p>
                        <Button size="sm" variant="ghost">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Resumen del Pedido */}
      {detalles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Tu Pedido
              <Badge>{detalles.length} productos</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalles.map((detalle) => (
                    <TableRow key={detalle.productoId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{detalle.nombre}</p>
                          <p className="text-xs text-muted-foreground">{detalle.codigo}</p>
                        </div>
                      </TableCell>
                      <TableCell>${formatCurrency(detalle.precioUnitario)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={detalle.cantidad}
                          onChange={(e) =>
                            actualizarCantidad(
                              detalle.productoId,
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-20 h-8"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium font-mono">
                        ${formatCurrency(detalle.subtotal)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => eliminarProducto(detalle.productoId)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Agregar notas o instrucciones especiales..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>

            <div className="space-y-2 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-mono">${formatCurrency(subtotal)}</span>
              </div>
              {iva > 0 && (
                <div className="flex justify-between text-sm text-blue-600">
                  <span>IVA (16%):</span>
                  <span className="font-mono">${formatCurrency(iva)}</span>
                </div>
              )}
              {ieps > 0 && (
                <div className="flex justify-between text-sm text-orange-600">
                  <span>IEPS (8%):</span>
                  <span className="font-mono">${formatCurrency(ieps)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="font-mono">${formatCurrency(total)}</span>
              </div>
              {total > creditoDisponible && (
                <p className="text-sm text-destructive">
                  ⚠️ El total excede tu crédito disponible
                </p>
              )}
            </div>

            <Button
              className="w-full"
              onClick={crearPedido}
              disabled={loading || total > creditoDisponible || (sucursales.length > 0 && !selectedSucursalId) || !fechaEntrega}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {loading ? "Procesando..." : "Enviar Pedido"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClienteNuevoPedido;
