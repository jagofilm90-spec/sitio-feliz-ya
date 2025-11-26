-- Eliminar la política de INSERT anterior que está causando problemas
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversaciones;

-- Crear una política de INSERT más permisiva que permita a cualquier usuario autenticado crear conversaciones
CREATE POLICY "Authenticated users can create conversations"
ON public.conversaciones
FOR INSERT
WITH CHECK (creado_por = auth.uid());