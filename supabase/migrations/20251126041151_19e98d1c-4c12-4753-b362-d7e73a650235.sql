-- Reiniciar completamente las políticas de RLS en conversaciones
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversaciones;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversaciones;
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversaciones;
DROP POLICY IF EXISTS "Admins can delete conversations" ON public.conversaciones;

-- Política para INSERT: cualquier usuario autenticado puede crear
CREATE POLICY "Users can create conversations"
ON public.conversaciones FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Política para SELECT: ver solo conversaciones donde es participante
CREATE POLICY "Users can view their conversations"
ON public.conversaciones FOR SELECT
USING (public.es_participante_conversacion(auth.uid(), id));

-- Política para UPDATE: solo el creador o admin pueden actualizar
CREATE POLICY "Users can update their conversations"
ON public.conversaciones FOR UPDATE
USING (
  creado_por = auth.uid() OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  creado_por = auth.uid() OR public.has_role(auth.uid(), 'admin')
);

-- Política para DELETE: solo admin puede borrar
CREATE POLICY "Admins can delete conversations"
ON public.conversaciones FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));