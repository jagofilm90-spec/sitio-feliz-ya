import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Search, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProveedorProductosSelectorProps {
  proveedorId: string;
  proveedorNombre: string;
}

const ProveedorProductosSelector = ({ proveedorId, proveedorNombre }: ProveedorProductosSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all products
  const { data: productos = [] } = useQuery({
    queryKey: ["productos-activos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("id, nombre, codigo, marca, presentacion")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // Fetch products associated with this supplier
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

  const toggleProducto = useMutation({
    mutationFn: async ({ productoId, isSelected }: { productoId: string; isSelected: boolean }) => {
      if (isSelected) {
        // Remove association
        const { error } = await supabase
          .from("proveedor_productos")
          .delete()
          .eq("proveedor_id", proveedorId)
          .eq("producto_id", productoId);
        if (error) throw error;
      } else {
        // Add association
        const { error } = await supabase
          .from("proveedor_productos")
          .insert({ proveedor_id: proveedorId, producto_id: productoId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proveedor-productos", proveedorId] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const filteredProductos = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.marca && p.marca.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        <Label className="text-base font-semibold">
          Productos que vende {proveedorNombre}
        </Label>
        <Badge variant="secondary">{productosProveedor.length} seleccionados</Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar productos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <ScrollArea className="h-[300px] rounded-md border p-4">
        <div className="space-y-3">
          {filteredProductos.map((producto) => {
            const isSelected = productosProveedor.includes(producto.id);
            return (
              <div
                key={producto.id}
                className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                onClick={() => toggleProducto.mutate({ productoId: producto.id, isSelected })}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleProducto.mutate({ productoId: producto.id, isSelected })}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{producto.nombre}</span>
                    {producto.marca && (
                      <Badge variant="outline" className="text-xs">
                        {producto.marca}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {producto.codigo}
                    {producto.presentacion && ` • ${producto.presentacion}kg`}
                  </div>
                </div>
              </div>
            );
          })}
          {filteredProductos.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              No se encontraron productos
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ProveedorProductosSelector;
