
-- Cambiar el tipo de columna cantidad de INTEGER a NUMERIC para soportar decimales
ALTER TABLE pedidos_detalles 
ALTER COLUMN cantidad TYPE NUMERIC(10,2) USING cantidad::NUMERIC(10,2);
