-- Add codigo_sucursal field to cliente_sucursales for client internal identifiers (like Lecaroz's "41")
ALTER TABLE public.cliente_sucursales
ADD COLUMN codigo_sucursal text;

-- Add comment explaining the field
COMMENT ON COLUMN public.cliente_sucursales.codigo_sucursal IS 'Código interno del cliente para identificar esta sucursal (ej: 41 para Lecaroz La Joya)';