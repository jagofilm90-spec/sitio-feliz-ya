-- Agregar campos de control de fumigación a productos
ALTER TABLE public.productos
ADD COLUMN requiere_fumigacion BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN fecha_ultima_fumigacion DATE;

-- Crear función para generar notificaciones de fumigación
CREATE OR REPLACE FUNCTION public.generar_notificaciones_fumigacion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insertar notificaciones para productos que requieren fumigación pronto
  -- Solo si tienen stock y si la notificación no existe ya
  INSERT INTO public.notificaciones (tipo, titulo, descripcion, leida)
  SELECT DISTINCT
    'fumigacion_proxima',
    'Fumigación próxima: ' || p.codigo,
    'El producto "' || p.nombre || '" requiere fumigación. Última fumigación: ' || 
    TO_CHAR(p.fecha_ultima_fumigacion, 'DD/MM/YYYY') || 
    '. Próxima fumigación: ' || TO_CHAR(p.fecha_ultima_fumigacion + INTERVAL '6 months', 'DD/MM/YYYY'),
    false
  FROM public.productos p
  WHERE p.requiere_fumigacion = true
    AND p.activo = true
    AND p.stock_actual > 0
    AND p.fecha_ultima_fumigacion IS NOT NULL
    -- Faltan 2 semanas o menos para los 6 meses
    AND (p.fecha_ultima_fumigacion + INTERVAL '6 months' - INTERVAL '2 weeks') <= CURRENT_DATE
    -- Aún no han pasado los 6 meses (o pasaron hace menos de 30 días para mantener visible)
    AND (p.fecha_ultima_fumigacion + INTERVAL '6 months' + INTERVAL '30 days') >= CURRENT_DATE
    -- No existe ya una notificación reciente para este producto
    AND NOT EXISTS (
      SELECT 1 FROM public.notificaciones n
      WHERE n.tipo = 'fumigacion_proxima'
        AND n.titulo = 'Fumigación próxima: ' || p.codigo
        AND n.created_at > CURRENT_DATE - INTERVAL '7 days'
    );
END;
$$;