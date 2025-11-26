-- Actualizar el check constraint para incluir licencia_conducir
ALTER TABLE empleados_documentos 
DROP CONSTRAINT IF EXISTS empleados_documentos_tipo_documento_check;

ALTER TABLE empleados_documentos 
ADD CONSTRAINT empleados_documentos_tipo_documento_check 
CHECK (tipo_documento IN (
  'contrato_laboral',
  'ine',
  'licencia_conducir',
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
));