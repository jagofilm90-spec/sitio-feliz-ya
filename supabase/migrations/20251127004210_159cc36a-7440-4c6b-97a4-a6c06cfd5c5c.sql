-- Crear tabla de lotes de inventario
CREATE TABLE IF NOT EXISTS public.inventario_lotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  cantidad_disponible INTEGER NOT NULL DEFAULT 0,
  precio_compra NUMERIC NOT NULL,
  fecha_entrada TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fecha_caducidad DATE,
  lote_referencia TEXT,
  orden_compra_id UUID REFERENCES public.ordenes_compra(id),
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_inventario_lotes_producto ON public.inventario_lotes(producto_id);
CREATE INDEX idx_inventario_lotes_caducidad ON public.inventario_lotes(fecha_caducidad) WHERE fecha_caducidad IS NOT NULL;
CREATE INDEX idx_inventario_lotes_disponible ON public.inventario_lotes(cantidad_disponible) WHERE cantidad_disponible > 0;

-- RLS policies
ALTER TABLE public.inventario_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and almacen can manage inventory lots"
  ON public.inventario_lotes
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'almacen'::app_role)
  );

CREATE POLICY "All authenticated users can view inventory lots"
  ON public.inventario_lotes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_inventario_lotes_updated_at
  BEFORE UPDATE ON public.inventario_lotes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Comentarios
COMMENT ON TABLE public.inventario_lotes IS 'Rastrea lotes individuales de productos con precios, caducidades y cantidades específicas para mejor rotación FIFO';
COMMENT ON COLUMN public.inventario_lotes.lote_referencia IS 'Referencia opcional para cosechas, temporadas, o identificación manual del lote';