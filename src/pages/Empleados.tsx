import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus,
  Search,
  Edit,
  FileText,
  Upload,
  Download,
  Trash2,
  Users,
  Bell,
  AlertTriangle,
} from "lucide-react";

interface Empleado {
  id: string;
  user_id: string | null;
  nombre_completo: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  fecha_ingreso: string;
  puesto: string;
  activo: boolean;
  notas: string | null;
  numero_seguro_social: string | null;
  sueldo_bruto: number | null;
  periodo_pago: "semanal" | "quincenal" | null;
  fecha_baja: string | null;
  motivo_baja: "renuncia" | "despido" | "abandono" | null;
  created_at: string;
  updated_at: string;
}

interface EmpleadoDocumento {
  id: string;
  empleado_id: string;
  tipo_documento: 
    | "contrato_laboral"
    | "ine"
    | "carta_seguro_social"
    | "constancia_situacion_fiscal"
    | "acta_nacimiento"
    | "comprobante_domicilio"
    | "curp"
    | "rfc"
    | "carta_renuncia"
    | "carta_despido"
    | "comprobante_finiquito"
    | "licencia_conducir"
    | "otro";
  nombre_archivo: string;
  ruta_storage: string;
  fecha_vencimiento: string | null;
  created_at: string;
}

interface EmpleadoDocumentoPendiente {
  id: string;
  empleado_id: string;
  tipo_documento: EmpleadoDocumento["tipo_documento"];
  notas: string | null;
  created_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
}

interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  empleado_id: string | null;
  documento_id: string | null;
  fecha_vencimiento: string | null;
  leida: boolean;
  created_at: string;
}

