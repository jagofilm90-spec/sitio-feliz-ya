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
    | "otro";
  nombre_archivo: string;
  ruta_storage: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
}

const Empleados = () => {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [documentos, setDocumentos] = useState<Record<string, EmpleadoDocumento[]>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDocDialogOpen, setIsDocDialogOpen] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null);
  const [selectedEmpleado, setSelectedEmpleado] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filtroActivo, setFiltroActivo] = useState<"todos" | "activos" | "inactivos">("activos");
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
  });

  const [docFormData, setDocFormData] = useState({
    tipo_documento: "contrato_laboral" as EmpleadoDocumento["tipo_documento"],
    file: null as File | null,
  });

  useEffect(() => {
    loadEmpleados();
    loadUsuarios();
  }, []);

  const loadEmpleados = async () => {
    try {
      const { data, error } = await supabase
        .from("empleados")
        .select("*")
        .order("nombre_completo");

      if (error) throw error;
      setEmpleados(data || []);

      // Load documents for each employee
      if (data) {
        const docsPromises = data.map(emp =>
          supabase
            .from("empleados_documentos")
            .select("*")
            .eq("empleado_id", emp.id)
        );
        const docsResults = await Promise.all(docsPromises);
        const docsMap: Record<string, EmpleadoDocumento[]> = {};
        data.forEach((emp, idx) => {
          docsMap[emp.id] = (docsResults[idx].data || []) as EmpleadoDocumento[];
        });
        setDocumentos(docsMap);
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
        .select("id, email, full_name")
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        user_id: formData.user_id || null,
      };

      if (editingEmpleado) {
        const { error } = await supabase
          .from("empleados")
          .update(payload)
          .eq("id", editingEmpleado.id);

        if (error) throw error;

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
    });
    setIsDialogOpen(true);
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFormData.file || !selectedEmpleado) return;

    setUploading(true);
    try {
      const fileExt = docFormData.file.name.split(".").pop();
      const fileName = `${selectedEmpleado}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("empleados-documentos")
        .upload(fileName, docFormData.file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("empleados_documentos").insert([
        {
          empleado_id: selectedEmpleado,
          tipo_documento: docFormData.tipo_documento,
          nombre_archivo: docFormData.file.name,
          ruta_storage: fileName,
        },
      ]);

      if (dbError) throw dbError;

      toast({
        title: "Documento subido",
        description: "El documento se subió correctamente",
      });

      setIsDocDialogOpen(false);
      setDocFormData({ tipo_documento: "contrato_laboral", file: null });
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
    });
    setEditingEmpleado(null);
  };

  const filteredEmpleados = empleados.filter((emp) => {
    const matchesSearch =
      emp.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.puesto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter =
      filtroActivo === "todos" ||
      (filtroActivo === "activos" && emp.activo) ||
      (filtroActivo === "inactivos" && !emp.activo);

    return matchesSearch && matchesFilter;
  });

  const getUsuarioNombre = (userId: string | null) => {
    if (!userId) return "-";
    const usuario = usuarios.find((u) => u.id === userId);
    return usuario ? usuario.full_name : "-";
  };

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
      otro: "Otro",
    };
    return labels[tipo];
  };

  return (
    <Layout>
      <div className="space-y-6">
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
                    <Input
                      id="puesto"
                      value={formData.puesto}
                      onChange={(e) =>
                        setFormData({ ...formData, puesto: e.target.value })
                      }
                      placeholder="ej: Almacenista, Chofer, Ayudante"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="user_id">Usuario del Sistema (opcional)</Label>
                  <Select
                    value={formData.user_id || undefined}
                    onValueChange={(value) =>
                      setFormData({ ...formData, user_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin usuario asignado" />
                    </SelectTrigger>
                    <SelectContent>
                      {usuarios.map((usuario) => (
                        <SelectItem key={usuario.id} value={usuario.id}>
                          {usuario.full_name} ({usuario.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vincula este empleado con un usuario que tenga acceso al sistema
                  </p>
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

          <Tabs defaultValue="activos" className="space-y-4" onValueChange={(v) => setFiltroActivo(v as any)}>
            <TabsList>
              <TabsTrigger value="activos">
                Activos ({empleados.filter(e => e.activo).length})
              </TabsTrigger>
              <TabsTrigger value="inactivos">
                Inactivos ({empleados.filter(e => !e.activo).length})
              </TabsTrigger>
              <TabsTrigger value="todos">
                Todos ({empleados.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filtroActivo} className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Puesto</TableHead>
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
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No se encontraron empleados
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmpleados.map((empleado) => (
                        <TableRow key={empleado.id}>
                          <TableCell className="font-medium">
                            {empleado.nombre_completo}
                          </TableCell>
                          <TableCell>{empleado.puesto}</TableCell>
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
                          </TableCell>
                          <TableCell>
                            <Badge variant={empleado.activo ? "default" : "secondary"}>
                              {empleado.activo ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(empleado)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
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
                Gestiona identificaciones, contratos y otros documentos
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Upload form */}
              <form onSubmit={handleUploadDocument} className="space-y-4 border-b pb-4">
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
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="file">Archivo PDF</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".pdf"
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
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-xs">
                                  {getTipoDocumentoLabel(doc.tipo_documento)}
                                </Badge>
                                <span>
                                  {new Date(doc.created_at).toLocaleDateString()}
                                </span>
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
      </div>
    </Layout>
  );
};

export default Empleados;
