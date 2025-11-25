import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Search, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Facturas = () => {
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadFacturas();
  }, []);

  const loadFacturas = async () => {
    try {
      const { data, error } = await supabase
        .from("facturas")
        .select(`
          *,
          clientes (nombre),
          pedidos (folio)
        `)
        .order("fecha_emision", { ascending: false });

      if (error) throw error;
      setFacturas(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las facturas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredFacturas = facturas.filter(
    (f) =>
      f.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.clientes?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Facturación</h1>
            <p className="text-muted-foreground">Control de facturas y pagos</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Factura
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por folio o cliente..."
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
                <TableHead>Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Fecha Emisión</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
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
              ) : filteredFacturas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    No hay facturas registradas
                  </TableCell>
                </TableRow>
              ) : (
                filteredFacturas.map((factura) => (
                  <TableRow key={factura.id}>
                    <TableCell className="font-medium">{factura.folio}</TableCell>
                    <TableCell>{factura.clientes?.nombre || "—"}</TableCell>
                    <TableCell>{factura.pedidos?.folio || "—"}</TableCell>
                    <TableCell>
                      {new Date(factura.fecha_emision).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {factura.fecha_vencimiento
                        ? new Date(factura.fecha_vencimiento).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>${factura.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={factura.pagada ? "default" : "destructive"}>
                        {factura.pagada ? "Pagada" : "Pendiente"}
                      </Badge>
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
      </div>
    </Layout>
  );
};

export default Facturas;