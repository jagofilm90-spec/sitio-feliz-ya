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
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NotificacionesCaducidad } from "@/components/NotificacionesCaducidad";

const Inventario = () => {
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    producto_id: "",
    tipo_movimiento: "entrada",
    cantidad: "",
    fecha_caducidad: "",
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
          .select("id, codigo, nombre, stock_actual, maneja_caducidad")
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

      const { error } = await supabase
        .from("inventario_movimientos")
        .insert([movimientoData]);

      if (error) throw error;

      toast({ title: "Movimiento registrado correctamente" });
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
    setFormData({
      producto_id: "",
      tipo_movimiento: "entrada",
      cantidad: "",
      fecha_caducidad: "",
      lote: "",
      referencia: "",
      notas: "",
    });
  };

  const handleProductChange = (productoId: string) => {
    const producto = productos.find(p => p.id === productoId);
    setSelectedProduct(producto);
    setFormData({ ...formData, producto_id: productoId });
  };

  const filteredMovimientos = movimientos.filter(
    (m) =>
      m.productos?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.productos?.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.lote?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <Layout>
      <div className="space-y-6">
        <NotificacionesCaducidad />
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Inventario</h1>
            <p className="text-muted-foreground">Control de movimientos de inventario</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Registrar Movimiento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Registrar Movimiento de Inventario</DialogTitle>
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
                  <div className="space-y-2">
                    <Label htmlFor="fecha_caducidad">
                      Fecha de Caducidad {selectedProduct?.maneja_caducidad && "*"}
                    </Label>
                    <Input
                      id="fecha_caducidad"
                      type="date"
                      value={formData.fecha_caducidad}
                      onChange={(e) => setFormData({ ...formData, fecha_caducidad: e.target.value })}
                      required={selectedProduct?.maneja_caducidad}
                    />
                    {selectedProduct?.maneja_caducidad && (
                      <p className="text-xs text-muted-foreground">
                        Este producto requiere fecha de caducidad
                      </p>
                    )}
                  </div>
                </div>
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
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Registrar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por producto, código o lote..."
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
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Caducidad</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Referencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filteredMovimientos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    No hay movimientos registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredMovimientos.map((movimiento) => (
                  <TableRow key={movimiento.id}>
                    <TableCell>
                      {new Date(movimiento.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {movimiento.productos?.codigo} - {movimiento.productos?.nombre}
                    </TableCell>
                    <TableCell>{getTipoMovimientoBadge(movimiento.tipo_movimiento)}</TableCell>
                    <TableCell>{movimiento.cantidad}</TableCell>
                    <TableCell>{movimiento.lote || "—"}</TableCell>
                    <TableCell>
                      {movimiento.fecha_caducidad
                        ? new Date(movimiento.fecha_caducidad).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>{movimiento.profiles?.full_name || "—"}</TableCell>
                    <TableCell>{movimiento.referencia || "—"}</TableCell>
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