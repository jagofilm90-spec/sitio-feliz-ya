-- Agregar campo nombre a cotizaciones para identificar categorías (ej: "Avio", "Azúcares")
ALTER TABLE public.cotizaciones 
ADD COLUMN nombre text;