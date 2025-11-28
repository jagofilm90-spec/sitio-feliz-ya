-- Create table for multiple scheduled deliveries per purchase order
CREATE TABLE public.ordenes_compra_entregas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_compra_id UUID NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  numero_entrega INTEGER NOT NULL,
  cantidad_bultos INTEGER NOT NULL,
  fecha_programada DATE NOT NULL,
  fecha_entrega_real DATE,
  status TEXT NOT NULL DEFAULT 'programada',
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ordenes_compra_entregas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins y secretarias pueden gestionar entregas de compra"
ON public.ordenes_compra_entregas
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Almacenistas pueden actualizar entregas"
ON public.ordenes_compra_entregas
FOR UPDATE
USING (has_role(auth.uid(), 'almacen'::app_role));

CREATE POLICY "Usuarios autenticados pueden ver entregas de compra"
ON public.ordenes_compra_entregas
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add column to ordenes_compra to mark if it has multiple deliveries
ALTER TABLE public.ordenes_compra 
ADD COLUMN IF NOT EXISTS entregas_multiples BOOLEAN DEFAULT false;

-- Enable realtime for the new table
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordenes_compra_entregas;