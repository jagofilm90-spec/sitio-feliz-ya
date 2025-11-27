import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Vehiculo {
  id: string;
  nombre: string;
  tipo: string;
  placa: string | null;
  peso_maximo_local_kg: number;
  peso_maximo_foraneo_kg: number;
  status: string;
  notas: string | null;
  activo: boolean;
}

const VehiculosTab = () => {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehiculo, setEditingVehiculo] = useState<Vehiculo | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nombre: "",
    tipo: "camioneta",
    placa: "",
    peso_maximo_local_kg: "7800",
    peso_maximo_foraneo_kg: "7000",
    status: "disponible",
    notas: "",
  });

  useEffect(() => {
    loadVehiculos();
  }, []);

  const loadVehiculos = async () => {
    try {
      const { data, error } = await supabase
        .from("vehiculos")
        .select("*")
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;
      setVehiculos(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los vehículos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const vehiculoData = {
        nombre: formData.nombre,
        tipo: formData.tipo,
        placa: formData.placa || null,
        peso_maximo_local_kg: parseFloat(formData.peso_maximo_local_kg),
        peso_maximo_foraneo_kg: parseFloat(formData.peso_maximo_foraneo_kg),
        status: formData.status,
        notas: formData.notas || null,
      };

      if (editingVehiculo) {
        const { error } = await supabase
          .from("vehiculos")
          .update(vehiculoData)
          .eq("id", editingVehiculo.id);

        if (error) throw error;
        toast({ title: "Vehículo actualizado correctamente" });
      } else {
        const { error } = await supabase
          .from("vehiculos")
          .insert([vehiculoData]);

        if (error) throw error;
        toast({ title: "Vehículo creado correctamente" });
      }

      setDialogOpen(false);
      resetForm();
      loadVehiculos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (vehiculo: Vehiculo) => {
    setEditingVehiculo(vehiculo);
    setFormData({
      nombre: vehiculo.nombre,
      tipo: vehiculo.tipo,
      placa: vehiculo.placa || "",
      peso_maximo_local_kg: vehiculo.peso_maximo_local_kg.toString(),
      peso_maximo_foraneo_kg: vehiculo.peso_maximo_foraneo_kg.toString(),
      status: vehiculo.status,
      notas: vehiculo.notas || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este vehículo?")) return;

    try {
      const { error } = await supabase
        .from("vehiculos")
        .update({ activo: false })
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Vehículo eliminado" });
      loadVehiculos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingVehiculo(null);
    setFormData({
      nombre: "",
      tipo: "camioneta",
      placa: "",
      peso_maximo_local_kg: "7800",
      peso_maximo_foraneo_kg: "7000",
      status: "disponible",
      notas: "",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      disponible: "default",
      en_ruta: "secondary",
      mantenimiento: "destructive",
    };
    const labels: Record<string, string> = {
      disponible: "Disponible",
      en_ruta: "En Ruta",
      mantenimiento: "Mantenimiento",
    };
    return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Vehículos</h2>
          <p className="text-sm text-muted-foreground">Gestiona tu flota de vehículos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Vehículo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingVehiculo ? "Editar Vehículo" : "Nuevo Vehículo"}
              </DialogTitle>
              <DialogDescription>
                Configura la información del vehículo
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Camioneta 1"
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="camioneta">Camioneta</SelectItem>
                      <SelectItem value="camion">Camión</SelectItem>
                      <SelectItem value="trailer">Tráiler</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="placa">Placa</Label>
                <Input
                  id="placa"
                  value={formData.placa}
                  onChange={(e) => setFormData({ ...formData, placa: e.target.value })}
                  placeholder="ABC-123"
                  autoComplete="off"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="peso_maximo_local_kg">Capacidad Local (kg) *</Label>
                  <Input
                    id="peso_maximo_local_kg"
                    type="number"
                    value={formData.peso_maximo_local_kg}
                    onChange={(e) => setFormData({ ...formData, peso_maximo_local_kg: e.target.value })}
                    required
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">CDMX y zona metropolitana</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="peso_maximo_foraneo_kg">Capacidad Foránea (kg) *</Label>
                  <Input
                    id="peso_maximo_foraneo_kg"
                    type="number"
                    value={formData.peso_maximo_foraneo_kg}
                    onChange={(e) => setFormData({ ...formData, peso_maximo_foraneo_kg: e.target.value })}
                    required
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">Estados fuera de CDMX</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponible">Disponible</SelectItem>
                    <SelectItem value="en_ruta">En Ruta</SelectItem>
                    <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notas">Notas</Label>
                <Input
                  id="notas"
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  placeholder="Notas adicionales..."
                  autoComplete="off"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Local (kg)</TableHead>
              <TableHead>Foránea (kg)</TableHead>
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
            ) : vehiculos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  <div className="py-8 flex flex-col items-center gap-2">
                    <Truck className="h-8 w-8 text-muted-foreground" />
                    <p>No hay vehículos registrados</p>
                    <p className="text-sm text-muted-foreground">
                      Agrega tu primer vehículo para empezar a planificar rutas
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              vehiculos.map((vehiculo) => (
                <TableRow key={vehiculo.id}>
                  <TableCell className="font-medium">{vehiculo.nombre}</TableCell>
                  <TableCell className="capitalize">{vehiculo.tipo}</TableCell>
                  <TableCell>{vehiculo.placa || "—"}</TableCell>
                  <TableCell>{vehiculo.peso_maximo_local_kg.toLocaleString()}</TableCell>
                  <TableCell>{vehiculo.peso_maximo_foraneo_kg.toLocaleString()}</TableCell>
                  <TableCell>{getStatusBadge(vehiculo.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(vehiculo)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(vehiculo.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default VehiculosTab;
