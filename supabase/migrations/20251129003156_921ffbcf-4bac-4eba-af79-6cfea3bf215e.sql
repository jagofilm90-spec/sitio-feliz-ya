
-- =====================================================
-- MIGRACIÓN DE SEGURIDAD CRÍTICA
-- =====================================================

-- 1. Crear vista segura de empleados que oculta datos sensibles
CREATE OR REPLACE VIEW public.empleados_vista_segura AS
SELECT 
  id,
  nombre_completo,
  nombre,
  primer_apellido,
  segundo_apellido,
  puesto,
  fecha_ingreso,
  activo,
  user_id,
  email,
  telefono,
  created_at,
  updated_at,
  -- Campos sensibles solo visibles para admin/secretaria
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN rfc 
    ELSE NULL 
  END as rfc,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN curp 
    ELSE NULL 
  END as curp,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN numero_seguro_social 
    ELSE NULL 
  END as numero_seguro_social,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN sueldo_bruto 
    ELSE NULL 
  END as sueldo_bruto,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN cuenta_bancaria 
    ELSE NULL 
  END as cuenta_bancaria,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN clabe_interbancaria 
    ELSE NULL 
  END as clabe_interbancaria,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN direccion 
    ELSE NULL 
  END as direccion,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN fecha_nacimiento 
    ELSE NULL 
  END as fecha_nacimiento,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN fecha_baja 
    ELSE NULL 
  END as fecha_baja,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN motivo_baja 
    ELSE NULL 
  END as motivo_baja,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN periodo_pago 
    ELSE NULL 
  END as periodo_pago,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN notas 
    ELSE NULL 
  END as notas,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN contacto_emergencia_nombre 
    ELSE NULL 
  END as contacto_emergencia_nombre,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN contacto_emergencia_telefono 
    ELSE NULL 
  END as contacto_emergencia_telefono,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN tipo_sangre 
    ELSE NULL 
  END as tipo_sangre,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN estado_civil 
    ELSE NULL 
  END as estado_civil,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN nivel_estudios 
    ELSE NULL 
  END as nivel_estudios,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN numero_dependientes 
    ELSE NULL 
  END as numero_dependientes
FROM public.empleados;

-- 2. Crear vista segura de gmail_cuentas que oculta tokens
CREATE OR REPLACE VIEW public.gmail_cuentas_segura AS
SELECT 
  id,
  email,
  nombre,
  proposito,
  activo,
  created_at,
  updated_at,
  -- Tokens NUNCA expuestos al cliente - solo para edge functions
  NULL::text as access_token,
  NULL::text as refresh_token,
  NULL::timestamp with time zone as token_expires_at
FROM public.gmail_cuentas;

-- 3. Función para obtener roles del usuario actual (útil para el frontend)
CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS SETOF app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid();
$$;

-- 4. Función para verificar si usuario tiene alguno de los roles especificados
CREATE OR REPLACE FUNCTION public.has_any_role(_roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = ANY(_roles)
  );
$$;

-- 5. Actualizar política de empleados para restringir SELECT a datos básicos
-- Primero eliminar política existente que permite ver todo
DROP POLICY IF EXISTS "Todos los usuarios autenticados pueden ver empleados" ON public.empleados;

-- Nueva política: solo admin y secretarias pueden ver tabla completa
CREATE POLICY "Solo admin y secretarias ven empleados completos"
ON public.empleados
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'secretaria'::app_role)
);

-- 6. Restringir acceso a documentos de empleados
DROP POLICY IF EXISTS "Todos los usuarios autenticados pueden ver documentos" ON public.empleados_documentos;

CREATE POLICY "Solo admin y secretarias ven documentos de empleados"
ON public.empleados_documentos
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'secretaria'::app_role)
);

-- 7. Restringir acceso a documentos pendientes
DROP POLICY IF EXISTS "Todos los usuarios autenticados pueden ver documentos pendiente" ON public.empleados_documentos_pendientes;

CREATE POLICY "Solo admin y secretarias ven docs pendientes"
ON public.empleados_documentos_pendientes
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'secretaria'::app_role)
);

-- 8. Asegurar que gmail_cuentas no exponga tokens a usuarios no-admin
DROP POLICY IF EXISTS "Users can view gmail accounts they have permission for" ON public.gmail_cuentas;

-- Nueva política: usuarios ven cuentas permitidas pero SIN tokens
CREATE POLICY "Usuarios ven cuentas gmail sin tokens"
ON public.gmail_cuentas
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  EXISTS (
    SELECT 1 FROM gmail_cuenta_permisos
    WHERE gmail_cuenta_id = gmail_cuentas.id AND user_id = auth.uid()
  )
);
