-- Crear bucket para archivos del chat
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-archivos', 'chat-archivos', true);

-- Políticas para el bucket de archivos del chat
-- Permitir a usuarios autenticados subir archivos
CREATE POLICY "Usuarios pueden subir archivos al chat"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-archivos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Permitir a todos ver archivos (ya que el bucket es público)
CREATE POLICY "Todos pueden ver archivos del chat"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'chat-archivos');

-- Permitir a usuarios eliminar sus propios archivos
CREATE POLICY "Usuarios pueden eliminar sus archivos del chat"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-archivos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Agregar campos para archivos adjuntos en la tabla mensajes
ALTER TABLE public.mensajes
ADD COLUMN archivo_url TEXT,
ADD COLUMN archivo_nombre TEXT,
ADD COLUMN archivo_tipo TEXT;