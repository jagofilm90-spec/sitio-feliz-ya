-- Change chat-archivos bucket from public to private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'chat-archivos';