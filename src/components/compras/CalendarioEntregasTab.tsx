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
import { Calendar, MoreVertical, Truck } from "lucide-react";
import OrdenAccionesDialog from "./OrdenAccionesDialog";
import { useState } from "react";

const CalendarioEntregasTab = () => {
  const [accionesDialogOpen, setAccionesDialogOpen] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null);

  // Fetch scheduled deliveries from ordenes_compra_entregas
  const { data: entregasProgramadas = [] } = useQuery({
    queryKey: ["entregas_programadas_calendario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordenes_compra_entregas")
        .select(
          `
          *,
          ordenes_compra (
            id,
            folio,
            total,
            status,
            proveedores (nombre),
            ordenes_compra_detalles (
              cantidad_ordenada,
              productos (nombre)
            )
          )
        `
        )
        .order("fecha_programada");

      if (error) throw error;
      return data;
    },
  });

  // Also fetch single-delivery orders (legacy or non-multiple)
  const { data: ordenesSimples = [] } = useQuery({
    queryKey: ["ordenes_calendario_simples"],
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
        .eq("entregas_multiples", false)
        .not("fecha_entrega_programada", "is", null)
        .order("fecha_entrega_programada");

      if (error) throw error;
      return data;
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      programada: "secondary",
      pendiente: "secondary",
      parcial: "default",
      recibida: "default",
      entregada: "default",
      devuelta: "destructive",
    };
    return colors[status] || "secondary";
  };

  // Combine both data sources into unified format
  const todasLasEntregas = [
    // Multiple delivery entries
    ...entregasProgramadas.map((entrega: any) => ({
      id: entrega.id,
      fecha: entrega.fecha_programada,
      folio: entrega.ordenes_compra?.folio,
      proveedor: entrega.ordenes_compra?.proveedores?.nombre,
      productos: entrega.ordenes_compra?.ordenes_compra_detalles,
      total: entrega.ordenes_compra?.total,
      status: entrega.status,
      orden: entrega.ordenes_compra,
      numeroEntrega: entrega.numero_entrega,
      cantidadBultos: entrega.cantidad_bultos,
      esMultiple: true,
    })),
    // Simple delivery entries
    ...ordenesSimples.map((orden: any) => ({
      id: orden.id,
      fecha: orden.fecha_entrega_programada,
      folio: orden.folio,
      proveedor: orden.proveedores?.nombre,
      productos: orden.ordenes_compra_detalles,
      total: orden.total,
      status: orden.status,
      orden: orden,
      numeroEntrega: null,
      cantidadBultos: null,
      esMultiple: false,
    })),
  ];

  const agruparPorFecha = () => {
    const grupos: Record<string, typeof todasLasEntregas> = {};
    todasLasEntregas.forEach((entrega) => {
      if (entrega.fecha) {
        const fecha = new Date(entrega.fecha).toLocaleDateString(
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
        grupos[fecha].push(entrega);
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
          {Object.entries(gruposPorFecha).map(([fecha, entregas]) => (
            <div key={fecha} className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-3">
                <h3 className="font-semibold capitalize">{fecha}</h3>
                <p className="text-sm text-muted-foreground">
                  {entregas.length} {entregas.length === 1 ? "entrega" : "entregas"}
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Productos</TableHead>
                    <TableHead>Bultos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entregas.map((entrega) => (
                    <TableRow key={entrega.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {entrega.folio}
                          {entrega.esMultiple && (
                            <Badge variant="outline" className="text-xs">
                              <Truck className="h-3 w-3 mr-1" />
                              #{entrega.numeroEntrega}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{entrega.proveedor}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {entrega.productos
                            ?.slice(0, 2)
                            .map((d: any) => d.productos?.nombre)
                            .join(", ")}
                          {entrega.productos &&
                            entrega.productos.length > 2 && (
                              <span className="text-muted-foreground">
                                {" "}
                                +{entrega.productos.length - 2} más
                              </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entrega.cantidadBultos ? (
                          <span className="font-medium">{entrega.cantidadBultos.toLocaleString()} bultos</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(entrega.status) as "default" | "secondary" | "destructive" | "outline"}>
                          {entrega.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setOrdenSeleccionada(entrega.orden);
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
