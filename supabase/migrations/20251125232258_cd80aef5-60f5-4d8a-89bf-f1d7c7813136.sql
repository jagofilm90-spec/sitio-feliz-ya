-- Permitir a los administradores ver todos los perfiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Permitir a los administradores actualizar el campo phone de cualquier perfil
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));