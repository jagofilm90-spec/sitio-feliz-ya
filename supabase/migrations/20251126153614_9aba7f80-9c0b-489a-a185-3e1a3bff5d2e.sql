-- Agregar campos individuales de identificación y contacto de emergencia
ALTER TABLE public.empleados 
  ADD COLUMN IF NOT EXISTS nombre TEXT,
  ADD COLUMN IF NOT EXISTS primer_apellido TEXT,
  ADD COLUMN IF NOT EXISTS segundo_apellido TEXT,
  ADD COLUMN IF NOT EXISTS rfc TEXT,
  ADD COLUMN IF NOT EXISTS curp TEXT,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre TEXT,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono TEXT,
  ADD COLUMN IF NOT EXISTS tipo_sangre TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil TEXT,
  ADD COLUMN IF NOT EXISTS numero_dependientes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nivel_estudios TEXT,
  ADD COLUMN IF NOT EXISTS cuenta_bancaria TEXT,
  ADD COLUMN IF NOT EXISTS clabe_interbancaria TEXT;

-- Comentario explicativo de los nuevos campos
COMMENT ON COLUMN public.empleados.nombre IS 'Nombre(s) del empleado';
COMMENT ON COLUMN public.empleados.primer_apellido IS 'Primer apellido (paterno)';
COMMENT ON COLUMN public.empleados.segundo_apellido IS 'Segundo apellido (materno)';
COMMENT ON COLUMN public.empleados.rfc IS 'Registro Federal de Contribuyentes';
COMMENT ON COLUMN public.empleados.curp IS 'Clave Única de Registro de Población';
COMMENT ON COLUMN public.empleados.fecha_nacimiento IS 'Fecha de nacimiento del empleado';
COMMENT ON COLUMN public.empleados.contacto_emergencia_nombre IS 'Nombre completo del contacto de emergencia';
COMMENT ON COLUMN public.empleados.contacto_emergencia_telefono IS 'Teléfono del contacto de emergencia';
COMMENT ON COLUMN public.empleados.tipo_sangre IS 'Tipo de sangre (A+, O-, etc.)';
COMMENT ON COLUMN public.empleados.estado_civil IS 'Estado civil: soltero, casado, divorciado, viudo, unión libre';
COMMENT ON COLUMN public.empleados.numero_dependientes IS 'Número de dependientes económicos';
COMMENT ON COLUMN public.empleados.nivel_estudios IS 'Nivel de estudios: primaria, secundaria, preparatoria, técnico, licenciatura, posgrado';
COMMENT ON COLUMN public.empleados.cuenta_bancaria IS 'Número de cuenta bancaria para depósito de nómina';
COMMENT ON COLUMN public.empleados.clabe_interbancaria IS 'CLABE interbancaria para transferencias';