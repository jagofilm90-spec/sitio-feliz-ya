-- Agregar columna tipo_precio a cotizaciones_detalles
ALTER TABLE cotizaciones_detalles
ADD COLUMN tipo_precio text;

COMMENT ON COLUMN cotizaciones_detalles.tipo_precio IS 'Identifica el tipo de precio: "por_kilo", "por_bulto", "por_caja", "por_balon", "por_saco", "por_cubeta", etc. Se usa para interpretar correctamente las cantidades en los pedidos.';

-- Actualizar registros existentes
UPDATE cotizaciones_detalles cd
SET tipo_precio = CASE
  WHEN p.precio_por_kilo = true THEN 'por_kilo'
  ELSE 'por_' || LOWER(p.unidad::text)
END
FROM productos p
WHERE cd.producto_id = p.id;