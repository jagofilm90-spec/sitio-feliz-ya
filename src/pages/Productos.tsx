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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LotesDesglose } from "@/components/productos/LotesDesglose";
import { NotificacionesSistema } from "@/components/NotificacionesSistema";
import { ScrollArea } from "@/components/ui/scroll-area";

const Productos = () => {
  const [productos, setProductos] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [tabActivo, setTabActivo] = useState<"activos" | "inactivos">("activos");
  const [codigoGapWarning, setCodigoGapWarning] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const { toast } = useToast();

  // Función para verificar huecos en la secuencia de códigos
  const checkCodigoGap = (codigo: string) => {
    if (!codigo) {
      setCodigoGapWarning(null);
      return;
    }

    // Extraer el número del código ingresado
    const numMatch = codigo.match(/(\d+)/);
    if (!numMatch) {
      setCodigoGapWarning(null);
      return;
    }

    const inputNum = parseInt(numMatch[1], 10);
    const prefix = codigo.slice(0, codigo.indexOf(numMatch[1]));
    const numLength = numMatch[1].length;

    // Obtener todos los códigos existentes con el mismo prefijo
    const existingCodes = productos
      .map(p => {
        const match = p.codigo.match(new RegExp(`^${prefix}(\\d{${numLength}})$`));
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(n => n !== null) as number[];

    // Buscar huecos en la secuencia
    const missingCodes: string[] = [];
    for (let i = 1; i < inputNum; i++) {
      if (!existingCodes.includes(i)) {
        const paddedNum = i.toString().padStart(numLength, '0');
        missingCodes.push(`${prefix}${paddedNum}`);
      }
    }

    if (missingCodes.length > 0) {
      const displayCodes = missingCodes.length <= 3 
        ? missingCodes.join(", ") 
        : `${missingCodes.slice(0, 3).join(", ")}... (${missingCodes.length} códigos faltantes)`;
      setCodigoGapWarning(`Códigos faltantes: ${displayCodes}`);
    } else {
      setCodigoGapWarning(null);
    }
  };

  // Función para verificar productos duplicados
  const checkDuplicateProduct = (nombre: string, marca: string, presentacion: string, unidad: string): string | null => {
    const normalizedNombre = nombre.trim().toLowerCase();
    const normalizedMarca = (marca || '').trim().toLowerCase();
    const normalizedPresentacion = (presentacion || '').trim();
    const normalizedUnidad = unidad;

    const duplicate = productos.find(p => {
      // Si estamos editando, excluir el producto actual
      if (editingProduct && p.id === editingProduct.id) return false;

      const pNombre = (p.nombre || '').trim().toLowerCase();
      const pMarca = (p.marca || '').trim().toLowerCase();
      const pPresentacion = (p.presentacion || '').trim();
      const pUnidad = p.unidad;

      // Es duplicado si coinciden nombre, marca, presentación Y unidad
      return pNombre === normalizedNombre &&
             pMarca === normalizedMarca &&
             pPresentacion === normalizedPresentacion &&
             pUnidad === normalizedUnidad;
    });

    if (duplicate) {
      return `Ya existe un producto con estas características: "${duplicate.nombre}" (${duplicate.codigo})`;
    }
    return null;
  };

  const [formData, setFormData] = useState<{
    codigo: string;
    nombre: string;
    marca: string;
    presentacion: string;
    unidad: "bulto" | "caja" | "churla";
    precio_por_kilo: boolean;
    precio_venta: string;
    precio_compra: string;
    stock_minimo: string;
    maneja_caducidad: boolean;
    aplica_iva: boolean;
    aplica_ieps: boolean;
    activo: boolean;
    requiere_fumigacion: boolean;
    fecha_ultima_fumigacion: string;
  }>({
    codigo: "",
    nombre: "",
    marca: "",
    presentacion: "",
    unidad: "bulto",
    precio_por_kilo: false,
    precio_venta: "",
    precio_compra: "",
    stock_minimo: "",
    maneja_caducidad: false,
    aplica_iva: false,
    aplica_ieps: false,
    activo: true,
    requiere_fumigacion: false,
    fecha_ultima_fumigacion: "",
  });

  useEffect(() => {
    loadProductos();
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
        .order("codigo");

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


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar producto duplicado
    const duplicateError = checkDuplicateProduct(formData.nombre, formData.marca, formData.presentacion, formData.unidad);
    if (duplicateError) {
      setDuplicateWarning(duplicateError);
      toast({
        title: "Producto duplicado",
        description: duplicateError,
        variant: "destructive",
      });
      return;
    }
    
    try {
      const productData = {
        codigo: formData.codigo,
        nombre: formData.nombre,
        marca: formData.marca || null,
        presentacion: formData.presentacion || null,
        unidad: formData.unidad,
        precio_por_kilo: formData.precio_por_kilo,
        precio_venta: parseFloat(formData.precio_venta),
        precio_compra: parseFloat(formData.precio_compra) || 0,
        stock_minimo: parseInt(formData.stock_minimo),
        maneja_caducidad: formData.maneja_caducidad,
        aplica_iva: formData.aplica_iva,
        aplica_ieps: formData.aplica_ieps,
        activo: formData.activo,
        requiere_fumigacion: formData.requiere_fumigacion,
        fecha_ultima_fumigacion: formData.fecha_ultima_fumigacion || null,
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
      marca: product.marca || "",
      presentacion: product.presentacion || "",
      unidad: product.unidad,
      precio_por_kilo: product.precio_por_kilo || false,
      precio_venta: product.precio_venta.toString(),
      precio_compra: product.precio_compra.toString(),
      stock_minimo: product.stock_minimo.toString(),
      maneja_caducidad: product.maneja_caducidad,
      aplica_iva: product.aplica_iva || false,
      aplica_ieps: product.aplica_ieps || false,
      activo: product.activo !== false,
      requiere_fumigacion: product.requiere_fumigacion || false,
      fecha_ultima_fumigacion: product.fecha_ultima_fumigacion || "",
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
    setCodigoGapWarning(null);
    setDuplicateWarning(null);
    setFormData({
      codigo: "",
      nombre: "",
      marca: "",
      presentacion: "",
      unidad: "bulto",
      precio_por_kilo: false,
      precio_venta: "",
      precio_compra: "",
      stock_minimo: "",
      maneja_caducidad: false,
      aplica_iva: false,
      aplica_ieps: false,
      activo: true,
      requiere_fumigacion: false,
      fecha_ultima_fumigacion: "",
    });
  };

  const filteredProductos = productos.filter((p) => {
    const matchesSearch = 
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.marca && p.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.presentacion && p.presentacion.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesActiveFilter = tabActivo === "inactivos" ? p.activo === false : p.activo !== false;
    
    return matchesSearch && matchesActiveFilter;
  });

  const productosActivos = productos.filter(p => p.activo !== false).length;
  const productosInactivos = productos.filter(p => p.activo === false).length;

  const calcularPrecioTotal = () => {
    if (!formData.precio_por_kilo || !formData.precio_venta || !formData.presentacion) {
      return null;
    }
    const precioUnitario = parseFloat(formData.precio_venta);
    const kilos = parseFloat(formData.presentacion);
    if (isNaN(precioUnitario) || isNaN(kilos)) return null;
    return (precioUnitario * kilos).toFixed(2);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <NotificacionesSistema />
        
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
                <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="activo" className="cursor-pointer">
                    Producto activo
                  </Label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código *</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) => {
                        setFormData({ ...formData, codigo: e.target.value });
                        checkCodigoGap(e.target.value);
                      }}
                      required
                      autoComplete="off"
                    />
                    {codigoGapWarning && !editingProduct && (
                      <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                        ⚠️ {codigoGapWarning}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unidad">Unidad *</Label>
                    <Select
                      value={formData.unidad}
                      onValueChange={(value: "bulto" | "caja" | "churla") => {
                        const newFormData = { ...formData, unidad: value };
                        setFormData(newFormData);
                        setDuplicateWarning(checkDuplicateProduct(newFormData.nombre, newFormData.marca, newFormData.presentacion, value));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bulto">Bulto</SelectItem>
                        <SelectItem value="caja">Caja</SelectItem>
                        <SelectItem value="churla">Churla</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nombre">Descripción del Producto *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => {
                      const nombre = e.target.value;
                      setFormData({ ...formData, nombre });
                      setDuplicateWarning(checkDuplicateProduct(nombre, formData.marca, formData.presentacion, formData.unidad));
                    }}
                    required
                    autoComplete="off"
                    placeholder="Ej: Alpiste, Azúcar, Frijol"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="marca">Marca</Label>
                    <Input
                      id="marca"
                      value={formData.marca}
                      onChange={(e) => {
                        const marca = e.target.value;
                        setFormData({ ...formData, marca });
                        setDuplicateWarning(checkDuplicateProduct(formData.nombre, marca, formData.presentacion, formData.unidad));
                      }}
                      placeholder="Ej: Morelos, Purina"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="presentacion">Presentación (Kilos) *</Label>
                    <Input
                      id="presentacion"
                      type="number"
                      step="0.01"
                      value={formData.presentacion}
                      onChange={(e) => {
                        const presentacion = e.target.value;
                        setFormData({ ...formData, presentacion });
                        setDuplicateWarning(checkDuplicateProduct(formData.nombre, formData.marca, presentacion, formData.unidad));
                      }}
                      placeholder="Ej: 25, 50"
                      autoComplete="off"
                      required
                    />
                  </div>
                </div>
                
                {duplicateWarning && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                    ❌ {duplicateWarning}
                  </p>
                )}
                
                <div className="flex items-center space-x-2 p-3 bg-muted rounded-md">
                  <input
                    type="checkbox"
                    id="precio_por_kilo"
                    checked={formData.precio_por_kilo}
                    onChange={(e) => setFormData({ ...formData, precio_por_kilo: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="precio_por_kilo" className="cursor-pointer">
                    Precio por kilo
                  </Label>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="precio_compra">Precio Compra</Label>
                    <Input
                      id="precio_compra"
                      type="number"
                      step="0.01"
                      value={formData.precio_compra}
                      onChange={(e) => setFormData({ ...formData, precio_compra: e.target.value })}
                      placeholder="0.00"
                      autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground">
                      Se actualizará desde Compras
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="precio_venta">
                      {formData.precio_por_kilo ? "Precio por Kilo *" : "Precio Venta *"}
                    </Label>
                    <Input
                      id="precio_venta"
                      type="number"
                      step="0.01"
                      value={formData.precio_venta}
                      onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                      required
                      autoComplete="off"
                    />
                    {formData.precio_por_kilo && calcularPrecioTotal() && (
                      <p className="text-xs text-primary font-medium">
                        Total del {formData.unidad}: ${calcularPrecioTotal()}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock_minimo">Stock Mínimo *</Label>
                    <Input
                      id="stock_minimo"
                      type="number"
                      value={formData.stock_minimo}
                      onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
                      required
                      autoComplete="off"
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
                <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="requiere_fumigacion"
                      checked={formData.requiere_fumigacion}
                      onChange={(e) => setFormData({ ...formData, requiere_fumigacion: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="requiere_fumigacion">Requiere fumigación cada 6 meses</Label>
                  </div>
                  {formData.requiere_fumigacion && (
                    <div className="space-y-2 ml-6">
                      <Label htmlFor="fecha_ultima_fumigacion">Fecha de última fumigación (opcional)</Label>
                      <Input
                        id="fecha_ultima_fumigacion"
                        type="date"
                        value={formData.fecha_ultima_fumigacion}
                        onChange={(e) => setFormData({ ...formData, fecha_ultima_fumigacion: e.target.value })}
                        autoComplete="off"
                      />
                      <p className="text-xs text-muted-foreground">
                        Si no se sabe, se registrará al recibir el producto en inventario
                      </p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="aplica_iva"
                      checked={formData.aplica_iva}
                      onChange={(e) => setFormData({ ...formData, aplica_iva: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="aplica_iva">Precio incluye IVA (16%)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="aplica_ieps"
                      checked={formData.aplica_ieps}
                      onChange={(e) => setFormData({ ...formData, aplica_ieps: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="aplica_ieps">Precio incluye IEPS (8%)</Label>
                  </div>
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

        <div className="flex gap-4 items-center mb-4">
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

        <Tabs value={tabActivo} onValueChange={(value) => setTabActivo(value as "activos" | "inactivos")}>
          <TabsList>
            <TabsTrigger value="activos">
              Activos ({productosActivos})
            </TabsTrigger>
            <TabsTrigger value="inactivos">
              Inactivos ({productosInactivos})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tabActivo} className="mt-4">
            <div className="border rounded-lg">
              <ScrollArea className="h-[calc(100vh-330px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Presentación</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Precio</TableHead>
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
                  filteredProductos.map((producto) => {
                    const precioMostrar = producto.precio_por_kilo && producto.presentacion
                      ? `$${producto.precio_venta.toFixed(2)}/kg ($${(producto.precio_venta * parseFloat(producto.presentacion)).toFixed(2)})`
                      : `$${producto.precio_venta.toFixed(2)}`;
                    
                    return (
                      <TableRow key={producto.id} className={producto.activo === false ? "opacity-50" : ""}>
                        <TableCell className="font-medium">
                          {producto.codigo}
                          {producto.activo === false && (
                            <Badge variant="secondary" className="ml-2 text-xs">Inactivo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span>{producto.nombre}</span>
                            {producto.aplica_iva && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">
                                IVA
                              </Badge>
                            )}
                            {producto.aplica_ieps && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                                IEPS
                              </Badge>
                            )}
                            {producto.maneja_caducidad && <span className="ml-1">📅</span>}
                            {producto.requiere_fumigacion && <span>🦠</span>}
                          </div>
                        </TableCell>
                        <TableCell>{producto.marca || "-"}</TableCell>
                        <TableCell>{producto.presentacion ? `${producto.presentacion} kg` : "-"}</TableCell>
                        <TableCell className="uppercase">{producto.unidad}</TableCell>
                        <TableCell className="font-medium">{precioMostrar}</TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            {producto.stock_actual === 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                Sin Stock
                              </Badge>
                            ) : (
                              <Badge variant={producto.stock_actual <= producto.stock_minimo ? "destructive" : "default"}>
                                {producto.stock_actual}
                              </Badge>
                            )}
                            <LotesDesglose
                              productoId={producto.id}
                              productoNombre={producto.nombre}
                              stockTotal={producto.stock_actual}
                            />
                          </div>
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
                    );
                  })
                )}
              </TableBody>
            </Table>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Productos;