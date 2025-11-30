-- Create table for quotation send history
CREATE TABLE public.cotizaciones_envios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotizacion_id UUID NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  enviado_por UUID NOT NULL REFERENCES public.profiles(id),
  email_destino TEXT NOT NULL,
  gmail_cuenta_id UUID REFERENCES public.gmail_cuentas(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cotizaciones_envios ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Usuarios autenticados pueden ver historial de envíos"
ON public.cotizaciones_envios
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden crear registros de envío"
ON public.cotizaciones_envios
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Index for faster lookups
CREATE INDEX idx_cotizaciones_envios_cotizacion ON public.cotizaciones_envios(cotizacion_id);