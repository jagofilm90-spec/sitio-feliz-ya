-- Create table to track purchase order email confirmations
CREATE TABLE public.ordenes_compra_confirmaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_compra_id uuid NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  confirmado_en timestamp with time zone,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ordenes_compra_confirmaciones ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins y secretarias pueden ver confirmaciones"
ON public.ordenes_compra_confirmaciones
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Public can insert confirmations via token"
ON public.ordenes_compra_confirmaciones
FOR INSERT
WITH CHECK (true);

-- Add column to track if email was opened (read receipt)
ALTER TABLE public.ordenes_compra
ADD COLUMN email_enviado_en timestamp with time zone,
ADD COLUMN email_leido_en timestamp with time zone;