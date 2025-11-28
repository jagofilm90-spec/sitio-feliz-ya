-- Add approval workflow columns to ordenes_compra
ALTER TABLE public.ordenes_compra 
ADD COLUMN IF NOT EXISTS autorizado_por uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS fecha_autorizacion timestamp with time zone,
ADD COLUMN IF NOT EXISTS rechazado_por uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS fecha_rechazo timestamp with time zone,
ADD COLUMN IF NOT EXISTS motivo_rechazo text;

-- Update status enum to include authorization states
-- Status values: pendiente, pendiente_autorizacion, autorizada, rechazada, enviada
COMMENT ON COLUMN public.ordenes_compra.status IS 'Estados: pendiente (borrador), pendiente_autorizacion (esperando autorización), autorizada (aprobada pero no enviada), rechazada, enviada';
