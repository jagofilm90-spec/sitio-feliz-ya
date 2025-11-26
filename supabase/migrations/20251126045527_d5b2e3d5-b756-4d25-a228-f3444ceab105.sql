-- Eliminar todas las políticas de conversaciones (ya no las necesitamos sin RLS)
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversaciones;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversaciones;
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversaciones;
DROP POLICY IF EXISTS "Users can delete their conversations" ON public.conversaciones;