-- Permitir a los usuarios crear participantes cuando crean conversaciones
DROP POLICY IF EXISTS "Users can create participants for new conversations" ON public.conversacion_participantes;

CREATE POLICY "Users can create participants for new conversations"
ON public.conversacion_participantes FOR INSERT
TO authenticated
WITH CHECK (
  -- El usuario puede agregar participantes si él creó la conversación
  EXISTS (
    SELECT 1 FROM public.conversaciones
    WHERE id = conversacion_id
    AND creado_por = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);