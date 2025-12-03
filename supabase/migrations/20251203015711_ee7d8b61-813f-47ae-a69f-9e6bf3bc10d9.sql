-- Agregar columna unidades_manual a pedidos_acumulativos_detalles
ALTER TABLE pedidos_acumulativos_detalles 
ADD COLUMN IF NOT EXISTS unidades_manual NUMERIC(10,2) DEFAULT NULL;

-- Agregar columna unidades_manual a pedidos_detalles
ALTER TABLE pedidos_detalles 
ADD COLUMN IF NOT EXISTS unidades_manual NUMERIC(10,2) DEFAULT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN pedidos_acumulativos_detalles.unidades_manual IS 'Unidades (bolsas/cajas) ingresadas manualmente en verificación rápida';
COMMENT ON COLUMN pedidos_detalles.unidades_manual IS 'Unidades manuales transferidas desde pedidos acumulativos';