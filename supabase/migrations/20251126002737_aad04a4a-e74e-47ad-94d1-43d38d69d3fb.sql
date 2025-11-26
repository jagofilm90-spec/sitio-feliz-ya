-- Eliminar constraint anterior de tipos de documentos
ALTER TABLE public.empleados_documentos 
DROP CONSTRAINT IF EXISTS empleados_documentos_tipo_documento_check;

-- Agregar nuevo constraint con más tipos de documentos
ALTER TABLE public.empleados_documentos 
ADD CONSTRAINT empleados_documentos_tipo_documento_check 
CHECK (tipo_documento IN (
  'contrato_laboral',
  'ine',
  'carta_seguro_social',
  'constancia_situacion_fiscal',
  'acta_nacimiento',
  'comprobante_domicilio',
  'curp',
  'rfc',
  'otro'
));