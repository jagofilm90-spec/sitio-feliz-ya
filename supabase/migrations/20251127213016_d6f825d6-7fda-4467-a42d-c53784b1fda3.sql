-- Add mileage tracking fields to rutas table
ALTER TABLE public.rutas
ADD COLUMN kilometraje_inicial numeric NULL,
ADD COLUMN kilometraje_final numeric NULL,
ADD COLUMN kilometros_recorridos numeric GENERATED ALWAYS AS (COALESCE(kilometraje_final, 0) - COALESCE(kilometraje_inicial, 0)) STORED,
ADD COLUMN fecha_hora_inicio timestamp with time zone NULL,
ADD COLUMN fecha_hora_fin timestamp with time zone NULL;

-- Create table for vehicle maintenance tracking based on mileage
CREATE TABLE public.vehiculos_mantenimientos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehiculo_id uuid NOT NULL REFERENCES public.vehiculos(id) ON DELETE CASCADE,
  tipo_mantenimiento text NOT NULL,
  kilometraje_actual numeric NOT NULL,
  kilometraje_proximo numeric NULL,
  fecha_mantenimiento timestamp with time zone NOT NULL DEFAULT now(),
  notas text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehiculos_mantenimientos ENABLE ROW LEVEL SECURITY;

-- RLS policies for vehicle maintenance
CREATE POLICY "Admins y secretarias pueden gestionar mantenimientos"
ON public.vehiculos_mantenimientos
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Todos los usuarios autenticados pueden ver mantenimientos"
ON public.vehiculos_mantenimientos
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add policy for choferes to update mileage on their routes
CREATE POLICY "Choferes can update mileage on their routes"
ON public.rutas
FOR UPDATE
USING (has_role(auth.uid(), 'chofer'::app_role) AND chofer_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'chofer'::app_role) AND chofer_id = auth.uid());