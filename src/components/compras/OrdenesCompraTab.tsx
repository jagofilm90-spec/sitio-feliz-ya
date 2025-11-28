import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Search, MoreVertical, Loader2, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import OrdenAccionesDialog from "./OrdenAccionesDialog";
import AutorizacionOCDialog from "./AutorizacionOCDialog";
import OCAutorizadaAlert from "./OCAutorizadaAlert";
import { formatCurrency } from "@/lib/utils";

interface ProductoEnOrden {
  producto_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  ultimo_costo?: number;
  subtotal: number;
  aplica_iva: boolean;
  aplica_ieps: boolean;
}

interface EntregaProgramada {
  numero_entrega: number;
  cantidad_bultos: number;
  fecha_programada: string;
}

const OrdenesCompraTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accionesDialogOpen, setAccionesDialogOpen] = useState(false);
  const [autorizacionDialogOpen, setAutorizacionDialogOpen] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingOrdenId, setEditingOrdenId] = useState<string | null>(null);
  
  // Form state
  const [proveedorId, setProveedorId] = useState("");
  const [folio, setFolio] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [notas, setNotas] = useState("");
  const [productosEnOrden, setProductosEnOrden] = useState<ProductoEnOrden[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [precioUnitario, setPrecioUnitario] = useState("");
  const [generatingFolio, setGeneratingFolio] = useState(false);
  
  // Multiple deliveries state
  const [entregasMultiples, setEntregasMultiples] = useState(false);
  const [bultosPorEntrega, setBultosPorEntrega] = useState("");
  const [entregasProgramadas, setEntregasProgramadas] = useState<EntregaProgramada[]>([]);

  // Function to generate next folio
  const generateNextFolio = async () => {
    setGeneratingFolio(true);
    try {
      const { data, error } = await supabase.rpc("generar_folio_orden_compra");
      if (error) throw error;
      setFolio(data);
    } catch (error: any) {
      toast({
        title: "Error al generar folio",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingFolio(false);
    }
  };

  // Open dialog for new order with auto-generated folio
  const handleNewOrder = async () => {
    resetForm();
    setDialogOpen(true);
    await generateNextFolio();
  };

  // Fetch proveedores
  const { data: proveedores = [] } = useQuery({
    queryKey: ["proveedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proveedores")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // Fetch productos
  const { data: productos = [] } = useQuery({
    queryKey: ["productos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // Fetch productos asociados al proveedor seleccionado
  const { data: productosProveedor = [] } = useQuery({
    queryKey: ["proveedor-productos", proveedorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proveedor_productos")
        .select("producto_id")
        .eq("proveedor_id", proveedorId);
      if (error) throw error;
      return data.map(p => p.producto_id);
    },
    enabled: !!proveedorId,
  });

  // Filter products: if proveedor has associated products, show only those; otherwise show all
  const productosDisponibles = proveedorId && productosProveedor.length > 0
    ? productos.filter(p => productosProveedor.includes(p.id))
    : productos;

  // Fetch ordenes de compra
  const { data: ordenes = [] } = useQuery({
    queryKey: ["ordenes_compra"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordenes_compra")
        .select(`
          *,
          proveedores (nombre, email),
          ordenes_compra_detalles (
            *,
            productos (nombre, codigo)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Handle ?aprobar= URL parameter to auto-open order for authorization
  useEffect(() => {
    const aprobarId = searchParams.get("aprobar");
    if (aprobarId && ordenes.length > 0) {
      const ordenParaAprobar = ordenes.find((o: any) => o.id === aprobarId);
      if (ordenParaAprobar) {
        setOrdenSeleccionada(ordenParaAprobar);
        setAutorizacionDialogOpen(true);
        // Clear the URL parameter
        setSearchParams({});
      }
    }
  }, [searchParams, ordenes]);

  // Calculate deliveries based on total quantity and bultos per delivery
  const calcularEntregas = () => {
    const cantidadTotal = productosEnOrden.reduce((sum, p) => sum + p.cantidad, 0);
    const bultosPorTrailer = parseInt(bultosPorEntrega) || 0;
    
    if (cantidadTotal <= 0 || bultosPorTrailer <= 0) {
      setEntregasProgramadas([]);
      return;
    }
    
    const numEntregas = Math.ceil(cantidadTotal / bultosPorTrailer);
    const entregas: EntregaProgramada[] = [];
    let bultosRestantes = cantidadTotal;
    
    for (let i = 1; i <= numEntregas; i++) {
      const bultosEntrega = Math.min(bultosPorTrailer, bultosRestantes);
      entregas.push({
        numero_entrega: i,
        cantidad_bultos: bultosEntrega,
        fecha_programada: "",
      });
      bultosRestantes -= bultosEntrega;
    }
    
    setEntregasProgramadas(entregas);
  };

  const updateFechaEntrega = (index: number, fecha: string) => {
    setEntregasProgramadas(prev => 
      prev.map((e, i) => i === index ? { ...e, fecha_programada: fecha } : e)
    );
  };

  const updateCantidadEntrega = (index: number, cantidad: number) => {
    setEntregasProgramadas(prev => 
      prev.map((e, i) => i === index ? { ...e, cantidad_bultos: cantidad } : e)
    );
  };

  // Create orden de compra
  const createOrden = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const subtotal = productosEnOrden.reduce((sum, p) => sum + p.subtotal, 0);
      const ivaAmount = productosEnOrden.reduce((sum, p) => 
        sum + (p.aplica_iva ? p.subtotal * 0.16 : 0), 0);
      const iepsAmount = productosEnOrden.reduce((sum, p) => 
        sum + (p.aplica_ieps ? p.subtotal * 0.08 : 0), 0);
      const impuestos = ivaAmount + iepsAmount;
      const total = subtotal + impuestos;

      // Create orden
      const { data: orden, error: ordenError } = await supabase
        .from("ordenes_compra")
        .insert({
          folio,
          proveedor_id: proveedorId,
          fecha_entrega_programada: entregasMultiples ? null : (fechaEntrega || null),
          subtotal,
          impuestos,
          total,
          notas,
          creado_por: user.id,
          status: "pendiente",
          entregas_multiples: entregasMultiples,
        })
        .select()
        .single();

      if (ordenError) throw ordenError;

      // Create detalles
      const detalles = productosEnOrden.map((p) => ({
        orden_compra_id: orden.id,
        producto_id: p.producto_id,
        cantidad_ordenada: p.cantidad,
        precio_unitario_compra: p.precio_unitario,
        subtotal: p.subtotal,
      }));

      const { error: detallesError } = await supabase
        .from("ordenes_compra_detalles")
        .insert(detalles);

      if (detallesError) throw detallesError;

      // Create multiple deliveries if enabled
      if (entregasMultiples && entregasProgramadas.length > 0) {
        const entregas = entregasProgramadas.map((e) => ({
          orden_compra_id: orden.id,
          numero_entrega: e.numero_entrega,
          cantidad_bultos: e.cantidad_bultos,
          fecha_programada: e.fecha_programada || null,
          status: e.fecha_programada ? "programada" : "pendiente_fecha",
        }));

        const { error: entregasError } = await supabase
          .from("ordenes_compra_entregas")
          .insert(entregas);

        if (entregasError) throw entregasError;
      }

      // Update productos with last purchase info
      for (const p of productosEnOrden) {
        await supabase
          .from("productos")
          .update({
            ultimo_costo_compra: p.precio_unitario,
            fecha_ultima_compra: new Date().toISOString(),
          })
          .eq("id", p.producto_id);
      }

      return orden;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["ordenes_calendario"] });
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      toast({
        title: "Orden creada",
        description: entregasMultiples 
          ? `Orden creada con ${entregasProgramadas.length} entregas programadas`
          : "La orden de compra se ha creado exitosamente",
      });
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const agregarProducto = () => {
    if (!productoSeleccionado || !cantidad || !precioUnitario) {
      toast({
        title: "Campos incompletos",
        description: "Selecciona un producto, cantidad y precio",
        variant: "destructive",
      });
      return;
    }

    const producto = productosDisponibles.find((p) => p.id === productoSeleccionado);
    if (!producto) return;

    const cantidadNum = parseInt(cantidad);
    const precioNum = parseFloat(precioUnitario);
    const subtotal = cantidadNum * precioNum;

    setProductosEnOrden([
      ...productosEnOrden,
      {
        producto_id: producto.id,
        nombre: producto.nombre,
        cantidad: cantidadNum,
        precio_unitario: precioNum,
        ultimo_costo: producto.ultimo_costo_compra,
        subtotal,
        aplica_iva: producto.aplica_iva ?? false,
        aplica_ieps: producto.aplica_ieps ?? false,
      },
    ]);

    setProductoSeleccionado("");
    setCantidad("");
    setPrecioUnitario("");
  };

  const eliminarProducto = (index: number) => {
    setProductosEnOrden(productosEnOrden.filter((_, i) => i !== index));
    // Recalculate deliveries if multiple deliveries enabled
    if (entregasMultiples) {
      setTimeout(calcularEntregas, 0);
    }
  };

  const resetForm = () => {
    setProveedorId("");
    setFolio("");
    setFechaEntrega("");
    setNotas("");
    setProductosEnOrden([]);
    setProductoSeleccionado("");
    setCantidad("");
    setPrecioUnitario("");
    setEditingOrdenId(null);
    setEntregasMultiples(false);
    setBultosPorEntrega("");
    setEntregasProgramadas([]);
  };

  // Update orden de compra
  const updateOrden = useMutation({
    mutationFn: async () => {
      if (!editingOrdenId) throw new Error("No order to update");

      const subtotal = productosEnOrden.reduce((sum, p) => sum + p.subtotal, 0);
      const ivaAmount = productosEnOrden.reduce((sum, p) => 
        sum + (p.aplica_iva ? p.subtotal * 0.16 : 0), 0);
      const iepsAmount = productosEnOrden.reduce((sum, p) => 
        sum + (p.aplica_ieps ? p.subtotal * 0.08 : 0), 0);
      const impuestos = ivaAmount + iepsAmount;
      const total = subtotal + impuestos;

      // Update orden
      const { error: ordenError } = await supabase
        .from("ordenes_compra")
        .update({
          folio,
          proveedor_id: proveedorId,
          fecha_entrega_programada: entregasMultiples ? null : (fechaEntrega || null),
          subtotal,
          impuestos,
          total,
          notas,
          entregas_multiples: entregasMultiples,
        })
        .eq("id", editingOrdenId);

      if (ordenError) throw ordenError;

      // Delete existing detalles
      const { error: deleteError } = await supabase
        .from("ordenes_compra_detalles")
        .delete()
        .eq("orden_compra_id", editingOrdenId);

      if (deleteError) throw deleteError;

      // Create new detalles
      const detalles = productosEnOrden.map((p) => ({
        orden_compra_id: editingOrdenId,
        producto_id: p.producto_id,
        cantidad_ordenada: p.cantidad,
        precio_unitario_compra: p.precio_unitario,
        subtotal: p.subtotal,
      }));

      const { error: detallesError } = await supabase
        .from("ordenes_compra_detalles")
        .insert(detalles);

      if (detallesError) throw detallesError;

      // Handle multiple deliveries
      if (entregasMultiples) {
        // Delete existing entregas
        await supabase
          .from("ordenes_compra_entregas")
          .delete()
          .eq("orden_compra_id", editingOrdenId);

        // Create new entregas
        if (entregasProgramadas.length > 0) {
          const entregas = entregasProgramadas.map((e) => ({
            orden_compra_id: editingOrdenId,
            numero_entrega: e.numero_entrega,
            cantidad_bultos: e.cantidad_bultos,
            fecha_programada: e.fecha_programada,
            status: "programada",
          }));

          const { error: entregasError } = await supabase
            .from("ordenes_compra_entregas")
            .insert(entregas);

          if (entregasError) throw entregasError;
        }
      }

      return editingOrdenId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["ordenes_calendario"] });
      toast({
        title: "Orden actualizada",
        description: "La orden de compra se ha actualizado exitosamente",
      });
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditOrden = async (orden: any) => {
    setEditingOrdenId(orden.id);
    setFolio(orden.folio);
    setProveedorId(orden.proveedor_id);
    setFechaEntrega(orden.fecha_entrega_programada || "");
    setNotas(orden.notas || "");
    setEntregasMultiples(orden.entregas_multiples || false);
    
    // Load products from order details
    const productos = (orden.ordenes_compra_detalles || []).map((d: any) => ({
      producto_id: d.producto_id,
      nombre: d.productos?.nombre || "Producto",
      cantidad: d.cantidad_ordenada,
      precio_unitario: d.precio_unitario_compra,
      subtotal: d.subtotal,
      aplica_iva: false,
      aplica_ieps: false,
    }));
    setProductosEnOrden(productos);
    
    // Load entregas if multiple
    if (orden.entregas_multiples) {
      const { data: entregas } = await supabase
        .from("ordenes_compra_entregas")
        .select("*")
        .eq("orden_compra_id", orden.id)
        .order("numero_entrega");
      
      if (entregas && entregas.length > 0) {
        setEntregasProgramadas(entregas.map(e => ({
          numero_entrega: e.numero_entrega,
          cantidad_bultos: e.cantidad_bultos,
          fecha_programada: e.fecha_programada,
        })));
      }
    }
    
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorId || !folio || productosEnOrden.length === 0) {
      toast({
        title: "Campos incompletos",
        description: "Completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }
    
    if (editingOrdenId) {
      updateOrden.mutate();
    } else {
      createOrden.mutate();
    }
  };

  const subtotalOrden = productosEnOrden.reduce((sum, p) => sum + p.subtotal, 0);
  const ivaOrden = productosEnOrden.reduce((sum, p) => 
    sum + (p.aplica_iva ? p.subtotal * 0.16 : 0), 0);
  const iepsOrden = productosEnOrden.reduce((sum, p) => 
    sum + (p.aplica_ieps ? p.subtotal * 0.08 : 0), 0);
  const impuestosOrden = ivaOrden + iepsOrden;
  const totalOrden = subtotalOrden + impuestosOrden;
  const cantidadTotalBultos = productosEnOrden.reduce((sum, p) => sum + p.cantidad, 0);

  const filteredOrdenes = ordenes.filter(
    (orden) =>
      orden.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      orden.proveedores?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any }> = {
      pendiente: { label: "Pendiente", variant: "secondary" },
      enviada: { label: "Enviada", variant: "default" },
      parcial: { label: "Parcial", variant: "default" },
      recibida: { label: "Recibida", variant: "default" },
      devuelta: { label: "Devuelta", variant: "destructive" },
    };
    const config = statusConfig[status] || { label: status, variant: "secondary" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Órdenes de Compra</h2>
          <p className="text-muted-foreground">
            Gestiona tus órdenes de compra y recepciones
          </p>
        </div>
        <Button onClick={handleNewOrder}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Orden de Compra
        </Button>
      </div>

      {/* Alert for authorized OCs ready to send */}
      <OCAutorizadaAlert 
        onNavigateToOC={(ordenId) => {
          const orden = ordenes.find(o => o.id === ordenId);
          if (orden) {
            setOrdenSeleccionada(orden);
            setAccionesDialogOpen(true);
          }
        }}
      />

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio o proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Entregas</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrdenes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No hay órdenes de compra registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredOrdenes.map((orden) => (
                <TableRow key={orden.id}>
                  <TableCell className="font-medium">{orden.folio}</TableCell>
                  <TableCell>{orden.proveedores?.nombre}</TableCell>
                  <TableCell>
                    {new Date(orden.fecha_orden).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{formatCurrency(orden.total)}</TableCell>
                  <TableCell>{getStatusBadge(orden.status)}</TableCell>
                  <TableCell>
                    {orden.entregas_multiples ? (
                      <Badge variant="outline" className="gap-1">
                        <Truck className="h-3 w-3" />
                        Múltiples
                      </Badge>
                    ) : orden.fecha_entrega_programada ? (
                      new Date(orden.fecha_entrega_programada).toLocaleDateString()
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setOrdenSeleccionada(orden);
                        setAccionesDialogOpen(true);
                      }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingOrdenId ? "Editar Orden de Compra" : "Nueva Orden de Compra"}</DialogTitle>
            <DialogDescription>
              {editingOrdenId 
                ? "Modifica los detalles de la orden de compra."
                : "Crea una nueva orden de compra. Los precios quedarán registrados como historial."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Folio *</Label>
                <div className="relative">
                  <Input
                    value={folio}
                    onChange={(e) => setFolio(e.target.value)}
                    placeholder="OC-YYYYMM-0001"
                    required
                    disabled={generatingFolio || !editingOrdenId}
                    className={!editingOrdenId ? "bg-muted" : ""}
                  />
                  {generatingFolio && (
                    <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {!editingOrdenId && (
                  <p className="text-xs text-muted-foreground mt-1">Auto-generado</p>
                )}
              </div>
              <div>
                <Label>Proveedor *</Label>
                <Select 
                  value={proveedorId} 
                  onValueChange={(value) => {
                    setProveedorId(value);
                    setProductoSeleccionado(""); // Reset product when proveedor changes
                    setPrecioUnitario("");
                  }} 
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {proveedores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!entregasMultiples && (
                <div>
                  <Label>Fecha de Entrega Programada</Label>
                  <Input
                    type="date"
                    value={fechaEntrega}
                    onChange={(e) => setFechaEntrega(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Agregar Productos</h3>
                {proveedorId && productosProveedor.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {productosDisponibles.length} productos de este proveedor
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <Label>Producto</Label>
                  <Select
                    value={productoSeleccionado}
                    onValueChange={(value) => {
                      setProductoSeleccionado(value);
                      const prod = productosDisponibles.find((p) => p.id === value);
                      if (prod?.ultimo_costo_compra) {
                        setPrecioUnitario(prod.ultimo_costo_compra.toString());
                      }
                    }}
                    disabled={!proveedorId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={proveedorId ? "Seleccionar" : "Primero selecciona proveedor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {productosDisponibles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre}
                          {p.marca && <span className="text-xs text-muted-foreground ml-1">({p.marca})</span>}
                          {p.ultimo_costo_compra && (
                            <span className="text-xs text-muted-foreground ml-2">
                              - Último: ${p.ultimo_costo_compra}
                            </span>
                          )}
                        </SelectItem>
                      ))}
                      {productosDisponibles.length === 0 && proveedorId && (
                        <div className="p-2 text-sm text-muted-foreground">
                          No hay productos asociados a este proveedor
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder="0"
                    min="1"
                  />
                </div>
                <div className="col-span-3">
                  <Label>Precio Unitario</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={precioUnitario}
                    onChange={(e) => setPrecioUnitario(e.target.value)}
                    placeholder="0.00"
                    min="0"
                  />
                </div>
                <div className="col-span-2 flex items-end">
                  <Button type="button" onClick={agregarProducto} className="w-full">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {productosEnOrden.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead>Último Costo</TableHead>
                        <TableHead>Subtotal</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productosEnOrden.map((p, index) => (
                        <TableRow key={index}>
                          <TableCell>{p.nombre}</TableCell>
                          <TableCell>{p.cantidad.toLocaleString()}</TableCell>
                          <TableCell>${formatCurrency(p.precio_unitario)}</TableCell>
                          <TableCell>
                            {p.ultimo_costo ? (
                              <span className="text-xs text-muted-foreground">
                                ${formatCurrency(p.ultimo_costo)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>${formatCurrency(p.subtotal)}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => eliminarProducto(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Multiple Deliveries Section */}
            {productosEnOrden.length > 0 && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">Múltiples Entregas (Tráilers)</h3>
                      <p className="text-sm text-muted-foreground">
                        Divide la orden en varias entregas con fechas diferentes
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={entregasMultiples}
                    onCheckedChange={(checked) => {
                      setEntregasMultiples(checked);
                      if (!checked) {
                        setEntregasProgramadas([]);
                        setBultosPorEntrega("");
                      }
                    }}
                  />
                </div>

                {entregasMultiples && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-3 gap-4 items-end">
                      <div>
                        <Label>Total de bultos en la orden</Label>
                        <Input
                          value={cantidadTotalBultos.toLocaleString()}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <div>
                        <Label>Bultos por tráiler/entrega</Label>
                        <Input
                          type="number"
                          value={bultosPorEntrega}
                          onChange={(e) => setBultosPorEntrega(e.target.value)}
                          placeholder="Ej: 1200"
                          min="1"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={calcularEntregas}
                        disabled={!bultosPorEntrega || cantidadTotalBultos <= 0}
                      >
                        Calcular Entregas
                      </Button>
                    </div>

                    {entregasProgramadas.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Entrega #</TableHead>
                              <TableHead>Bultos</TableHead>
                              <TableHead>Fecha Programada</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entregasProgramadas.map((entrega, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  <Badge variant="outline">
                                    Tráiler {entrega.numero_entrega}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={entrega.cantidad_bultos}
                                    onChange={(e) => updateCantidadEntrega(index, parseInt(e.target.value) || 0)}
                                    className="w-24"
                                    min="1"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="date"
                                    value={entrega.fecha_programada}
                                    onChange={(e) => updateFechaEntrega(index, e.target.value)}
                                    placeholder="Pendiente"
                                  />
                                  {!entrega.fecha_programada && (
                                    <span className="text-xs text-amber-600 mt-1 block">Pendiente de programar</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="p-2 bg-muted text-sm text-muted-foreground text-center">
                          Total: {entregasProgramadas.reduce((sum, e) => sum + e.cantidad_bultos, 0).toLocaleString()} bultos en {entregasProgramadas.length} entregas
                          {entregasProgramadas.some(e => !e.fecha_programada) && (
                            <span className="text-amber-600 ml-2">
                              ({entregasProgramadas.filter(e => !e.fecha_programada).length} pendientes de fecha)
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {productosEnOrden.length > 0 && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${formatCurrency(subtotalOrden)}</span>
                  </div>
                  {ivaOrden > 0 && (
                    <div className="flex justify-between">
                      <span>IVA (16%):</span>
                      <span>${formatCurrency(ivaOrden)}</span>
                    </div>
                  )}
                  {iepsOrden > 0 && (
                    <div className="flex justify-between">
                      <span>IEPS (8%):</span>
                      <span>${formatCurrency(iepsOrden)}</span>
                    </div>
                  )}
                  {ivaOrden === 0 && iepsOrden === 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Impuestos:</span>
                      <span>$0.00</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>${formatCurrency(totalOrden)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createOrden.isPending || updateOrden.isPending}>
                {(createOrden.isPending || updateOrden.isPending) 
                  ? "Guardando..." 
                  : editingOrdenId ? "Guardar Cambios" : "Crear Orden"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <OrdenAccionesDialog
        open={accionesDialogOpen}
        onOpenChange={setAccionesDialogOpen}
        orden={ordenSeleccionada}
        onEdit={handleEditOrden}
      />

      <AutorizacionOCDialog
        open={autorizacionDialogOpen}
        onOpenChange={setAutorizacionDialogOpen}
        orden={ordenSeleccionada}
      />
    </Card>
  );
};

export default OrdenesCompraTab;
