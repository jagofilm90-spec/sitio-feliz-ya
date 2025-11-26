-- Agregar campos de impuestos a la tabla productos
ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS aplica_iva boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS aplica_ieps boolean NOT NULL DEFAULT false;

-- Comentarios para documentación
COMMENT ON COLUMN public.productos.aplica_iva IS 'Indica si el producto tiene IVA del 16%';
COMMENT ON COLUMN public.productos.aplica_ieps IS 'Indica si el producto tiene IEPS del 8%';