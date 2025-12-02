-- Agregar campos de dirección fiscal detallada basados en la CSF del SAT
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS regimen_capital text,
ADD COLUMN IF NOT EXISTS codigo_postal text,
ADD COLUMN IF NOT EXISTS tipo_vialidad text,
ADD COLUMN IF NOT EXISTS nombre_vialidad text,
ADD COLUMN IF NOT EXISTS numero_exterior text,
ADD COLUMN IF NOT EXISTS numero_interior text,
ADD COLUMN IF NOT EXISTS nombre_colonia text,
ADD COLUMN IF NOT EXISTS nombre_localidad text,
ADD COLUMN IF NOT EXISTS nombre_municipio text,
ADD COLUMN IF NOT EXISTS nombre_entidad_federativa text,
ADD COLUMN IF NOT EXISTS entre_calle text,
ADD COLUMN IF NOT EXISTS y_calle text,
ADD COLUMN IF NOT EXISTS csf_archivo_url text;

-- Crear bucket para archivos de CSF
INSERT INTO storage.buckets (id, name, public)
VALUES ('clientes-csf', 'clientes-csf', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para CSF
CREATE POLICY "Admin y secretarias pueden ver CSF"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'clientes-csf' 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role))
);

CREATE POLICY "Admin y secretarias pueden subir CSF"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'clientes-csf' 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role))
);

CREATE POLICY "Admin y secretarias pueden eliminar CSF"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'clientes-csf' 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role))
);