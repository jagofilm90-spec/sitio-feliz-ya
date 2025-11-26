-- Ver las políticas actuales y recrearlas correctamente

-- Eliminar todas las políticas de conversaciones para empezar de cero
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversaciones;
DROP POLICY IF EXISTS "Admins can create conversations" ON public.conversaciones;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversaciones;
DROP POLICY IF EXISTS "Admins can update conversations" ON public.conversaciones;

-- Crear política simple para INSERT - cualquier usuario autenticado puede insertar
CREATE POLICY "Users can create conversations"
ON public.conversaciones FOR INSERT
TO authenticated
WITH CHECK (true);

-- Crear política para SELECT - los usuarios pueden ver conversaciones donde son participantes
CREATE POLICY "Users can view their conversations"
ON public.conversaciones FOR SELECT
TO authenticated
USING (public.es_participante_conversacion(auth.uid(), id));

-- Crear política para UPDATE - solo admins y el creador pueden actualizar
CREATE POLICY "Users can update their conversations"
ON public.conversaciones FOR UPDATE
TO authenticated
USING (
  creado_por = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Crear política para DELETE - solo admins pueden eliminar
CREATE POLICY "Admins can delete conversations"
ON public.conversaciones FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));