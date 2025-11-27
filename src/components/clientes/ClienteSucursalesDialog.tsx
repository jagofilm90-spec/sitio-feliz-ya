import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Edit, Trash2, MapPin, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ClienteSucursalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: { id: string; nombre: string } | null;
}

interface Sucursal {
  id: string;
  nombre: string;
  direccion: string;
  zona_id: string | null;
  telefono: string | null;
  contacto: string | null;
  notas: string | null;
  activo: boolean;
  zona?: { nombre: string } | null;
  horario_entrega: string | null;
  restricciones_vehiculo: string | null;
  dias_sin_entrega: string | null;
  no_combinar_pedidos: boolean;
}

interface Zona {
  id: string;
  nombre: string;
}

const ClienteSucursalesDialog = ({
  open,
  onOpenChange,
  cliente,
}: ClienteSucursalesDialogProps) => {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSucursal, setEditingSucursal] = useState<Sucursal | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nombre: "",
    direccion: "",
    zona_id: "",
    telefono: "",
    contacto: "",
    notas: "",
    horario_entrega: "",
    restricciones_vehiculo: "",
    dias_sin_entrega: "",
    no_combinar_pedidos: false,
  });

  useEffect(() => {
    if (open && cliente) {
      loadSucursales();
      loadZonas();
    }
  }, [open, cliente]);

  const loadSucursales = async () => {
    if (!cliente) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cliente_sucursales")
        .select(`
          *,
          zona:zona_id (nombre)
        `)
        .eq("cliente_id", cliente.id)
        .order("nombre");

      if (error) throw error;
      setSucursales(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las sucursales",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadZonas = async () => {
    try {
      const { data, error } = await supabase
        .from("zonas")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;
      setZonas(data || []);
    } catch (error: any) {
      console.error("Error loading zones:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente) return;

    try {
      const sucursalData = {
      cliente_id: cliente.id,
        nombre: formData.nombre,
        direccion: formData.direccion,
        zona_id: formData.zona_id || null,
        telefono: formData.telefono || null,
        contacto: formData.contacto || null,
        notas: formData.notas || null,
        horario_entrega: formData.horario_entrega || null,
        restricciones_vehiculo: formData.restricciones_vehiculo || null,
        dias_sin_entrega: formData.dias_sin_entrega || null,
        no_combinar_pedidos: formData.no_combinar_pedidos,
      };

      if (editingSucursal) {
        const { error } = await supabase
          .from("cliente_sucursales")
          .update(sucursalData)
          .eq("id", editingSucursal.id);

        if (error) throw error;
        toast({ title: "Sucursal actualizada" });
      } else {
        const { error } = await supabase
          .from("cliente_sucursales")
          .insert([sucursalData]);

        if (error) throw error;
        toast({ title: "Sucursal creada" });
      }

      setFormOpen(false);
      resetForm();
      loadSucursales();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (sucursal: Sucursal) => {
    setEditingSucursal(sucursal);
    setFormData({
      nombre: sucursal.nombre,
      direccion: sucursal.direccion,
      zona_id: sucursal.zona_id || "",
      telefono: sucursal.telefono || "",
      contacto: sucursal.contacto || "",
      notas: sucursal.notas || "",
      horario_entrega: sucursal.horario_entrega || "",
      restricciones_vehiculo: sucursal.restricciones_vehiculo || "",
      dias_sin_entrega: sucursal.dias_sin_entrega || "",
      no_combinar_pedidos: sucursal.no_combinar_pedidos || false,
    });
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta sucursal?")) return;

    try {
      const { error } = await supabase
        .from("cliente_sucursales")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Sucursal eliminada" });
      loadSucursales();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingSucursal(null);
    setFormData({
      nombre: "",
      direccion: "",
      zona_id: "",
      telefono: "",
      contacto: "",
      notas: "",
      horario_entrega: "",
      restricciones_vehiculo: "",
      dias_sin_entrega: "",
      no_combinar_pedidos: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Sucursales de {cliente?.nombre}
          </DialogTitle>
          <DialogDescription>
            Gestiona las ubicaciones de entrega del cliente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Sucursal
            </Button>
          </div>

          {formOpen && (
            <form onSubmit={handleSave} className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="suc_nombre">Nombre *</Label>
                  <Input
                    id="suc_nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Sucursal Ciprés"
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suc_zona">Zona de Entrega</Label>
                  <Select
                    value={formData.zona_id}
                    onValueChange={(value) => setFormData({ ...formData, zona_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona zona" />
                    </SelectTrigger>
                    <SelectContent>
                      {zonas.map((zona) => (
                        <SelectItem key={zona.id} value={zona.id}>
                          {zona.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="suc_direccion">Dirección *</Label>
                <Input
                  id="suc_direccion"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Dirección de entrega"
                  autoComplete="off"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="suc_contacto">Contacto</Label>
                  <Input
                    id="suc_contacto"
                    value={formData.contacto}
                    onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                    placeholder="Nombre del contacto"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suc_telefono">Teléfono</Label>
                  <Input
                    id="suc_telefono"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="Teléfono de contacto"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Restricciones de Entrega
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="suc_horario">Horario de Entrega</Label>
                    <Input
                      id="suc_horario"
                      value={formData.horario_entrega}
                      onChange={(e) => setFormData({ ...formData, horario_entrega: e.target.value })}
                      placeholder="Ej: 8am - 2pm"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="suc_dias_sin">Días sin Entrega</Label>
                    <Input
                      id="suc_dias_sin"
                      value={formData.dias_sin_entrega}
                      onChange={(e) => setFormData({ ...formData, dias_sin_entrega: e.target.value })}
                      placeholder="Ej: Miércoles (hay mercado)"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <Label htmlFor="suc_restricciones">Restricciones de Vehículo</Label>
                  <Input
                    id="suc_restricciones"
                    value={formData.restricciones_vehiculo}
                    onChange={(e) => setFormData({ ...formData, restricciones_vehiculo: e.target.value })}
                    placeholder="Ej: No tortón (no entra), solo camioneta"
                    autoComplete="off"
                  />
                </div>
                <div className="flex items-center space-x-2 mt-4">
                  <Checkbox
                    id="suc_no_combinar"
                    checked={formData.no_combinar_pedidos}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, no_combinar_pedidos: checked === true })
                    }
                  />
                  <Label htmlFor="suc_no_combinar" className="text-sm font-normal">
                    No combinar pedidos con otros clientes (requiere autorización)
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="suc_notas">Notas Adicionales</Label>
                <Textarea
                  id="suc_notas"
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  placeholder="Otras observaciones importantes..."
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingSucursal ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </form>
          )}

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : sucursales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No hay sucursales registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  sucursales.map((sucursal) => (
                    <TableRow key={sucursal.id}>
                      <TableCell className="font-medium">{sucursal.nombre}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {sucursal.direccion}
                      </TableCell>
                      <TableCell>
                        {sucursal.zona ? (
                          <Badge variant="outline">{sucursal.zona.nombre}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {sucursal.contacto || sucursal.telefono || "—"}
                          {sucursal.no_combinar_pedidos && (
                            <Badge variant="secondary" className="text-xs w-fit">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              No combinar
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(sucursal)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(sucursal.id)}
                          >
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
      </DialogContent>
    </Dialog>
  );
};

export default ClienteSucursalesDialog;
