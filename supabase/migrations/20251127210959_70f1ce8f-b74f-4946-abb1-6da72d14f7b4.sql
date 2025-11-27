-- Rename peso_maximo_kg to peso_maximo_local_kg and add peso_maximo_foraneo_kg
ALTER TABLE public.vehiculos 
RENAME COLUMN peso_maximo_kg TO peso_maximo_local_kg;

ALTER TABLE public.vehiculos 
ADD COLUMN peso_maximo_foraneo_kg NUMERIC NOT NULL DEFAULT 7000;

-- Add tipo_ruta to rutas table (local or foranea)
ALTER TABLE public.rutas
ADD COLUMN tipo_ruta TEXT NOT NULL DEFAULT 'local';

-- Update existing vehicles with reasonable foráneo defaults
UPDATE public.vehiculos SET peso_maximo_foraneo_kg = peso_maximo_local_kg * 0.9;