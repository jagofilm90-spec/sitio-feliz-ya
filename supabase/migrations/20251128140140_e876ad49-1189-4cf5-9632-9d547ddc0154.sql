-- Create cotizaciones table
CREATE TABLE public.cotizaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folio TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
  sucursal_id UUID REFERENCES public.cliente_sucursales(id),
  fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fecha_vigencia DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'borrador',
  email_origen_id TEXT,
  gmail_cuenta_id UUID REFERENCES public.gmail_cuentas(id),
  notas TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  impuestos NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  creado_por UUID NOT NULL,
  pedido_id UUID REFERENCES public.pedidos(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cotizaciones_detalles table
CREATE TABLE public.cotizaciones_detalles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotizacion_id UUID REFERENCES public.cotizaciones(id) ON DELETE CASCADE NOT NULL,
  producto_id UUID REFERENCES public.productos(id) NOT NULL,
  cantidad INTEGER NOT NULL,
  precio_unitario NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizaciones_detalles ENABLE ROW LEVEL SECURITY;

-- RLS policies for cotizaciones
CREATE POLICY "Admins y secretarias pueden gestionar cotizaciones"
ON public.cotizaciones
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Vendedores pueden ver y crear cotizaciones"
ON public.cotizaciones
FOR SELECT
USING (has_role(auth.uid(), 'vendedor'::app_role) OR auth.uid() IS NOT NULL);

CREATE POLICY "Vendedores pueden crear cotizaciones"
ON public.cotizaciones
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Clientes pueden ver sus cotizaciones"
ON public.cotizaciones
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM clientes
  WHERE clientes.id = cotizaciones.cliente_id
  AND clientes.user_id = auth.uid()
));

-- RLS policies for cotizaciones_detalles
CREATE POLICY "Usuarios autenticados pueden ver detalles de cotizaciones"
ON public.cotizaciones_detalles
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins y secretarias pueden gestionar detalles"
ON public.cotizaciones_detalles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role) OR has_role(auth.uid(), 'vendedor'::app_role));

-- Function to generate cotizacion folio
CREATE OR REPLACE FUNCTION public.generar_folio_cotizacion()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year_month TEXT;
  last_folio TEXT;
  last_number INTEGER;
  new_number INTEGER;
  new_folio TEXT;
BEGIN
  current_year_month := TO_CHAR(NOW(), 'YYYYMM');
  
  SELECT folio INTO last_folio
  FROM cotizaciones
  WHERE folio LIKE 'COT-' || current_year_month || '-%'
  ORDER BY folio DESC
  LIMIT 1;
  
  IF last_folio IS NULL THEN
    new_number := 1;
  ELSE
    last_number := CAST(SUBSTRING(last_folio FROM 13 FOR 4) AS INTEGER);
    new_number := last_number + 1;
  END IF;
  
  new_folio := 'COT-' || current_year_month || '-' || LPAD(new_number::TEXT, 4, '0');
  
  RETURN new_folio;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_cotizaciones_updated_at
BEFORE UPDATE ON public.cotizaciones
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();