const Empleados = () => {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [documentos, setDocumentos] = useState<Record<string, EmpleadoDocumento[]>>({});
  const [documentosPendientes, setDocumentosPendientes] = useState<Record<string, EmpleadoDocumentoPendiente[]>>({});
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDocDialogOpen, setIsDocDialogOpen] = useState(false);
  const [isPendingDialogOpen, setIsPendingDialogOpen] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null);
  const [selectedEmpleado, setSelectedEmpleado] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filtroPuesto, setFiltroPuesto] = useState<"todos" | "secretaria" | "vendedor" | "chofer" | "almacenista">("todos");
  const [filtroActivo, setFiltroActivo] = useState<"todos" | "activos" | "inactivos">("todos");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nombre_completo: "",
    telefono: "",
    email: "",
    direccion: "",
    fecha_ingreso: new Date().toISOString().split("T")[0],
    puesto: "",
    user_id: "",
    activo: true,
    notas: "",
    numero_seguro_social: "",
    sueldo_bruto: "",
    periodo_pago: "",
    fecha_baja: "",
    motivo_baja: "",
  });

  const [docFormData, setDocFormData] = useState<{
    tipo_documento: EmpleadoDocumento["tipo_documento"] | "";
    file: File | null;
  }>({
    tipo_documento: "",
    file: null,
  });

  const [pendingDocFormData, setPendingDocFormData] = useState({
    tipo_documento: "contrato_laboral" as EmpleadoDocumento["tipo_documento"],
    notas: "",
  });

  const [terminationFiles, setTerminationFiles] = useState<{
    carta: File | null;
    finiquito: File | null;
  }>({
    carta: null,
    finiquito: null,
  });

  useEffect(() => {
    loadEmpleados();
    loadUsuarios();
    loadNotificaciones();
  }, []);

  // Resetear el formulario de documento cuando se abre el diálogo
  useEffect(() => {
    if (isDocDialogOpen) {
      setDocFormData({ tipo_documento: "", file: null });
    }
  }, [isDocDialogOpen]);

  const loadEmpleados = async () => {
    try {
      const { data, error } = await supabase
        .from("empleados")
        .select("*")
        .order("nombre_completo");

      if (error) throw error;
      setEmpleados((data || []) as Empleado[]);

      // Load documents for each employee
      if (data) {
        const docsPromises = data.map(emp =>
          supabase
            .from("empleados_documentos")
            .select("*")
            .eq("empleado_id", emp.id)
        );
        const pendingDocsPromises = data.map(emp =>
          supabase
            .from("empleados_documentos_pendientes")
            .select("*")
            .eq("empleado_id", emp.id)
        );
        
        const docsResults = await Promise.all(docsPromises);
        const pendingDocsResults = await Promise.all(pendingDocsPromises);
        
        const docsMap: Record<string, EmpleadoDocumento[]> = {};
        const pendingDocsMap: Record<string, EmpleadoDocumentoPendiente[]> = {};
        
        data.forEach((emp, idx) => {
          docsMap[emp.id] = (docsResults[idx].data || []) as EmpleadoDocumento[];
          pendingDocsMap[emp.id] = (pendingDocsResults[idx].data || []) as EmpleadoDocumentoPendiente[];
        });
        
        setDocumentos(docsMap);
        setDocumentosPendientes(pendingDocsMap);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone")
        .order("full_name");

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadNotificaciones = async () => {
    try {
      const { data, error } = await supabase
        .from("notificaciones")
        .select("*")
        .eq("leida", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotificaciones(data || []);
    } catch (error: any) {
      console.error("Error loading notifications:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validar si ya existe un empleado con el mismo nombre completo
      const { data: existingEmpleados, error: checkError } = await supabase
        .from("empleados")
        .select("id, nombre_completo")
        .ilike("nombre_completo", formData.nombre_completo.trim());

      if (checkError) throw checkError;

      // Si existe y no es el mismo que estamos editando, mostrar error
      const duplicado = existingEmpleados?.find(
        emp => !editingEmpleado || emp.id !== editingEmpleado.id
      );

      if (duplicado) {
        toast({
          title: "Empleado duplicado",
          description: `Ya existe un empleado registrado con el nombre "${formData.nombre_completo}".`,
          variant: "destructive",
        });
        return;
      }

      const payload = {
        ...formData,
        user_id: formData.user_id || null,
        sueldo_bruto: formData.sueldo_bruto ? parseFloat(formData.sueldo_bruto) : null,
        periodo_pago: formData.periodo_pago || null,
        fecha_baja: formData.fecha_baja || null,
        motivo_baja: formData.motivo_baja || null,
      };

      let empleadoId: string;

      if (editingEmpleado) {
        const { error } = await supabase
          .from("empleados")
          .update(payload)
          .eq("id", editingEmpleado.id);

        if (error) throw error;
        empleadoId = editingEmpleado.id;

        // Subir archivos de terminación si están presentes
        if (!formData.activo && formData.motivo_baja) {
          if (formData.motivo_baja === "renuncia" && terminationFiles.carta) {
            await uploadTerminationDocument(empleadoId, "carta_renuncia", terminationFiles.carta);
          }
          if (formData.motivo_baja === "despido" && terminationFiles.carta) {
            await uploadTerminationDocument(empleadoId, "carta_despido", terminationFiles.carta);
          }
          if (terminationFiles.finiquito) {
            await uploadTerminationDocument(empleadoId, "comprobante_finiquito", terminationFiles.finiquito);
          }
        }

        toast({
          title: "Empleado actualizado",
          description: "El empleado se actualizó correctamente",
        });
      } else {
        const { error } = await supabase.from("empleados").insert([payload]);

        if (error) throw error;

        toast({
          title: "Empleado creado",
          description: "El empleado se creó correctamente",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadEmpleados();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const uploadTerminationDocument = async (
    empleadoId: string,
    tipoDocumento: "carta_renuncia" | "carta_despido" | "comprobante_finiquito",
    file: File
  ) => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${empleadoId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("empleados-documentos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("empleados_documentos").insert([
        {
          empleado_id: empleadoId,
          tipo_documento: tipoDocumento,
          nombre_archivo: file.name,
          ruta_storage: fileName,
        },
      ]);

      if (dbError) throw dbError;
    } catch (error: any) {
      console.error("Error uploading termination document:", error);
      toast({
        title: "Error al subir documento",
        description: `No se pudo subir ${file.name}`,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (empleado: Empleado) => {
    setEditingEmpleado(empleado);
    setFormData({
      nombre_completo: empleado.nombre_completo,
      telefono: empleado.telefono || "",
      email: empleado.email || "",
      direccion: empleado.direccion || "",
      fecha_ingreso: empleado.fecha_ingreso,
      puesto: empleado.puesto,
      user_id: empleado.user_id || "",
      activo: empleado.activo,
      notas: empleado.notas || "",
      numero_seguro_social: empleado.numero_seguro_social || "",
      sueldo_bruto: empleado.sueldo_bruto ? empleado.sueldo_bruto.toString() : "",
      periodo_pago: empleado.periodo_pago || "",
      fecha_baja: empleado.fecha_baja || "",
      motivo_baja: empleado.motivo_baja || "",
    });
    
    // Reset termination files when opening edit
    setTerminationFiles({ carta: null, finiquito: null });
    
    setIsDialogOpen(true);
  };

  const handleDelete = async (empleado: Empleado) => {
    if (!confirm(`¿Estás seguro de eliminar a ${empleado.nombre_completo}? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      // Primero eliminar todos los documentos del empleado del storage
      if (documentos[empleado.id]?.length > 0) {
        const filePaths = documentos[empleado.id].map(
          (doc) => `${empleado.id}/${doc.ruta_storage}`
        );
        await supabase.storage.from("empleados-documentos").remove(filePaths);
      }

      // Eliminar registros de documentos de la base de datos
      await supabase
        .from("empleados_documentos")
        .delete()
        .eq("empleado_id", empleado.id);

      // Eliminar documentos pendientes
      await supabase
        .from("empleados_documentos_pendientes")
        .delete()
        .eq("empleado_id", empleado.id);

      // Finalmente eliminar el empleado
      const { error } = await supabase
        .from("empleados")
        .delete()
        .eq("id", empleado.id);

      if (error) throw error;

      toast({
        title: "Empleado eliminado",
        description: "El empleado y sus documentos se eliminaron correctamente",
      });

      loadEmpleados();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFormData.file || !selectedEmpleado || !docFormData.tipo_documento) return;

    setUploading(true);
    try {
      const fileExt = docFormData.file.name.split(".").pop();
      const fileName = `${selectedEmpleado}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("empleados-documentos")
        .upload(fileName, docFormData.file);

      if (uploadError) throw uploadError;

      const { data: insertData, error: dbError } = await supabase.from("empleados_documentos").insert([
        {
          empleado_id: selectedEmpleado,
          tipo_documento: docFormData.tipo_documento,
          nombre_archivo: docFormData.file.name,
          ruta_storage: fileName,
        },
      ]).select();

      if (dbError) throw dbError;

      // Si es licencia de conducir, llamar al edge function para extraer fecha
      if (docFormData.tipo_documento === "licencia_conducir" && insertData?.[0]) {
        toast({
          title: "Procesando licencia",
          description: "Extrayendo fecha de vencimiento automáticamente...",
        });

        const { data: aiData, error: aiError } = await supabase.functions.invoke(
          "extract-license-expiry",
          {
            body: {
              documentoId: insertData[0].id,
              filePath: fileName,
            },
          }
        );

        if (aiError) {
          console.error("Error extracting expiry date:", aiError);
          toast({
            title: "Advertencia",
            description: "No se pudo extraer automáticamente la fecha de vencimiento. Puedes agregarla manualmente después.",
            variant: "destructive",
          });
        } else if (aiData?.fecha_vencimiento) {
          toast({
            title: "Fecha extraída",
            description: `Fecha de vencimiento detectada: ${aiData.fecha_vencimiento}`,
          });
        } else {
          toast({
            title: "No se detectó fecha",
            description: "No se pudo detectar la fecha de vencimiento automáticamente.",
          });
        }
      }

      // Eliminar de pendientes si existe
      await supabase
        .from("empleados_documentos_pendientes")
        .delete()
        .eq("empleado_id", selectedEmpleado)
        .eq("tipo_documento", docFormData.tipo_documento);

      toast({
        title: "Documento subido",
        description: "El documento se subió correctamente",
      });

      setIsDocDialogOpen(false);
      setDocFormData({ tipo_documento: "", file: null });
      loadEmpleados();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadDocument = async (doc: EmpleadoDocumento) => {
    try {
      const { data, error } = await supabase.storage
        .from("empleados-documentos")
        .download(doc.ruta_storage);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.nombre_archivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteDocument = async (doc: EmpleadoDocumento) => {
    if (!confirm("¿Estás seguro de eliminar este documento?")) return;

    try {
      const { error: storageError } = await supabase.storage
        .from("empleados-documentos")
        .remove([doc.ruta_storage]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("empleados_documentos")
        .delete()
        .eq("id", doc.id);

      if (dbError) throw dbError;

      toast({
        title: "Documento eliminado",
        description: "El documento se eliminó correctamente",
      });

      loadEmpleados();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddPendingDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpleado) return;

    try {
      const { error } = await supabase.from("empleados_documentos_pendientes").insert([
        {
          empleado_id: selectedEmpleado,
          tipo_documento: pendingDocFormData.tipo_documento,
          notas: pendingDocFormData.notas || null,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Documento marcado como pendiente",
        description: "Se agregó a la lista de documentos faltantes",
      });

      setIsPendingDialogOpen(false);
      setPendingDocFormData({ tipo_documento: "contrato_laboral", notas: "" });
      loadEmpleados();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeletePendingDocument = async (pendingDoc: EmpleadoDocumentoPendiente) => {
    if (!confirm("¿Eliminar de la lista de pendientes?")) return;

    try {
      const { error } = await supabase
        .from("empleados_documentos_pendientes")
        .delete()
        .eq("id", pendingDoc.id);

      if (error) throw error;

      toast({
        title: "Documento eliminado de pendientes",
        description: "Ya no aparecerá como faltante",
      });

      loadEmpleados();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nombre_completo: "",
      telefono: "",
      email: "",
      direccion: "",
      fecha_ingreso: new Date().toISOString().split("T")[0],
      puesto: "",
      user_id: "",
      activo: true,
      notas: "",
      numero_seguro_social: "",
      sueldo_bruto: "",
      periodo_pago: "",
      fecha_baja: "",
      motivo_baja: "",
    });
    setTerminationFiles({ carta: null, finiquito: null });
    setEditingEmpleado(null);
  };

  const handleTerminationFileChange = (
    type: "carta" | "finiquito",
    file: File | null
  ) => {
    setTerminationFiles({ ...terminationFiles, [type]: file });
  };

  const filteredEmpleados = empleados.filter((emp) => {
    const matchesSearch =
      emp.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.puesto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesActivo =
      filtroActivo === "todos" ||
      (filtroActivo === "activos" && emp.activo) ||
      (filtroActivo === "inactivos" && !emp.activo);

    const matchesPuesto = 
      filtroPuesto === "todos" ||
      emp.puesto.toLowerCase() === filtroPuesto;

    return matchesSearch && matchesActivo && matchesPuesto;
  });

  const getEmpleadosPorPuesto = (puesto: string) => {
    return empleados.filter(emp => emp.puesto.toLowerCase() === puesto.toLowerCase());
  };

  const getUsuarioNombre = (userId: string | null) => {
    if (!userId) return "-";
    const usuario = usuarios.find((u) => u.id === userId);
    return usuario ? usuario.full_name : "-";
  };

  // Filtrar usuarios que ya están asignados a empleados (excepto el actual si estamos editando)
  const usuariosDisponibles = usuarios.filter((usuario) => {
    const empleadoConUsuario = empleados.find((emp) => emp.user_id === usuario.id);
    
    // Si no hay empleado con este usuario, está disponible
    if (!empleadoConUsuario) return true;
    
    // Si estamos editando y es el usuario del empleado actual, también está disponible
    if (editingEmpleado && empleadoConUsuario.id === editingEmpleado.id) return true;
    
    // En cualquier otro caso, no está disponible
    return false;
  });

  const getTipoDocumentoLabel = (tipo: EmpleadoDocumento["tipo_documento"]) => {
    const labels: Record<EmpleadoDocumento["tipo_documento"], string> = {
      contrato_laboral: "Contrato Laboral",
      ine: "INE",
      carta_seguro_social: "Carta Seguro Social",
      constancia_situacion_fiscal: "Constancia Situación Fiscal",
      acta_nacimiento: "Acta de Nacimiento",
      comprobante_domicilio: "Comprobante de Domicilio",
      curp: "CURP",
      rfc: "RFC",
      carta_renuncia: "Carta de Renuncia",
      carta_despido: "Carta de Despido",
      comprobante_finiquito: "Comprobante de Finiquito",
      licencia_conducir: "Licencia de Conducir",
      otro: "Otro",
    };
    return labels[tipo];
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Widget de notificaciones */}
        {notificaciones.length > 0 && (
          <Card className="p-4 border-destructive/50 bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-2">
                  {notificaciones.length} Notificación{notificaciones.length > 1 ? "es" : ""} Pendiente{notificaciones.length > 1 ? "s" : ""}
                </h3>
                <div className="space-y-2">
                  {notificaciones.slice(0, 3).map((notif) => (
                    <div key={notif.id} className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{notif.titulo}</p>
                        <p className="text-xs text-muted-foreground">{notif.descripcion}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await supabase
                            .from("notificaciones")
                            .update({ leida: true })
                            .eq("id", notif.id);
                          loadNotificaciones();
                        }}
                      >
                        Marcar leída
                      </Button>
                    </div>
                  ))}
                  {notificaciones.length > 3 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Y {notificaciones.length - 3} notificación{notificaciones.length - 3 > 1 ? "es" : ""} más...
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Empleados</h1>
            <p className="text-muted-foreground">
              Gestión completa de empleados con documentos
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <UserPlus className="h-4 w-4 mr-2" />
                Nuevo Empleado
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEmpleado ? "Editar Empleado" : "Nuevo Empleado"}
                </DialogTitle>
                <DialogDescription>
                  Registra todos los datos del empleado y vincúlalo con un usuario del
                  sistema si tiene acceso
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="user_id">Usuario del Sistema (opcional)</Label>
                  <Select
                    value={formData.user_id || undefined}
                    onValueChange={(value) => {
                      const usuario = usuarios.find((u) => u.id === value);
                      if (usuario) {
                        setFormData({
                          ...formData,
                          user_id: value,
                          nombre_completo: usuario.full_name,
                          email: usuario.email,
                          telefono: usuario.phone || formData.telefono,
                        });
                      } else {
                        setFormData({ ...formData, user_id: value });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar usuario existente" />
                    </SelectTrigger>
                    <SelectContent>
                      {usuariosDisponibles.length === 0 ? (
                        <SelectItem value="no-users" disabled>
                          No hay usuarios disponibles
                        </SelectItem>
                      ) : (
                        usuariosDisponibles.map((usuario) => (
                          <SelectItem key={usuario.id} value={usuario.id}>
                            {usuario.full_name} ({usuario.email})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Si seleccionas un usuario, se autorellenarán nombre y correo
                  </p>
                </div>

                <div>
                  <Label htmlFor="nombre_completo">Nombre Completo *</Label>
                  <Input
                    id="nombre_completo"
                    value={formData.nombre_completo}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre_completo: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) =>
                        setFormData({ ...formData, telefono: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) =>
                      setFormData({ ...formData, direccion: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fecha_ingreso">Fecha de Ingreso *</Label>
                    <Input
                      id="fecha_ingreso"
                      type="date"
                      value={formData.fecha_ingreso}
                      onChange={(e) =>
                        setFormData({ ...formData, fecha_ingreso: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="puesto">Puesto *</Label>
                    <Select
                      value={formData.puesto}
                      onValueChange={(value) =>
                        setFormData({ ...formData, puesto: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar puesto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Secretaria">Secretaria</SelectItem>
                        <SelectItem value="Almacenista">Almacenista</SelectItem>
                        <SelectItem value="Chofer">Chofer</SelectItem>
                        <SelectItem value="Ayudante de Chofer">Ayudante de Chofer</SelectItem>
                        <SelectItem value="Vendedor">Vendedor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>


                <div>
                  <Label htmlFor="notas">Notas</Label>
                  <Textarea
                    id="notas"
                    value={formData.notas}
                    onChange={(e) =>
                      setFormData({ ...formData, notas: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3">Información de Nómina</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="numero_seguro_social">Número de Seguro Social</Label>
                      <Input
                        id="numero_seguro_social"
                        value={formData.numero_seguro_social}
                        onChange={(e) =>
                          setFormData({ ...formData, numero_seguro_social: e.target.value })
                        }
                        placeholder="ej: 12345678901"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sueldo_bruto">Sueldo Bruto</Label>
                        <Input
                          id="sueldo_bruto"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.sueldo_bruto}
                          onChange={(e) =>
                            setFormData({ ...formData, sueldo_bruto: e.target.value })
                          }
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="periodo_pago">Periodo de Pago</Label>
                        <Select
                          value={formData.periodo_pago || undefined}
                          onValueChange={(value) =>
                            setFormData({ ...formData, periodo_pago: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar periodo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="semanal">Semanal</SelectItem>
                            <SelectItem value="quincenal">Quincenal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formData.activo}
                    onChange={(e) =>
                      setFormData({ ...formData, activo: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="activo">Empleado activo</Label>
                </div>

                {!formData.activo && editingEmpleado && (
                  <div className="border-t pt-4 bg-muted/30 p-4 rounded-lg">
                    <h3 className="font-medium mb-3 text-destructive">
                      Información de Baja
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="fecha_baja">Fecha de Baja</Label>
                          <Input
                            id="fecha_baja"
                            type="date"
                            value={formData.fecha_baja}
                            onChange={(e) =>
                              setFormData({ ...formData, fecha_baja: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="motivo_baja">Motivo de Baja</Label>
                          <Select
                            value={formData.motivo_baja || undefined}
                            onValueChange={(value) =>
                              setFormData({ ...formData, motivo_baja: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar motivo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="renuncia">Renuncia</SelectItem>
                              <SelectItem value="despido">Despido</SelectItem>
                              <SelectItem value="abandono">Abandono (No regresó)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Documentos de terminación según el motivo */}
                      {formData.motivo_baja && (formData.motivo_baja === "renuncia" || formData.motivo_baja === "despido") && (
                        <div className="border-t pt-4 space-y-4">
                          <p className="text-sm font-medium">Documentos de terminación:</p>
                          
                          {/* Carta de Renuncia/Despido */}
                          <div className="space-y-2">
                            <Label htmlFor="carta_file">
                              {formData.motivo_baja === "renuncia" ? "Carta de Renuncia (PDF)" : "Carta de Despido (PDF)"}
                            </Label>
                            
                            {/* Mostrar documento existente si ya fue subido */}
                            {editingEmpleado && documentos[editingEmpleado.id] && (() => {
                              const tipoDoc = formData.motivo_baja === "renuncia" ? "carta_renuncia" : "carta_despido";
                              const docExistente = documentos[editingEmpleado.id].find(d => d.tipo_documento === tipoDoc);
                              
                              if (docExistente) {
                                return (
                                  <div className="p-3 border rounded-lg bg-muted/30 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <p className="text-sm font-medium">{docExistente.nombre_archivo}</p>
                                        <p className="text-xs text-muted-foreground">
                                          Subido: {new Date(docExistente.created_at).toLocaleDateString('es-MX')}
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDownloadDocument(docExistente)}
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      Descargar
                                    </Button>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            
                            {/* Input para subir nuevo documento */}
                            <Input
                              id="carta_file"
                              type="file"
                              accept=".pdf"
                              onChange={(e) =>
                                handleTerminationFileChange("carta", e.target.files?.[0] || null)
                              }
                            />
                            {terminationFiles.carta && (
                              <p className="text-xs text-muted-foreground">
                                Archivo seleccionado: {terminationFiles.carta.name}
                              </p>
                            )}
                          </div>
                          
                          {/* Comprobante de Finiquito */}
                          <div className="space-y-2">
                            <Label htmlFor="finiquito_file">Comprobante de Finiquito (PDF)</Label>
                            
                            {/* Mostrar documento existente si ya fue subido */}
                            {editingEmpleado && documentos[editingEmpleado.id] && (() => {
                              const docExistente = documentos[editingEmpleado.id].find(d => d.tipo_documento === "comprobante_finiquito");
                              
                              if (docExistente) {
                                return (
                                  <div className="p-3 border rounded-lg bg-muted/30 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <p className="text-sm font-medium">{docExistente.nombre_archivo}</p>
                                        <p className="text-xs text-muted-foreground">
                                          Subido: {new Date(docExistente.created_at).toLocaleDateString('es-MX')}
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDownloadDocument(docExistente)}
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      Descargar
                                    </Button>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            
                            {/* Input para subir nuevo documento */}
                            <Input
                              id="finiquito_file"
                              type="file"
                              accept=".pdf"
                              onChange={(e) =>
                                handleTerminationFileChange("finiquito", e.target.files?.[0] || null)
                              }
                            />
                            {terminationFiles.finiquito && (
                              <p className="text-xs text-muted-foreground">
                                Archivo seleccionado: {terminationFiles.finiquito.name}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {formData.motivo_baja === "abandono" && (
                        <div className="border-t pt-4">
                          <p className="text-sm text-muted-foreground">
                            Para abandono de trabajo, puedes subir una carta usando el tipo de documento "Otro" en la sección de documentos.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingEmpleado ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por nombre, puesto o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <Tabs defaultValue="todos" className="space-y-4" onValueChange={(v) => setFiltroPuesto(v as any)}>
            <TabsList>
              <TabsTrigger value="todos">
                Todos ({empleados.length})
              </TabsTrigger>
              <TabsTrigger value="secretaria">
                Secretaria ({getEmpleadosPorPuesto('Secretaria').length})
              </TabsTrigger>
              <TabsTrigger value="vendedor">
                Vendedor ({getEmpleadosPorPuesto('Vendedor').length})
              </TabsTrigger>
              <TabsTrigger value="chofer">
                Chofer ({getEmpleadosPorPuesto('Chofer').length})
              </TabsTrigger>
              <TabsTrigger value="almacenista">
                Almacenista ({getEmpleadosPorPuesto('Almacenista').length})
              </TabsTrigger>
              <TabsTrigger value="ayudante de chofer">
                Ayudantes ({getEmpleadosPorPuesto('Ayudante de Chofer').length})
              </TabsTrigger>
            </TabsList>

            {/* Tabs para Todos, Secretaria, Almacenista, Ayudante de Chofer (sin columna de licencia) */}
            {['todos', 'secretaria', 'almacenista', 'ayudante de chofer'].map((tab) => (
              <TabsContent key={tab} value={tab} className="space-y-4">
                <div className="flex gap-2">
                  <Select value={filtroActivo} onValueChange={(value: any) => setFiltroActivo(value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="activos">Activos</SelectItem>
                      <SelectItem value="inactivos">Inactivos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        {tab === 'todos' && <TableHead>Puesto</TableHead>}
                        <TableHead>Contacto</TableHead>
                        <TableHead>Fecha Ingreso</TableHead>
                        <TableHead>Usuario Sistema</TableHead>
                        <TableHead>Documentos</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmpleados.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={tab === 'todos' ? 8 : 7} className="text-center text-muted-foreground">
                            No se encontraron empleados
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEmpleados.map((empleado) => (
                          <TableRow key={empleado.id}>
                            <TableCell className="font-medium">
                              {empleado.nombre_completo}
                            </TableCell>
                            {tab === 'todos' && <TableCell><Badge variant="outline">{empleado.puesto}</Badge></TableCell>}
                            <TableCell>
                              <div className="text-sm">
                                {empleado.telefono && <div>{empleado.telefono}</div>}
                                {empleado.email && (
                                  <div className="text-muted-foreground">{empleado.email}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {new Date(empleado.fecha_ingreso).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {getUsuarioNombre(empleado.user_id)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedEmpleado(empleado.id);
                                    setIsDocDialogOpen(true);
                                  }}
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Docs ({documentos[empleado.id]?.length || 0})
                                </Button>
                                {documentosPendientes[empleado.id]?.length > 0 && (
                                  <Badge variant="destructive" className="ml-1">
                                    {documentosPendientes[empleado.id].length} faltantes
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge variant={empleado.activo ? "default" : "secondary"}>
                                  {empleado.activo ? "Activo" : "Inactivo"}
                                </Badge>
                                {!empleado.activo && empleado.motivo_baja && (
                                  <div className="text-xs text-muted-foreground">
                                    {empleado.motivo_baja === "renuncia" && "Renuncia"}
                                    {empleado.motivo_baja === "despido" && "Despido"}
                                    {empleado.motivo_baja === "abandono" && "Abandono"}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(empleado)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(empleado)}
                                  className="text-destructive hover:text-destructive"
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
              </TabsContent>
            ))}

            {/* Tab especial para Vendedor con columna de vencimiento de licencia */}
            <TabsContent value="vendedor" className="space-y-4">
              <div className="flex gap-2">
                <Select value={filtroActivo} onValueChange={(value: any) => setFiltroActivo(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="activos">Activos</SelectItem>
                    <SelectItem value="inactivos">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Vencimiento Licencia</TableHead>
                      <TableHead>Fecha Ingreso</TableHead>
                      <TableHead>Usuario Sistema</TableHead>
                      <TableHead>Documentos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmpleados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No se encontraron vendedores
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmpleados.map((empleado) => {
                        const licenciaDoc = documentos[empleado.id]?.find(
                          doc => doc.tipo_documento === 'licencia_conducir'
                        );
                        const diasRestantes = licenciaDoc?.fecha_vencimiento 
                          ? Math.ceil((new Date(licenciaDoc.fecha_vencimiento).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                          : null;

                        return (
                          <TableRow key={empleado.id}>
                            <TableCell className="font-medium">
                              {empleado.nombre_completo}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {empleado.telefono && <div>{empleado.telefono}</div>}
                                {empleado.email && (
                                  <div className="text-muted-foreground">{empleado.email}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {licenciaDoc?.fecha_vencimiento ? (
                                (() => {
                                  const esPermanente = licenciaDoc.fecha_vencimiento === "2099-12-31";
                                  if (esPermanente) {
                                    return (
                                      <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/20">
                                        PERMANENTE
                                      </Badge>
                                    );
                                  }
                                  return (
                                    <Badge 
                                      variant={
                                        diasRestantes !== null && diasRestantes < 0 
                                          ? "destructive" 
                                          : diasRestantes !== null && diasRestantes <= 30 
                                          ? "destructive" 
                                          : "secondary"
                                      }
                                    >
                                      {new Date(licenciaDoc.fecha_vencimiento).toLocaleDateString('es-MX')}
                                      {diasRestantes !== null && diasRestantes < 0 && " (Vencida)"}
                                      {diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 30 && ` (${diasRestantes}d)`}
                                    </Badge>
                                  );
                                })()
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Sin licencia
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(empleado.fecha_ingreso).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {getUsuarioNombre(empleado.user_id)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedEmpleado(empleado.id);
                                    setIsDocDialogOpen(true);
                                  }}
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Docs ({documentos[empleado.id]?.length || 0})
                                </Button>
                                {documentosPendientes[empleado.id]?.length > 0 && (
                                  <Badge variant="destructive" className="ml-1">
                                    {documentosPendientes[empleado.id].length} faltantes
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge variant={empleado.activo ? "default" : "secondary"}>
                                  {empleado.activo ? "Activo" : "Inactivo"}
                                </Badge>
                                {!empleado.activo && empleado.motivo_baja && (
                                  <div className="text-xs text-muted-foreground">
                                    {empleado.motivo_baja === "renuncia" && "Renuncia"}
                                    {empleado.motivo_baja === "despido" && "Despido"}
                                    {empleado.motivo_baja === "abandono" && "Abandono"}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(empleado)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(empleado)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Tab especial para Chofer con columna de vencimiento de licencia */}
            <TabsContent value="chofer" className="space-y-4">
              <div className="flex gap-2">
                <Select value={filtroActivo} onValueChange={(value: any) => setFiltroActivo(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="activos">Activos</SelectItem>
                    <SelectItem value="inactivos">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Vencimiento Licencia</TableHead>
                      <TableHead>Fecha Ingreso</TableHead>
                      <TableHead>Usuario Sistema</TableHead>
                      <TableHead>Documentos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmpleados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No se encontraron choferes
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmpleados.map((empleado) => {
                        const licenciaDoc = documentos[empleado.id]?.find(
                          doc => doc.tipo_documento === 'licencia_conducir'
                        );
                        const diasRestantes = licenciaDoc?.fecha_vencimiento 
                          ? Math.ceil((new Date(licenciaDoc.fecha_vencimiento).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                          : null;

                        return (
                          <TableRow key={empleado.id}>
                            <TableCell className="font-medium">
                              {empleado.nombre_completo}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {empleado.telefono && <div>{empleado.telefono}</div>}
                                {empleado.email && (
                                  <div className="text-muted-foreground">{empleado.email}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {licenciaDoc?.fecha_vencimiento ? (
                                (() => {
                                  const esPermanente = licenciaDoc.fecha_vencimiento === "2099-12-31";
                                  if (esPermanente) {
                                    return (
                                      <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/20">
                                        PERMANENTE
                                      </Badge>
                                    );
                                  }
                                  return (
                                    <Badge 
                                      variant={
                                        diasRestantes !== null && diasRestantes < 0 
                                          ? "destructive" 
                                          : diasRestantes !== null && diasRestantes <= 30 
                                          ? "destructive" 
                                          : "secondary"
                                      }
                                    >
                                      {new Date(licenciaDoc.fecha_vencimiento).toLocaleDateString('es-MX')}
                                      {diasRestantes !== null && diasRestantes < 0 && " (Vencida)"}
                                      {diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 30 && ` (${diasRestantes}d)`}
                                    </Badge>
                                  );
                                })()
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Sin licencia
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(empleado.fecha_ingreso).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {getUsuarioNombre(empleado.user_id)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedEmpleado(empleado.id);
                                    setIsDocDialogOpen(true);
                                  }}
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Docs ({documentos[empleado.id]?.length || 0})
                                </Button>
                                {documentosPendientes[empleado.id]?.length > 0 && (
                                  <Badge variant="destructive" className="ml-1">
                                    {documentosPendientes[empleado.id].length} faltantes
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge variant={empleado.activo ? "default" : "secondary"}>
                                  {empleado.activo ? "Activo" : "Inactivo"}
                                </Badge>
                                {!empleado.activo && empleado.motivo_baja && (
                                  <div className="text-xs text-muted-foreground">
                                    {empleado.motivo_baja === "renuncia" && "Renuncia"}
                                    {empleado.motivo_baja === "despido" && "Despido"}
                                    {empleado.motivo_baja === "abandono" && "Abandono"}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(empleado)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(empleado)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Dialog para documentos */}
        <Dialog open={isDocDialogOpen} onOpenChange={setIsDocDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Documentos del Empleado</DialogTitle>
              <DialogDescription>
                Gestiona documentos subidos y marca documentos faltantes
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Documentos pendientes */}
              {selectedEmpleado && documentosPendientes[selectedEmpleado]?.length > 0 && (
                <div className="border border-destructive/50 rounded-lg p-4 bg-destructive/5">
                  <h3 className="font-medium mb-3 text-destructive flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documentos Faltantes ({documentosPendientes[selectedEmpleado].length})
                  </h3>
                  <div className="space-y-2">
                    {documentosPendientes[selectedEmpleado].map((pendingDoc) => (
                      <div
                        key={pendingDoc.id}
                        className="flex items-start justify-between p-3 bg-background rounded-lg border"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {getTipoDocumentoLabel(pendingDoc.tipo_documento)}
                          </p>
                          {pendingDoc.notas && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {pendingDoc.notas}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Marcado: {new Date(pendingDoc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePendingDocument(pendingDoc)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agregar documento pendiente */}
              <div className="border-b pb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPendingDialogOpen(true)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Marcar Documento Faltante
                </Button>
              </div>

              {/* Upload form */}
              <form onSubmit={handleUploadDocument} className="space-y-4 border-b pb-4">
                <h3 className="font-medium">Subir Documento</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tipo_documento">Tipo de Documento</Label>
                    <Select
                      value={docFormData.tipo_documento}
                      onValueChange={(value: any) =>
                        setDocFormData({ ...docFormData, tipo_documento: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tipo de documento" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Filtrar tipos de documento según el estado del empleado */}
                        {selectedEmpleado && (() => {
                          const empleado = empleados.find(e => e.id === selectedEmpleado);
                          const tiposSubidos = documentos[selectedEmpleado]?.map(doc => doc.tipo_documento) || [];
                          
                          // Tipos de documento normales (sin terminación)
                          const tiposNormales: Array<{ value: EmpleadoDocumento["tipo_documento"], label: string }> = [
                            { value: "contrato_laboral", label: "Contrato Laboral" },
                            { value: "ine", label: "INE / Identificación" },
                            { value: "licencia_conducir", label: "Licencia de Conducir" },
                            { value: "carta_seguro_social", label: "Carta del Seguro Social" },
                            { value: "constancia_situacion_fiscal", label: "Constancia de Situación Fiscal" },
                            { value: "acta_nacimiento", label: "Acta de Nacimiento" },
                            { value: "comprobante_domicilio", label: "Comprobante de Domicilio" },
                            { value: "curp", label: "CURP" },
                            { value: "rfc", label: "RFC" },
                            { value: "otro", label: "Otro" },
                          ];

                          // Tipos de documento de terminación (solo si el empleado está inactivo)
                          const tiposTerminacion: Array<{ value: EmpleadoDocumento["tipo_documento"], label: string }> = [];
                          if (empleado && !empleado.activo && empleado.motivo_baja) {
                            if (empleado.motivo_baja === "renuncia") {
                              tiposTerminacion.push(
                                { value: "carta_renuncia", label: "Carta de Renuncia" },
                                { value: "comprobante_finiquito", label: "Comprobante de Finiquito" }
                              );
                            } else if (empleado.motivo_baja === "despido") {
                              tiposTerminacion.push(
                                { value: "carta_despido", label: "Carta de Despido" },
                                { value: "comprobante_finiquito", label: "Comprobante de Finiquito" }
                              );
                            }
                            // Para abandono, solo pueden usar "otro" que ya está en tipos normales
                          }

                          const todosTipos = [...tiposNormales, ...tiposTerminacion];
                          const tiposDisponibles = todosTipos.filter(tipo => !tiposSubidos.includes(tipo.value));
                          
                          if (tiposDisponibles.length === 0) {
                            return (
                              <SelectItem value="no-disponibles" disabled>
                                Todos los documentos han sido subidos
                              </SelectItem>
                            );
                          }
                          
                          return tiposDisponibles.map(tipo => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="file">
                      {docFormData.tipo_documento === 'licencia_conducir' ? 'Archivo (PDF o imagen)' : 'Archivo PDF'}
                    </Label>
                    <Input
                      id="file"
                      type="file"
                      accept={docFormData.tipo_documento === 'licencia_conducir' ? '.pdf,.jpg,.jpeg,.png,.webp' : '.pdf'}
                      onChange={(e) =>
                        setDocFormData({
                          ...docFormData,
                          file: e.target.files?.[0] || null,
                        })
                      }
                      required
                    />
                  </div>
                </div>
                <Button type="submit" disabled={uploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Subiendo..." : "Subir Documento"}
                </Button>
              </form>

              {/* Documents list */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documentos guardados
                </h3>
                {selectedEmpleado && documentos[selectedEmpleado]?.length > 0 ? (
                  <div className="space-y-2">
                    {documentos[selectedEmpleado].map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{doc.nombre_archivo}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  {getTipoDocumentoLabel(doc.tipo_documento)}
                                </Badge>
                                <span>
                                  Subido: {new Date(doc.created_at).toLocaleDateString()}
                                </span>
                                {doc.fecha_vencimiento && (
                                  <>
                                    <span className="text-muted-foreground">•</span>
                                    <Badge 
                                      variant={
                                        (() => {
                                          const diasRestantes = Math.ceil((new Date(doc.fecha_vencimiento).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                          if (diasRestantes < 0) return "destructive";
                                          if (diasRestantes <= 30) return "destructive";
                                          return "secondary";
                                        })()
                                      }
                                      className="text-xs"
                                    >
                                      Vence: {new Date(doc.fecha_vencimiento).toLocaleDateString()}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadDocument(doc)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDocument(doc)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay documentos guardados
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog para marcar documento pendiente */}
        <Dialog open={isPendingDialogOpen} onOpenChange={setIsPendingDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Marcar Documento Faltante</DialogTitle>
              <DialogDescription>
                Registra qué documento necesita entregar el empleado
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddPendingDocument} className="space-y-4">
              <div>
                <Label htmlFor="pending_tipo">Tipo de Documento *</Label>
                <Select
                  value={pendingDocFormData.tipo_documento}
                  onValueChange={(value: any) =>
                    setPendingDocFormData({ ...pendingDocFormData, tipo_documento: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contrato_laboral">Contrato Laboral</SelectItem>
                    <SelectItem value="ine">INE / Identificación</SelectItem>
                    <SelectItem value="carta_seguro_social">Carta del Seguro Social</SelectItem>
                    <SelectItem value="constancia_situacion_fiscal">Constancia de Situación Fiscal</SelectItem>
                    <SelectItem value="acta_nacimiento">Acta de Nacimiento</SelectItem>
                    <SelectItem value="comprobante_domicilio">Comprobante de Domicilio</SelectItem>
                    <SelectItem value="curp">CURP</SelectItem>
                    <SelectItem value="rfc">RFC</SelectItem>
                    <SelectItem value="carta_renuncia">Carta de Renuncia</SelectItem>
                    <SelectItem value="carta_despido">Carta de Despido</SelectItem>
                    <SelectItem value="comprobante_finiquito">Comprobante de Finiquito</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="pending_notas">Notas (opcional)</Label>
                <Textarea
                  id="pending_notas"
                  value={pendingDocFormData.notas}
                  onChange={(e) =>
                    setPendingDocFormData({ ...pendingDocFormData, notas: e.target.value })
                  }
                  placeholder="ej: Tráelo mañana"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsPendingDialogOpen(false);
                    setPendingDocFormData({ tipo_documento: "contrato_laboral", notas: "" });
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">Marcar como Faltante</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Empleados;
