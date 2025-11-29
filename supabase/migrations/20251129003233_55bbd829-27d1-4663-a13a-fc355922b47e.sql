
-- Corregir vistas para usar SECURITY INVOKER en lugar de DEFINER
-- Esto asegura que las políticas RLS del usuario actual se apliquen

-- Recrear vista de empleados con SECURITY INVOKER
DROP VIEW IF EXISTS public.empleados_vista_segura;
CREATE VIEW public.empleados_vista_segura 
WITH (security_invoker = true)
AS
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
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN rfc ELSE NULL 
  END as rfc,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN curp ELSE NULL 
  END as curp,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN numero_seguro_social ELSE NULL 
  END as numero_seguro_social,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN sueldo_bruto ELSE NULL 
  END as sueldo_bruto,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN cuenta_bancaria ELSE NULL 
  END as cuenta_bancaria,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN clabe_interbancaria ELSE NULL 
  END as clabe_interbancaria,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN direccion ELSE NULL 
  END as direccion,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN fecha_nacimiento ELSE NULL 
  END as fecha_nacimiento,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN fecha_baja ELSE NULL 
  END as fecha_baja,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN motivo_baja ELSE NULL 
  END as motivo_baja,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN periodo_pago ELSE NULL 
  END as periodo_pago,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN notas ELSE NULL 
  END as notas,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN contacto_emergencia_nombre ELSE NULL 
  END as contacto_emergencia_nombre,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN contacto_emergencia_telefono ELSE NULL 
  END as contacto_emergencia_telefono,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN tipo_sangre ELSE NULL 
  END as tipo_sangre,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN estado_civil ELSE NULL 
  END as estado_civil,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN nivel_estudios ELSE NULL 
  END as nivel_estudios,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) 
    THEN numero_dependientes ELSE NULL 
  END as numero_dependientes
FROM public.empleados;

-- Recrear vista de gmail_cuentas con SECURITY INVOKER
DROP VIEW IF EXISTS public.gmail_cuentas_segura;
CREATE VIEW public.gmail_cuentas_segura
WITH (security_invoker = true)
AS
SELECT 
  id,
  email,
  nombre,
  proposito,
  activo,
  created_at,
  updated_at,
  NULL::text as access_token,
  NULL::text as refresh_token,
  NULL::timestamp with time zone as token_expires_at
FROM public.gmail_cuentas;
