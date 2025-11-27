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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, MapPin } from "lucide-react";

interface Zona {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

const ZonasTab = () => {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZona, setEditingZona] = useState<Zona | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
  });

  useEffect(() => {
    loadZonas();
  }, []);

  const loadZonas = async () => {
    try {
      const { data, error } = await supabase
        .from("zonas")
        .select("*")
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;
      setZonas(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las zonas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const zonaData = {
        nombre: formData.nombre,
        descripcion: formData.descripcion || null,
      };

      if (editingZona) {
        const { error } = await supabase
          .from("zonas")
          .update(zonaData)
          .eq("id", editingZona.id);

        if (error) throw error;
        toast({ title: "Zona actualizada correctamente" });
      } else {
        const { error } = await supabase
          .from("zonas")
          .insert([zonaData]);

        if (error) throw error;
        toast({ title: "Zona creada correctamente" });
      }

      setDialogOpen(false);
      resetForm();
      loadZonas();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (zona: Zona) => {
    setEditingZona(zona);
    setFormData({
      nombre: zona.nombre,
      descripcion: zona.descripcion || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta zona?")) return;

    try {
      const { error } = await supabase
        .from("zonas")
        .update({ activo: false })
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Zona eliminada" });
      loadZonas();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingZona(null);
    setFormData({
      nombre: "",
      descripcion: "",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Zonas de Entrega</h2>
          <p className="text-sm text-muted-foreground">Define las zonas geográficas para validar rutas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Zona
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingZona ? "Editar Zona" : "Nueva Zona"}
              </DialogTitle>
              <DialogDescription>
                Define una zona geográfica de entrega
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Gustavo A. Madero"
                  required
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Input
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción de la zona..."
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
              <TableHead>Descripción</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : zonas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  <div className="py-8 flex flex-col items-center gap-2">
                    <MapPin className="h-8 w-8 text-muted-foreground" />
                    <p>No hay zonas registradas</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              zonas.map((zona) => (
                <TableRow key={zona.id}>
                  <TableCell className="font-medium">{zona.nombre}</TableCell>
                  <TableCell>{zona.descripcion || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(zona)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(zona.id)}>
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

export default ZonasTab;
