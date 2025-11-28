import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Globe, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ProveedorProductosSelector from "./ProveedorProductosSelector";

interface Proveedor {
  id: string;
  nombre: string;
  nombre_contacto: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  pais: string;
  rfc: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
}

const ProveedoresTab = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isProductosDialogOpen, setIsProductosDialogOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [productosProveedor, setProductosProveedor] = useState<Proveedor | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [newProveedor, setNewProveedor] = useState({
    nombre: "",
    nombre_contacto: "",
    email: "",
    telefono: "",
    direccion: "",
    pais: "México",
    rfc: "",
    notas: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: proveedores = [], isLoading } = useQuery({
    queryKey: ["proveedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proveedores")
        .select("*")
        .order("nombre");
      
      if (error) throw error;
      return data as Proveedor[];
    },
  });

  const createProveedor = useMutation({
    mutationFn: async (proveedor: typeof newProveedor) => {
      const { error } = await supabase.from("proveedores").insert([proveedor]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proveedores"] });
      setIsDialogOpen(false);
      setNewProveedor({
        nombre: "",
        nombre_contacto: "",
        email: "",
        telefono: "",
        direccion: "",
        pais: "México",
        rfc: "",
        notas: "",
      });
      toast({
        title: "Proveedor creado",
        description: "El proveedor ha sido registrado exitosamente",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo crear el proveedor",
      });
    },
  });

  const updateProveedor = useMutation({
    mutationFn: async (proveedor: Proveedor) => {
      const { error } = await supabase
        .from("proveedores")
        .update({
          nombre: proveedor.nombre,
          nombre_contacto: proveedor.nombre_contacto,
          email: proveedor.email,
          telefono: proveedor.telefono,
          direccion: proveedor.direccion,
          pais: proveedor.pais,
          rfc: proveedor.rfc,
          notas: proveedor.notas,
          activo: proveedor.activo,
        })
        .eq("id", proveedor.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proveedores"] });
      setIsEditDialogOpen(false);
      setEditingProveedor(null);
      toast({
        title: "Proveedor actualizado",
        description: "Los cambios han sido guardados",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el proveedor",
      });
    },
  });

  const filteredProveedores = proveedores.filter(
    (p) =>
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.pais.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.rfc && p.rfc.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar proveedores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Proveedor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Nuevo Proveedor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre del Proveedor *</Label>
                  <Input
                    id="nombre"
                    placeholder="Distribuidora ABC"
                    value={newProveedor.nombre}
                    onChange={(e) =>
                      setNewProveedor({ ...newProveedor, nombre: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pais">País *</Label>
                  <Input
                    id="pais"
                    placeholder="México"
                    value={newProveedor.pais}
                    onChange={(e) =>
                      setNewProveedor({ ...newProveedor, pais: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre_contacto">Nombre de Contacto</Label>
                  <Input
                    id="nombre_contacto"
                    placeholder="Juan Pérez"
                    value={newProveedor.nombre_contacto}
                    onChange={(e) =>
                      setNewProveedor({
                        ...newProveedor,
                        nombre_contacto: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rfc">RFC</Label>
                  <Input
                    id="rfc"
                    placeholder="ABC123456XYZ"
                    value={newProveedor.rfc}
                    onChange={(e) =>
                      setNewProveedor({ ...newProveedor, rfc: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="contacto@proveedor.com"
                    value={newProveedor.email}
                    onChange={(e) =>
                      setNewProveedor({ ...newProveedor, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    placeholder="555-1234"
                    value={newProveedor.telefono}
                    onChange={(e) =>
                      setNewProveedor({ ...newProveedor, telefono: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  placeholder="Calle, número, colonia, ciudad"
                  value={newProveedor.direccion}
                  onChange={(e) =>
                    setNewProveedor({ ...newProveedor, direccion: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notas">Notas</Label>
                <Textarea
                  id="notas"
                  placeholder="Información adicional sobre el proveedor"
                  value={newProveedor.notas}
                  onChange={(e) =>
                    setNewProveedor({ ...newProveedor, notas: e.target.value })
                  }
                />
              </div>

              <Button
                onClick={() => createProveedor.mutate(newProveedor)}
                disabled={!newProveedor.nombre || createProveedor.isPending}
                className="w-full"
              >
                Guardar Proveedor
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Cargando proveedores...
        </div>
      ) : filteredProveedores.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm
            ? "No se encontraron proveedores con ese criterio"
            : "No hay proveedores registrados"}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProveedores.map((proveedor) => (
                <TableRow key={proveedor.id}>
                  <TableCell className="font-medium">{proveedor.nombre}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      {proveedor.pais}
                    </div>
                  </TableCell>
                  <TableCell>{proveedor.nombre_contacto || "-"}</TableCell>
                  <TableCell>{proveedor.telefono || "-"}</TableCell>
                  <TableCell>{proveedor.email || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={proveedor.activo ? "default" : "secondary"}>
                      {proveedor.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setProductosProveedor(proveedor);
                          setIsProductosDialogOpen(true);
                        }}
                        title="Gestionar productos"
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingProveedor(proveedor);
                          setIsEditDialogOpen(true);
                        }}
                        title="Editar proveedor"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Proveedor</DialogTitle>
          </DialogHeader>
          {editingProveedor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nombre">Nombre del Proveedor *</Label>
                  <Input
                    id="edit-nombre"
                    value={editingProveedor.nombre}
                    onChange={(e) =>
                      setEditingProveedor({
                        ...editingProveedor,
                        nombre: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-pais">País *</Label>
                  <Input
                    id="edit-pais"
                    value={editingProveedor.pais}
                    onChange={(e) =>
                      setEditingProveedor({
                        ...editingProveedor,
                        pais: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nombre_contacto">Nombre de Contacto</Label>
                  <Input
                    id="edit-nombre_contacto"
                    value={editingProveedor.nombre_contacto || ""}
                    onChange={(e) =>
                      setEditingProveedor({
                        ...editingProveedor,
                        nombre_contacto: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-rfc">RFC</Label>
                  <Input
                    id="edit-rfc"
                    value={editingProveedor.rfc || ""}
                    onChange={(e) =>
                      setEditingProveedor({
                        ...editingProveedor,
                        rfc: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingProveedor.email || ""}
                    onChange={(e) =>
                      setEditingProveedor({
                        ...editingProveedor,
                        email: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-telefono">Teléfono</Label>
                  <Input
                    id="edit-telefono"
                    value={editingProveedor.telefono || ""}
                    onChange={(e) =>
                      setEditingProveedor({
                        ...editingProveedor,
                        telefono: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-direccion">Dirección</Label>
                <Input
                  id="edit-direccion"
                  value={editingProveedor.direccion || ""}
                  onChange={(e) =>
                    setEditingProveedor({
                      ...editingProveedor,
                      direccion: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notas">Notas</Label>
                <Textarea
                  id="edit-notas"
                  value={editingProveedor.notas || ""}
                  onChange={(e) =>
                    setEditingProveedor({
                      ...editingProveedor,
                      notas: e.target.value,
                    })
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-activo"
                  checked={editingProveedor.activo}
                  onChange={(e) =>
                    setEditingProveedor({
                      ...editingProveedor,
                      activo: e.target.checked,
                    })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="edit-activo">Proveedor activo</Label>
              </div>

              <Button
                onClick={() => updateProveedor.mutate(editingProveedor)}
                disabled={!editingProveedor.nombre || updateProveedor.isPending}
                className="w-full"
              >
                Guardar Cambios
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog for managing supplier products */}
      <Dialog open={isProductosDialogOpen} onOpenChange={setIsProductosDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Productos del Proveedor</DialogTitle>
          </DialogHeader>
          {productosProveedor && (
            <ProveedorProductosSelector 
              proveedorId={productosProveedor.id} 
              proveedorNombre={productosProveedor.nombre}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ProveedoresTab;
