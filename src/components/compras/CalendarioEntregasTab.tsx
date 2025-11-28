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
import { Calendar as CalendarIcon, List, MoreVertical, Truck, ChevronLeft, ChevronRight } from "lucide-react";
import OrdenAccionesDialog from "./OrdenAccionesDialog";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const CalendarioEntregasTab = () => {
  const [accionesDialogOpen, setAccionesDialogOpen] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null);
  const [vistaCalendario, setVistaCalendario] = useState(true);
  const [mesActual, setMesActual] = useState(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null);
  const [dialogDiaOpen, setDialogDiaOpen] = useState(false);

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
  const todasLasEntregas = useMemo(() => [
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
  ], [entregasProgramadas, ordenesSimples]);

  // Map of dates with deliveries
  const entregasPorFecha = useMemo(() => {
    const mapa: Record<string, typeof todasLasEntregas> = {};
    todasLasEntregas.forEach((entrega) => {
      if (entrega.fecha) {
        const fechaKey = format(new Date(entrega.fecha), "yyyy-MM-dd");
        if (!mapa[fechaKey]) {
          mapa[fechaKey] = [];
        }
        mapa[fechaKey].push(entrega);
      }
    });
    return mapa;
  }, [todasLasEntregas]);

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

  // Calendar helpers
  const diasDelMes = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mesActual), { locale: es });
    const fin = endOfWeek(endOfMonth(mesActual), { locale: es });
    return eachDayOfInterval({ start: inicio, end: fin });
  }, [mesActual]);

  const diasSemana = ["D", "L", "M", "M", "J", "V", "S"];

  const getEntregasDelDia = (dia: Date) => {
    const key = format(dia, "yyyy-MM-dd");
    return entregasPorFecha[key] || [];
  };

  const handleDiaClick = (dia: Date) => {
    const entregas = getEntregasDelDia(dia);
    if (entregas.length > 0) {
      setDiaSeleccionado(dia);
      setDialogDiaOpen(true);
    }
  };

  const entregasDelDiaSeleccionado = diaSeleccionado ? getEntregasDelDia(diaSeleccionado) : [];

  return (
    <Card className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" />
            <h2 className="text-2xl font-bold">Calendario de Entregas</h2>
          </div>
          <div className="flex gap-2">
            <Button
              variant={vistaCalendario ? "default" : "outline"}
              size="sm"
              onClick={() => setVistaCalendario(true)}
            >
              <CalendarIcon className="h-4 w-4 mr-1" />
              Calendario
            </Button>
            <Button
              variant={!vistaCalendario ? "default" : "outline"}
              size="sm"
              onClick={() => setVistaCalendario(false)}
            >
              <List className="h-4 w-4 mr-1" />
              Lista
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground">
          Visualiza y gestiona las entregas programadas de tus proveedores
        </p>
      </div>

      {vistaCalendario ? (
        <div className="space-y-4">
          {/* Calendar header */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => setMesActual(subMonths(mesActual, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold capitalize">
              {format(mesActual, "MMMM yyyy", { locale: es })}
            </h3>
            <Button variant="outline" size="icon" onClick={() => setMesActual(addMonths(mesActual, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {diasSemana.map((dia, i) => (
              <div key={i} className="text-center py-2 text-sm font-medium text-muted-foreground">
                {dia}
              </div>
            ))}

            {/* Day cells */}
            {diasDelMes.map((dia, i) => {
              const entregas = getEntregasDelDia(dia);
              const esHoy = isSameDay(dia, new Date());
              const esDelMes = isSameMonth(dia, mesActual);
              const tieneEntregas = entregas.length > 0;

              return (
                <div
                  key={i}
                  onClick={() => handleDiaClick(dia)}
                  className={cn(
                    "min-h-[72px] p-2 text-center rounded-lg transition-colors relative",
                    esDelMes ? "bg-background" : "bg-muted/30 text-muted-foreground",
                    tieneEntregas && "cursor-pointer hover:bg-accent",
                    esHoy && "ring-2 ring-primary ring-offset-2"
                  )}
                >
                  <span className={cn(
                    "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm",
                    esHoy && "bg-primary text-primary-foreground"
                  )}>
                    {format(dia, "d")}
                  </span>
                  
                  {/* Dots indicator */}
                  {tieneEntregas && (
                    <div className="flex justify-center gap-1 mt-1">
                      {entregas.slice(0, 3).map((_, idx) => (
                        <span
                          key={idx}
                          className="w-2 h-2 rounded-full bg-primary"
                        />
                      ))}
                      {entregas.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{entregas.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Lista view (existing)
        <>
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
        </>
      )}

      {/* Dialog for day details */}
      <Dialog open={dialogDiaOpen} onOpenChange={setDialogDiaOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {diaSeleccionado && format(diaSeleccionado, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {entregasDelDiaSeleccionado.map((entrega) => (
              <div
                key={entrega.id}
                className="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => {
                  setOrdenSeleccionada(entrega.orden);
                  setAccionesDialogOpen(true);
                  setDialogDiaOpen(false);
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{entrega.folio}</span>
                    {entrega.esMultiple && (
                      <Badge variant="outline" className="text-xs">
                        <Truck className="h-3 w-3 mr-1" />
                        Entrega #{entrega.numeroEntrega}
                      </Badge>
                    )}
                  </div>
                  <Badge variant={getStatusColor(entrega.status) as "default" | "secondary" | "destructive" | "outline"}>
                    {entrega.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{entrega.proveedor}</p>
                <p className="text-sm">
                  {entrega.productos
                    ?.slice(0, 3)
                    .map((d: any) => d.productos?.nombre)
                    .join(", ")}
                  {entrega.productos && entrega.productos.length > 3 && (
                    <span className="text-muted-foreground"> +{entrega.productos.length - 3} más</span>
                  )}
                </p>
                {entrega.cantidadBultos && (
                  <p className="text-sm font-medium mt-1">{entrega.cantidadBultos.toLocaleString()} bultos</p>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <OrdenAccionesDialog
        open={accionesDialogOpen}
        onOpenChange={setAccionesDialogOpen}
        orden={ordenSeleccionada}
      />
    </Card>
  );
};

export default CalendarioEntregasTab;
