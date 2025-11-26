-- Actualizar políticas de RLS para permitir que cualquier usuario autenticado cree conversaciones

-- Eliminar política anterior solo para admins
DROP POLICY IF EXISTS "Admins can create conversations" ON public.conversaciones;

-- Permitir que cualquier usuario autenticado cree conversaciones donde el campo creado_por sea su propio id
CREATE POLICY "Authenticated users can create conversations"
ON public.conversaciones FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND creado_por = auth.uid()
);
