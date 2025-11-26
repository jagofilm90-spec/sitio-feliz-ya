-- Crear tabla de empleados
CREATE TABLE public.empleados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre_completo TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
  puesto TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para empleados
CREATE POLICY "Admins y secretarias pueden gestionar empleados"
  ON public.empleados
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Todos los usuarios autenticados pueden ver empleados"
  ON public.empleados
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_empleados_updated_at
  BEFORE UPDATE ON public.empleados
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Crear bucket de storage para documentos de empleados
INSERT INTO storage.buckets (id, name, public)
VALUES ('empleados-documentos', 'empleados-documentos', false);

-- Políticas de storage para documentos de empleados
CREATE POLICY "Admins y secretarias pueden subir documentos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'empleados-documentos' AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role))
  );

CREATE POLICY "Admins y secretarias pueden ver documentos"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'empleados-documentos' AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role))
  );

CREATE POLICY "Admins y secretarias pueden eliminar documentos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'empleados-documentos' AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role))
  );

-- Crear tabla de documentos de empleados
CREATE TABLE public.empleados_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL CHECK (tipo_documento IN ('identificacion', 'contrato', 'otro')),
  nombre_archivo TEXT NOT NULL,
  ruta_storage TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.empleados_documentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para documentos
CREATE POLICY "Admins y secretarias pueden gestionar documentos"
  ON public.empleados_documentos
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Todos los usuarios autenticados pueden ver documentos"
  ON public.empleados_documentos
  FOR SELECT
  USING (auth.uid() IS NOT NULL);