-- Add kg_por_unidad column to productos table
ALTER TABLE public.productos 
ADD COLUMN kg_por_unidad numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.productos.kg_por_unidad IS 'Kilogramos por unidad/caja, usado para conversión de precio por kg a precio por unidad';