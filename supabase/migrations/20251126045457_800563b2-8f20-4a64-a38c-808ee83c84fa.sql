-- Volver a desactivar RLS en conversaciones para evitar bloqueos al crear chats
ALTER TABLE public.conversaciones DISABLE ROW LEVEL SECURITY;