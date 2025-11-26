import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MoreVertical } from "lucide-react";
import OrdenAccionesDialog from "./OrdenAccionesDialog";
import { useState } from "react";

const CalendarioEntregasTab = () => {
  const [accionesDialogOpen, setAccionesDialogOpen] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null);

  const { data: ordenesConEntrega = [] } = useQuery({
    queryKey: ["ordenes_calendario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordenes_compra")
        .select(
          `
          *,
          proveedores (nombre),
          ordenes_compra_detalles (
            cantidad_ordenada,
            productos (nombre)
          )
        `
        )
        .not("fecha_entrega_programada", "is", null)
        .order("fecha_entrega_programada");

      if (error) throw error;
      return data;
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, any> = {
      pendiente: "secondary",
      parcial: "default",
      recibida: "default",
      devuelta: "destructive",
    };
    return colors[status] || "secondary";
  };

  const agruparPorFecha = () => {
    const grupos: Record<string, typeof ordenesConEntrega> = {};
    ordenesConEntrega.forEach((orden) => {
      if (orden.fecha_entrega_programada) {
        const fecha = new Date(orden.fecha_entrega_programada).toLocaleDateString(
          "es-MX",
          {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        );
        if (!grupos[fecha]) {
          grupos[fecha] = [];
        }
        grupos[fecha].push(orden);
      }
    });
    return grupos;
  };

  const gruposPorFecha = agruparPorFecha();

  return (
    <Card className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Calendario de Entregas</h2>
        </div>
        <p className="text-muted-foreground">
          Visualiza y gestiona las entregas programadas de tus proveedores
        </p>
      </div>

      {Object.keys(gruposPorFecha).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No hay entregas programadas
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(gruposPorFecha).map(([fecha, ordenes]) => (
            <div key={fecha} className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-3">
                <h3 className="font-semibold capitalize">{fecha}</h3>
                <p className="text-sm text-muted-foreground">
                  {ordenes.length} {ordenes.length === 1 ? "entrega" : "entregas"}
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Productos</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenes.map((orden) => (
                    <TableRow key={orden.id}>
                      <TableCell className="font-medium">{orden.folio}</TableCell>
                      <TableCell>{orden.proveedores?.nombre}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {orden.ordenes_compra_detalles
                            ?.slice(0, 2)
                            .map((d: any) => d.productos.nombre)
                            .join(", ")}
                          {orden.ordenes_compra_detalles &&
                            orden.ordenes_compra_detalles.length > 2 && (
                              <span className="text-muted-foreground">
                                {" "}
                                +{orden.ordenes_compra_detalles.length - 2} más
                              </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>${orden.total.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(orden.status)}>
                          {orden.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setOrdenSeleccionada(orden);
                            setAccionesDialogOpen(true);
                          }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}

      <OrdenAccionesDialog
        open={accionesDialogOpen}
        onOpenChange={setAccionesDialogOpen}
        orden={ordenSeleccionada}
      />
    </Card>
  );
};

export default CalendarioEntregasTab;
