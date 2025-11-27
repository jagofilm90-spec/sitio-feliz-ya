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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Eye, Truck, MapPin, Route, Play, Square, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import VehiculosTab from "@/components/rutas/VehiculosTab";
import ZonasTab from "@/components/rutas/ZonasTab";
import PlanificadorRutas from "@/components/rutas/PlanificadorRutas";
import RutaKilometrajeDialog from "@/components/rutas/RutaKilometrajeDialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const Rutas = () => {
  const [rutas, setRutas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [kmDialogOpen, setKmDialogOpen] = useState(false);
  const [selectedRuta, setSelectedRuta] = useState<any>(null);
  const [kmMode, setKmMode] = useState<"iniciar" | "finalizar">("iniciar");
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
          ayudante:ayudante_id (full_name),
          vehiculo:vehiculo_id (id, nombre, peso_maximo_local_kg, peso_maximo_foraneo_kg)
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
      r.folio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.chofer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.vehiculo?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      programada: "secondary",
      en_curso: "default",
      completada: "outline",
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

  const handleIniciarRuta = (ruta: any) => {
    setSelectedRuta(ruta);
    setKmMode("iniciar");
    setKmDialogOpen(true);
  };

  const handleFinalizarRuta = (ruta: any) => {
    setSelectedRuta(ruta);
    setKmMode("finalizar");
    setKmDialogOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Rutas y Entregas</h1>
          <p className="text-muted-foreground">Control de rutas de entrega, vehículos y zonas</p>
        </div>

        <Tabs defaultValue="planificar" className="space-y-4">
          <TabsList>
            <TabsTrigger value="planificar" className="flex items-center gap-2">
              <Route className="h-4 w-4" />
              Planificar
            </TabsTrigger>
            <TabsTrigger value="rutas" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Rutas
            </TabsTrigger>
            <TabsTrigger value="vehiculos" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Vehículos
            </TabsTrigger>
            <TabsTrigger value="zonas" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Zonas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="planificar">
            <PlanificadorRutas />
          </TabsContent>

          <TabsContent value="rutas" className="space-y-4">
        <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por folio, chofer o vehículo..."
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
                    <TableHead>Tipo</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Chofer</TableHead>
                    <TableHead>Peso</TableHead>
                    <TableHead>Kilometraje</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : filteredRutas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        No hay rutas registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRutas.map((ruta) => (
                      <TableRow key={ruta.id}>
                        <TableCell className="font-medium">{ruta.folio}</TableCell>
                        <TableCell>
                          {new Date(ruta.fecha_ruta).toLocaleDateString("es-MX")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ruta.tipo_ruta === "local" ? "secondary" : "outline"}>
                            {ruta.tipo_ruta === "local" ? "Local" : "Foránea"}
                          </Badge>
                        </TableCell>
                        <TableCell>{ruta.vehiculo?.nombre || "—"}</TableCell>
                        <TableCell>{ruta.chofer?.full_name || "—"}</TableCell>
                        <TableCell>
                          {ruta.peso_total_kg?.toLocaleString() || 0} kg
                          {ruta.vehiculo && (
                            <span className="text-muted-foreground text-xs ml-1">
                              / {(ruta.tipo_ruta === "local" 
                                ? ruta.vehiculo.peso_maximo_local_kg 
                                : ruta.vehiculo.peso_maximo_foraneo_kg)?.toLocaleString()} kg
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1">
                                  <Gauge className="h-3 w-3 text-muted-foreground" />
                                  {ruta.kilometros_recorridos !== null && ruta.kilometros_recorridos > 0 ? (
                                    <span className="text-sm font-medium">
                                      {ruta.kilometros_recorridos.toLocaleString()} km
                                    </span>
                                  ) : ruta.kilometraje_inicial !== null ? (
                                    <span className="text-sm text-muted-foreground">
                                      {ruta.kilometraje_inicial.toLocaleString()} km (inicio)
                                    </span>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">—</span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs space-y-1">
                                  <p>Inicial: {ruta.kilometraje_inicial?.toLocaleString() || "—"} km</p>
                                  <p>Final: {ruta.kilometraje_final?.toLocaleString() || "—"} km</p>
                                  {ruta.fecha_hora_inicio && (
                                    <p>Inicio: {format(new Date(ruta.fecha_hora_inicio), "dd/MM HH:mm", { locale: es })}</p>
                                  )}
                                  {ruta.fecha_hora_fin && (
                                    <p>Fin: {format(new Date(ruta.fecha_hora_fin), "dd/MM HH:mm", { locale: es })}</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>{getStatusBadge(ruta.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {ruta.status === "programada" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-green-600 hover:text-green-700 hover:bg-green-100"
                                      onClick={() => handleIniciarRuta(ruta)}
                                    >
                                      <Play className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Iniciar ruta (registrar km inicial)</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {ruta.status === "en_curso" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-100"
                                      onClick={() => handleFinalizarRuta(ruta)}
                                    >
                                      <Square className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Finalizar ruta (registrar km final)</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="vehiculos">
            <VehiculosTab />
          </TabsContent>

          <TabsContent value="zonas">
            <ZonasTab />
          </TabsContent>
        </Tabs>

        <RutaKilometrajeDialog
          ruta={selectedRuta}
          open={kmDialogOpen}
          onOpenChange={setKmDialogOpen}
          onSuccess={loadRutas}
          mode={kmMode}
        />
      </div>
    </Layout>
  );
};

export default Rutas;
