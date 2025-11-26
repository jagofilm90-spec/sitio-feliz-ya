-- Crear tabla para documentos pendientes/faltantes
CREATE TABLE public.empleados_documentos_pendientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL CHECK (tipo_documento IN (
    'contrato_laboral',
    'ine',
    'carta_seguro_social',
    'constancia_situacion_fiscal',
    'acta_nacimiento',
    'comprobante_domicilio',
    'curp',
    'rfc',
    'carta_renuncia',
    'carta_despido',
    'comprobante_finiquito',
    'otro'
  )),
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.empleados_documentos_pendientes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para documentos pendientes
CREATE POLICY "Admins y secretarias pueden gestionar documentos pendientes"
  ON public.empleados_documentos_pendientes
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Todos los usuarios autenticados pueden ver documentos pendientes"
  ON public.empleados_documentos_pendientes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.empleados_documentos_pendientes IS 'Documentos que faltan por entregar de cada empleado';