-- Cambiar almendra para que se maneje en kg (no en cajas)
UPDATE productos 
SET unidad = 'kg', kg_por_unidad = NULL 
WHERE nombre ILIKE '%almendra%';