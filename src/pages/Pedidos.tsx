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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, ShoppingCart, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import CotizacionesTab from "@/components/cotizaciones/CotizacionesTab";
import { formatCurrency } from "@/lib/utils";

const Pedidos = () => {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pedidos");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadPedidos();
  }, []);

  const loadPedidos = async () => {
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select(`
          *,
          clientes (nombre),
          profiles:vendedor_id (full_name)
        `)
        .order("fecha_pedido", { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
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
      p.clientes?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
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
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : filteredPedidos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        No hay pedidos registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPedidos.map((pedido) => (
                      <TableRow key={pedido.id}>
                        <TableCell className="font-medium">{pedido.folio}</TableCell>
                        <TableCell>{pedido.clientes?.nombre || "—"}</TableCell>
                        <TableCell>{pedido.profiles?.full_name || "—"}</TableCell>
                        <TableCell>
                          {new Date(pedido.fecha_pedido).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-mono">${formatCurrency(pedido.total)}</TableCell>
                        <TableCell>{getStatusBadge(pedido.status)}</TableCell>
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
    </Layout>
  );
};

export default Pedidos;
