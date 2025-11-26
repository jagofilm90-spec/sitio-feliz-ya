import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Shield, Mail, User, Pencil, Trash2, Eye, EyeOff, KeyRound } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
}

interface UserWithRoles extends Profile {
  roles: string[];
}

interface Empleado {
  id: string;
  user_id: string | null;
  nombre_completo: string;
  nombre: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  email: string | null;
  telefono: string | null;
}

const ROLES = [
  { value: "admin", label: "Administrador", color: "destructive" },
  { value: "secretaria", label: "Secretaria", color: "default" },
  { value: "vendedor", label: "Vendedor", color: "secondary" },
  { value: "almacen", label: "Almacén", color: "outline" },
  { value: "chofer", label: "Chofer", color: "outline" },
];

export default function Usuarios() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [editUserFields, setEditUserFields] = useState({
    nombre: "",
    primer_apellido: "",
    segundo_apellido: "",
  });
  const [newUserFields, setNewUserFields] = useState({
    nombre: "",
    primer_apellido: "",
    segundo_apellido: "",
  });
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserWithRoles | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<string>("");
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    role: "vendedor",
  });
  const [emailCheckResult, setEmailCheckResult] = useState<"available" | "taken" | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
    loadEmpleados();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Obtener todos los perfiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (profilesError) throw profilesError;

      // Obtener roles de cada usuario
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combinar profiles con sus roles
      const usersWithRoles = profiles?.map((profile) => ({
        ...profile,
        roles: userRoles?.filter((r) => r.user_id === profile.id).map((r) => r.role) || [],
      })) || [];

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error loading users:", error);
      toast({
        variant: "destructive",
        title: "Error al cargar usuarios",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEmpleados = async () => {
    try {
      const { data, error } = await supabase
        .from("empleados")
        .select("id, user_id, nombre_completo, nombre, primer_apellido, segundo_apellido, email, telefono, puesto")
        .is("user_id", null)
        .eq("activo", true)
        .in("puesto", ["Vendedor", "Secretaria", "Chofer", "Almacenista"])
        .order("nombre_completo");

      if (error) throw error;
      setEmpleados(data || []);
    } catch (error: any) {
      console.error("Error loading empleados:", error);
    }
  };

  const handleCheckEmail = async () => {
    if (!newUser.email || !newUser.email.includes("@")) {
      toast({
        variant: "destructive",
        title: "Email inválido",
        description: "Ingresa un email válido",
      });
      return;
    }

    setIsCheckingEmail(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("email")
        .eq("email", newUser.email)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setEmailCheckResult("taken");
        toast({
          variant: "destructive",
          title: "Email no disponible",
          description: "Este email ya está registrado en el sistema",
        });
      } else {
        setEmailCheckResult("available");
        toast({
          title: "Email disponible",
          description: "Este email puede ser usado",
        });
      }
    } catch (error: any) {
      console.error("Error checking email:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo verificar el email",
      });
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleEmpleadoSelect = (empleadoId: string) => {
    setSelectedEmpleadoId(empleadoId);
    const empleado = empleados.find(e => e.id === empleadoId);
    if (empleado) {
      // Auto-rellenar campos separados
      setNewUserFields({
        nombre: empleado.nombre || "",
        primer_apellido: empleado.primer_apellido || "",
        segundo_apellido: empleado.segundo_apellido || "",
      });
      
      const fullName = `${empleado.nombre || ''} ${empleado.primer_apellido || ''} ${empleado.segundo_apellido || ''}`.trim();
      setNewUser({
        ...newUser,
        full_name: fullName,
        email: empleado.email || "",
        phone: empleado.telefono || "",
      });
      setEmailCheckResult(null);
    }
  };

  const handleCreateUser = async () => {
    try {
      // Construir nombre completo desde los campos separados
      const fullName = `${newUserFields.nombre} ${newUserFields.primer_apellido} ${newUserFields.segundo_apellido}`.trim();
      
      if (!newUser.email || !newUser.password || !fullName) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Completa todos los campos obligatorios",
        });
        return;
      }

      if (emailCheckResult !== "available") {
        toast({
          variant: "destructive",
          title: "Email no verificado",
          description: "Verifica que el email esté disponible antes de crear el usuario",
        });
        return;
      }

      // Obtener el token de sesión actual
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No hay sesión activa",
        });
        return;
      }

      // Llamar al edge function para crear usuario sin perder la sesión
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUser.email,
          password: newUser.password,
          full_name: fullName,
          phone: newUser.phone || null,
          role: newUser.role,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Si se seleccionó un empleado, actualizar su user_id con el nuevo usuario creado
      if (selectedEmpleadoId && data.user) {
        const { error: empleadoError } = await supabase
          .from('empleados')
          .update({ user_id: data.user.id })
          .eq('id', selectedEmpleadoId);

        if (empleadoError) {
          console.error('Error vinculando empleado con usuario:', empleadoError);
          toast({
            variant: "destructive",
            title: "Advertencia",
            description: "El usuario se creó pero no se pudo vincular con el empleado",
          });
        }
      }

      toast({
        title: "Usuario creado",
        description: `${fullName} ha sido agregado al sistema`,
      });

      setIsDialogOpen(false);
      setNewUser({
        email: "",
        password: "",
        full_name: "",
        phone: "",
        role: "vendedor",
      });
      setNewUserFields({
        nombre: "",
        primer_apellido: "",
        segundo_apellido: "",
      });
      setSelectedEmpleadoId("");
      setEmailCheckResult(null);
      loadUsers();
      loadEmpleados();
    } catch (error: any) {
      console.error("Error creating user:", error);
      const errorMsg = error.message || "Error desconocido";
      const friendlyMsg = errorMsg.includes("already been registered") 
        ? "Este email ya está registrado en el sistema"
        : errorMsg;
      toast({
        variant: "destructive",
        title: "Error al crear usuario",
        description: friendlyMsg,
      });
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;

    try {
      // Construir nombre completo desde los campos separados
      const fullName = `${editUserFields.nombre} ${editUserFields.primer_apellido} ${editUserFields.segundo_apellido}`.trim();

      // Actualizar nombre completo y teléfono en profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          full_name: fullName,
          phone: editingUser.phone 
        })
        .eq("id", editingUser.id);

      if (profileError) throw profileError;

      // Actualizar empleado vinculado si existe
      const { data: empleadoVinculado } = await supabase
        .from("empleados")
        .select("id")
        .eq("user_id", editingUser.id)
        .maybeSingle();

      if (empleadoVinculado) {
        const { error: empleadoError } = await supabase
          .from("empleados")
          .update({
            nombre: editUserFields.nombre,
            primer_apellido: editUserFields.primer_apellido,
            segundo_apellido: editUserFields.segundo_apellido,
            nombre_completo: fullName,
          })
          .eq("id", empleadoVinculado.id);

        if (empleadoError) {
          console.error("Error actualizando empleado:", empleadoError);
        }
      }

      // Eliminar roles actuales
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", editingUser.id);

      if (deleteError) throw deleteError;

      // Insertar nuevos roles
      if (editingUser.roles.length > 0) {
        const { error: rolesError } = await supabase
          .from("user_roles")
          .insert(editingUser.roles.map(role => ({
            user_id: editingUser.id,
            role: role as any,
          })));

        if (rolesError) throw rolesError;
      }

      toast({
        title: "Usuario actualizado",
        description: `${fullName} ha sido actualizado correctamente`,
      });

      setIsEditDialogOpen(false);
      setEditingUser(null);
      setEditUserFields({ nombre: "", primer_apellido: "", segundo_apellido: "" });
      loadUsers();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast({
        variant: "destructive",
        title: "Error al actualizar usuario",
        description: error.message,
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: {
          userId: userToDelete.id,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: "Usuario eliminado",
        description: `${userToDelete.full_name} ha sido eliminado del sistema`,
      });

      setUserToDelete(null);
      loadUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        variant: "destructive",
        title: "Error al eliminar usuario",
        description: error.message,
      });
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) return;

    try {
      if (newPassword.length < 6) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "La contraseña debe tener al menos 6 caracteres",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId: resetPasswordUser.id,
          newPassword: newPassword,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: "Contraseña actualizada",
        description: `La contraseña de ${resetPasswordUser.full_name} ha sido actualizada`,
      });

      setResetPasswordUser(null);
      setNewPassword("");
      setShowNewPassword(false);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast({
        variant: "destructive",
        title: "Error al cambiar contraseña",
        description: error.message,
      });
    }
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = ROLES.find((r) => r.value === role);
    return (
      <Badge variant={roleConfig?.color as any} className="text-xs">
        {roleConfig?.label || role}
      </Badge>
    );
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getUsersByRole = (role?: string) => {
    if (!role) return filteredUsers;
    return filteredUsers.filter(user => user.roles.includes(role));
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
            <p className="text-muted-foreground">Administra usuarios y sus roles en el sistema</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                <DialogDescription>
                  Agrega un nuevo miembro al equipo de Abarrotes La Manita
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="empleado_select">Seleccionar Empleado (Opcional)</Label>
                  <Select value={selectedEmpleadoId} onValueChange={handleEmpleadoSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un empleado existente" />
                    </SelectTrigger>
                    <SelectContent>
                      {empleados.length === 0 ? (
                        <SelectItem value="no-empleados" disabled>
                          No hay empleados disponibles
                        </SelectItem>
                      ) : (
                        empleados.map((empleado) => (
                          <SelectItem key={empleado.id} value={empleado.id}>
                            {empleado.nombre_completo}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Si seleccionas un empleado, se autorellenarán nombre, email y teléfono
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    placeholder="Juan"
                    value={newUserFields.nombre}
                    onChange={(e) => {
                      setNewUserFields({ ...newUserFields, nombre: e.target.value });
                      const fullName = `${e.target.value} ${newUserFields.primer_apellido} ${newUserFields.segundo_apellido}`.trim();
                      setNewUser({ ...newUser, full_name: fullName });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primer_apellido">Primer Apellido *</Label>
                  <Input
                    id="primer_apellido"
                    placeholder="Pérez"
                    value={newUserFields.primer_apellido}
                    onChange={(e) => {
                      setNewUserFields({ ...newUserFields, primer_apellido: e.target.value });
                      const fullName = `${newUserFields.nombre} ${e.target.value} ${newUserFields.segundo_apellido}`.trim();
                      setNewUser({ ...newUser, full_name: fullName });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="segundo_apellido">Segundo Apellido *</Label>
                  <Input
                    id="segundo_apellido"
                    placeholder="García"
                    value={newUserFields.segundo_apellido}
                    onChange={(e) => {
                      setNewUserFields({ ...newUserFields, segundo_apellido: e.target.value });
                      const fullName = `${newUserFields.nombre} ${newUserFields.primer_apellido} ${e.target.value}`.trim();
                      setNewUser({ ...newUser, full_name: fullName });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@almasa.com.mx"
                      value={newUser.email}
                      onChange={(e) => {
                        setNewUser({ ...newUser, email: e.target.value });
                        setEmailCheckResult(null);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCheckEmail}
                      disabled={isCheckingEmail || !newUser.email}
                    >
                      {isCheckingEmail ? "Verificando..." : "Verificar"}
                    </Button>
                  </div>
                  {emailCheckResult === "available" && (
                    <p className="text-sm text-green-600">✓ Email disponible</p>
                  )}
                  {emailCheckResult === "taken" && (
                    <p className="text-sm text-destructive">✗ Email ya registrado</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    placeholder="(123) 456-7890"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol *</Label>
                  <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateUser}>Crear Usuario</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar por nombre o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <Tabs defaultValue="todos" className="w-full">
          <TabsList>
            <TabsTrigger value="todos">Todos ({filteredUsers.length})</TabsTrigger>
            <TabsTrigger value="admin">Admins ({getUsersByRole('admin').length})</TabsTrigger>
            <TabsTrigger value="secretaria">Secretarias ({getUsersByRole('secretaria').length})</TabsTrigger>
            <TabsTrigger value="vendedor">Vendedores ({getUsersByRole('vendedor').length})</TabsTrigger>
            <TabsTrigger value="almacen">Almacén ({getUsersByRole('almacen').length})</TabsTrigger>
            <TabsTrigger value="chofer">Choferes ({getUsersByRole('chofer').length})</TabsTrigger>
          </TabsList>

          {["todos", "admin", "secretaria", "vendedor", "almacen", "chofer"].map((roleFilter) => {
            const displayUsers = roleFilter === "todos" ? filteredUsers : getUsersByRole(roleFilter);
            
            return (
              <TabsContent key={roleFilter} value={roleFilter}>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Correo</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead className="w-[100px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            Cargando usuarios...
                          </TableCell>
                        </TableRow>
                      ) : displayUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            No se encontraron usuarios
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.full_name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.phone || "-"}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {user.roles.length > 0 ? (
                                  user.roles.map((role) => (
                                    <span key={role}>{getRoleBadge(role)}</span>
                                  ))
                                ) : (
                                  <Badge variant="outline">Sin rol</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const nombrePartes = user.full_name.trim().split(/\s+/);
                                    const nombre = nombrePartes[0] || "";
                                    const primerApellido = nombrePartes[1] || "";
                                    const segundoApellido = nombrePartes.slice(2).join(" ") || "";
                                    
                                    setEditingUser(user);
                                    setEditUserFields({
                                      nombre,
                                      primer_apellido: primerApellido,
                                      segundo_apellido: segundoApellido,
                                    });
                                    setIsEditDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setUserToDelete(user)}
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
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Dialog para editar usuario */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>
                Modifica los datos y roles del usuario
              </DialogDescription>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_nombre">Nombre *</Label>
                  <Input 
                    id="edit_nombre"
                    value={editUserFields.nombre}
                    onChange={(e) => setEditUserFields({ ...editUserFields, nombre: e.target.value })}
                    required
                    placeholder="Nombre(s)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_primer_apellido">Primer Apellido *</Label>
                    <Input 
                      id="edit_primer_apellido"
                      value={editUserFields.primer_apellido}
                      onChange={(e) => setEditUserFields({ ...editUserFields, primer_apellido: e.target.value })}
                      required
                      placeholder="Primer apellido"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_segundo_apellido">Segundo Apellido</Label>
                    <Input 
                      id="edit_segundo_apellido"
                      value={editUserFields.segundo_apellido}
                      onChange={(e) => setEditUserFields({ ...editUserFields, segundo_apellido: e.target.value })}
                      placeholder="Segundo apellido (opcional)"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Correo</Label>
                  <Input value={editingUser.email} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_phone">Teléfono</Label>
                  <Input
                    id="edit_phone"
                    placeholder="(123) 456-7890"
                    value={editingUser.phone || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Roles</Label>
                  <div className="space-y-2">
                    {ROLES.map((role) => (
                      <div key={role.value} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`role-${role.value}`}
                          checked={editingUser.roles.includes(role.value)}
                          onChange={(e) => {
                            const newRoles = e.target.checked
                              ? [...editingUser.roles, role.value]
                              : editingUser.roles.filter(r => r !== role.value);
                            setEditingUser({ ...editingUser, roles: newRoles });
                          }}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={`role-${role.value}`} className="cursor-pointer">
                          {role.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setResetPasswordUser(editingUser);
                      setIsEditDialogOpen(false);
                    }}
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    Cambiar Contraseña
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditUser}>Guardar Cambios</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmación para eliminar */}
        <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que deseas eliminar a <strong>{userToDelete?.full_name}</strong>? Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog para resetear contraseña */}
        <Dialog open={!!resetPasswordUser} onOpenChange={() => {
          setResetPasswordUser(null);
          setNewPassword("");
          setShowNewPassword(false);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cambiar Contraseña</DialogTitle>
              <DialogDescription>
                Establece una nueva contraseña para {resetPasswordUser?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new_password">Nueva Contraseña *</Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setResetPasswordUser(null);
                setNewPassword("");
                setShowNewPassword(false);
              }}>
                Cancelar
              </Button>
              <Button onClick={handleResetPassword}>Cambiar Contraseña</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
