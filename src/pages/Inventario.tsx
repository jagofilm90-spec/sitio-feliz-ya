import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NotificacionesSistema } from "@/components/NotificacionesSistema";

const Inventario = () => {
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMovimiento, setEditingMovimiento] = useState<any | null>(null);
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterFechaInicio, setFilterFechaInicio] = useState("");
  const [filterFechaFin, setFilterFechaFin] = useState("");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    producto_id: "",
    tipo_movimiento: "entrada",
    cantidad: "",
    fecha_caducidad: "",
    fecha_ultima_fumigacion: "",
    lote: "",
    referencia: "",
    notas: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [movimientosData, productosData] = await Promise.all([
        supabase
          .from("inventario_movimientos")
          .select(`
            *,
            productos (nombre, codigo),
            profiles:usuario_id (full_name)
          `)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("productos")
          .select("id, codigo, nombre, stock_actual, maneja_caducidad, requiere_fumigacion, fecha_ultima_fumigacion")
          .eq("activo", true)
          .order("nombre"),
      ]);

      if (movimientosData.error) throw movimientosData.error;
      if (productosData.error) throw productosData.error;

      setMovimientos(movimientosData.data || []);
      setProductos(productosData.data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar fecha de caducidad si el producto la requiere
    if (selectedProduct?.maneja_caducidad && !formData.fecha_caducidad) {
      toast({
        title: "Error",
        description: "Este producto requiere fecha de caducidad",
        variant: "destructive",
      });
      return;
    }

    // Validar fecha de fumigación si el producto la requiere y es una entrada
    if (formData.tipo_movimiento === "entrada" && selectedProduct?.requiere_fumigacion && !formData.fecha_ultima_fumigacion) {
      toast({
        title: "Error",
        description: "Este producto requiere fecha de última fumigación",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("No hay sesión activa");

      const movimientoData = {
        producto_id: formData.producto_id,
        tipo_movimiento: formData.tipo_movimiento,
        cantidad: parseInt(formData.cantidad),
        fecha_caducidad: formData.fecha_caducidad || null,
        lote: formData.lote || null,
        referencia: formData.referencia || null,
        notas: formData.notas || null,
        usuario_id: session.session.user.id,
      };

      let error;

      if (isEditing && editingMovimiento) {
        ({ error } = await supabase
          .from("inventario_movimientos")
          .update(movimientoData)
          .eq("id", editingMovimiento.id));
      } else {
        ({ error } = await supabase
          .from("inventario_movimientos")
          .insert([movimientoData]));
      }

      if (error) throw error;

      // Si es una entrada y el producto requiere fumigación, actualizar la fecha en el producto
      if (formData.tipo_movimiento === "entrada" && selectedProduct?.requiere_fumigacion && formData.fecha_ultima_fumigacion) {
        const { error: updateError } = await supabase
          .from("productos")
          .update({ fecha_ultima_fumigacion: formData.fecha_ultima_fumigacion })
          .eq("id", formData.producto_id);
        
        if (updateError) {
          console.error("Error actualizando fecha de fumigación:", updateError);
        }
      }

      toast({ title: isEditing ? "Movimiento actualizado" : "Movimiento registrado correctamente" });
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setIsEditing(false);
    setEditingMovimiento(null);
    setFormData({
      producto_id: "",
      tipo_movimiento: "entrada",
      cantidad: "",
      fecha_caducidad: "",
      fecha_ultima_fumigacion: "",
      lote: "",
      referencia: "",
      notas: "",
    });
  };

  const handleProductChange = (productoId: string) => {
    const producto = productos.find((p) => p.id === productoId);
    setSelectedProduct(producto);
    setFormData({ ...formData, producto_id: productoId });
  };

  const handleEditMovimiento = (movimiento: any) => {
    setIsEditing(true);
    setEditingMovimiento(movimiento);
    setSelectedProduct(productos.find((p) => p.id === movimiento.producto_id));
    setFormData({
      producto_id: movimiento.producto_id,
      tipo_movimiento: movimiento.tipo_movimiento,
      cantidad: String(movimiento.cantidad),
      fecha_caducidad: movimiento.fecha_caducidad || "",
      fecha_ultima_fumigacion: "",
      lote: movimiento.lote || "",
      referencia: movimiento.referencia || "",
      notas: movimiento.notas || "",
    });
    setDialogOpen(true);
  };

  const handleDeleteMovimiento = async (movimiento: any) => {
    const confirmar = window.confirm(
      "¿Seguro que quieres eliminar este movimiento de inventario? Esto afectará el stock."
    );
    if (!confirmar) return;

    try {
      const { error } = await supabase
        .from("inventario_movimientos")
        .delete()
        .eq("id", movimiento.id);

      if (error) throw error;

      toast({ title: "Movimiento eliminado" });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error al eliminar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredMovimientos = movimientos.filter((m) => {
    // Filtro por búsqueda de texto
    const matchesSearch = 
      m.productos?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.productos?.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.lote?.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtro por tipo de movimiento
    const matchesTipo = filterTipo === "todos" || m.tipo_movimiento === filterTipo;

    // Filtro por rango de fechas
    let matchesFecha = true;
    if (filterFechaInicio || filterFechaFin) {
      const movimientoFecha = new Date(m.created_at).toISOString().split('T')[0];
      if (filterFechaInicio && movimientoFecha < filterFechaInicio) matchesFecha = false;
      if (filterFechaFin && movimientoFecha > filterFechaFin) matchesFecha = false;
    }

    return matchesSearch && matchesTipo && matchesFecha;
  });

  const getTipoMovimientoBadge = (tipo: string) => {
    const variants: Record<string, any> = {
      entrada: "default",
      salida: "destructive",
      ajuste: "secondary",
    };

    return (
      <Badge variant={variants[tipo] || "default"}>
        {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
      </Badge>
    );
  };

  const getStockChangeIndicator = (stockAnterior: number | null, stockNuevo: number | null, tipoMovimiento: string) => {
    if (stockAnterior === null || stockNuevo === null) return null;
    
    const diferencia = stockNuevo - stockAnterior;
    
    if (diferencia > 0) {
      return (
        <div className="flex items-center gap-2">
          <span className="font-semibold">{stockNuevo}</span>
          <div className="flex items-center gap-1 text-green-600">
            <ArrowUp className="h-4 w-4" />
            <span className="text-xs font-medium">+{diferencia}</span>
          </div>
        </div>
      );
    } else if (diferencia < 0) {
      return (
        <div className="flex items-center gap-2">
          <span className="font-semibold">{stockNuevo}</span>
          <div className="flex items-center gap-1 text-red-600">
            <ArrowDown className="h-4 w-4" />
            <span className="text-xs font-medium">{diferencia}</span>
          </div>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2">
          <span className="font-semibold">{stockNuevo}</span>
          <div className="flex items-center gap-1 text-yellow-600">
            <Minus className="h-4 w-4" />
            <span className="text-xs font-medium">0</span>
          </div>
        </div>
      );
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <NotificacionesSistema />
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Inventario</h1>
            <p className="text-muted-foreground">Control de movimientos de inventario</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                {isEditing ? "Editar movimiento" : "Registrar Movimiento"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {isEditing ? "Editar Movimiento de Inventario" : "Registrar Movimiento de Inventario"}
                </DialogTitle>
                <DialogDescription>
                  Registra entradas, salidas o ajustes de inventario
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="producto_id">Producto *</Label>
                    <Select
                      value={formData.producto_id}
                      onValueChange={handleProductChange}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {productos.map((producto) => (
                          <SelectItem key={producto.id} value={producto.id}>
                            {producto.codigo} - {producto.nombre} (Stock: {producto.stock_actual})
                            {producto.maneja_caducidad && " 📅"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo_movimiento">Tipo de Movimiento *</Label>
                    <Select
                      value={formData.tipo_movimiento}
                      onValueChange={(value) => setFormData({ ...formData, tipo_movimiento: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada</SelectItem>
                        <SelectItem value="salida">Salida</SelectItem>
                        <SelectItem value="ajuste">Ajuste</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cantidad">Cantidad *</Label>
                    <Input
                      id="cantidad"
                      type="number"
                      value={formData.cantidad}
                      onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                      required
                    />
                  </div>
                  {selectedProduct?.maneja_caducidad && (
                    <div className="space-y-2">
                      <Label htmlFor="fecha_caducidad">Fecha de Caducidad *</Label>
                      <Input
                        id="fecha_caducidad"
                        type="date"
                        value={formData.fecha_caducidad}
                        onChange={(e) => setFormData({ ...formData, fecha_caducidad: e.target.value })}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Este producto requiere fecha de caducidad
                      </p>
                    </div>
                  )}
                 </div>
                {formData.tipo_movimiento === "entrada" && selectedProduct?.requiere_fumigacion && (
                  <div className="space-y-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <Label htmlFor="fecha_ultima_fumigacion">Fecha de última fumigación *</Label>
                    <Input
                      id="fecha_ultima_fumigacion"
                      type="date"
                      value={formData.fecha_ultima_fumigacion}
                      onChange={(e) => setFormData({ ...formData, fecha_ultima_fumigacion: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Este producto requiere registro de fumigación
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lote">Lote</Label>
                    <Input
                      id="lote"
                      value={formData.lote}
                      onChange={(e) => setFormData({ ...formData, lote: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="referencia">Referencia</Label>
                    <Input
                      id="referencia"
                      value={formData.referencia}
                      onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notas">Notas</Label>
                  <Input
                    id="notas"
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">{isEditing ? "Guardar cambios" : "Registrar"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por producto, código o lote..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo de movimiento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="salida">Salidas</SelectItem>
                <SelectItem value="ajuste">Ajustes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-4 flex-wrap items-end">
            <div className="space-y-2">
              <Label htmlFor="fecha_inicio">Desde</Label>
              <Input
                id="fecha_inicio"
                type="date"
                value={filterFechaInicio}
                onChange={(e) => setFilterFechaInicio(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha_fin">Hasta</Label>
              <Input
                id="fecha_fin"
                type="date"
                value={filterFechaFin}
                onChange={(e) => setFilterFechaFin(e.target.value)}
                className="w-[180px]"
              />
            </div>
            {(filterTipo !== "todos" || filterFechaInicio || filterFechaFin) && (
              <Button
                variant="outline"
                onClick={() => {
                  setFilterTipo("todos");
                  setFilterFechaInicio("");
                  setFilterFechaFin("");
                }}
              >
                Limpiar filtros
              </Button>
            )}
            <div className="ml-auto text-sm text-muted-foreground">
              Mostrando {filteredMovimientos.length} de {movimientos.length} movimientos
            </div>
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Stock Anterior</TableHead>
                <TableHead>Stock Nuevo</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Caducidad</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead className="w-[140px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filteredMovimientos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center">
                    No hay movimientos registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredMovimientos.map((movimiento) => (
                  <TableRow key={movimiento.id}>
                    <TableCell className="font-mono text-xs">
                      <div>{new Date(movimiento.created_at).toLocaleDateString('es-MX')}</div>
                      <div className="text-muted-foreground">
                        {new Date(movimiento.created_at).toLocaleTimeString('es-MX')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {movimiento.productos?.codigo} - {movimiento.productos?.nombre}
                    </TableCell>
                    <TableCell>{getTipoMovimientoBadge(movimiento.tipo_movimiento)}</TableCell>
                    <TableCell className="font-semibold">{movimiento.cantidad}</TableCell>
                    <TableCell className="text-muted-foreground">{movimiento.stock_anterior ?? "—"}</TableCell>
                    <TableCell>
                      {movimiento.stock_anterior !== null && movimiento.stock_nuevo !== null
                        ? getStockChangeIndicator(movimiento.stock_anterior, movimiento.stock_nuevo, movimiento.tipo_movimiento)
                        : movimiento.stock_nuevo ?? "—"}
                    </TableCell>
                    <TableCell>{movimiento.lote || "—"}</TableCell>
                    <TableCell>
                      {movimiento.fecha_caducidad
                        ? new Date(movimiento.fecha_caducidad).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>{movimiento.profiles?.full_name || "—"}</TableCell>
                    <TableCell>{movimiento.referencia || "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditMovimiento(movimiento)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteMovimiento(movimiento)}
                      >
                        Eliminar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
};

export default Inventario;