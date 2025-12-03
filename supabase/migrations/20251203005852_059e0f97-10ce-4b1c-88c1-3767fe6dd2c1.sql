-- Add verificado column to pedidos_acumulativos_detalles
ALTER TABLE pedidos_acumulativos_detalles 
ADD COLUMN verificado BOOLEAN DEFAULT FALSE;