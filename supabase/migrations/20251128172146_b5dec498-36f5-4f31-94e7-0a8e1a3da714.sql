-- Drop the existing check constraint and add new one with pendiente_autorizacion
ALTER TABLE ordenes_compra DROP CONSTRAINT IF EXISTS ordenes_compra_status_check;

ALTER TABLE ordenes_compra ADD CONSTRAINT ordenes_compra_status_check 
CHECK (status IN ('pendiente', 'pendiente_autorizacion', 'autorizada', 'enviada', 'recibida', 'rechazada', 'devuelta', 'cancelada'));