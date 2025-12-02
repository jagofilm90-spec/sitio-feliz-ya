-- Ajustar kg_por_unidad para la cereza con rabo VAR-004
UPDATE public.productos
SET kg_por_unidad = 13.6
WHERE codigo = 'VAR-004';