import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Truck, Package, AlertTriangle, Check, X, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Vehiculo {
  id: string;
  nombre: string;
  tipo: string;
  peso_maximo_local_kg: number;
  peso_maximo_foraneo_kg: number;
  status: string;
}

interface Pedido {
  id: string;
  folio: string;
  cliente: {
    nombre: string;
    direccion: string | null;
    zona: { id: string; nombre: string } | null;
  };
  total: number;
  peso_total_kg: number;
  fecha_pedido: string;
}

interface PedidoSeleccionado extends Pedido {
  orden: number;
}

const PlanificadorRutas = () => {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [pedidosPendientes, setPedidosPendientes] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  // Form state
  const [selectedVehiculo, setSelectedVehiculo] = useState<string>("");
  const [fechaRuta, setFechaRuta] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [tipoRuta, setTipoRuta] = useState<"local" | "foranea">("local");
  const [pedidosSeleccionados, setPedidosSeleccionados] = useState<PedidoSeleccionado[]>([]);
  const [notas, setNotas] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load available vehicles
      const { data: vehiculosData, error: vehiculosError } = await supabase
        .from("vehiculos")
        .select("*")
        .eq("activo", true)
        .eq("status", "disponible")
        .order("nombre");

      if (vehiculosError) throw vehiculosError;
      setVehiculos(vehiculosData || []);

      // Load pending orders with client info and zone
      const { data: pedidosData, error: pedidosError } = await supabase
        .from("pedidos")
        .select(`
          id,
          folio,
          total,
          peso_total_kg,
          fecha_pedido,
          cliente:cliente_id (
            nombre,
            direccion,
            zona:zona_id (id, nombre)
          )
        `)
        .eq("status", "pendiente")
        .order("fecha_pedido");

      if (pedidosError) throw pedidosError;
      
      // Transform data to match interface
      const transformedPedidos = (pedidosData || []).map((p: any) => ({
        ...p,
        cliente: p.cliente || { nombre: "Sin cliente", direccion: null, zona: null },
      }));
      
      setPedidosPendientes(transformedPedidos);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const vehiculoSeleccionado = vehiculos.find(v => v.id === selectedVehiculo);
  
  const pesoTotal = pedidosSeleccionados.reduce((sum, p) => sum + (p.peso_total_kg || 0), 0);
  const capacidadMaxima = vehiculoSeleccionado 
    ? (tipoRuta === "local" ? vehiculoSeleccionado.peso_maximo_local_kg : vehiculoSeleccionado.peso_maximo_foraneo_kg)
    : 0;
  const porcentajeCapacidad = capacidadMaxima > 0 ? (pesoTotal / capacidadMaxima) * 100 : 0;
  const excedido = pesoTotal > capacidadMaxima;

  // Check zone consistency
  const zonasUnicas = [...new Set(pedidosSeleccionados
    .map(p => p.cliente.zona?.nombre)
    .filter(Boolean))];
  const zonasMultiples = zonasUnicas.length > 1;

  const agregarPedido = (pedido: Pedido) => {
    if (pedidosSeleccionados.some(p => p.id === pedido.id)) return;
    
    setPedidosSeleccionados([
      ...pedidosSeleccionados,
      { ...pedido, orden: pedidosSeleccionados.length + 1 }
    ]);
  };

  const quitarPedido = (pedidoId: string) => {
    const nuevos = pedidosSeleccionados
      .filter(p => p.id !== pedidoId)
      .map((p, idx) => ({ ...p, orden: idx + 1 }));
    setPedidosSeleccionados(nuevos);
  };

  const handleCrearRuta = async () => {
    if (!selectedVehiculo || pedidosSeleccionados.length === 0) {
      toast({
        title: "Error",
        description: "Selecciona un vehículo y al menos un pedido",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      // Generate folio
      const { data: lastRuta } = await supabase
        .from("rutas")
        .select("folio")
        .order("created_at", { ascending: false })
        .limit(1);

      const lastNumber = lastRuta?.[0]?.folio 
        ? parseInt(lastRuta[0].folio.replace("RUT-", "")) 
        : 0;
      const newFolio = `RUT-${String(lastNumber + 1).padStart(4, "0")}`;

      // Create route
      const { data: rutaData, error: rutaError } = await supabase
        .from("rutas")
        .insert([{
          folio: newFolio,
          fecha_ruta: fechaRuta,
          chofer_id: user.id, // Temporary - should be selected
          vehiculo_id: selectedVehiculo,
          peso_total_kg: pesoTotal,
          tipo_ruta: tipoRuta,
          status: "programada",
          notas: notas || null,
        }])
        .select()
        .single();

      if (rutaError) throw rutaError;

      // Create entregas for each pedido
      const entregasData = pedidosSeleccionados.map(pedido => ({
        ruta_id: rutaData.id,
        pedido_id: pedido.id,
        orden_entrega: pedido.orden,
        entregado: false,
      }));

      const { error: entregasError } = await supabase
        .from("entregas")
        .insert(entregasData);

      if (entregasError) throw entregasError;

      // Update pedidos status to en_ruta
      const pedidoIds = pedidosSeleccionados.map(p => p.id);
      await supabase
        .from("pedidos")
        .update({ status: "en_ruta" })
        .in("id", pedidoIds);

      // Update vehicle status
      await supabase
        .from("vehiculos")
        .update({ status: "en_ruta" })
        .eq("id", selectedVehiculo);

      toast({ title: `Ruta ${newFolio} creada correctamente` });
      
      // Reset and reload
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setSelectedVehiculo("");
    setFechaRuta(format(new Date(), "yyyy-MM-dd"));
    setTipoRuta("local");
    setPedidosSeleccionados([]);
    setNotas("");
  };

  const pedidosDisponibles = pedidosPendientes.filter(
    p => !pedidosSeleccionados.some(ps => ps.id === p.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Planificar Nueva Ruta</h2>
          <p className="text-sm text-muted-foreground">
            Asigna pedidos a un vehículo y optimiza la ruta
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Ruta
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Planificar Nueva Ruta</DialogTitle>
            <DialogDescription>
              Selecciona un vehículo y asigna los pedidos para la ruta
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            {/* Left column - Vehicle & Capacity */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de Ruta *</Label>
                  <Input
                    type="date"
                    value={fechaRuta}
                    onChange={(e) => setFechaRuta(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Ruta *</Label>
                  <Select value={tipoRuta} onValueChange={(v: "local" | "foranea") => setTipoRuta(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local (CDMX)</SelectItem>
                      <SelectItem value="foranea">Foránea</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Vehículo *</Label>
                <Select value={selectedVehiculo} onValueChange={setSelectedVehiculo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un vehículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehiculos.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          {v.nombre} - L:{v.peso_maximo_local_kg.toLocaleString()}kg / F:{v.peso_maximo_foraneo_kg.toLocaleString()}kg
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {vehiculoSeleccionado && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Capacidad del Vehículo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Cargado: {pesoTotal.toLocaleString()} kg</span>
                        <span>Máximo: {capacidadMaxima.toLocaleString()} kg</span>
                      </div>
                      <Progress 
                        value={Math.min(porcentajeCapacidad, 100)} 
                        className={excedido ? "bg-destructive/20" : ""}
                      />
                      {excedido && (
                        <div className="flex items-center gap-2 text-destructive text-sm">
                          <AlertTriangle className="h-4 w-4" />
                          Excede la capacidad por {(pesoTotal - capacidadMaxima).toLocaleString()} kg
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {zonasMultiples && (
                <Card className="border-yellow-500">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-yellow-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm">
                        Mezcla de zonas: {zonasUnicas.join(", ")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <Label>Notas</Label>
                <Input
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Notas para el chofer..."
                  autoComplete="off"
                />
              </div>

              {/* Selected orders */}
              <div className="space-y-2">
                <Label>Pedidos Asignados ({pedidosSeleccionados.length})</Label>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {pedidosSeleccionados.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Selecciona pedidos de la lista
                    </div>
                  ) : (
                    <div className="divide-y">
                      {pedidosSeleccionados.map((pedido) => (
                        <div key={pedido.id} className="p-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                              {pedido.orden}
                            </Badge>
                            <div>
                              <p className="text-sm font-medium">{pedido.folio}</p>
                              <p className="text-xs text-muted-foreground">
                                {pedido.cliente.nombre}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {pedido.peso_total_kg || 0} kg
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => quitarPedido(pedido.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column - Available orders */}
            <div className="space-y-2">
              <Label>Pedidos Pendientes ({pedidosDisponibles.length})</Label>
              <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center">Cargando...</div>
                ) : pedidosDisponibles.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No hay pedidos pendientes
                  </div>
                ) : (
                  <div className="divide-y">
                    {pedidosDisponibles.map((pedido) => (
                      <div
                        key={pedido.id}
                        className="p-3 hover:bg-muted/50 cursor-pointer"
                        onClick={() => agregarPedido(pedido)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{pedido.folio}</span>
                            </div>
                            <p className="text-sm mt-1">{pedido.cliente.nombre}</p>
                            {pedido.cliente.direccion && (
                              <p className="text-xs text-muted-foreground">
                                {pedido.cliente.direccion}
                              </p>
                            )}
                            {pedido.cliente.zona && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                <MapPin className="h-3 w-3 mr-1" />
                                {pedido.cliente.zona.nombre}
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {pedido.peso_total_kg || 0} kg
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ${pedido.total?.toFixed(2) || "0.00"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCrearRuta}
              disabled={!selectedVehiculo || pedidosSeleccionados.length === 0 || excedido}
            >
              <Check className="h-4 w-4 mr-2" />
              Crear Ruta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vehículos Disponibles</CardDescription>
            <CardTitle className="text-2xl">{vehiculos.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pedidos Pendientes</CardDescription>
            <CardTitle className="text-2xl">{pedidosPendientes.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Peso Total Pendiente</CardDescription>
            <CardTitle className="text-2xl">
              {pedidosPendientes.reduce((sum, p) => sum + (p.peso_total_kg || 0), 0).toLocaleString()} kg
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};

export default PlanificadorRutas;
