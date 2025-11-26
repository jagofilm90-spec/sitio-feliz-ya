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
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Productos = () => {
  const [productos, setProductos] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<{
    codigo: string;
    nombre: string;
    descripcion: string;
    marca: string;
    presentacion: string;
    categoria: string;
    unidad: "kg" | "pieza" | "caja" | "bulto" | "costal" | "litro";
    precio_venta: string;
    precio_compra: string;
    stock_minimo: string;
    maneja_caducidad: boolean;
    proveedor_preferido_id: string;
  }>({
    codigo: "",
    nombre: "",
    descripcion: "",
    marca: "",
    presentacion: "",
    categoria: "",
    unidad: "pieza",
    precio_venta: "",
    precio_compra: "",
    stock_minimo: "",
    maneja_caducidad: false,
    proveedor_preferido_id: "",
  });

  useEffect(() => {
    loadProductos();
    loadProveedores();
  }, []);

  const loadProductos = async () => {
    try {
      const { data, error } = await supabase
        .from("productos")
        .select(`
          *,
          proveedores:proveedor_preferido_id (
            id,
            nombre
          )
        `)
        .order("nombre");

      if (error) throw error;
      setProductos(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProveedores = async () => {
    try {
      const { data, error } = await supabase
        .from("proveedores")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;
      setProveedores(data || []);
    } catch (error: any) {
      console.error("Error loading proveedores:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const productData = {
        ...formData,
        precio_venta: parseFloat(formData.precio_venta),
        precio_compra: parseFloat(formData.precio_compra),
        stock_minimo: parseInt(formData.stock_minimo),
        proveedor_preferido_id: formData.proveedor_preferido_id || null,
        marca: formData.marca || null,
        presentacion: formData.presentacion || null,
        categoria: formData.categoria || null,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("productos")
          .update(productData)
          .eq("id", editingProduct.id);

        if (error) throw error;
        toast({ title: "Producto actualizado correctamente" });
      } else {
        const { error } = await supabase
          .from("productos")
          .insert([productData]);

        if (error) throw error;
        toast({ title: "Producto creado correctamente" });
      }

      setDialogOpen(false);
      resetForm();
      loadProductos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      codigo: product.codigo,
      nombre: product.nombre,
      descripcion: product.descripcion || "",
      marca: product.marca || "",
      presentacion: product.presentacion || "",
      categoria: product.categoria || "",
      unidad: product.unidad,
      precio_venta: product.precio_venta.toString(),
      precio_compra: product.precio_compra.toString(),
      stock_minimo: product.stock_minimo.toString(),
      maneja_caducidad: product.maneja_caducidad,
      proveedor_preferido_id: product.proveedor_preferido_id || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;

    try {
      const { error } = await supabase
        .from("productos")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Producto eliminado" });
      loadProductos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      codigo: "",
      nombre: "",
      descripcion: "",
      marca: "",
      presentacion: "",
      categoria: "",
      unidad: "pieza",
      precio_venta: "",
      precio_compra: "",
      stock_minimo: "",
      maneja_caducidad: false,
      proveedor_preferido_id: "",
    });
  };

  const filteredProductos = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.marca && p.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.categoria && p.categoria.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.presentacion && p.presentacion.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Productos</h1>
            <p className="text-muted-foreground">Gestión de catálogo de productos</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Editar Producto" : "Nuevo Producto"}
                </DialogTitle>
                <DialogDescription>
                  Completa la información del producto
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código *</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unidad">Unidad *</Label>
                    <Select
                      value={formData.unidad}
                      onValueChange={(value: "kg" | "pieza" | "caja" | "bulto" | "costal" | "litro") => setFormData({ ...formData, unidad: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Kilogramo</SelectItem>
                        <SelectItem value="pieza">Pieza</SelectItem>
                        <SelectItem value="caja">Caja</SelectItem>
                        <SelectItem value="bulto">Bulto</SelectItem>
                        <SelectItem value="costal">Costal</SelectItem>
                        <SelectItem value="litro">Litro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="marca">Marca</Label>
                    <Input
                      id="marca"
                      value={formData.marca}
                      onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                      placeholder="Ej: Almasa, Morelos, Purina"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="presentacion">Presentación</Label>
                    <Input
                      id="presentacion"
                      value={formData.presentacion}
                      onChange={(e) => setFormData({ ...formData, presentacion: e.target.value })}
                      placeholder="Ej: 25 KG, 50 KG"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoría</Label>
                    <Input
                      id="categoria"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      placeholder="Ej: Azúcar, Arroz, Alimentos"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proveedor_preferido">Proveedor Preferido</Label>
                    <Select
                      value={formData.proveedor_preferido_id}
                      onValueChange={(value) => setFormData({ ...formData, proveedor_preferido_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar proveedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin proveedor</SelectItem>
                        {proveedores.map((proveedor) => (
                          <SelectItem key={proveedor.id} value={proveedor.id}>
                            {proveedor.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Input
                    id="descripcion"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="precio_compra">Precio Compra *</Label>
                    <Input
                      id="precio_compra"
                      type="number"
                      step="0.01"
                      value={formData.precio_compra}
                      onChange={(e) => setFormData({ ...formData, precio_compra: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="precio_venta">Precio Venta *</Label>
                    <Input
                      id="precio_venta"
                      type="number"
                      step="0.01"
                      value={formData.precio_venta}
                      onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock_minimo">Stock Mínimo *</Label>
                    <Input
                      id="stock_minimo"
                      type="number"
                      value={formData.stock_minimo}
                      onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="maneja_caducidad"
                    checked={formData.maneja_caducidad}
                    onChange={(e) => setFormData({ ...formData, maneja_caducidad: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="maneja_caducidad">Maneja fecha de caducidad</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Guardar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o código..."
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
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Presentación</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Precio Venta</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filteredProductos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    No hay productos registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredProductos.map((producto) => (
                  <TableRow key={producto.id}>
                    <TableCell className="font-medium">{producto.codigo}</TableCell>
                    <TableCell>{producto.nombre}</TableCell>
                    <TableCell>{producto.marca || "-"}</TableCell>
                    <TableCell>{producto.presentacion || "-"}</TableCell>
                    <TableCell>{producto.categoria || "-"}</TableCell>
                    <TableCell>${producto.precio_venta.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={producto.stock_actual <= producto.stock_minimo ? "destructive" : "default"}>
                        {producto.stock_actual}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(producto)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(producto.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

export default Productos;