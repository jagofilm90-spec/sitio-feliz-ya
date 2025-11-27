import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

interface ProductoRentabilidad {
  id: string;
  codigo: string;
  nombre: string;
  marca: string | null;
  precio_compra: number;
  precio_venta: number;
  margen_pesos: number;
  margen_porcentaje: number;
  stock_actual: number;
  valor_inventario: number;
}

const Rentabilidad = () => {
  const [productos, setProductos] = useState<ProductoRentabilidad[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<ProductoRentabilidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [ordenamiento, setOrdenamiento] = useState("margen_desc");

  useEffect(() => {
    loadProductos();
  }, []);

  useEffect(() => {
    filterAndSort();
  }, [productos, searchTerm, ordenamiento]);

  const loadProductos = async () => {
    try {
      const { data, error } = await supabase
        .from("productos")
        .select("id, codigo, nombre, marca, precio_compra, precio_venta, stock_actual")
        .eq("activo", true)
        .gt("precio_compra", 0)
        .gt("precio_venta", 0)
        .order("nombre");

      if (error) throw error;

      const productosConMargen: ProductoRentabilidad[] = (data || []).map((p) => {
        const margen_pesos = p.precio_venta - p.precio_compra;
        const margen_porcentaje = (margen_pesos / p.precio_compra) * 100;
        const valor_inventario = p.stock_actual * p.precio_compra;

        return {
          id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          marca: p.marca,
          precio_compra: p.precio_compra,
          precio_venta: p.precio_venta,
          margen_pesos,
          margen_porcentaje,
          stock_actual: p.stock_actual,
          valor_inventario,
        };
      });

      setProductos(productosConMargen);
    } catch (error) {
      console.error("Error cargando productos:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSort = () => {
    let filtered = productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.marca && p.marca.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Ordenar
    switch (ordenamiento) {
      case "margen_desc":
        filtered.sort((a, b) => b.margen_porcentaje - a.margen_porcentaje);
        break;
      case "margen_asc":
        filtered.sort((a, b) => a.margen_porcentaje - b.margen_porcentaje);
        break;
      case "venta_desc":
        filtered.sort((a, b) => b.precio_venta - a.precio_venta);
        break;
      case "valor_inv_desc":
        filtered.sort((a, b) => b.valor_inventario - a.valor_inventario);
        break;
      default:
        break;
    }

    setFilteredProductos(filtered);
  };

  const getMargenBadge = (porcentaje: number) => {
    if (porcentaje < 10) {
      return <Badge variant="destructive">Bajo ({porcentaje.toFixed(1)}%)</Badge>;
    } else if (porcentaje < 30) {
      return <Badge variant="secondary">Medio ({porcentaje.toFixed(1)}%)</Badge>;
    } else {
      return <Badge variant="default">Alto ({porcentaje.toFixed(1)}%)</Badge>;
    }
  };

  const calcularResumen = () => {
    const totalProductos = filteredProductos.length;
    const margenPromedio = filteredProductos.length > 0
      ? filteredProductos.reduce((sum, p) => sum + p.margen_porcentaje, 0) / filteredProductos.length
      : 0;
    const valorInventarioTotal = filteredProductos.reduce((sum, p) => sum + p.valor_inventario, 0);
    const productosMargenBajo = filteredProductos.filter(p => p.margen_porcentaje < 10).length;

    return { totalProductos, margenPromedio, valorInventarioTotal, productosMargenBajo };
  };

  const resumen = calcularResumen();

  // Top 10 productos por margen para gráfico
  const topProductos = [...filteredProductos]
    .sort((a, b) => b.margen_porcentaje - a.margen_porcentaje)
    .slice(0, 10)
    .map(p => ({
      nombre: p.codigo,
      margen: parseFloat(p.margen_porcentaje.toFixed(1)),
    }));

  const getBarColor = (margen: number) => {
    if (margen < 10) return "#ef4444";
    if (margen < 30) return "#f59e0b";
    return "#10b981";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Análisis de Rentabilidad</h1>
          <p className="text-muted-foreground">Comparación de precios de compra vs venta por producto</p>
        </div>

        {/* Resumen Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productos Analizados</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resumen.totalProductos}</div>
              <p className="text-xs text-muted-foreground">Con precios definidos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Margen Promedio</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resumen.margenPromedio.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Sobre precio de compra</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor de Inventario</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${resumen.valorInventarioTotal.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">A precio de compra</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Margen Bajo</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resumen.productosMargenBajo}</div>
              <p className="text-xs text-muted-foreground">Productos con &lt;10% margen</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico Top 10 */}
        {topProductos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Productos por Margen</CardTitle>
              <CardDescription>Productos con mayor porcentaje de utilidad</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProductos} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="nombre" type="category" width={80} style={{ fontSize: '11px' }} />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Bar dataKey="margen" name="Margen %">
                    {topProductos.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.margen)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Detalle por Producto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="w-[200px]">
                <Select value={ordenamiento} onValueChange={setOrdenamiento}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="margen_desc">Mayor margen %</SelectItem>
                    <SelectItem value="margen_asc">Menor margen %</SelectItem>
                    <SelectItem value="venta_desc">Mayor precio venta</SelectItem>
                    <SelectItem value="valor_inv_desc">Mayor valor inventario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabla */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead className="text-right">Precio Compra</TableHead>
                    <TableHead className="text-right">Precio Venta</TableHead>
                    <TableHead className="text-right">Margen $</TableHead>
                    <TableHead>Margen %</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Valor Inv.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : filteredProductos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        No hay productos con precios definidos
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProductos.map((producto) => (
                      <TableRow key={producto.id}>
                        <TableCell className="font-medium">{producto.codigo}</TableCell>
                        <TableCell>{producto.nombre}</TableCell>
                        <TableCell>{producto.marca || "—"}</TableCell>
                        <TableCell className="text-right">
                          ${producto.precio_compra.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${producto.precio_venta.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          ${producto.margen_pesos.toFixed(2)}
                        </TableCell>
                        <TableCell>{getMargenBadge(producto.margen_porcentaje)}</TableCell>
                        <TableCell className="text-right">{producto.stock_actual}</TableCell>
                        <TableCell className="text-right">
                          ${producto.valor_inventario.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Rentabilidad;
