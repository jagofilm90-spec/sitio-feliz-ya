import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UseUserRolesReturn {
  roles: AppRole[];
  isLoading: boolean;
  isAdmin: boolean;
  isSecretaria: boolean;
  isVendedor: boolean;
  isChofer: boolean;
  isAlmacen: boolean;
  isContadora: boolean;
  isCliente: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
}

export const useUserRoles = (): UseUserRolesReturn => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setRoles([]);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching user roles:', error);
          setRoles([]);
        } else {
          setRoles(data?.map(r => r.role) || []);
        }
      } catch (error) {
        console.error('Error in fetchRoles:', error);
        setRoles([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoles();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        fetchRoles();
      } else if (event === 'SIGNED_OUT') {
        setRoles([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (role: AppRole): boolean => roles.includes(role);
  const hasAnyRole = (checkRoles: AppRole[]): boolean => 
    checkRoles.some(role => roles.includes(role));

  return {
    roles,
    isLoading,
    isAdmin: hasRole('admin'),
    isSecretaria: hasRole('secretaria'),
    isVendedor: hasRole('vendedor'),
    isChofer: hasRole('chofer'),
    isAlmacen: hasRole('almacen'),
    isContadora: hasRole('contadora'),
    isCliente: hasRole('cliente'),
    hasRole,
    hasAnyRole,
  };
};

// Configuración de permisos por módulo
export const MODULE_PERMISSIONS: Record<string, AppRole[]> = {
  '/dashboard': ['admin', 'secretaria', 'vendedor', 'chofer', 'almacen', 'contadora'],
  '/productos': ['admin', 'secretaria', 'almacen'],
  '/fumigaciones': ['admin', 'secretaria', 'almacen'],
  '/clientes': ['admin', 'secretaria', 'vendedor'],
  '/pedidos': ['admin', 'secretaria', 'vendedor'],
  '/compras': ['admin', 'secretaria'],
  '/inventario': ['admin', 'secretaria', 'almacen'],
  '/rentabilidad': ['admin', 'contadora'],
  '/rutas': ['admin', 'secretaria', 'chofer'],
  '/facturas': ['admin', 'secretaria', 'contadora'],
  '/empleados': ['admin', 'secretaria'],
  '/usuarios': ['admin'],
  '/chat': ['admin', 'secretaria', 'vendedor', 'chofer', 'almacen', 'contadora'],
  '/correos': ['admin', 'secretaria'],
};

// Hook para verificar acceso a un módulo específico
export const useModuleAccess = (path: string): { hasAccess: boolean; isLoading: boolean } => {
  const { roles, isLoading } = useUserRoles();
  
  const allowedRoles = MODULE_PERMISSIONS[path] || [];
  const hasAccess = roles.some(role => allowedRoles.includes(role));
  
  return { hasAccess, isLoading };
};
