-- Crear tabla para múltiples correos por cliente
CREATE TABLE public.cliente_correos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre_contacto TEXT,
  es_principal BOOLEAN DEFAULT false,
  proposito TEXT, -- ej: 'cotizaciones', 'facturas', 'pedidos', 'general'
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_cliente_correos_cliente ON public.cliente_correos(cliente_id);
CREATE INDEX idx_cliente_correos_email ON public.cliente_correos(email);

-- Enable RLS
ALTER TABLE public.cliente_correos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins y secretarias pueden gestionar correos de clientes"
ON public.cliente_correos
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Usuarios autenticados pueden ver correos de clientes"
ON public.cliente_correos
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_cliente_correos_updated_at
BEFORE UPDATE ON public.cliente_correos
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();