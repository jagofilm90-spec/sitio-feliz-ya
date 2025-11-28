-- Agregar campo sucursal_id a pedidos para asociar cada pedido con una sucursal de entrega
ALTER TABLE public.pedidos 
ADD COLUMN sucursal_id uuid REFERENCES public.cliente_sucursales(id) ON DELETE SET NULL;

-- Crear índice para mejorar performance de consultas
CREATE INDEX idx_pedidos_sucursal_id ON public.pedidos(sucursal_id);