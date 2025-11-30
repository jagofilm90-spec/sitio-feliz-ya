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
import { Plus, Edit, Trash2, MapPin, AlertTriangle, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import GoogleMapsAddressAutocomplete from "@/components/GoogleMapsAddressAutocomplete";

interface ClienteSucursalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: { id: string; nombre: string } | null;
}

interface Sucursal {
  id: string;
  nombre: string;
  codigo_sucursal: string | null;
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
  // Datos fiscales opcionales para facturación por sucursal
  rfc: string | null;
  razon_social: string | null;
  direccion_fiscal: string | null;
  email_facturacion: string | null;
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
    codigo_sucursal: "",
    direccion: "",
    zona_id: "",
    telefono: "",
    contacto: "",
    notas: "",
    horario_entrega: "",
    restricciones_vehiculo: "",
    dias_sin_entrega: "",
    no_combinar_pedidos: false,
    // Datos fiscales opcionales
    rfc: "",
    razon_social: "",
    direccion_fiscal: "",
    email_facturacion: "",
  });
  const [mostrarDatosFiscales, setMostrarDatosFiscales] = useState(false);

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
        codigo_sucursal: formData.codigo_sucursal || null,
        direccion: formData.direccion,
        zona_id: formData.zona_id || null,
        telefono: formData.telefono || null,
        contacto: formData.contacto || null,
        notas: formData.notas || null,
        horario_entrega: formData.horario_entrega || null,
        restricciones_vehiculo: formData.restricciones_vehiculo || null,
        dias_sin_entrega: formData.dias_sin_entrega || null,
        no_combinar_pedidos: formData.no_combinar_pedidos,
        // Datos fiscales opcionales
        rfc: formData.rfc || null,
        razon_social: formData.razon_social || null,
        direccion_fiscal: formData.direccion_fiscal || null,
        email_facturacion: formData.email_facturacion || null,
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
      codigo_sucursal: sucursal.codigo_sucursal || "",
      direccion: sucursal.direccion,
      zona_id: sucursal.zona_id || "",
      telefono: sucursal.telefono || "",
      contacto: sucursal.contacto || "",
      notas: sucursal.notas || "",
      horario_entrega: sucursal.horario_entrega || "",
      restricciones_vehiculo: sucursal.restricciones_vehiculo || "",
      dias_sin_entrega: sucursal.dias_sin_entrega || "",
      no_combinar_pedidos: sucursal.no_combinar_pedidos || false,
      rfc: sucursal.rfc || "",
      razon_social: sucursal.razon_social || "",
      direccion_fiscal: sucursal.direccion_fiscal || "",
      email_facturacion: sucursal.email_facturacion || "",
    });
    setMostrarDatosFiscales(!!(sucursal.rfc || sucursal.razon_social));
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
      codigo_sucursal: "",
      direccion: "",
      zona_id: "",
      telefono: "",
      contacto: "",
      notas: "",
      horario_entrega: "",
      restricciones_vehiculo: "",
      dias_sin_entrega: "",
      no_combinar_pedidos: false,
      rfc: "",
      razon_social: "",
      direccion_fiscal: "",
      email_facturacion: "",
    });
    setMostrarDatosFiscales(false);
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
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="suc_codigo">Código</Label>
                  <Input
                    id="suc_codigo"
                    value={formData.codigo_sucursal}
                    onChange={(e) => setFormData({ ...formData, codigo_sucursal: e.target.value })}
                    placeholder="Ej: 41"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">ID interno del cliente</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suc_nombre">Nombre *</Label>
                  <Input
                    id="suc_nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: La Joya"
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
                <Label htmlFor="suc_direccion">Dirección de Entrega *</Label>
                <GoogleMapsAddressAutocomplete
                  id="suc_direccion"
                  value={formData.direccion}
                  onChange={(value) => setFormData({ ...formData, direccion: value })}
                  placeholder="Buscar dirección de entrega..."
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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Horario de Entrega</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={formData.horario_entrega?.split(' - ')[0] || ''}
                        onChange={(e) => {
                          const horaFin = formData.horario_entrega?.split(' - ')[1] || '';
                          const nuevoHorario = horaFin ? `${e.target.value} - ${horaFin}` : e.target.value;
                          setFormData({ ...formData, horario_entrega: nuevoHorario });
                        }}
                        className="w-32"
                      />
                      <span className="text-muted-foreground">a</span>
                      <Input
                        type="time"
                        value={formData.horario_entrega?.split(' - ')[1] || ''}
                        onChange={(e) => {
                          const horaInicio = formData.horario_entrega?.split(' - ')[0] || '';
                          const nuevoHorario = horaInicio ? `${horaInicio} - ${e.target.value}` : `- ${e.target.value}`;
                          setFormData({ ...formData, horario_entrega: nuevoHorario });
                        }}
                        className="w-32"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Días sin Entrega</Label>
                    <div className="flex flex-wrap gap-3">
                      {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((dia) => {
                        const diasSeleccionados = formData.dias_sin_entrega?.split(',').filter(d => d.trim()) || [];
                        const isChecked = diasSeleccionados.includes(dia);
                        return (
                          <div key={dia} className="flex items-center space-x-2">
                            <Checkbox
                              id={`dia_${dia}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                let nuevosDias: string[];
                                if (checked) {
                                  nuevosDias = [...diasSeleccionados, dia];
                                } else {
                                  nuevosDias = diasSeleccionados.filter(d => d !== dia);
                                }
                                setFormData({ ...formData, dias_sin_entrega: nuevosDias.join(',') });
                              }}
                            />
                            <Label htmlFor={`dia_${dia}`} className="text-sm font-normal cursor-pointer">
                              {dia}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">Selecciona los días que NO se puede entregar</p>
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
              
              {/* Datos Fiscales Opcionales */}
              <div className="border-t pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setMostrarDatosFiscales(!mostrarDatosFiscales)}
                  className="flex items-center gap-2 font-medium text-sm hover:text-primary transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Datos Fiscales de la Sucursal (opcional)
                  {mostrarDatosFiscales ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Solo si esta sucursal se factura por separado del grupo
                </p>
                
                {mostrarDatosFiscales && (
                  <div className="space-y-4 pl-2 border-l-2 border-primary/20">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="suc_rfc">RFC</Label>
                        <Input
                          id="suc_rfc"
                          value={formData.rfc}
                          onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                          placeholder="RFC de la sucursal"
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="suc_razon_social">Razón Social</Label>
                        <Input
                          id="suc_razon_social"
                          value={formData.razon_social}
                          onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                          placeholder="Razón social para facturación"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="suc_direccion_fiscal">Dirección Fiscal</Label>
                      <Input
                        id="suc_direccion_fiscal"
                        value={formData.direccion_fiscal}
                        onChange={(e) => setFormData({ ...formData, direccion_fiscal: e.target.value })}
                        placeholder="Dirección fiscal para facturación"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="suc_email_facturacion">Email de Facturación</Label>
                      <Input
                        id="suc_email_facturacion"
                        type="email"
                        value={formData.email_facturacion}
                        onChange={(e) => setFormData({ ...formData, email_facturacion: e.target.value })}
                        placeholder="Email para envío de facturas"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                )}
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
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {sucursal.codigo_sucursal && (
                              <Badge variant="secondary" className="text-xs font-mono">
                                {sucursal.codigo_sucursal}
                              </Badge>
                            )}
                            {sucursal.nombre}
                          </div>
                          {sucursal.rfc && (
                            <Badge variant="outline" className="text-xs w-fit">
                              <FileText className="h-3 w-3 mr-1" />
                              Factura propia
                            </Badge>
                          )}
                        </div>
                      </TableCell>
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
