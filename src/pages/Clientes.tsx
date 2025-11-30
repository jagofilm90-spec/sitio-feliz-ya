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
import { Plus, Search, Edit, Trash2, MapPin, Truck, X, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ClienteSucursalesDialog from "@/components/clientes/ClienteSucursalesDialog";
import GoogleMapsAddressAutocomplete from "@/components/GoogleMapsAddressAutocomplete";

interface Zona {
  id: string;
  nombre: string;
}

interface SucursalForm {
  id: string; // temporal ID for UI
  nombre: string;
  direccion: string;
  zona_id: string;
  telefono: string;
  contacto: string;
}

interface CorreoForm {
  id: string;
  email: string;
  nombre_contacto: string;
  proposito: string;
  es_principal: boolean;
  isNew?: boolean; // to track if it's a new email or existing one
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
    preferencia_facturacion: "siempre_factura" | "siempre_remision" | "variable";
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
    preferencia_facturacion: "variable",
  });

  // Delivery options state
  const [entregarMismaDireccion, setEntregarMismaDireccion] = useState(true);
  const [sucursales, setSucursales] = useState<SucursalForm[]>([]);

  // Email management state (inline like proveedores)
  const [correos, setCorreos] = useState<CorreoForm[]>([]);
  const [originalCorreoIds, setOriginalCorreoIds] = useState<string[]>([]); // Track loaded IDs to know what to deactivate
  const [newCorreoEmail, setNewCorreoEmail] = useState("");
  const [newCorreoNombre, setNewCorreoNombre] = useState("");

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

  // Load correos for a client when editing
  const loadCorreosCliente = async (clienteId: string) => {
    try {
      const { data, error } = await supabase
        .from("cliente_correos")
        .select("*")
        .eq("cliente_id", clienteId)
        .eq("activo", true)
        .order("es_principal", { ascending: false });

      if (error) throw error;
      const loadedCorreos = (data || []).map(c => ({
        id: c.id,
        email: c.email,
        nombre_contacto: c.nombre_contacto || "",
        proposito: c.proposito || "general",
        es_principal: c.es_principal || false,
        isNew: false,
      }));
      setCorreos(loadedCorreos);
      setOriginalCorreoIds(loadedCorreos.map(c => c.id)); // Track original IDs for deactivation logic
    } catch (error) {
      console.error("Error loading correos:", error);
      setCorreos([]);
      setOriginalCorreoIds([]);
    }
  };

  // Email management functions (inline like proveedores)
  const handleAddCorreo = () => {
    if (!newCorreoEmail || !newCorreoEmail.includes("@")) return;
    if (correos.some(c => c.email.toLowerCase() === newCorreoEmail.toLowerCase())) {
      toast({
        title: "Correo duplicado",
        description: "Este correo ya está registrado",
        variant: "destructive",
      });
      return;
    }

    const newCorreo: CorreoForm = {
      id: crypto.randomUUID(),
      email: newCorreoEmail.trim(),
      nombre_contacto: newCorreoNombre.trim(),
      proposito: "general",
      es_principal: correos.length === 0, // First email is principal
      isNew: true,
    };
    setCorreos([...correos, newCorreo]);
    setNewCorreoEmail("");
    setNewCorreoNombre("");
  };

  const handleRemoveCorreo = (correoId: string) => {
    const correoToRemove = correos.find(c => c.id === correoId);
    const remaining = correos.filter(c => c.id !== correoId);
    
    // If removing the principal, make the first remaining one principal
    if (correoToRemove?.es_principal && remaining.length > 0) {
      remaining[0].es_principal = true;
    }
    
    setCorreos(remaining);
  };

  const handleSetPrincipal = (correoId: string) => {
    setCorreos(correos.map(c => ({
      ...c,
      es_principal: c.id === correoId,
    })));
  };

  const addSucursal = () => {
    setSucursales([
      ...sucursales,
      {
        id: crypto.randomUUID(),
        nombre: "",
        direccion: "",
        zona_id: "",
        telefono: "",
        contacto: "",
      },
    ]);
  };

  const removeSucursal = (id: string) => {
    setSucursales(sucursales.filter((s) => s.id !== id));
  };

  const updateSucursal = (id: string, field: keyof SucursalForm, value: string) => {
    setSucursales(
      sucursales.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      )
    );
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
        preferencia_facturacion: formData.preferencia_facturacion,
      };

      let clienteId: string;

      if (editingClient) {
        const { error } = await supabase
          .from("clientes")
          .update(clientData)
          .eq("id", editingClient.id);

        if (error) throw error;
        clienteId = editingClient.id;

        // Handle correos for editing - only if we had original correos loaded
        if (originalCorreoIds.length > 0) {
          // Find which original correos were removed (not in current list)
          const currentExistingIds = correos.filter(c => !c.isNew).map(c => c.id);
          const idsToDeactivate = originalCorreoIds.filter(id => !currentExistingIds.includes(id));
          
          if (idsToDeactivate.length > 0) {
            await supabase
              .from("cliente_correos")
              .update({ activo: false })
              .in("id", idsToDeactivate);
          }
        }

        // Update existing correos
        for (const correo of correos.filter(c => !c.isNew)) {
          await supabase
            .from("cliente_correos")
            .update({
              email: correo.email,
              nombre_contacto: correo.nombre_contacto || null,
              proposito: correo.proposito,
              es_principal: correo.es_principal,
            })
            .eq("id", correo.id);
        }

        // Insert new correos
        const newCorreos = correos.filter(c => c.isNew);
        if (newCorreos.length > 0) {
          await supabase.from("cliente_correos").insert(
            newCorreos.map(c => ({
              cliente_id: clienteId,
              email: c.email,
              nombre_contacto: c.nombre_contacto || null,
              proposito: c.proposito,
              es_principal: c.es_principal,
            }))
          );
        }

        toast({ title: "Cliente actualizado correctamente" });
      } else {
        const { data, error } = await supabase
          .from("clientes")
          .insert([clientData])
          .select()
          .single();

        if (error) throw error;
        clienteId = data.id;

        // Create correos for new client
        if (correos.length > 0) {
          const correosData = correos.map(c => ({
            cliente_id: clienteId,
            email: c.email,
            nombre_contacto: c.nombre_contacto || null,
            proposito: c.proposito,
            es_principal: c.es_principal,
          }));

          const { error: correoError } = await supabase
            .from("cliente_correos")
            .insert(correosData);

          if (correoError) {
            console.error("Error creating correos:", correoError);
          }
        }

        // Create sucursales if not delivering to fiscal address
        if (!entregarMismaDireccion && sucursales.length > 0) {
          const sucursalesValidas = sucursales.filter(s => s.nombre && s.direccion);
          
          if (sucursalesValidas.length > 0) {
            const sucursalesData = sucursalesValidas.map(s => ({
              cliente_id: clienteId,
              nombre: s.nombre,
              direccion: s.direccion,
              zona_id: s.zona_id || null,
              telefono: s.telefono || null,
              contacto: s.contacto || null,
            }));

            const { error: sucError } = await supabase
              .from("cliente_sucursales")
              .insert(sucursalesData);

            if (sucError) {
              console.error("Error creating sucursales:", sucError);
              toast({
                title: "Cliente creado",
                description: `Pero hubo un error al crear las sucursales`,
                variant: "destructive",
              });
            } else {
              toast({ 
                title: "Cliente creado correctamente",
                description: `Se crearon ${sucursalesValidas.length} sucursal(es) de entrega y ${correos.length} correo(s)`
              });
            }
          } else {
            toast({ title: "Cliente creado correctamente" });
          }
        } else if (entregarMismaDireccion && formData.direccion) {
          // Create a default sucursal with the fiscal address
          const { error: sucError } = await supabase
            .from("cliente_sucursales")
            .insert([{
              cliente_id: clienteId,
              nombre: "Principal",
              direccion: formData.direccion,
              zona_id: formData.zona_id || null,
              telefono: formData.telefono || null,
              contacto: null,
            }]);

          if (sucError) {
            console.error("Error creating default sucursal:", sucError);
          }
          toast({ title: "Cliente creado correctamente" });
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

  const handleEdit = async (client: any) => {
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
      preferencia_facturacion: client.preferencia_facturacion || "variable",
    });
    setEntregarMismaDireccion(true);
    setSucursales([]);
    await loadCorreosCliente(client.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este cliente?")) return;

    try {
      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", id);

      if (error) {
        // Check for foreign key constraint error
        if (error.message.includes("violates foreign key constraint")) {
          if (error.message.includes("cotizaciones")) {
            throw new Error("No se puede eliminar el cliente porque tiene cotizaciones asociadas. Primero elimina las cotizaciones de este cliente.");
          } else if (error.message.includes("pedidos")) {
            throw new Error("No se puede eliminar el cliente porque tiene pedidos asociados. Primero elimina los pedidos de este cliente.");
          } else if (error.message.includes("facturas")) {
            throw new Error("No se puede eliminar el cliente porque tiene facturas asociadas.");
          } else if (error.message.includes("cliente_sucursales")) {
            throw new Error("No se puede eliminar el cliente porque tiene sucursales asociadas. Primero elimina las sucursales de este cliente.");
          } else {
            throw new Error("No se puede eliminar el cliente porque tiene registros asociados en el sistema.");
          }
        }
        throw error;
      }
      toast({ title: "Cliente eliminado" });
      loadClientes();
    } catch (error: any) {
      toast({
        title: "Error al eliminar",
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
      preferencia_facturacion: "variable",
    });
    setEntregarMismaDireccion(true);
    setSucursales([]);
    setCorreos([]);
    setOriginalCorreoIds([]);
    setNewCorreoEmail("");
    setNewCorreoNombre("");
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
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? "Editar Cliente" : "Nuevo Cliente"}
                </DialogTitle>
                <DialogDescription>
                  {editingClient 
                    ? "Modifica la información del cliente" 
                    : "Completa la información del cliente y sus sucursales de entrega"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-6">
                {/* Datos Fiscales del Cliente */}
                <div className="space-y-4">
                  <h4 className="font-medium text-lg border-b pb-2">Datos Fiscales</h4>
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
                      <Label htmlFor="nombre">Nombre del Cliente/Grupo *</Label>
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej: Universal, Lecaroz, Pan Rol"
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
                  <div className="space-y-2">
                    <Label htmlFor="preferencia_facturacion">Preferencia de Facturación</Label>
                    <Select
                      value={formData.preferencia_facturacion}
                      onValueChange={(value: "siempre_factura" | "siempre_remision" | "variable") => setFormData({ ...formData, preferencia_facturacion: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="siempre_factura">Siempre factura</SelectItem>
                        <SelectItem value="siempre_remision">Siempre remisión</SelectItem>
                        <SelectItem value="variable">Variable (según pedido)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Define si este cliente normalmente requiere factura o remisión
                    </p>
                  </div>
                </div>

                {/* Sección de Correos Electrónicos */}
                <div className="space-y-4">
                  <h4 className="font-medium text-lg border-b pb-2 flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Correos Electrónicos
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Email *</Label>
                        <Input
                          type="email"
                          placeholder="correo@cliente.com"
                          value={newCorreoEmail}
                          onChange={(e) => setNewCorreoEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCorreo())}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Nombre contacto (opcional)</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Juan Pérez"
                            value={newCorreoNombre}
                            onChange={(e) => setNewCorreoNombre(e.target.value)}
                            className="flex-1"
                          />
                          <Button type="button" variant="outline" size="icon" onClick={handleAddCorreo}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {correos.length > 0 && (
                      <div className="space-y-2">
                        {correos.map((correo) => (
                          <div 
                            key={correo.id} 
                            className="flex items-center gap-2 p-2 bg-muted/50 rounded-md"
                          >
                            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{correo.email}</span>
                                {correo.es_principal && (
                                  <Badge variant="default" className="text-xs shrink-0">Principal</Badge>
                                )}
                              </div>
                              {correo.nombre_contacto && (
                                <span className="text-xs text-muted-foreground">{correo.nombre_contacto}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!correo.es_principal && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => handleSetPrincipal(correo.id)}
                                >
                                  Hacer principal
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-destructive/20"
                                onClick={() => handleRemoveCorreo(correo.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {correos.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Agrega correos para enviar cotizaciones y facturas
                      </p>
                    )}
                  </div>
                </div>

                {/* Sección de Sucursales de Entrega - Solo para nuevos clientes */}
                {!editingClient && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-lg border-b pb-2 flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Sucursales de Entrega
                    </h4>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="entregarMismaDireccion"
                        checked={entregarMismaDireccion}
                        onCheckedChange={(checked) => {
                          setEntregarMismaDireccion(checked === true);
                          if (checked === true) {
                            setSucursales([]);
                          }
                        }}
                      />
                      <Label htmlFor="entregarMismaDireccion" className="text-sm font-normal cursor-pointer">
                        Entregar en la misma dirección fiscal (cliente simple como Pan Rol)
                      </Label>
                    </div>

                    {!entregarMismaDireccion && (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Agrega las sucursales de entrega para grupos como Universal o Lecaroz
                        </p>

                        {sucursales.length === 0 ? (
                          <div className="text-center p-6 border-2 border-dashed rounded-lg">
                            <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-muted-foreground mb-3">No hay sucursales agregadas</p>
                            <Button type="button" variant="outline" onClick={addSucursal}>
                              <Plus className="h-4 w-4 mr-2" />
                              Agregar Sucursal
                            </Button>
                          </div>
                        ) : (
                          <>
                            {sucursales.map((sucursal, index) => (
                              <div 
                                key={sucursal.id} 
                                className="p-4 bg-muted/30 rounded-lg border space-y-4"
                              >
                                <div className="flex justify-between items-center">
                                  <h5 className="font-medium">Sucursal {index + 1}</h5>
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => removeSucursal(sucursal.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Nombre de Sucursal *</Label>
                                    <Input
                                      value={sucursal.nombre}
                                      onChange={(e) => updateSucursal(sucursal.id, "nombre", e.target.value)}
                                      placeholder="Ej: Dallas, Kansas, Centro"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Zona de Entrega</Label>
                                    <Select
                                      value={sucursal.zona_id}
                                      onValueChange={(value) => updateSucursal(sucursal.id, "zona_id", value)}
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
                                  <Label>Dirección de Entrega *</Label>
                                  <GoogleMapsAddressAutocomplete
                                    value={sucursal.direccion}
                                    onChange={(value) => updateSucursal(sucursal.id, "direccion", value)}
                                    placeholder="Buscar dirección de entrega..."
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Contacto</Label>
                                    <Input
                                      value={sucursal.contacto}
                                      onChange={(e) => updateSucursal(sucursal.id, "contacto", e.target.value)}
                                      placeholder="Nombre del contacto"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Teléfono</Label>
                                    <Input
                                      value={sucursal.telefono}
                                      onChange={(e) => updateSucursal(sucursal.id, "telefono", e.target.value)}
                                      placeholder="Teléfono de la sucursal"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                            
                            <Button type="button" variant="outline" onClick={addSucursal}>
                              <Plus className="h-4 w-4 mr-2" />
                              Agregar Otra Sucursal
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingClient ? "Actualizar" : "Crear Cliente"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes..."
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
                <TableHead>RFC</TableHead>
                <TableHead>Crédito</TableHead>
                <TableHead>Límite</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filteredClientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No se encontraron clientes
                  </TableCell>
                </TableRow>
              ) : (
                filteredClientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-mono">{cliente.codigo}</TableCell>
                    <TableCell className="font-medium">{cliente.nombre}</TableCell>
                    <TableCell>{cliente.rfc || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getCreditLabel(cliente.termino_credito)}
                      </Badge>
                    </TableCell>
                    <TableCell>${(cliente.limite_credito || 0).toLocaleString()}</TableCell>
                    <TableCell className={cliente.saldo_pendiente > 0 ? "text-destructive" : ""}>
                      ${(cliente.saldo_pendiente || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cliente.activo ? "default" : "destructive"}>
                        {cliente.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedClienteForSucursales({ id: cliente.id, nombre: cliente.nombre });
                            setSucursalesDialogOpen(true);
                          }}
                          title="Ver sucursales"
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(cliente)}
                          title="Editar cliente y correos"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cliente.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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
