-- Tabla de relación proveedor-productos
CREATE TABLE public.proveedor_productos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proveedor_id UUID NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(proveedor_id, producto_id)
);

-- Enable RLS
ALTER TABLE public.proveedor_productos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins y secretarias pueden gestionar relaciones proveedor-producto"
ON public.proveedor_productos
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Usuarios autenticados pueden ver relaciones proveedor-producto"
ON public.proveedor_productos
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Index for performance
CREATE INDEX idx_proveedor_productos_proveedor ON public.proveedor_productos(proveedor_id);
CREATE INDEX idx_proveedor_productos_producto ON public.proveedor_productos(producto_id);