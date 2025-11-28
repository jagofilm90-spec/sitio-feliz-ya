import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface GmailPermiso {
  id: string;
  user_id: string;
  gmail_cuenta_id: string;
  created_at: string;
  asignado_por: string | null;
}

interface GmailCuenta {
  id: string;
  email: string;
  nombre: string;
  proposito: string;
  activo: boolean;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
}

export const useGmailPermisos = () => {
  // Get current user and their role
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ["current-user-with-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = roles?.map(r => r.role) || [];
      const isAdmin = userRoles.includes("admin");

      return {
        userId: user.id,
        roles: userRoles,
        isAdmin,
      };
    },
  });

  const isAdmin = userData?.isAdmin || false;

  // Get user's permitted accounts (always runs for non-admins when userData is available)
  const { data: permisos, isLoading: isLoadingPermisos } = useQuery({
    queryKey: ["gmail-permisos-usuario", userData?.userId],
    queryFn: async () => {
      if (!userData?.userId) return [];

      const { data, error } = await supabase
        .from("gmail_cuenta_permisos")
        .select("gmail_cuenta_id")
        .eq("user_id", userData.userId);

      if (error) throw error;
      return data?.map(p => p.gmail_cuenta_id) || [];
    },
    enabled: !!userData && !userData.isAdmin,
  });

  // Filter function to apply to accounts
  const filterCuentasByPermiso = (cuentas: GmailCuenta[]): GmailCuenta[] => {
    // Still loading user data
    if (isLoadingUser) return [];
    
    // No user data (not authenticated)
    if (!userData) return [];
    
    // Admins see all accounts
    if (userData.isAdmin) return cuentas;
    
    // Still loading permissions for non-admin
    if (isLoadingPermisos) return [];
    
    // Non-admins see only permitted accounts
    if (!permisos || permisos.length === 0) return [];
    
    return cuentas.filter(c => permisos.includes(c.id));
  };

  return {
    isAdmin,
    permisos,
    filterCuentasByPermiso,
    isLoading: isLoadingUser || (!isAdmin && isLoadingPermisos),
  };
};

// Hook to get all permissions for admin management
export const useGmailPermisosAdmin = () => {
  return useQuery({
    queryKey: ["gmail-permisos-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gmail_cuenta_permisos")
        .select(`
          id,
          user_id,
          gmail_cuenta_id,
          created_at,
          asignado_por
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as GmailPermiso[];
    },
  });
};

// Function to log email actions for audit
export const logEmailAction = async (
  gmailCuentaId: string,
  accion: "enviar" | "responder" | "reenviar" | "leer" | "eliminar",
  details?: {
    emailTo?: string;
    emailSubject?: string;
    gmailMessageId?: string;
  }
) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("gmail_auditoria").insert({
    user_id: user.id,
    gmail_cuenta_id: gmailCuentaId,
    accion,
    email_to: details?.emailTo,
    email_subject: details?.emailSubject,
    gmail_message_id: details?.gmailMessageId,
  });
};
