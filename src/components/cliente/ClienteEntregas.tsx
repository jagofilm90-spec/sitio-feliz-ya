import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Truck, MapPin, Calendar } from "lucide-react";

interface ClienteEntregasProps {
  clienteId: string;
}

const ClienteEntregas = ({ clienteId }: ClienteEntregasProps) => {
  const [entregas, setEntregas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadEntregas();

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel("entregas-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "entregas",
        },
        () => {
          loadEntregas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clienteId]);

  const loadEntregas = async () => {
    try {
      const { data, error } = await supabase
        .from("entregas")
        .select(`
          *,
          pedidos!inner (
            folio,
            cliente_id,
            total
          ),
          rutas (
            folio,
            fecha_ruta,
            status,
            profiles:chofer_id (full_name)
          )
        `)
        .eq("pedidos.cliente_id", clienteId)
        .order("orden_entrega", { ascending: true });

      if (error) throw error;
      setEntregas(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las entregas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getEstadoEntrega = (entrega: any) => {
    if (entrega.entregado) {
      return {
        badge: <Badge className="bg-green-600">Entregado</Badge>,
        icon: <Truck className="h-4 w-4 text-green-600" />,
      };
    }

    if (entrega.rutas?.status === "en_ruta") {
      return {
        badge: <Badge className="bg-blue-600">En Ruta</Badge>,
        icon: <Truck className="h-4 w-4 text-blue-600 animate-pulse" />,
      };
    }

    if (entrega.rutas?.status === "programada") {
      return {
        badge: <Badge variant="secondary">Programada</Badge>,
        icon: <Calendar className="h-4 w-4 text-muted-foreground" />,
      };
    }

    return {
      badge: <Badge variant="outline">Pendiente</Badge>,
      icon: <Calendar className="h-4 w-4 text-muted-foreground" />,
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">Cargando entregas...</div>
        </CardContent>
      </Card>
    );
  }

  const entregasEnRuta = entregas.filter(
    (e) => e.rutas?.status === "en_ruta" && !e.entregado
  );
  const entregasProgramadas = entregas.filter(
    (e) => e.rutas?.status === "programada" && !e.entregado
  );
  const entregasCompletadas = entregas.filter((e) => e.entregado);

  return (
    <div className="space-y-6">
      {entregasEnRuta.length > 0 && (
        <Card className="border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600 animate-pulse" />
              Entregas en Ruta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {entregasEnRuta.map((entrega) => {
                const estado = getEstadoEntrega(entrega);
                return (
                  <Card key={entrega.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            {estado.icon}
                            <p className="font-semibold">
                              Pedido: {entrega.pedidos.folio}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Ruta: {entrega.rutas?.folio}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Chofer: {entrega.rutas?.profiles?.full_name || "—"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Orden de entrega: #{entrega.orden_entrega}
                          </p>
                        </div>
                        {estado.badge}
                      </div>
                      {entrega.notas && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <p className="font-medium mb-1">Notas:</p>
                          <p className="text-muted-foreground">{entrega.notas}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {entregasProgramadas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Entregas Programadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Ruta</TableHead>
                    <TableHead>Fecha Programada</TableHead>
                    <TableHead>Chofer</TableHead>
                    <TableHead>Orden</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entregasProgramadas.map((entrega) => {
                    const estado = getEstadoEntrega(entrega);
                    return (
                      <TableRow key={entrega.id}>
                        <TableCell className="font-medium">
                          {entrega.pedidos.folio}
                        </TableCell>
                        <TableCell>{entrega.rutas?.folio || "—"}</TableCell>
                        <TableCell>
                          {entrega.rutas?.fecha_ruta
                            ? new Date(entrega.rutas.fecha_ruta).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {entrega.rutas?.profiles?.full_name || "—"}
                        </TableCell>
                        <TableCell>#{entrega.orden_entrega}</TableCell>
                        <TableCell>{estado.badge}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {entregasCompletadas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Entregas Completadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Fecha Entrega</TableHead>
                    <TableHead>Ruta</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entregasCompletadas.map((entrega) => (
                    <TableRow key={entrega.id}>
                      <TableCell className="font-medium">
                        {entrega.pedidos.folio}
                      </TableCell>
                      <TableCell>
                        {entrega.fecha_entrega
                          ? new Date(entrega.fecha_entrega).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>{entrega.rutas?.folio || "—"}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-600">Entregado</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {entregas.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tienes entregas registradas</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClienteEntregas;
