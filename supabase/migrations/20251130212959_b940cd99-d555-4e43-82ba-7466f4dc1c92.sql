-- Agregar campos de autorización a cotizaciones
ALTER TABLE public.cotizaciones 
ADD COLUMN IF NOT EXISTS autorizado_por uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS fecha_autorizacion timestamp with time zone,
ADD COLUMN IF NOT EXISTS rechazado_por uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS fecha_rechazo timestamp with time zone,
ADD COLUMN IF NOT EXISTS motivo_rechazo text;

-- Agregar cotizacion_id a notificaciones para las alertas de autorización
ALTER TABLE public.notificaciones 
ADD COLUMN IF NOT EXISTS cotizacion_id uuid REFERENCES public.cotizaciones(id) ON DELETE CASCADE;