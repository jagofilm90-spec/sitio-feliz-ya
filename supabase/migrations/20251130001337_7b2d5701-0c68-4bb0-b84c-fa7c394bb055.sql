-- Add SAT code field to productos table for invoicing compliance
ALTER TABLE public.productos 
ADD COLUMN IF NOT EXISTS codigo_sat TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN public.productos.codigo_sat IS 'Código SAT del producto para facturación electrónica (CFDI)';