-- Create RLS policies for the private chat-archivos bucket
-- Users can view files in conversations they participate in
CREATE POLICY "Authenticated users can view chat files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-archivos' 
  AND auth.uid() IS NOT NULL
);

-- Users can upload files to their own folder
CREATE POLICY "Users can upload their own chat files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-archivos' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own files
CREATE POLICY "Users can delete their own chat files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-archivos' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);