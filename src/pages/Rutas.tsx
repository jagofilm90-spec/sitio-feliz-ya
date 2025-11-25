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

const Rutas = () => {
  const [rutas, setRutas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadRutas();
  }, []);

  const loadRutas = async () => {
    try {
      const { data, error } = await supabase
        .from("rutas")
        .select(`
          *,
          chofer:chofer_id (full_name),
          ayudante:ayudante_id (full_name)
        `)
        .order("fecha_ruta", { ascending: false });

      if (error) throw error;
      setRutas(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las rutas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRutas = rutas.filter(
    (r) =>
      r.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.chofer?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      programada: "secondary",
      en_curso: "default",
      completada: "default",
      cancelada: "destructive",
    };

    const labels: Record<string, string> = {
      programada: "Programada",
      en_curso: "En Curso",
      completada: "Completada",
      cancelada: "Cancelada",
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Rutas y Entregas</h1>
            <p className="text-muted-foreground">Control de rutas de entrega y seguimiento</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Ruta
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por folio o chofer..."
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
                <TableHead>Fecha</TableHead>
                <TableHead>Chofer</TableHead>
                <TableHead>Ayudante</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filteredRutas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No hay rutas registradas
                  </TableCell>
                </TableRow>
              ) : (
                filteredRutas.map((ruta) => (
                  <TableRow key={ruta.id}>
                    <TableCell className="font-medium">{ruta.folio}</TableCell>
                    <TableCell>
                      {new Date(ruta.fecha_ruta).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{ruta.chofer?.full_name || "—"}</TableCell>
                    <TableCell>{ruta.ayudante?.full_name || "—"}</TableCell>
                    <TableCell>{getStatusBadge(ruta.status)}</TableCell>
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

export default Rutas;