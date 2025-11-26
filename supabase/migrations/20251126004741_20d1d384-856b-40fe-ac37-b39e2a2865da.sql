-- Create storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('empleados-documentos', 'empleados-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload employee documents
CREATE POLICY "Authenticated users can upload employee documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'empleados-documentos');

-- Allow authenticated users to view employee documents
CREATE POLICY "Authenticated users can view employee documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'empleados-documentos');

-- Allow authenticated users to update employee documents
CREATE POLICY "Authenticated users can update employee documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'empleados-documentos');

-- Allow authenticated users to delete employee documents
CREATE POLICY "Authenticated users can delete employee documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'empleados-documentos');