import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Trash2, Search, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import OrdenAccionesDialog from "./OrdenAccionesDialog";

interface ProductoEnOrden {
  producto_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  ultimo_costo?: number;
  subtotal: number;
}

const OrdenesCompraTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accionesDialogOpen, setAccionesDialogOpen] = useState(false);
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
            productos (nombre)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create orden de compra
  const createOrden = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const subtotal = productosEnOrden.reduce((sum, p) => sum + p.subtotal, 0);
      const impuestos = subtotal * 0.16; // 16% IVA
      const total = subtotal + impuestos;

      // Create orden
      const { data: orden, error: ordenError } = await supabase
        .from("ordenes_compra")
        .insert({
          folio,
          proveedor_id: proveedorId,
          fecha_entrega_programada: fechaEntrega || null,
          subtotal,
          impuestos,
          total,
          notas,
          creado_por: user.id,
          status: "pendiente",
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
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      toast({
        title: "Orden creada",
        description: "La orden de compra se ha creado exitosamente",
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

    const producto = productos.find((p) => p.id === productoSeleccionado);
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
      },
    ]);

    setProductoSeleccionado("");
    setCantidad("");
    setPrecioUnitario("");
  };

  const eliminarProducto = (index: number) => {
    setProductosEnOrden(productosEnOrden.filter((_, i) => i !== index));
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
  };

  // Update orden de compra
  const updateOrden = useMutation({
    mutationFn: async () => {
      if (!editingOrdenId) throw new Error("No order to update");

      const subtotal = productosEnOrden.reduce((sum, p) => sum + p.subtotal, 0);
      const impuestos = subtotal * 0.16;
      const total = subtotal + impuestos;

      // Update orden
      const { error: ordenError } = await supabase
        .from("ordenes_compra")
        .update({
          folio,
          proveedor_id: proveedorId,
          fecha_entrega_programada: fechaEntrega || null,
          subtotal,
          impuestos,
          total,
          notas,
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

  const handleEditOrden = (orden: any) => {
    setEditingOrdenId(orden.id);
    setFolio(orden.folio);
    setProveedorId(orden.proveedor_id);
    setFechaEntrega(orden.fecha_entrega_programada || "");
    setNotas(orden.notas || "");
    
    // Load products from order details
    const productos = (orden.ordenes_compra_detalles || []).map((d: any) => ({
      producto_id: d.producto_id,
      nombre: d.productos?.nombre || "Producto",
      cantidad: d.cantidad_ordenada,
      precio_unitario: d.precio_unitario_compra,
      subtotal: d.subtotal,
    }));
    setProductosEnOrden(productos);
    
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
  const impuestosOrden = subtotalOrden * 0.16;
  const totalOrden = subtotalOrden + impuestosOrden;

  const filteredOrdenes = ordenes.filter(
    (orden) =>
      orden.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      orden.proveedores?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any }> = {
      pendiente: { label: "Pendiente", variant: "secondary" },
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
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Orden de Compra
        </Button>
      </div>

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
              <TableHead>Entrega Programada</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrdenes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                  <TableCell>${orden.total.toLocaleString()}</TableCell>
                  <TableCell>{getStatusBadge(orden.status)}</TableCell>
                  <TableCell>
                    {orden.fecha_entrega_programada
                      ? new Date(orden.fecha_entrega_programada).toLocaleDateString()
                      : "-"}
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
                <Input
                  value={folio}
                  onChange={(e) => setFolio(e.target.value)}
                  placeholder="OC-001"
                  required
                />
              </div>
              <div>
                <Label>Proveedor *</Label>
                <Select value={proveedorId} onValueChange={setProveedorId} required>
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
              <div>
                <Label>Fecha de Entrega Programada</Label>
                <Input
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                />
              </div>
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
              <h3 className="font-semibold">Agregar Productos</h3>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <Label>Producto</Label>
                  <Select
                    value={productoSeleccionado}
                    onValueChange={(value) => {
                      setProductoSeleccionado(value);
                      const prod = productos.find((p) => p.id === value);
                      if (prod?.ultimo_costo_compra) {
                        setPrecioUnitario(prod.ultimo_costo_compra.toString());
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {productos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre}
                          {p.ultimo_costo_compra && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (Último: ${p.ultimo_costo_compra})
                            </span>
                          )}
                        </SelectItem>
                      ))}
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
                          <TableCell>{p.cantidad}</TableCell>
                          <TableCell>${p.precio_unitario}</TableCell>
                          <TableCell>
                            {p.ultimo_costo ? (
                              <span className="text-xs text-muted-foreground">
                                ${p.ultimo_costo}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>${p.subtotal.toLocaleString()}</TableCell>
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

            {productosEnOrden.length > 0 && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${subtotalOrden.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IVA (16%):</span>
                    <span>${impuestosOrden.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>${totalOrden.toLocaleString()}</span>
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
    </Card>
  );
};

export default OrdenesCompraTab;
