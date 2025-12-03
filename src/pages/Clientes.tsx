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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, MapPin, X, Mail, BarChart3, Loader2, Sparkles, User, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ClienteSucursalesDialog from "@/components/clientes/ClienteSucursalesDialog";
import GoogleMapsAddressAutocomplete from "@/components/GoogleMapsAddressAutocomplete";
import ClienteHistorialAnalytics from "@/components/analytics/ClienteHistorialAnalytics";
import { ClienteUsuarioTab } from "@/components/clientes/ClienteUsuarioTab";
import { ClienteFormContent } from "@/components/clientes/ClienteFormContent";
import { ClienteProductosTab } from "@/components/clientes/ClienteProductosTab";
import { ClienteProductosDialog } from "@/components/clientes/ClienteProductosDialog";
import { useUserRoles } from "@/hooks/useUserRoles";
import {
  Dialog as HistorialDialog,
  DialogContent as HistorialDialogContent,
  DialogHeader as HistorialDialogHeader,
  DialogTitle as HistorialDialogTitle,
} from "@/components/ui/dialog";

interface Zona {
  id: string;
  nombre: string;
}

interface SucursalForm {
  id: string;
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
  isNew?: boolean;
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
  const [historialDialogOpen, setHistorialDialogOpen] = useState(false);
  const [selectedClienteForHistorial, setSelectedClienteForHistorial] = useState<{ id: string; nombre: string } | null>(null);
  const [productosDialogOpen, setProductosDialogOpen] = useState(false);
  const [selectedClienteForProductos, setSelectedClienteForProductos] = useState<{ id: string; nombre: string } | null>(null);
  const { toast } = useToast();
  const { isAdmin } = useUserRoles();

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
    regimen_capital: string;
    codigo_postal: string;
    tipo_vialidad: string;
    nombre_vialidad: string;
    numero_exterior: string;
    numero_interior: string;
    nombre_colonia: string;
    nombre_localidad: string;
    nombre_municipio: string;
    nombre_entidad_federativa: string;
    entre_calle: string;
    y_calle: string;
    csf_archivo_url: string;
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
    regimen_capital: "",
    codigo_postal: "",
    tipo_vialidad: "",
    nombre_vialidad: "",
    numero_exterior: "",
    numero_interior: "",
    nombre_colonia: "",
    nombre_localidad: "",
    nombre_municipio: "",
    nombre_entidad_federativa: "",
    entre_calle: "",
    y_calle: "",
    csf_archivo_url: "",
  });
  
  // CSF file upload state
  const [csfFile, setCsfFile] = useState<File | null>(null);
  const [parsingCsf, setParsingCsf] = useState(false);

  // Delivery options state
  const [entregarMismaDireccion, setEntregarMismaDireccion] = useState(true);
  const [sucursales, setSucursales] = useState<SucursalForm[]>([]);

  // Email management state
  const [correos, setCorreos] = useState<CorreoForm[]>([]);
  const [originalCorreoIds, setOriginalCorreoIds] = useState<string[]>([]);
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
          zona:zona_id (id, nombre),
          cliente_sucursales (count),
          cliente_productos_frecuentes (count)
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
      setOriginalCorreoIds(loadedCorreos.map(c => c.id));
    } catch (error) {
      console.error("Error loading correos:", error);
      setCorreos([]);
      setOriginalCorreoIds([]);
    }
  };

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
      es_principal: correos.length === 0,
      isNew: true,
    };
    setCorreos([...correos, newCorreo]);
    setNewCorreoEmail("");
    setNewCorreoNombre("");
  };

  const handleRemoveCorreo = (correoId: string) => {
    const correoToRemove = correos.find(c => c.id === correoId);
    const remaining = correos.filter(c => c.id !== correoId);
    
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

  const handleParseCsf = async (file: File) => {
    setParsingCsf(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const { data, error } = await supabase.functions.invoke('parse-csf', {
        body: { pdfBase64: base64 }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const parsedData = data?.data;
      if (parsedData) {
        setFormData(prev => ({
          ...prev,
          rfc: parsedData.rfc || prev.rfc,
          razon_social: parsedData.razon_social || prev.razon_social,
          regimen_capital: parsedData.regimen_capital || prev.regimen_capital,
          codigo_postal: parsedData.codigo_postal || prev.codigo_postal,
          tipo_vialidad: parsedData.tipo_vialidad || prev.tipo_vialidad,
          nombre_vialidad: parsedData.nombre_vialidad || prev.nombre_vialidad,
          numero_exterior: parsedData.numero_exterior || prev.numero_exterior,
          numero_interior: parsedData.numero_interior || prev.numero_interior,
          nombre_colonia: parsedData.nombre_colonia || prev.nombre_colonia,
          nombre_localidad: parsedData.nombre_localidad || prev.nombre_localidad,
          nombre_municipio: parsedData.nombre_municipio || prev.nombre_municipio,
          nombre_entidad_federativa: parsedData.nombre_entidad_federativa || prev.nombre_entidad_federativa,
          entre_calle: parsedData.entre_calle || prev.entre_calle,
          y_calle: parsedData.y_calle || prev.y_calle,
          direccion: [
            parsedData.tipo_vialidad,
            parsedData.nombre_vialidad,
            parsedData.numero_exterior,
            parsedData.nombre_colonia,
            parsedData.nombre_municipio,
            parsedData.nombre_entidad_federativa,
            parsedData.codigo_postal
          ].filter(Boolean).join(', ') || prev.direccion,
        }));

        toast({
          title: "CSF analizada correctamente",
          description: "Los datos fiscales se han auto-llenado. Verifica que sean correctos.",
        });
      }
    } catch (error: any) {
      console.error("Error parsing CSF:", error);
      toast({
        title: "Error al analizar CSF",
        description: error.message || "No se pudo extraer la información del PDF",
        variant: "destructive",
      });
    } finally {
      setParsingCsf(false);
    }
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
      let csfUrl = formData.csf_archivo_url;
      
      if (csfFile) {
        const fileExt = csfFile.name.split('.').pop();
        const fileName = `${formData.rfc || formData.codigo}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('clientes-csf')
          .upload(filePath, csfFile);
        
        if (uploadError) throw uploadError;
        csfUrl = filePath;
      }
      
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
        regimen_capital: formData.regimen_capital || null,
        codigo_postal: formData.codigo_postal || null,
        tipo_vialidad: formData.tipo_vialidad || null,
        nombre_vialidad: formData.nombre_vialidad || null,
        numero_exterior: formData.numero_exterior || null,
        numero_interior: formData.numero_interior || null,
        nombre_colonia: formData.nombre_colonia || null,
        nombre_localidad: formData.nombre_localidad || null,
        nombre_municipio: formData.nombre_municipio || null,
        nombre_entidad_federativa: formData.nombre_entidad_federativa || null,
        entre_calle: formData.entre_calle || null,
        y_calle: formData.y_calle || null,
        csf_archivo_url: csfUrl || null,
      };

      let clienteId: string;

      if (editingClient) {
        const { error } = await supabase
          .from("clientes")
          .update(clientData)
          .eq("id", editingClient.id);

        if (error) throw error;
        clienteId = editingClient.id;

        if (originalCorreoIds.length > 0) {
          const currentExistingIds = correos.filter(c => !c.isNew).map(c => c.id);
          const idsToDeactivate = originalCorreoIds.filter(id => !currentExistingIds.includes(id));
          
          if (idsToDeactivate.length > 0) {
            await supabase
              .from("cliente_correos")
              .update({ activo: false })
              .in("id", idsToDeactivate);
          }
        }

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
      regimen_capital: client.regimen_capital || "",
      codigo_postal: client.codigo_postal || "",
      tipo_vialidad: client.tipo_vialidad || "",
      nombre_vialidad: client.nombre_vialidad || "",
      numero_exterior: client.numero_exterior || "",
      numero_interior: client.numero_interior || "",
      nombre_colonia: client.nombre_colonia || "",
      nombre_localidad: client.nombre_localidad || "",
      nombre_municipio: client.nombre_municipio || "",
      nombre_entidad_federativa: client.nombre_entidad_federativa || "",
      entre_calle: client.entre_calle || "",
      y_calle: client.y_calle || "",
      csf_archivo_url: client.csf_archivo_url || "",
    });
    setEntregarMismaDireccion(true);
    setSucursales([]);
    setCsfFile(null);
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
        if (error.message.includes("violates foreign key constraint")) {
          if (error.message.includes("cotizaciones")) {
            throw new Error("No se puede eliminar el cliente porque tiene cotizaciones asociadas.");
          } else if (error.message.includes("pedidos")) {
            throw new Error("No se puede eliminar el cliente porque tiene pedidos asociados.");
          } else if (error.message.includes("facturas")) {
            throw new Error("No se puede eliminar el cliente porque tiene facturas asociadas.");
          } else if (error.message.includes("cliente_sucursales")) {
            throw new Error("No se puede eliminar el cliente porque tiene sucursales asociadas.");
          } else {
            throw new Error("No se puede eliminar el cliente porque tiene registros asociados.");
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
      regimen_capital: "",
      codigo_postal: "",
      tipo_vialidad: "",
      nombre_vialidad: "",
      numero_exterior: "",
      numero_interior: "",
      nombre_colonia: "",
      nombre_localidad: "",
      nombre_municipio: "",
      nombre_entidad_federativa: "",
      entre_calle: "",
      y_calle: "",
      csf_archivo_url: "",
    });
    setEntregarMismaDireccion(true);
    setSucursales([]);
    setCorreos([]);
    setOriginalCorreoIds([]);
    setNewCorreoEmail("");
    setNewCorreoNombre("");
    setCsfFile(null);
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
              
              {editingClient ? (
                <Tabs defaultValue="datos" className="w-full">
                  <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <TabsTrigger value="datos">Datos del Cliente</TabsTrigger>
                    <TabsTrigger value="productos" className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Productos
                    </TabsTrigger>
                    {isAdmin && (
                      <TabsTrigger value="usuario" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Acceso Portal
                        {editingClient.user_id && (
                          <Badge variant="default" className="ml-1 h-5 bg-green-500">✓</Badge>
                        )}
                      </TabsTrigger>
                    )}
                  </TabsList>
                  <TabsContent value="productos" className="mt-4">
                    <ClienteProductosTab clienteId={editingClient.id} />
                  </TabsContent>
                  {isAdmin && (
                    <TabsContent value="usuario" className="mt-4">
                      <ClienteUsuarioTab 
                        cliente={{
                          id: editingClient.id,
                          nombre: editingClient.nombre,
                          email: editingClient.email,
                          user_id: editingClient.user_id,
                        }}
                        onUserCreated={() => {
                          loadClientes();
                          supabase
                            .from("clientes")
                            .select("*")
                            .eq("id", editingClient.id)
                            .single()
                            .then(({ data }) => {
                              if (data) setEditingClient(data);
                            });
                        }}
                      />
                    </TabsContent>
                  )}
                  <TabsContent value="datos" className="mt-4">
                    <ClienteFormContent 
                      formData={formData}
                      setFormData={setFormData}
                      zonas={zonas}
                      handleSave={handleSave}
                      editingClient={editingClient}
                      setDialogOpen={setDialogOpen}
                      csfFile={csfFile}
                      setCsfFile={setCsfFile}
                      parsingCsf={parsingCsf}
                      handleParseCsf={handleParseCsf}
                      entregarMismaDireccion={entregarMismaDireccion}
                      setEntregarMismaDireccion={setEntregarMismaDireccion}
                      sucursales={sucursales}
                      setSucursales={setSucursales}
                      addSucursal={addSucursal}
                      removeSucursal={removeSucursal}
                      updateSucursal={updateSucursal}
                      correos={correos}
                      setCorreos={setCorreos}
                      newCorreoEmail={newCorreoEmail}
                      setNewCorreoEmail={setNewCorreoEmail}
                      newCorreoNombre={newCorreoNombre}
                      setNewCorreoNombre={setNewCorreoNombre}
                      handleAddCorreo={handleAddCorreo}
                      handleRemoveCorreo={handleRemoveCorreo}
                      handleSetPrincipal={handleSetPrincipal}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <ClienteFormContent 
                  formData={formData}
                  setFormData={setFormData}
                  zonas={zonas}
                  handleSave={handleSave}
                  editingClient={editingClient}
                  setDialogOpen={setDialogOpen}
                  csfFile={csfFile}
                  setCsfFile={setCsfFile}
                  parsingCsf={parsingCsf}
                  handleParseCsf={handleParseCsf}
                  entregarMismaDireccion={entregarMismaDireccion}
                  setEntregarMismaDireccion={setEntregarMismaDireccion}
                  sucursales={sucursales}
                  setSucursales={setSucursales}
                  addSucursal={addSucursal}
                  removeSucursal={removeSucursal}
                  updateSucursal={updateSucursal}
                  correos={correos}
                  setCorreos={setCorreos}
                  newCorreoEmail={newCorreoEmail}
                  setNewCorreoEmail={setNewCorreoEmail}
                  newCorreoNombre={newCorreoNombre}
                  setNewCorreoNombre={setNewCorreoNombre}
                  handleAddCorreo={handleAddCorreo}
                  handleRemoveCorreo={handleRemoveCorreo}
                  handleSetPrincipal={handleSetPrincipal}
                />
              )}
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
                            setSelectedClienteForHistorial({ id: cliente.id, nombre: cliente.nombre });
                            setHistorialDialogOpen(true);
                          }}
                          title="Ver historial de precios"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedClienteForSucursales({ id: cliente.id, nombre: cliente.nombre });
                            setSucursalesDialogOpen(true);
                          }}
                          title={`Ver sucursales (${cliente.cliente_sucursales?.[0]?.count || 0})`}
                          className="relative"
                        >
                          <MapPin className="h-4 w-4" />
                          {cliente.cliente_sucursales?.[0]?.count > 0 && (
                            <Badge 
                              variant="secondary" 
                              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 text-xs"
                            >
                              {cliente.cliente_sucursales[0].count}
                            </Badge>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedClienteForProductos({ id: cliente.id, nombre: cliente.nombre });
                            setProductosDialogOpen(true);
                          }}
                          title={`Productos frecuentes (${cliente.cliente_productos_frecuentes?.[0]?.count || 0})`}
                          className="relative"
                        >
                          <Package className="h-4 w-4" />
                          {cliente.cliente_productos_frecuentes?.[0]?.count > 0 && (
                            <Badge 
                              variant="secondary" 
                              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 text-xs"
                            >
                              {cliente.cliente_productos_frecuentes[0].count}
                            </Badge>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(cliente)}
                          title="Editar cliente"
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

      <HistorialDialog open={historialDialogOpen} onOpenChange={setHistorialDialogOpen}>
        <HistorialDialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <HistorialDialogHeader>
            <HistorialDialogTitle>
              Historial de {selectedClienteForHistorial?.nombre}
            </HistorialDialogTitle>
          </HistorialDialogHeader>
          {selectedClienteForHistorial && (
            <ClienteHistorialAnalytics
              clienteId={selectedClienteForHistorial.id}
              clienteNombre={selectedClienteForHistorial.nombre}
            />
          )}
        </HistorialDialogContent>
      </HistorialDialog>

      <ClienteProductosDialog
        open={productosDialogOpen}
        onOpenChange={setProductosDialogOpen}
        cliente={selectedClienteForProductos}
      />
    </Layout>
  );
};

export default Clientes;
