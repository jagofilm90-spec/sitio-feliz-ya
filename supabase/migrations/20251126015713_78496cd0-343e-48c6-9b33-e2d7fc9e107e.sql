-- Agregar campo fecha_vencimiento a empleados_documentos
ALTER TABLE public.empleados_documentos 
ADD COLUMN fecha_vencimiento DATE;

-- Crear tabla de notificaciones
CREATE TABLE public.notificaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  empleado_id UUID REFERENCES public.empleados(id) ON DELETE CASCADE,
  documento_id UUID REFERENCES public.empleados_documentos(id) ON DELETE CASCADE,
  fecha_vencimiento DATE,
  leida BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en notificaciones
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- Policy para que admins y secretarias gestionen notificaciones
CREATE POLICY "Admins y secretarias pueden gestionar notificaciones"
ON public.notificaciones
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

-- Policy para que todos los usuarios autenticados vean notificaciones
CREATE POLICY "Usuarios autenticados pueden ver notificaciones"
ON public.notificaciones
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Crear índice para mejorar performance en consultas de notificaciones
CREATE INDEX idx_notificaciones_leida ON public.notificaciones(leida);
CREATE INDEX idx_notificaciones_empleado ON public.notificaciones(empleado_id);
CREATE INDEX idx_notificaciones_fecha_vencimiento ON public.notificaciones(fecha_vencimiento);