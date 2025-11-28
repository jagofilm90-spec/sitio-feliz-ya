import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Trash2, Users, Mail, Shield } from "lucide-react";
import { toast } from "sonner";

interface GmailCuenta {
  id: string;
  email: string;
  nombre: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface Permiso {
  id: string;
  user_id: string;
  gmail_cuenta_id: string;
  created_at: string;
  profiles: Profile | null;
  gmail_cuentas: GmailCuenta | null;
}

const GmailPermisosManager = () => {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedCuenta, setSelectedCuenta] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);

  // Fetch all users (non-admin secretarias, etc.)
  const { data: users } = useQuery({
    queryKey: ["users-for-permisos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");

      if (error) throw error;
      return data as Profile[];
    },
  });

  // Fetch all gmail accounts
  const { data: cuentas } = useQuery({
    queryKey: ["gmail-cuentas-for-permisos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gmail_cuentas")
        .select("id, email, nombre")
        .order("nombre");

      if (error) throw error;
      return data as GmailCuenta[];
    },
  });

  // Fetch all existing permissions
  const { data: permisos, isLoading } = useQuery({
    queryKey: ["gmail-permisos-admin"],
    queryFn: async () => {
      // First get the permissions
      const { data: permisosData, error: permisosError } = await supabase
        .from("gmail_cuenta_permisos")
        .select("id, user_id, gmail_cuenta_id, created_at")
        .order("created_at", { ascending: false });

      if (permisosError) throw permisosError;

      // Then get the profiles and cuentas separately
      const userIds = [...new Set(permisosData?.map(p => p.user_id) || [])];
      const cuentaIds = [...new Set(permisosData?.map(p => p.gmail_cuenta_id) || [])];

      const [profilesRes, cuentasRes] = await Promise.all([
        userIds.length > 0 
          ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
          : { data: [], error: null },
        cuentaIds.length > 0
          ? supabase.from("gmail_cuentas").select("id, email, nombre").in("id", cuentaIds)
          : { data: [], error: null },
      ]);

      const profilesMap = new Map<string, Profile>();
      profilesRes.data?.forEach(p => profilesMap.set(p.id, p));
      
      const cuentasMap = new Map<string, GmailCuenta>();
      cuentasRes.data?.forEach(c => cuentasMap.set(c.id, c));

      // Combine the data
      return permisosData?.map(p => ({
        ...p,
        profiles: profilesMap.get(p.user_id) || null,
        gmail_cuentas: cuentasMap.get(p.gmail_cuenta_id) || null,
      })) as Permiso[];
    },
  });

  const handleAddPermiso = async () => {
    if (!selectedUser || !selectedCuenta) {
      toast.error("Selecciona un usuario y una cuenta");
      return;
    }

    // Check if permission already exists
    const exists = permisos?.some(
      p => p.user_id === selectedUser && p.gmail_cuenta_id === selectedCuenta
    );

    if (exists) {
      toast.error("Este usuario ya tiene acceso a esta cuenta");
      return;
    }

    setIsAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("gmail_cuenta_permisos").insert({
        user_id: selectedUser,
        gmail_cuenta_id: selectedCuenta,
        asignado_por: user?.id,
      });

      if (error) throw error;

      toast.success("Permiso agregado correctamente");
      queryClient.invalidateQueries({ queryKey: ["gmail-permisos-admin"] });
      setSelectedUser("");
      setSelectedCuenta("");
    } catch (error: any) {
      toast.error(error.message || "Error al agregar permiso");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemovePermiso = async (id: string) => {
    try {
      const { error } = await supabase
        .from("gmail_cuenta_permisos")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Permiso eliminado");
      queryClient.invalidateQueries({ queryKey: ["gmail-permisos-admin"] });
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar permiso");
    }
  };

  // Group permissions by user
  const permisosByUser = permisos?.reduce((acc, p) => {
    const userId = p.user_id;
    if (!acc[userId]) {
      acc[userId] = {
        user: p.profiles,
        cuentas: [],
      };
    }
    if (p.gmail_cuentas) {
      acc[userId].cuentas.push({ ...p.gmail_cuentas, permisoId: p.id });
    }
    return acc;
  }, {} as Record<string, { user: Profile | null; cuentas: (GmailCuenta & { permisoId: string })[] }>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Asignar Acceso a Correos
          </CardTitle>
          <CardDescription>
            Asigna qué cuentas de correo puede ver cada usuario del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Seleccionar usuario..." />
              </SelectTrigger>
              <SelectContent>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {user.full_name}
                      <span className="text-muted-foreground text-xs">
                        ({user.email})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCuenta} onValueChange={setSelectedCuenta}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Seleccionar cuenta de correo..." />
              </SelectTrigger>
              <SelectContent>
                {cuentas?.map((cuenta) => (
                  <SelectItem key={cuenta.id} value={cuenta.id}>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {cuenta.nombre}
                      <span className="text-muted-foreground text-xs">
                        ({cuenta.email})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleAddPermiso} disabled={isAdding}>
              <Plus className="h-4 w-4 mr-2" />
              Asignar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Permisos Actuales
          </CardTitle>
          <CardDescription>
            Lista de usuarios y las cuentas de correo a las que tienen acceso
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando permisos...
            </div>
          ) : Object.keys(permisosByUser || {}).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay permisos asignados. Los administradores pueden ver todas las cuentas automáticamente.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(permisosByUser || {}).map(([userId, data]) => (
                <div key={userId} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{data.user?.full_name || "Usuario"}</span>
                    <span className="text-sm text-muted-foreground">
                      ({data.user?.email})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.cuentas.map((cuenta) => (
                      <Badge
                        key={cuenta.permisoId}
                        variant="secondary"
                        className="flex items-center gap-2 py-1.5 px-3"
                      >
                        <Mail className="h-3 w-3" />
                        {cuenta.nombre}
                        <button
                          onClick={() => handleRemovePermiso(cuenta.permisoId)}
                          className="ml-1 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GmailPermisosManager;
