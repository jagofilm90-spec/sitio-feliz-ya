import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, Search, FileText, Mail } from "lucide-react";
import ClienteCorreosManager from "@/components/clientes/ClienteCorreosManager";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency, calcularDesgloseImpuestos, validarTotales } from "@/lib/utils";

interface DetalleProducto {
  producto_id: string;
  nombre: string;
  codigo: string;
  unidad: string;
  marca: string | null;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
  precio_lista: number;
  ultimo_precio_cliente: number | null;
  fecha_ultima_compra: string | null;
  aplica_iva: boolean;
  aplica_ieps: boolean;
  cantidad_maxima: number | null;
  nota_linea: string | null;
}

interface Cliente {
  id: string;
  nombre: string;
  codigo: string;
}

interface Sucursal {
  id: string;
  nombre: string;
  direccion: string;
}

interface Producto {
  id: string;
  nombre: string;
  codigo: string;
  unidad: string;
  marca: string | null;
  precio_venta: number;
  stock_actual: number;
  aplica_iva: boolean;
  aplica_ieps: boolean;
}

interface CrearCotizacionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailOrigen?: { id: string; subject: string; from: string };
  gmailCuentaId?: string;
  onSuccess?: (cotizacionId: string) => void;
  cotizacionId?: string; // For edit mode
}

