-- Crear tabla para pedidos acumulativos en borrador (específicamente para Lecaroz)
CREATE TABLE IF NOT EXISTS public.pedidos_acumulativos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  sucursal_id UUID REFERENCES public.cliente_sucursales(id) ON DELETE CASCADE,
  fecha_entrega DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'borrador', -- 'borrador', 'finalizado'
  notas TEXT,
  subtotal NUMERIC(10,2) DEFAULT 0,
  impuestos NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  correos_procesados TEXT[] DEFAULT ARRAY[]::TEXT[], -- IDs de correos incluidos
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de detalles de productos en pedidos acumulativos
CREATE TABLE IF NOT EXISTS public.pedidos_acumulativos_detalles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_acumulativo_id UUID NOT NULL REFERENCES public.pedidos_acumulativos(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  cantidad NUMERIC(10,2) NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para mejorar performance
CREATE INDEX idx_pedidos_acumulativos_cliente ON public.pedidos_acumulativos(cliente_id);
CREATE INDEX idx_pedidos_acumulativos_sucursal ON public.pedidos_acumulativos(sucursal_id);
CREATE INDEX idx_pedidos_acumulativos_status ON public.pedidos_acumulativos(status);
CREATE INDEX idx_pedidos_acumulativos_detalles_pedido ON public.pedidos_acumulativos_detalles(pedido_acumulativo_id);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_pedidos_acumulativos_updated_at
BEFORE UPDATE ON public.pedidos_acumulativos
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- RLS policies
ALTER TABLE public.pedidos_acumulativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_acumulativos_detalles ENABLE ROW LEVEL SECURITY;

-- Admins y secretarias pueden ver/editar todos los pedidos acumulativos
CREATE POLICY "Admins y secretarias acceso completo pedidos acumulativos"
ON public.pedidos_acumulativos
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'secretaria')
  )
);

CREATE POLICY "Admins y secretarias acceso completo detalles acumulativos"
ON public.pedidos_acumulativos_detalles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'secretaria')
  )
);