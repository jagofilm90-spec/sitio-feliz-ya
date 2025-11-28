-- Add orden_compra_id column to notificaciones table for linking OC authorization requests
ALTER TABLE public.notificaciones 
ADD COLUMN orden_compra_id uuid REFERENCES public.ordenes_compra(id) ON DELETE CASCADE;

-- Add index for faster lookups
CREATE INDEX idx_notificaciones_orden_compra ON public.notificaciones(orden_compra_id) WHERE orden_compra_id IS NOT NULL;