const CrearCotizacionDialog = ({
  open,
  onOpenChange,
  emailOrigen,
  gmailCuentaId,
  onSuccess,
  cotizacionId,
}: CrearCotizacionDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);

  const [selectedCliente, setSelectedCliente] = useState<string>("");
  const [selectedSucursal, setSelectedSucursal] = useState<string>("");
  const [correosDialogOpen, setCorreosDialogOpen] = useState(false);
  const [vigenciaDias, setVigenciaDias] = useState(7);
  const [mesCotizacion, setMesCotizacion] = useState<string>(() => {
    const hoy = new Date();
    return format(hoy, "MMMM yyyy", { locale: es });
  });
  const [notas, setNotas] = useState("");
  const [detalles, setDetalles] = useState<DetalleProducto[]>([]);
  const [folio, setFolio] = useState<string>("");
  const [sinCantidades, setSinCantidades] = useState(false);
  const [nombreCotizacion, setNombreCotizacion] = useState("");
  const fechaCreacion = new Date();

  const isEditMode = !!cotizacionId;

  useEffect(() => {
    if (open) {
      loadClientes();
      loadProductos();
      if (cotizacionId) {
        loadCotizacion(cotizacionId);
      }
    }
  }, [open, cotizacionId]);

  useEffect(() => {
    if (selectedCliente) {
      loadSucursales(selectedCliente);
    } else {
      setSucursales([]);
      setSelectedSucursal("");
    }
  }, [selectedCliente]);

  const loadClientes = async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select("id, nombre, codigo")
      .eq("activo", true)
      .order("nombre");

    if (!error && data) {
      setClientes(data);
    }
  };

  const loadSucursales = async (clienteId: string) => {
    const { data, error } = await supabase
      .from("cliente_sucursales")
      .select("id, nombre, direccion")
      .eq("cliente_id", clienteId)
      .eq("activo", true);

    if (!error && data) {
      setSucursales(data);
      if (data.length === 1) {
        setSelectedSucursal(data[0].id);
      }
    }
  };

  const loadProductos = async () => {
    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, codigo, unidad, marca, precio_venta, stock_actual, aplica_iva, aplica_ieps")
      .eq("activo", true)
      .order("nombre");

    if (!error && data) {
      setProductos(data);
    }
  };

  const loadCotizacion = async (id: string) => {
    setLoadingData(true);
    try {
      const { data: cotizacion, error } = await supabase
        .from("cotizaciones")
        .select(`
          *,
          detalles:cotizaciones_detalles(
            id,
            producto_id,
            cantidad,
            precio_unitario,
            subtotal,
            cantidad_maxima,
            nota_linea,
            producto:productos(
              id, nombre, codigo, unidad, marca, precio_venta, aplica_iva, aplica_ieps
            )
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      setFolio(cotizacion.folio);
      setSelectedCliente(cotizacion.cliente_id);
      setSelectedSucursal(cotizacion.sucursal_id || "");
      setNombreCotizacion((cotizacion as any).nombre || "");
      
      // Parse notas to extract mesCotizacion, sinCantidades, and clean notes
      const notasRaw = cotizacion.notas || "";
      const mesMatch = notasRaw.match(/\[Cotización para: ([^\]]+)\]/);
      if (mesMatch) {
        setMesCotizacion(mesMatch[1]);
      }
      
      // Detect "solo precios" mode from notas tag
      const esSoloPreciosTag = notasRaw.includes("[Solo precios]");
      setSinCantidades(esSoloPreciosTag);
      
      // Remove all tags from notas for display
      let notasLimpias = notasRaw
        .replace(/\[Cotización para: [^\]]+\]/g, "")
        .replace(/\[Solo precios\]/g, "")
        .trim();
      setNotas(notasLimpias);
      
      // Calculate vigencia days from fecha_vigencia
      const vigencia = new Date(cotizacion.fecha_vigencia);
      const hoy = new Date();
      const diffTime = vigencia.getTime() - hoy.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setVigenciaDias(Math.max(1, diffDays));

      // Load detalles
      const detallesFormateados: DetalleProducto[] = cotizacion.detalles.map((d: any) => ({
        producto_id: d.producto_id,
        nombre: d.producto.nombre,
        codigo: d.producto.codigo,
        unidad: d.producto.unidad,
        marca: d.producto.marca,
        precio_unitario: d.precio_unitario,
        cantidad: d.cantidad,
        subtotal: d.subtotal,
        precio_lista: d.producto.precio_venta,
        ultimo_precio_cliente: null,
        fecha_ultima_compra: null,
        aplica_iva: d.producto.aplica_iva,
        aplica_ieps: d.producto.aplica_ieps,
        cantidad_maxima: d.cantidad_maxima || null,
        nota_linea: d.nota_linea || null,
      }));

      setDetalles(detallesFormateados);
      // Note: sinCantidades is already set from the notas tag above
    } catch (error: any) {
      console.error("Error loading cotizacion:", error);
      toast({
        title: "Error al cargar cotización",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const productosFiltrados = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Buscar el último precio que pagó este cliente por este producto
  const buscarUltimoPrecioCliente = async (productoId: string): Promise<{precio: number | null, fecha: string | null}> => {
    if (!selectedCliente) return { precio: null, fecha: null };

    const { data, error } = await supabase
      .from("pedidos_detalles")
      .select(`
        precio_unitario,
        created_at,
        pedido:pedidos!inner(cliente_id)
      `)
      .eq("producto_id", productoId)
      .eq("pedido.cliente_id", selectedCliente)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return { precio: null, fecha: null };
    }

    return { 
      precio: data[0].precio_unitario, 
      fecha: data[0].created_at 
    };
  };

  const agregarProducto = async (producto: Producto) => {
    const existe = detalles.find((d) => d.producto_id === producto.id);
    if (existe) {
      toast({
        title: "Producto ya agregado",
        description: "El producto ya está en la cotización",
        variant: "destructive",
      });
      return;
    }

    // Buscar historial de precios para este cliente
    const historial = await buscarUltimoPrecioCliente(producto.id);
    
    // Si hay precio anterior, usarlo; si no, usar precio de lista
    const precioAUsar = historial.precio || producto.precio_venta;

    setDetalles([
      ...detalles,
      {
        producto_id: producto.id,
        nombre: producto.nombre,
        codigo: producto.codigo,
        unidad: producto.unidad,
        marca: producto.marca,
        precio_unitario: precioAUsar,
        cantidad: 1,
        subtotal: precioAUsar,
        precio_lista: producto.precio_venta,
        ultimo_precio_cliente: historial.precio,
        fecha_ultima_compra: historial.fecha,
        aplica_iva: producto.aplica_iva,
        aplica_ieps: producto.aplica_ieps,
        cantidad_maxima: null,
        nota_linea: null,
      },
    ]);
    // Limpiar búsqueda pero mantener el dropdown abierto para seguir agregando
    setSearchTerm("");
    // NO cerrar el buscador - permitir agregar múltiples productos
  };

  const actualizarCantidad = (index: number, cantidad: number) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index].cantidad = cantidad;
    nuevosDetalles[index].subtotal = cantidad * nuevosDetalles[index].precio_unitario;
    setDetalles(nuevosDetalles);
  };

  const actualizarPrecio = (index: number, precio: number) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index].precio_unitario = precio;
    nuevosDetalles[index].subtotal = nuevosDetalles[index].cantidad * precio;
    setDetalles(nuevosDetalles);
  };

  const eliminarProducto = (index: number) => {
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  const actualizarCantidadMaxima = (index: number, cantidad: number | null) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index].cantidad_maxima = cantidad;
    setDetalles(nuevosDetalles);
  };

  const actualizarNotaLinea = (index: number, nota: string) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index].nota_linea = nota || null;
    setDetalles(nuevosDetalles);
  };

  // Calcular totales desglosando IVA e IEPS de precios que YA incluyen impuestos
  const calcularTotales = () => {
    let subtotalNeto = 0;
    let totalIva = 0;
    let totalIeps = 0;

    detalles.forEach((d) => {
      const desglose = calcularDesgloseImpuestos(d.subtotal, d.aplica_iva, d.aplica_ieps);
      subtotalNeto += desglose.base;
      totalIva += desglose.iva;
      totalIeps += desglose.ieps;
    });

    // Redondear a 2 decimales
    subtotalNeto = Math.round(subtotalNeto * 100) / 100;
    totalIva = Math.round(totalIva * 100) / 100;
    totalIeps = Math.round(totalIeps * 100) / 100;
    const total = Math.round((subtotalNeto + totalIva + totalIeps) * 100) / 100;

    // Validar consistencia
    if (!validarTotales(subtotalNeto, totalIva, totalIeps, total)) {
      console.warn('Inconsistencia en cálculo de totales detectada');
    }

    return { 
      subtotal: subtotalNeto, 
      iva: totalIva,
      ieps: totalIeps,
      impuestos: totalIva + totalIeps, 
      total
    };
  };

  const handleGuardar = async () => {
    if (!selectedCliente) {
      toast({
        title: "Selecciona un cliente",
        variant: "destructive",
      });
      return;
    }

    if (detalles.length === 0) {
      toast({
        title: "Agrega productos",
        description: "La cotización debe tener al menos un producto",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        throw new Error("No hay sesión activa");
      }

      const totales = calcularTotales();
      const fechaVigencia = addDays(new Date(), vigenciaDias);

      if (isEditMode && cotizacionId) {
        // UPDATE mode - incluir indicador de "solo precios"
        const notasConMes = `[Cotización para: ${mesCotizacion}]${sinCantidades ? '[Solo precios]' : ''}${notas ? ` ${notas}` : ''}`;
        const { error: cotizacionError } = await supabase
          .from("cotizaciones")
          .update({
            cliente_id: selectedCliente,
            sucursal_id: selectedSucursal === "none" ? null : (selectedSucursal || null),
            fecha_vigencia: format(fechaVigencia, "yyyy-MM-dd"),
            notas: notasConMes,
            nombre: nombreCotizacion || null,
            subtotal: totales.subtotal,
            impuestos: totales.impuestos,
            total: totales.total,
          })
          .eq("id", cotizacionId);

        if (cotizacionError) throw cotizacionError;

        // Delete existing detalles
        const { error: deleteError } = await supabase
          .from("cotizaciones_detalles")
          .delete()
          .eq("cotizacion_id", cotizacionId);

        if (deleteError) throw deleteError;

        // Insert new detalles - si es "solo precios", guardar cantidad como 0
        const detallesInsert = detalles.map((d) => ({
          cotizacion_id: cotizacionId,
          producto_id: d.producto_id,
          cantidad: sinCantidades ? 0 : d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal: sinCantidades ? 0 : d.subtotal,
          cantidad_maxima: d.cantidad_maxima || null,
          nota_linea: d.nota_linea || null,
        }));

        const { error: detallesError } = await supabase
          .from("cotizaciones_detalles")
          .insert(detallesInsert);

        if (detallesError) throw detallesError;

        toast({
          title: "Cotización actualizada",
          description: `Folio: ${folio}`,
        });

        onSuccess?.(cotizacionId);
      } else {
        // CREATE mode
        const { data: folioData, error: folioError } = await supabase.rpc(
          "generar_folio_cotizacion"
        );

        if (folioError) throw folioError;

        // Incluir el mes de cotización y modo "solo precios" en las notas
        const notasConMes = `[Cotización para: ${mesCotizacion}]${sinCantidades ? '[Solo precios]' : ''}${notas ? ` ${notas}` : ''}`;

        const { data: cotizacion, error: cotizacionError } = await supabase
          .from("cotizaciones")
          .insert({
            folio: folioData,
            cliente_id: selectedCliente,
            sucursal_id: selectedSucursal === "none" ? null : (selectedSucursal || null),
            fecha_vigencia: format(fechaVigencia, "yyyy-MM-dd"),
            email_origen_id: emailOrigen?.id || null,
            gmail_cuenta_id: gmailCuentaId || null,
            notas: notasConMes,
            nombre: nombreCotizacion || null,
            subtotal: totales.subtotal,
            impuestos: totales.impuestos,
            total: totales.total,
            creado_por: session.session.user.id,
          })
          .select()
          .single();

        if (cotizacionError) throw cotizacionError;

        // Si es "solo precios", guardar cantidad como 0
        const detallesInsert = detalles.map((d) => ({
          cotizacion_id: cotizacion.id,
          producto_id: d.producto_id,
          cantidad: sinCantidades ? 0 : d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal: sinCantidades ? 0 : d.subtotal,
          cantidad_maxima: d.cantidad_maxima || null,
          nota_linea: d.nota_linea || null,
        }));

        const { error: detallesError } = await supabase
          .from("cotizaciones_detalles")
          .insert(detallesInsert);

        if (detallesError) throw detallesError;

        // All quotations start as 'borrador' - user decides when to send for authorization
        toast({
          title: "Cotización creada",
          description: `Folio: ${folioData}. Puedes editarla o enviarla a autorización.`,
        });

        onSuccess?.(cotizacion.id);
      }

      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving cotizacion:", error);
      toast({
        title: isEditMode ? "Error al actualizar cotización" : "Error al crear cotización",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedCliente("");
    setSelectedSucursal("");
    setVigenciaDias(7);
    setMesCotizacion(format(new Date(), "MMMM yyyy", { locale: es }));
    setNotas("");
    setDetalles([]);
    setSearchTerm("");
    setFolio("");
    setSinCantidades(false);
    setNombreCotizacion("");
  };

  const totales = calcularTotales();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isEditMode ? `Editar Cotización ${folio}` : "Nueva Cotización"}
          </DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <div className="space-y-6">
          {emailOrigen && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">Creando desde email:</p>
              <p className="text-muted-foreground">{emailOrigen.subject}</p>
              <p className="text-muted-foreground text-xs">De: {emailOrigen.from}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <div className="flex gap-2">
                <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre} ({c.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!selectedCliente}
                  onClick={() => setCorreosDialogOpen(true)}
                  title="Gestionar correos del cliente"
                >
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sucursal de entrega <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Select
                value={selectedSucursal}
                onValueChange={setSelectedSucursal}
                disabled={!selectedCliente || sucursales.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={sucursales.length === 0 ? "Oficinas principales" : "Oficinas principales"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Oficinas principales</SelectItem>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cotización para el mes de *</Label>
              <Select value={mesCotizacion} onValueChange={setMesCotizacion}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar mes" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const fecha = new Date();
                    fecha.setMonth(fecha.getMonth() + i - 1);
                    const mesNombre = format(fecha, "MMMM yyyy", { locale: es });
                    return (
                      <SelectItem key={mesNombre} value={mesNombre}>
                        {mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nombre de cotización <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              {clientes.find(c => c.id === selectedCliente)?.nombre?.toLowerCase().includes('lecaroz') ? (
                <Select value={nombreCotizacion} onValueChange={setNombreCotizacion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo de cotización" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={`Avio ${mesCotizacion}`}>
                      Avio {mesCotizacion}
                    </SelectItem>
                    <SelectItem value={`Azúcares ${mesCotizacion}`}>
                      Azúcares {mesCotizacion}
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="Ej: Avio Diciembre, Azúcares..."
                  value={nombreCotizacion}
                  onChange={(e) => setNombreCotizacion(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Fecha de creación</Label>
              <Input
                value={format(fechaCreacion, "dd/MM/yyyy")}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label>Vigencia (días)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={vigenciaDias}
                onChange={(e) => setVigenciaDias(parseInt(e.target.value) || 7)}
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha de vencimiento</Label>
              <Input
                value={format(addDays(new Date(), vigenciaDias), "dd/MM/yyyy")}
                disabled
              />
            </div>
          </div>

          {/* Switch sin cantidades */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="sin-cantidades" className="cursor-pointer">Solo precios (sin cantidades)</Label>
              <p className="text-xs text-muted-foreground">
                Activar para cotizaciones donde el cliente define las cantidades en su pedido
              </p>
            </div>
            <Switch
              id="sin-cantidades"
              checked={sinCantidades}
              onCheckedChange={setSinCantidades}
            />
          </div>

          {/* Product search */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Agregar productos</Label>
              {detalles.length > 0 && (
                <Badge variant="secondary">{detalles.length} producto{detalles.length !== 1 ? 's' : ''}</Badge>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto por nombre o código..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowProductSearch(true);
                }}
                onFocus={() => setShowProductSearch(true)}
                onBlur={() => setTimeout(() => setShowProductSearch(false), 200)}
                className="pl-10"
              />
            </div>

            {showProductSearch && (
              <div className="absolute z-50 w-full max-w-[calc(100%-3rem)] bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {productosFiltrados.length > 0 ? (
                  productosFiltrados.slice(0, 15).map((p) => {
                    const yaAgregado = detalles.some(d => d.producto_id === p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => !yaAgregado && agregarProducto(p)}
                        disabled={yaAgregado}
                        className={`w-full px-4 py-2 text-left flex items-center justify-between ${
                          yaAgregado 
                            ? 'bg-muted/50 text-muted-foreground cursor-not-allowed' 
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {yaAgregado && <Badge variant="outline" className="text-xs">Agregado</Badge>}
                          <div>
                            <span className={yaAgregado ? '' : 'font-medium'}>{p.nombre}</span>
                            {p.marca && (
                              <span className="text-primary text-sm ml-1">
                                {p.marca}
                              </span>
                            )}
                            <span className="text-muted-foreground text-sm ml-2">
                              ({p.codigo})
                            </span>
                          </div>
                        </div>
                        <span className="text-sm">
                          ${p.precio_venta.toFixed(2)} / {p.unidad}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-3 text-muted-foreground text-sm">
                    No se encontraron productos
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Products table */}
          {detalles.length > 0 && (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    {!sinCantidades && <TableHead className="w-24">Cantidad</TableHead>}
                    <TableHead className="w-40">Precio Unit.</TableHead>
                    <TableHead className="w-28">Máx. Disponible</TableHead>
                    <TableHead className="w-40">Nota línea</TableHead>
                    {!sinCantidades && <TableHead className="w-28 text-right">Subtotal</TableHead>}
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalles.map((d, index) => (
                    <TableRow key={d.producto_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {d.nombre}
                            {d.marca && <span className="text-primary ml-1">{d.marca}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {d.codigo} • {d.unidad}
                            {d.aplica_iva && <span className="ml-1 text-blue-600">IVA</span>}
                            {d.aplica_ieps && <span className="ml-1 text-orange-600">IEPS</span>}
                          </p>
                        </div>
                      </TableCell>
                      {!sinCantidades && (
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={d.cantidad}
                            onChange={(e) =>
                              actualizarCantidad(index, parseInt(e.target.value) || 1)
                            }
                            className="w-20"
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="space-y-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={d.precio_unitario}
                            onChange={(e) =>
                              actualizarPrecio(index, parseFloat(e.target.value) || 0)
                            }
                            className="w-28"
                          />
                          {/* Mostrar historial de precios */}
                          <div className="text-xs space-y-0.5">
                            <p className="text-muted-foreground">
                              Lista: <span className="font-medium text-foreground">${d.precio_lista.toFixed(2)}</span>
                              {d.precio_unitario !== d.precio_lista && (
                                <button
                                  type="button"
                                  onClick={() => actualizarPrecio(index, d.precio_lista)}
                                  className="ml-1 text-blue-600 hover:underline"
                                >
                                  usar
                                </button>
                              )}
                            </p>
                            {d.ultimo_precio_cliente !== null && (
                              <p className="text-amber-600">
                                Último: <span className="font-medium">${d.ultimo_precio_cliente.toFixed(2)}</span>
                                {d.fecha_ultima_compra && (
                                  <span className="text-muted-foreground ml-1">
                                    ({format(new Date(d.fecha_ultima_compra), "MMM yyyy", { locale: es })})
                                  </span>
                                )}
                                {d.precio_unitario !== d.ultimo_precio_cliente && (
                                  <button
                                    type="button"
                                    onClick={() => actualizarPrecio(index, d.ultimo_precio_cliente!)}
                                    className="ml-1 text-blue-600 hover:underline"
                                  >
                                    usar
                                  </button>
                                )}
                              </p>
                            )}
                            {d.ultimo_precio_cliente === null && (
                              <p className="text-green-600 italic">Primera compra de este cliente</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Sin límite"
                          value={d.cantidad_maxima || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            actualizarCantidadMaxima(index, val ? parseInt(val) : null);
                          }}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Ej: Solo 3000 bultos"
                          value={d.nota_linea || ""}
                          onChange={(e) => actualizarNotaLinea(index, e.target.value)}
                          className="w-36 text-xs"
                        />
                      </TableCell>
                      {!sinCantidades && (
                        <TableCell className="text-right font-medium">
                          ${formatCurrency(d.subtotal)}
                        </TableCell>
                      )}
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => eliminarProducto(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              placeholder="Notas adicionales para la cotización..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
            />
          </div>

          {/* Totals - solo mostrar cuando hay cantidades */}
          {detalles.length > 0 && !sinCantidades && (
            <div className="flex justify-end">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono">${formatCurrency(totales.subtotal)}</span>
                </div>
                {totales.iva > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>IVA (16%):</span>
                    <span className="font-mono">${formatCurrency(totales.iva)}</span>
                  </div>
                )}
                {totales.ieps > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>IEPS (8%):</span>
                    <span className="font-mono">${formatCurrency(totales.ieps)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span className="font-mono">${formatCurrency(totales.total)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditMode ? "Guardar Cambios" : "Crear Cotización"}
            </Button>
          </div>
        </div>
        )}
      </DialogContent>

      {/* Dialog para gestionar correos del cliente */}
      {selectedCliente && (
        <ClienteCorreosManager
          clienteId={selectedCliente}
          clienteNombre={clientes.find(c => c.id === selectedCliente)?.nombre || ""}
          open={correosDialogOpen}
          onOpenChange={setCorreosDialogOpen}
        />
      )}
    </Dialog>
  );
};

export default CrearCotizacionDialog;
