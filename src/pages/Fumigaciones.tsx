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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, addMonths, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Pencil, Check, X } from "lucide-react";

interface ProductoFumigacion {
  id: string;
  codigo: string;
  nombre: string;
  marca: string | null;
  presentacion: string | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string>("");

  useEffect(() => {
    cargarProductos();
  }, []);

  const cargarProductos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("productos")
        .select("id, codigo, nombre, marca, presentacion, stock_actual, fecha_ultima_fumigacion, requiere_fumigacion")
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

      // Ordenar: sin fecha primero (más urgentes), luego por fecha más antigua a más reciente
      productosConEstado.sort((a, b) => {
        if (a.fecha_ultima_fumigacion === null && b.fecha_ultima_fumigacion !== null) return -1;
        if (a.fecha_ultima_fumigacion !== null && b.fecha_ultima_fumigacion === null) return 1;
        if (a.fecha_ultima_fumigacion === null && b.fecha_ultima_fumigacion === null) {
          return a.nombre.localeCompare(b.nombre);
        }
        return new Date(a.fecha_ultima_fumigacion!).getTime() - new Date(b.fecha_ultima_fumigacion!).getTime();
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

  const startEditing = (producto: ProductoFumigacion) => {
    setEditingId(producto.id);
    setEditingDate(producto.fecha_ultima_fumigacion || "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingDate("");
  };

  const saveDate = async (productoId: string) => {
    try {
      const { error } = await supabase
        .from("productos")
        .update({ fecha_ultima_fumigacion: editingDate || null })
        .eq("id", productoId);

      if (error) throw error;

      toast({
        title: "Fecha actualizada",
        description: "La fecha de fumigación se actualizó correctamente. Próxima fumigación en 6 meses.",
      });

      setEditingId(null);
      setEditingDate("");
      cargarProductos();
    } catch (error) {
      console.error("Error actualizando fecha:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la fecha",
        variant: "destructive",
      });
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
                  Se notifica automáticamente 2 semanas antes de cumplir 6 meses desde la última fumigación. Haz clic en el lápiz para editar la fecha.
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
                          <TableHead>Presentación</TableHead>
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
                            <TableCell>{producto.presentacion || "-"}</TableCell>
                            <TableCell>{producto.stock_actual}</TableCell>
                            <TableCell>
                              {editingId === producto.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="date"
                                    value={editingDate}
                                    onChange={(e) => setEditingDate(e.target.value)}
                                    className="w-36 h-8"
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => saveDate(producto.id)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={cancelEditing}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span>
                                    {producto.fecha_ultima_fumigacion
                                      ? format(new Date(producto.fecha_ultima_fumigacion), "dd/MM/yyyy", { locale: es })
                                      : "-"}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => startEditing(producto)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
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
