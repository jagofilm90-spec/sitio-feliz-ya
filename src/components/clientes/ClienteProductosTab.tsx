import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Trash2, Star, GripVertical, Package } from "lucide-react";

interface ClienteProductosTabProps {
  clienteId: string;
}

interface ProductoFrecuente {
  id: string;
  producto_id: string;
  es_especial: boolean;
  orden_display: number;
  producto: {
    id: string;
    nombre: string;
    codigo: string;
    unidad: string;
    precio_venta: number;
  };
}

interface ProductoDisponible {
  id: string;
  nombre: string;
  codigo: string;
  unidad: string;
  precio_venta: number;
}

export function ClienteProductosTab({ clienteId }: ClienteProductosTabProps) {
  const [productosFrecuentes, setProductosFrecuentes] = useState<ProductoFrecuente[]>([]);
  const [productosDisponibles, setProductosDisponibles] = useState<ProductoDisponible[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (clienteId) {
      loadData();
    }
  }, [clienteId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load client's frequent products
      const { data: frecuentes, error: frecuentesError } = await supabase
        .from("cliente_productos_frecuentes")
        .select(`
          id,
          producto_id,
          es_especial,
          orden_display,
          producto:productos(id, nombre, codigo, unidad, precio_venta)
        `)
        .eq("cliente_id", clienteId)
        .eq("activo", true)
        .order("orden_display");

      if (frecuentesError) throw frecuentesError;

      // Load all active products for search
      const { data: productos, error: productosError } = await supabase
        .from("productos")
        .select("id, nombre, codigo, unidad, precio_venta")
        .eq("activo", true)
        .order("nombre");

      if (productosError) throw productosError;

      setProductosFrecuentes((frecuentes || []).map(f => ({
        ...f,
        producto: f.producto as unknown as ProductoFrecuente['producto']
      })));
      setProductosDisponibles(productos || []);
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

  const agregarProducto = async (producto: ProductoDisponible, esEspecial: boolean = false) => {
    // Check if already added
    if (productosFrecuentes.some(pf => pf.producto_id === producto.id)) {
      toast({
        title: "Producto ya agregado",
        description: "Este producto ya está en la lista del cliente",
        variant: "destructive",
      });
      return;
    }

    try {
      const maxOrden = Math.max(...productosFrecuentes.map(p => p.orden_display), 0);
      
      const { data, error } = await supabase
        .from("cliente_productos_frecuentes")
        .insert({
          cliente_id: clienteId,
          producto_id: producto.id,
          es_especial: esEspecial,
          orden_display: maxOrden + 1,
        })
        .select(`
          id,
          producto_id,
          es_especial,
          orden_display,
          producto:productos(id, nombre, codigo, unidad, precio_venta)
        `)
        .single();

      if (error) throw error;

      setProductosFrecuentes([...productosFrecuentes, {
        ...data,
        producto: data.producto as unknown as ProductoFrecuente['producto']
      }]);
      setSearchTerm("");

      toast({
        title: "Producto agregado",
        description: `${producto.nombre} agregado a la lista del cliente`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo agregar el producto",
        variant: "destructive",
      });
    }
  };

  const eliminarProducto = async (id: string) => {
    try {
      const { error } = await supabase
        .from("cliente_productos_frecuentes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setProductosFrecuentes(productosFrecuentes.filter(p => p.id !== id));
      
      toast({
        title: "Producto eliminado",
        description: "El producto fue removido de la lista",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el producto",
        variant: "destructive",
      });
    }
  };

  const toggleEspecial = async (id: string, esEspecial: boolean) => {
    try {
      const { error } = await supabase
        .from("cliente_productos_frecuentes")
        .update({ es_especial: esEspecial })
        .eq("id", id);

      if (error) throw error;

      setProductosFrecuentes(productosFrecuentes.map(p =>
        p.id === id ? { ...p, es_especial: esEspecial } : p
      ));
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el producto",
        variant: "destructive",
      });
    }
  };

  const productosFiltrados = productosDisponibles.filter(p =>
    (p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase())) &&
    !productosFrecuentes.some(pf => pf.producto_id === p.id)
  );

  const productosRegulares = productosFrecuentes.filter(p => !p.es_especial);
  const productosEspeciales = productosFrecuentes.filter(p => p.es_especial);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and add products */}
      <div className="space-y-2">
        <Label>Agregar Producto</Label>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto por nombre o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {searchTerm && productosFiltrados.length > 0 && (
          <ScrollArea className="h-60 border rounded-lg">
            {productosFiltrados.slice(0, 20).map((producto) => (
              <div
                key={producto.id}
                className="p-3 hover:bg-muted flex justify-between items-center border-b last:border-b-0"
              >
                <div>
                  <p className="font-medium">{producto.nombre}</p>
                  <p className="text-sm text-muted-foreground">
                    {producto.codigo} - ${producto.precio_venta.toFixed(2)} / {producto.unidad}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => agregarProducto(producto, false)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Frecuente
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={() => agregarProducto(producto, true)}
                  >
                    <Star className="h-4 w-4 mr-1" />
                    Especial
                  </Button>
                </div>
              </div>
            ))}
          </ScrollArea>
        )}
        
        {searchTerm && productosFiltrados.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No se encontraron productos disponibles
          </p>
        )}
      </div>

      {/* Frequent products list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Productos Frecuentes</h3>
            <Badge variant="secondary">{productosRegulares.length}</Badge>
          </div>
        </div>

        {productosRegulares.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="w-[100px]">Especial</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productosRegulares.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.producto.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{item.producto.codigo}</TableCell>
                  <TableCell>${item.producto.precio_venta.toFixed(2)}</TableCell>
                  <TableCell>{item.producto.unidad}</TableCell>
                  <TableCell>
                    <Checkbox
                      checked={item.es_especial}
                      onCheckedChange={(checked) => toggleEspecial(item.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => eliminarProducto(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/30">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay productos frecuentes asignados</p>
            <p className="text-sm">Usa el buscador para agregar productos</p>
          </div>
        )}
      </div>

      {/* Special products list */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold">Productos Especiales</h3>
          <Badge variant="outline" className="border-amber-500 text-amber-600">
            {productosEspeciales.length}
          </Badge>
        </div>

        {productosEspeciales.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="w-[100px]">Especial</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productosEspeciales.map((item) => (
                <TableRow key={item.id} className="bg-amber-50/50 dark:bg-amber-950/20">
                  <TableCell className="font-medium">{item.producto.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{item.producto.codigo}</TableCell>
                  <TableCell>${item.producto.precio_venta.toFixed(2)}</TableCell>
                  <TableCell>{item.producto.unidad}</TableCell>
                  <TableCell>
                    <Checkbox
                      checked={item.es_especial}
                      onCheckedChange={(checked) => toggleEspecial(item.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => eliminarProducto(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-6 text-muted-foreground border rounded-lg border-dashed">
            <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Sin productos especiales</p>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Los productos frecuentes aparecen directamente en el portal del cliente. 
        Los productos especiales se muestran en una sección separada para pedidos ocasionales.
      </p>
    </div>
  );
}
