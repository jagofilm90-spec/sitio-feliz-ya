-- Add quantity limit and line note fields to cotizaciones_detalles
ALTER TABLE public.cotizaciones_detalles 
ADD COLUMN cantidad_maxima integer NULL,
ADD COLUMN nota_linea text NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.cotizaciones_detalles.cantidad_maxima IS 'Cantidad máxima disponible a este precio (ej: solo 3000 bultos)';
COMMENT ON COLUMN public.cotizaciones_detalles.nota_linea IS 'Nota específica para esta línea de producto';