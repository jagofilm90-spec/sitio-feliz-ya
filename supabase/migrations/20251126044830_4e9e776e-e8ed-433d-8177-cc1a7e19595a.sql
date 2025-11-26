-- Permitir que todos los usuarios autenticados vean los perfiles (para mostrar nombres en el chat)
CREATE POLICY "Authenticated users can view all profiles in chat"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);