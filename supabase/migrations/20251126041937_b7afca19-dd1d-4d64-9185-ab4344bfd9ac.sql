-- Reactivar RLS y crear políticas correctas
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversaciones;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversaciones;
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversaciones;
DROP POLICY IF EXISTS "Admins can delete conversations" ON public.conversaciones;

-- Política de INSERT: permitir a cualquier usuario autenticado
CREATE POLICY "Allow authenticated users to insert conversations"
ON public.conversaciones FOR INSERT
TO public
WITH CHECK (true);

-- Política de SELECT: ver conversaciones donde es participante
CREATE POLICY "Allow users to view their conversations"
ON public.conversaciones FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.conversacion_participantes
    WHERE conversacion_id = conversaciones.id
    AND user_id = auth.uid()
  )
);

-- Política de UPDATE: el creador o admin puede actualizar
CREATE POLICY "Allow creator or admin to update conversations"
ON public.conversaciones FOR UPDATE
TO public
USING (creado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (creado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Política de DELETE: solo admins
CREATE POLICY "Allow admin to delete conversations"
ON public.conversaciones FOR DELETE
TO public
USING (public.has_role(auth.uid(), 'admin'));