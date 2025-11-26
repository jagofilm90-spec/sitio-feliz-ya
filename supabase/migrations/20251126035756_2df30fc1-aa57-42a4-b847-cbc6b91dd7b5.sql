-- Eliminar políticas problemáticas
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversaciones;
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversacion_participantes;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.mensajes;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.mensajes;

-- Crear función para verificar si un usuario es participante de una conversación
CREATE OR REPLACE FUNCTION public.es_participante_conversacion(_user_id uuid, _conversacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversacion_participantes
    WHERE user_id = _user_id
      AND conversacion_id = _conversacion_id
  )
$$;

-- Recrear políticas usando la función security definer

-- Política para conversaciones
CREATE POLICY "Users can view their conversations"
ON public.conversaciones FOR SELECT
USING (public.es_participante_conversacion(auth.uid(), id));

-- Política para participantes
CREATE POLICY "Users can view participants in their conversations"
ON public.conversacion_participantes FOR SELECT
USING (public.es_participante_conversacion(auth.uid(), conversacion_id));

-- Políticas para mensajes
CREATE POLICY "Users can view messages in their conversations"
ON public.mensajes FOR SELECT
USING (public.es_participante_conversacion(auth.uid(), conversacion_id));

CREATE POLICY "Users can send messages to their conversations"
ON public.mensajes FOR INSERT
WITH CHECK (
  public.es_participante_conversacion(auth.uid(), conversacion_id)
  AND remitente_id = auth.uid()
);