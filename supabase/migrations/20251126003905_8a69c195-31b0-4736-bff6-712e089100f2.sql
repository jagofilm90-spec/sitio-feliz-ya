-- Agregar campos para gestión de bajas de empleados
ALTER TABLE public.empleados 
ADD COLUMN fecha_baja DATE,
ADD COLUMN motivo_baja TEXT CHECK (motivo_baja IN ('renuncia', 'despido', 'abandono'));

-- Actualizar constraint de tipos de documentos para incluir documentos de baja
ALTER TABLE public.empleados_documentos 
DROP CONSTRAINT IF EXISTS empleados_documentos_tipo_documento_check;

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
  'carta_renuncia',
  'carta_despido',
  'comprobante_finiquito',
  'otro'
));

-- Comentarios para documentación
COMMENT ON COLUMN public.empleados.fecha_baja IS 'Fecha en que el empleado dejó de trabajar';
COMMENT ON COLUMN public.empleados.motivo_baja IS 'Motivo de baja: renuncia, despido o abandono';