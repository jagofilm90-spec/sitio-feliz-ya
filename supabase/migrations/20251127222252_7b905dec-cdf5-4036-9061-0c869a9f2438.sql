-- Create table for client branches/delivery locations
CREATE TABLE public.cliente_sucursales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  zona_id UUID REFERENCES public.zonas(id),
  telefono TEXT,
  contacto TEXT,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cliente_sucursales ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins and vendedores can manage client branches"
ON public.cliente_sucursales
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "All authenticated users can view client branches"
ON public.cliente_sucursales
FOR SELECT
USING (true);

CREATE POLICY "Clientes can view their own branches"
ON public.cliente_sucursales
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM clientes 
  WHERE clientes.id = cliente_sucursales.cliente_id 
  AND clientes.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_cliente_sucursales_updated_at
BEFORE UPDATE ON public.cliente_sucursales
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();