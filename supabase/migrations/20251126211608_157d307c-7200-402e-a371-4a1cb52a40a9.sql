-- Agregar campos marca y precio_por_kilo a la tabla productos
ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS marca text,
ADD COLUMN IF NOT EXISTS precio_por_kilo boolean NOT NULL DEFAULT false;

-- Comentarios para documentación
COMMENT ON COLUMN public.productos.marca IS 'Marca del producto para identificar variantes';
COMMENT ON COLUMN public.productos.precio_por_kilo IS 'Indica si el precio es por kilo (true) o precio de bulto completo (false)';
