import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, ShoppingCart, FileText, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import CotizacionesTab from "@/components/cotizaciones/CotizacionesTab";
import CotizacionDetalleDialog from "@/components/cotizaciones/CotizacionDetalleDialog";
import { formatCurrency } from "@/lib/utils";

interface PedidoConCotizacion {
  id: string;
  folio: string;
  fecha_pedido: string;
  total: number;
  status: string;
  clientes: { nombre: string } | null;
  profiles: { full_name: string } | null;
  cotizacion_origen?: { id: string; folio: string } | null;
}

const Pedidos = () => {
  const [pedidos, setPedidos] = useState<PedidoConCotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pedidos");
  const [selectedCotizacionId, setSelectedCotizacionId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadPedidos();
  }, []);

  const loadPedidos = async () => {
    try {
      // First get pedidos
      const { data: pedidosData, error: pedidosError } = await supabase
        .from("pedidos")
        .select(`
          id,
          folio,
          fecha_pedido,
          total,
          status,
          clientes (nombre),
          profiles:vendedor_id (full_name)
        `)
        .order("fecha_pedido", { ascending: false });

      if (pedidosError) throw pedidosError;

      // Get cotizaciones that have pedido_id (created from cotizacion)
      const { data: cotizacionesData, error: cotizacionesError } = await supabase
        .from("cotizaciones")
        .select("id, folio, pedido_id")
        .not("pedido_id", "is", null);

      if (cotizacionesError) throw cotizacionesError;

      // Create map of pedido_id to cotizacion
      const cotizacionMap = new Map<string, { id: string; folio: string }>();
      cotizacionesData?.forEach((cot) => {
        if (cot.pedido_id) {
          cotizacionMap.set(cot.pedido_id, { id: cot.id, folio: cot.folio });
        }
      });

      // Merge data
      const pedidosConCotizacion: PedidoConCotizacion[] = (pedidosData || []).map((p) => ({
        ...p,
        cotizacion_origen: cotizacionMap.get(p.id) || null,
      }));

      setPedidos(pedidosConCotizacion);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los pedidos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPedidos = pedidos.filter(
    (p) =>
      p.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.clientes?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cotizacion_origen?.folio.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pendiente: "secondary",
      en_ruta: "default",
      entregado: "default",
      cancelado: "destructive",
    };

    const labels: Record<string, string> = {
      pendiente: "Pendiente",
      en_ruta: "En Ruta",
      entregado: "Entregado",
      cancelado: "Cancelado",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pedidos y Cotizaciones</h1>
          <p className="text-muted-foreground">
            Gestión de pedidos de clientes y cotizaciones
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pedidos" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="cotizaciones" className="gap-2">
              <FileText className="h-4 w-4" />
              Cotizaciones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pedidos" className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por folio o cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Pedido
              </Button>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Origen</TableHead>
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
                  ) : filteredPedidos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center">
                        No hay pedidos registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPedidos.map((pedido) => (
                      <TableRow key={pedido.id}>
                        <TableCell className="font-medium font-mono">{pedido.folio}</TableCell>
                        <TableCell>{pedido.clientes?.nombre || "—"}</TableCell>
                        <TableCell>{pedido.profiles?.full_name || "—"}</TableCell>
                        <TableCell>
                          {new Date(pedido.fecha_pedido).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-mono">${formatCurrency(pedido.total)}</TableCell>
                        <TableCell>{getStatusBadge(pedido.status)}</TableCell>
                        <TableCell>
                          {pedido.cotizacion_origen ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1 text-primary hover:text-primary/80 p-1 h-auto"
                                    onClick={() => setSelectedCotizacionId(pedido.cotizacion_origen!.id)}
                                  >
                                    <Link2 className="h-3 w-3" />
                                    <span className="font-mono text-xs">{pedido.cotizacion_origen.folio}</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Ver cotización origen</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground text-xs">Directo</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="cotizaciones" className="mt-6">
            <CotizacionesTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog para ver cotización origen */}
      {selectedCotizacionId && (
        <CotizacionDetalleDialog
          cotizacionId={selectedCotizacionId}
          open={!!selectedCotizacionId}
          onOpenChange={(open) => !open && setSelectedCotizacionId(null)}
          onUpdate={() => loadPedidos()}
        />
      )}
    </Layout>
  );
};

export default Pedidos;
