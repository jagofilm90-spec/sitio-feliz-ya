-- Add vehicle document fields
ALTER TABLE public.vehiculos
ADD COLUMN IF NOT EXISTS numero_serie VARCHAR(50),
ADD COLUMN IF NOT EXISTS tipo_combustible VARCHAR(20) DEFAULT 'diesel',
ADD COLUMN IF NOT EXISTS tarjeta_circulacion_url TEXT,
ADD COLUMN IF NOT EXISTS tarjeta_circulacion_vencimiento DATE,
ADD COLUMN IF NOT EXISTS poliza_seguro_url TEXT,
ADD COLUMN IF NOT EXISTS poliza_seguro_vencimiento DATE;

-- Create storage bucket for vehicle documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehiculos-documentos', 'vehiculos-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for vehicle documents bucket
CREATE POLICY "Admins y secretarias pueden gestionar documentos vehiculos"
ON storage.objects FOR ALL
USING (
  bucket_id = 'vehiculos-documentos' 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria'))
);

CREATE POLICY "Usuarios autenticados pueden ver documentos vehiculos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'vehiculos-documentos' 
  AND auth.uid() IS NOT NULL
);