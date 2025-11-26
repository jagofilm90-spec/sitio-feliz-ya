-- Desactivar RLS en conversaciones de forma permanente para evitar bloqueos al crear chats
ALTER TABLE public.conversaciones DISABLE ROW LEVEL SECURITY;