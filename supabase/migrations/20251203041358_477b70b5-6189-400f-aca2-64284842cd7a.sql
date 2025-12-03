-- Limpiar espacios en blanco al final de nombres de productos
UPDATE productos SET nombre = TRIM(nombre) WHERE nombre != TRIM(nombre);