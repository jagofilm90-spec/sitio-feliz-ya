-- Create table for client-specific frequent products
CREATE TABLE public.cliente_productos_frecuentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  es_especial BOOLEAN DEFAULT false,
  orden_display INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, producto_id)
);

-- Enable RLS
ALTER TABLE public.cliente_productos_frecuentes ENABLE ROW LEVEL SECURITY;

-- Policies for admins and secretarias to manage
CREATE POLICY "Admins y secretarias pueden gestionar productos de clientes"
ON public.cliente_productos_frecuentes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

-- Clients can view their own products
CREATE POLICY "Clientes pueden ver sus productos asignados"
ON public.cliente_productos_frecuentes
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.clientes
  WHERE clientes.id = cliente_productos_frecuentes.cliente_id
  AND clientes.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_cliente_productos_frecuentes_updated_at
BEFORE UPDATE ON public.cliente_productos_frecuentes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();