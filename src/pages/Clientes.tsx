import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Search, Edit, Trash2, MapPin, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ClienteSucursalesDialog from "@/components/clientes/ClienteSucursalesDialog";
import GoogleMapsAddressAutocomplete from "@/components/GoogleMapsAddressAutocomplete";

interface Zona {
  id: string;
  nombre: string;
}

const Clientes = () => {
  const [clientes, setClientes] = useState<any[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [sucursalesDialogOpen, setSucursalesDialogOpen] = useState(false);
  const [selectedClienteForSucursales, setSelectedClienteForSucursales] = useState<{ id: string; nombre: string } | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState<{
    codigo: string;
    nombre: string;
    razon_social: string;
    rfc: string;
    direccion: string;
    telefono: string;
    email: string;
    termino_credito: "contado" | "8_dias" | "15_dias" | "30_dias";
    limite_credito: string;
    zona_id: string;
  }>({
    codigo: "",
    nombre: "",
    razon_social: "",
    rfc: "",
    direccion: "",
    telefono: "",
    email: "",
    termino_credito: "contado",
    limite_credito: "",
    zona_id: "",
  });

  // Delivery options state
  const [entregarMismaDireccion, setEntregarMismaDireccion] = useState(true);
  const [sucursalData, setSucursalData] = useState({
    nombre: "",
    direccion: "",
    zona_id: "",
    telefono: "",
    contacto: "",
  });

  useEffect(() => {
    loadClientes();
    loadZonas();
  }, []);

  const loadClientes = async () => {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select(`
          *,
          zona:zona_id (id, nombre)
        `)
        .order("nombre");

      if (error) throw error;
      setClientes(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes",
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
    
    try {
      const clientData = {
        codigo: formData.codigo,
        nombre: formData.nombre,
        razon_social: formData.razon_social || null,
        rfc: formData.rfc || null,
        direccion: formData.direccion || null,
        telefono: formData.telefono || null,
        email: formData.email || null,
        termino_credito: formData.termino_credito,
        limite_credito: parseFloat(formData.limite_credito || "0"),
        zona_id: formData.zona_id || null,
      };

      let clienteId: string;

      if (editingClient) {
        const { error } = await supabase
          .from("clientes")
          .update(clientData)
          .eq("id", editingClient.id);

        if (error) throw error;
        clienteId = editingClient.id;
        toast({ title: "Cliente actualizado correctamente" });
      } else {
        const { data, error } = await supabase
          .from("clientes")
          .insert([clientData])
          .select()
          .single();

        if (error) throw error;
        clienteId = data.id;

        // If NOT delivering to fiscal address AND sucursal data is filled, create sucursal
        if (!entregarMismaDireccion && sucursalData.nombre && sucursalData.direccion) {
          const { error: sucError } = await supabase
            .from("cliente_sucursales")
            .insert([{
              cliente_id: clienteId,
              nombre: sucursalData.nombre,
              direccion: sucursalData.direccion,
              zona_id: sucursalData.zona_id || null,
              telefono: sucursalData.telefono || null,
              contacto: sucursalData.contacto || null,
            }]);

          if (sucError) {
            console.error("Error creating sucursal:", sucError);
            toast({
              title: "Cliente creado",
              description: "Pero hubo un error al crear la sucursal de entrega",
              variant: "destructive",
            });
          } else {
            toast({ title: "Cliente y sucursal creados correctamente" });
          }
        } else {
          toast({ title: "Cliente creado correctamente" });
        }
      }

      setDialogOpen(false);
      resetForm();
      loadClientes();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (client: any) => {
    setEditingClient(client);
    setFormData({
      codigo: client.codigo,
      nombre: client.nombre,
      razon_social: client.razon_social || "",
      rfc: client.rfc || "",
      direccion: client.direccion || "",
      telefono: client.telefono || "",
      email: client.email || "",
      termino_credito: client.termino_credito,
      limite_credito: client.limite_credito.toString(),
      zona_id: client.zona_id || "",
    });
    setEntregarMismaDireccion(true);
    setSucursalData({
      nombre: "",
      direccion: "",
      zona_id: "",
      telefono: "",
      contacto: "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este cliente?")) return;

    try {
      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Cliente eliminado" });
      loadClientes();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingClient(null);
    setFormData({
      codigo: "",
      nombre: "",
      razon_social: "",
      rfc: "",
      direccion: "",
      telefono: "",
      email: "",
      termino_credito: "contado",
      limite_credito: "",
      zona_id: "",
    });
    setEntregarMismaDireccion(true);
    setSucursalData({
      nombre: "",
      direccion: "",
      zona_id: "",
      telefono: "",
      contacto: "",
    });
  };

  const filteredClientes = clientes.filter(
    (c) =>
      c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCreditLabel = (term: string) => {
    const labels: Record<string, string> = {
      contado: "Contado",
      "8_dias": "8 días",
      "15_dias": "15 días",
      "30_dias": "30 días",
    };
    return labels[term] || term;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Clientes</h1>
            <p className="text-muted-foreground">Gestión de clientes y créditos</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? "Editar Cliente" : "Nuevo Cliente"}
                </DialogTitle>
                <DialogDescription>
                  Completa la información del cliente
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                {/* Datos del Cliente */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código *</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="razon_social">Razón Social</Label>
                    <Input
                      id="razon_social"
                      value={formData.razon_social}
                      onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rfc">RFC</Label>
                    <Input
                      id="rfc"
                      value={formData.rfc}
                      onChange={(e) => setFormData({ ...formData, rfc: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección Fiscal</Label>
                  <Input
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    placeholder="Dirección fiscal del cliente"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="termino_credito">Término de Crédito *</Label>
                    <Select
                      value={formData.termino_credito}
                      onValueChange={(value: "contado" | "8_dias" | "15_dias" | "30_dias") => setFormData({ ...formData, termino_credito: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contado">Contado</SelectItem>
                        <SelectItem value="8_dias">8 días</SelectItem>
                        <SelectItem value="15_dias">15 días</SelectItem>
                        <SelectItem value="30_dias">30 días</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="limite_credito">Límite de Crédito</Label>
                    <Input
                      id="limite_credito"
                      type="number"
                      step="0.01"
                      value={formData.limite_credito}
                      onChange={(e) => setFormData({ ...formData, limite_credito: e.target.value })}
                    />
                  </div>
                </div>

                {/* Sección de Entrega - Solo para nuevos clientes */}
                {!editingClient && (
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Dirección de Entrega
                    </h4>
                    
                    <div className="flex items-center space-x-2 mb-4">
                      <Checkbox
                        id="entregarMismaDireccion"
                        checked={entregarMismaDireccion}
                        onCheckedChange={(checked) => setEntregarMismaDireccion(checked === true)}
                      />
                      <Label htmlFor="entregarMismaDireccion" className="text-sm font-normal cursor-pointer">
                        Entregar en la misma dirección fiscal
                      </Label>
                    </div>

                    {!entregarMismaDireccion && (
                      <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                        <p className="text-sm text-muted-foreground">
                          Agrega una sucursal de entrega diferente a la dirección fiscal
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="suc_nombre">Nombre de Sucursal *</Label>
                            <Input
                              id="suc_nombre"
                              value={sucursalData.nombre}
                              onChange={(e) => setSucursalData({ ...sucursalData, nombre: e.target.value })}
                              placeholder="Ej: Sucursal Centro"
                              required={!entregarMismaDireccion}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="suc_zona">Zona de Entrega</Label>
                            <Select
                              value={sucursalData.zona_id}
                              onValueChange={(value) => setSucursalData({ ...sucursalData, zona_id: value })}
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
                            value={sucursalData.direccion}
                            onChange={(value) => setSucursalData({ ...sucursalData, direccion: value })}
                            placeholder="Buscar dirección de entrega..."
                            required={!entregarMismaDireccion}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="suc_contacto">Contacto</Label>
                            <Input
                              id="suc_contacto"
                              value={sucursalData.contacto}
                              onChange={(e) => setSucursalData({ ...sucursalData, contacto: e.target.value })}
                              placeholder="Nombre del contacto"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="suc_telefono">Teléfono</Label>
                            <Input
                              id="suc_telefono"
                              value={sucursalData.telefono}
                              onChange={(e) => setSucursalData({ ...sucursalData, telefono: e.target.value })}
                              placeholder="Teléfono de contacto"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Guardar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o código..."
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
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Crédito</TableHead>
                <TableHead>Límite</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filteredClientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    No hay clientes registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredClientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-medium">{cliente.codigo}</TableCell>
                    <TableCell>{cliente.nombre}</TableCell>
                    <TableCell>
                      {cliente.zona ? (
                        <Badge variant="outline">{cliente.zona.nombre}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{cliente.telefono || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getCreditLabel(cliente.termino_credito)}
                      </Badge>
                    </TableCell>
                    <TableCell>${cliente.limite_credito.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={cliente.saldo_pendiente > 0 ? "destructive" : "default"}>
                        ${cliente.saldo_pendiente.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Sucursales"
                          onClick={() => {
                            setSelectedClienteForSucursales({ id: cliente.id, nombre: cliente.nombre });
                            setSucursalesDialogOpen(true);
                          }}
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(cliente)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cliente.id)}
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

      <ClienteSucursalesDialog
        open={sucursalesDialogOpen}
        onOpenChange={setSucursalesDialogOpen}
        cliente={selectedClienteForSucursales}
      />
    </Layout>
  );
};

export default Clientes;
