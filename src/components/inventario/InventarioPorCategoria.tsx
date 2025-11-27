import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown, ChevronUp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LotesDesglose } from "@/components/productos/LotesDesglose";

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  stock_actual: number;
  precio_compra: number;
  precio_venta: number;
  unidad: string;
}

interface CategoriaAgrupada {
  categoria: string;
  productos: Producto[];
  stockTotal: number;
  valorTotal: number;
}

export const InventarioPorCategoria = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadProductos();
  }, []);

  const loadProductos = async () => {
    try {
      const { data, error } = await supabase
        .from("productos")
        .select("id, codigo, nombre, marca, categoria, stock_actual, precio_compra, precio_venta, unidad")
        .eq("activo", true)
        .order("categoria")
        .order("nombre");

      if (error) throw error;
      setProductos(data || []);
    } catch (error) {
      console.error("Error loading productos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Agrupar productos por categoría
  const categoriasAgrupadas: CategoriaAgrupada[] = (() => {
    const filteredProductos = productos.filter(p =>
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.marca?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.categoria?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const grouped = filteredProductos.reduce((acc, producto) => {
      const cat = producto.categoria || "Sin categoría";
      if (!acc[cat]) {
        acc[cat] = {
          categoria: cat,
          productos: [],
          stockTotal: 0,
          valorTotal: 0,
        };
      }
      acc[cat].productos.push(producto);
      acc[cat].stockTotal += producto.stock_actual;
      acc[cat].valorTotal += producto.stock_actual * producto.precio_compra;
      return acc;
    }, {} as Record<string, CategoriaAgrupada>);

    return Object.values(grouped).sort((a, b) => a.categoria.localeCompare(b.categoria));
  })();

  const toggleCategory = (categoria: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoria)) {
      newExpanded.delete(categoria);
    } else {
      newExpanded.add(categoria);
    }
    setExpandedCategories(newExpanded);
  };

  const expandAll = () => {
    setExpandedCategories(new Set(categoriasAgrupadas.map(c => c.categoria)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  if (loading) {
    return <div className="text-center py-8">Cargando inventario...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por producto, código, marca o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expandir todo
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Colapsar todo
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {categoriasAgrupadas.length} categorías • {productos.length} productos
        </div>
      </div>

      <div className="space-y-3">
        {categoriasAgrupadas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay productos que coincidan con la búsqueda
          </div>
        ) : (
          categoriasAgrupadas.map((categoria) => (
            <div key={categoria.categoria} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(categoria.categoria)}
                className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedCategories.has(categoria.categoria) ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                  <Package className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-lg">{categoria.categoria}</span>
                  <Badge variant="secondary">{categoria.productos.length} productos</Badge>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-sm text-muted-foreground">Stock Total</p>
                    <p className="font-bold text-lg">{categoria.stockTotal.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Inventario</p>
                    <p className="font-bold text-lg text-primary">
                      ${categoria.valorTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </button>

              {expandedCategories.has(categoria.categoria) && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right">Precio Venta</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Lotes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoria.productos.map((producto) => (
                      <TableRow key={producto.id}>
                        <TableCell className="font-mono">{producto.codigo}</TableCell>
                        <TableCell className="font-medium">{producto.nombre}</TableCell>
                        <TableCell>{producto.marca || "—"}</TableCell>
                        <TableCell className="text-right">
                          <span className={producto.stock_actual === 0 ? "text-destructive" : ""}>
                            {producto.stock_actual}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">{producto.unidad}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          ${producto.precio_compra.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${producto.precio_venta.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${(producto.stock_actual * producto.precio_compra).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <LotesDesglose
                            productoId={producto.id}
                            productoNombre={producto.nombre}
                            stockTotal={producto.stock_actual}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ))
        )}
      </div>

      {/* Totales globales */}
      {categoriasAgrupadas.length > 0 && (
        <div className="border-t pt-4 mt-6">
          <div className="flex justify-end gap-8">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Stock Total Global</p>
              <p className="font-bold text-2xl">
                {categoriasAgrupadas.reduce((sum, c) => sum + c.stockTotal, 0).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Valor Total Inventario</p>
              <p className="font-bold text-2xl text-primary">
                ${categoriasAgrupadas.reduce((sum, c) => sum + c.valorTotal, 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
