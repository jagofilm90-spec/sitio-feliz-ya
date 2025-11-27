-- Add delivery restrictions fields to cliente_sucursales
ALTER TABLE public.cliente_sucursales 
ADD COLUMN IF NOT EXISTS horario_entrega text,
ADD COLUMN IF NOT EXISTS restricciones_vehiculo text,
ADD COLUMN IF NOT EXISTS dias_sin_entrega text,
ADD COLUMN IF NOT EXISTS no_combinar_pedidos boolean DEFAULT false;