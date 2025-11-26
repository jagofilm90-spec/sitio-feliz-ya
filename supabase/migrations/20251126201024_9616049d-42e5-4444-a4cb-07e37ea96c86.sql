-- Add new columns to productos table for product variants and categorization
ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS marca text,
ADD COLUMN IF NOT EXISTS presentacion text,
ADD COLUMN IF NOT EXISTS categoria text,
ADD COLUMN IF NOT EXISTS proveedor_preferido_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_productos_marca ON public.productos(marca);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON public.productos(categoria);
CREATE INDEX IF NOT EXISTS idx_productos_proveedor_preferido ON public.productos(proveedor_preferido_id);

COMMENT ON COLUMN public.productos.marca IS 'Marca del producto (Almasa, Morelos, Purina, etc.)';
COMMENT ON COLUMN public.productos.presentacion IS 'Presentación del producto (25 KG, 50 KG, etc.)';
COMMENT ON COLUMN public.productos.categoria IS 'Categoría del producto (Azúcar, Arroz, Alimentos Balanceados, etc.)';
COMMENT ON COLUMN public.productos.proveedor_preferido_id IS 'Proveedor preferido para este producto';