-- Habilitar RLS en la tabla conversaciones (fue deshabilitado anteriormente)
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;

-- Permitir que todos los usuarios autenticados vean conversaciones donde son participantes
CREATE POLICY "Users can view their conversations"
ON public.conversaciones
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.conversacion_participantes 
    WHERE conversacion_participantes.conversacion_id = conversaciones.id 
    AND conversacion_participantes.user_id = auth.uid()
  )
);

-- Permitir que usuarios autenticados creen nuevas conversaciones
CREATE POLICY "Authenticated users can create conversations"
ON public.conversaciones
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Permitir actualizar conversaciones donde el usuario es participante
CREATE POLICY "Users can update their conversations"
ON public.conversaciones
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM public.conversacion_participantes 
    WHERE conversacion_participantes.conversacion_id = conversaciones.id 
    AND conversacion_participantes.user_id = auth.uid()
  )
);

-- Permitir eliminar conversaciones donde el usuario es participante
CREATE POLICY "Users can delete their conversations"
ON public.conversaciones
FOR DELETE
USING (
  EXISTS (
    SELECT 1 
    FROM public.conversacion_participantes 
    WHERE conversacion_participantes.conversacion_id = conversaciones.id 
    AND conversacion_participantes.user_id = auth.uid()
  )
);