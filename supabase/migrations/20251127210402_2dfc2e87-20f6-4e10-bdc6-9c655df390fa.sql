-- Create vehiculos table for fleet management
CREATE TABLE public.vehiculos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'camioneta',
  placa TEXT,
  peso_maximo_kg NUMERIC NOT NULL DEFAULT 7800,
  status TEXT NOT NULL DEFAULT 'disponible',
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create zonas table for geographic zones
CREATE TABLE public.zonas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add zona_id to clientes table
ALTER TABLE public.clientes 
ADD COLUMN zona_id UUID REFERENCES public.zonas(id);

-- Add peso_total_kg to pedidos for weight tracking
ALTER TABLE public.pedidos
ADD COLUMN peso_total_kg NUMERIC DEFAULT 0;

-- Add vehiculo_id to rutas table
ALTER TABLE public.rutas
ADD COLUMN vehiculo_id UUID REFERENCES public.vehiculos(id);

-- Add peso_total_kg to rutas for capacity tracking
ALTER TABLE public.rutas
ADD COLUMN peso_total_kg NUMERIC DEFAULT 0;

-- Enable RLS on vehiculos
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;

-- RLS policies for vehiculos
CREATE POLICY "Admins y secretarias pueden gestionar vehiculos" 
ON public.vehiculos 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Todos los usuarios autenticados pueden ver vehiculos" 
ON public.vehiculos 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Enable RLS on zonas
ALTER TABLE public.zonas ENABLE ROW LEVEL SECURITY;

-- RLS policies for zonas
CREATE POLICY "Admins y secretarias pueden gestionar zonas" 
ON public.zonas 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Todos los usuarios autenticados pueden ver zonas" 
ON public.zonas 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at on vehiculos
CREATE TRIGGER update_vehiculos_updated_at
BEFORE UPDATE ON public.vehiculos
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Insert some common zones for Mexico City area
INSERT INTO public.zonas (nombre) VALUES 
('Gustavo A. Madero'),
('Azcapotzalco'),
('Cuauhtémoc'),
('Miguel Hidalgo'),
('Venustiano Carranza'),
('Iztacalco'),
('Iztapalapa'),
('Coyoacán'),
('Benito Juárez'),
('Álvaro Obregón'),
('Tlalpan'),
('Xochimilco'),
('Milpa Alta'),
('Tláhuac'),
('Magdalena Contreras'),
('Cuajimalpa'),
('Estado de México'),
('Morelos'),
('Puebla'),
('Querétaro'),
('Hidalgo');