-- Allow null dates for pending deliveries
ALTER TABLE public.ordenes_compra_entregas 
ALTER COLUMN fecha_programada DROP NOT NULL;

-- Add a computed column or use status for pending vs scheduled
-- We'll use the existing status field with new values