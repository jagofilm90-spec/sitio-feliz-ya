import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, addMonths, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2 } from "lucide-react";

interface ProductoFumigacion {
  id: string;
  codigo: string;
  nombre: string;
  marca: string | null;
  stock_actual: number;
  fecha_ultima_fumigacion: string | null;
  proximaFumigacion: Date | null;
  diasRestantes: number | null;
  estado: "vencida" | "proxima" | "vigente" | "sin_fecha";
}

const Fumigaciones = () => {
  const { toast } = useToast();
  const [productos, setProductos] = useState<ProductoFumigacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "vencida" | "proxima" | "vigente">("todos");

  useEffect(() => {
    cargarProductos();
  }, []);

  const cargarProductos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("productos")
        .select("id, codigo, nombre, marca, stock_actual, fecha_ultima_fumigacion, requiere_fumigacion")
        .eq("requiere_fumigacion", true)
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;

      const productosConEstado: ProductoFumigacion[] = (data || []).map((producto) => {
        if (!producto.fecha_ultima_fumigacion) {
          return {
            ...producto,
            proximaFumigacion: null,
            diasRestantes: null,
            estado: "sin_fecha" as const,
          };
        }

        const ultimaFumigacion = new Date(producto.fecha_ultima_fumigacion);
        const proximaFumigacion = addMonths(ultimaFumigacion, 6);
        const hoy = new Date();
        const diasRestantes = differenceInDays(proximaFumigacion, hoy);

        let estado: "vencida" | "proxima" | "vigente";
        if (diasRestantes < 0) {
          estado = "vencida";
        } else if (diasRestantes <= 14) {
          estado = "proxima";
        } else {
          estado = "vigente";
        }

        return {
          ...producto,
          proximaFumigacion,
          diasRestantes,
          estado,
        };
      });

      setProductos(productosConEstado);
    } catch (error) {
      console.error("Error cargando productos:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const productosFiltrados = productos.filter((producto) => {
    if (filtroEstado === "todos") return true;
    return producto.estado === filtroEstado;
  });

  const contadores = {
    vencida: productos.filter((p) => p.estado === "vencida").length,
    proxima: productos.filter((p) => p.estado === "proxima").length,
    vigente: productos.filter((p) => p.estado === "vigente").length,
    sin_fecha: productos.filter((p) => p.estado === "sin_fecha").length,
  };

  const getEstadoBadge = (producto: ProductoFumigacion) => {
    if (producto.estado === "sin_fecha") {
      return <Badge variant="outline">Sin fecha registrada</Badge>;
    }
    if (producto.estado === "vencida") {
      return <Badge className="bg-red-500 hover:bg-red-600">Fumigación vencida</Badge>;
    }
    if (producto.estado === "proxima") {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Próxima fumigación</Badge>;
    }
    return <Badge className="bg-green-500 hover:bg-green-600">Vigente</Badge>;
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Reporte de Fumigaciones</h1>
          <p className="text-muted-foreground">
            Control de fechas de fumigación programadas para productos
          </p>
        </div>

        <Tabs value={filtroEstado} onValueChange={(value) => setFiltroEstado(value as any)}>
          <TabsList>
            <TabsTrigger value="todos">
              Todos ({productos.length})
            </TabsTrigger>
            <TabsTrigger value="vencida">
              Vencidas ({contadores.vencida})
            </TabsTrigger>
            <TabsTrigger value="proxima">
              Próximas ({contadores.proxima})
            </TabsTrigger>
            <TabsTrigger value="vigente">
              Vigentes ({contadores.vigente})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filtroEstado} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Productos que requieren fumigación</CardTitle>
                <CardDescription>
                  Se notifica automáticamente 2 semanas antes de cumplir 6 meses desde la última fumigación
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : productosFiltrados.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No hay productos en esta categoría
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Última Fumigación</TableHead>
                          <TableHead>Próxima Fumigación</TableHead>
                          <TableHead>Días Restantes</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productosFiltrados.map((producto) => (
                          <TableRow key={producto.id}>
                            <TableCell className="font-medium">{producto.codigo}</TableCell>
                            <TableCell>{producto.nombre}</TableCell>
                            <TableCell>{producto.marca || "-"}</TableCell>
                            <TableCell>{producto.stock_actual}</TableCell>
                            <TableCell>
                              {producto.fecha_ultima_fumigacion
                                ? format(new Date(producto.fecha_ultima_fumigacion), "dd/MM/yyyy", { locale: es })
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {producto.proximaFumigacion
                                ? format(producto.proximaFumigacion, "dd/MM/yyyy", { locale: es })
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {producto.diasRestantes !== null ? (
                                <span
                                  className={
                                    producto.diasRestantes < 0
                                      ? "text-red-600 font-semibold"
                                      : producto.diasRestantes <= 14
                                      ? "text-yellow-600 font-semibold"
                                      : "text-green-600"
                                  }
                                >
                                  {producto.diasRestantes < 0
                                    ? `${Math.abs(producto.diasRestantes)} días vencida`
                                    : `${producto.diasRestantes} días`}
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>{getEstadoBadge(producto)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Fumigaciones;
