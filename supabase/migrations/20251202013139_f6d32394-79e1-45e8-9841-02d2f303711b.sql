-- Ajustar kg_por_unidad para el arroz SEM-013
UPDATE public.productos
SET kg_por_unidad = 25
WHERE codigo = 'SEM-013';