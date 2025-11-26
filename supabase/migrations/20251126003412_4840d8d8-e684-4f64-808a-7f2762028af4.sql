-- Agregar campos de nómina a empleados
ALTER TABLE public.empleados 
ADD COLUMN numero_seguro_social TEXT,
ADD COLUMN sueldo_bruto NUMERIC(10, 2),
ADD COLUMN periodo_pago TEXT CHECK (periodo_pago IN ('semanal', 'quincenal'));

-- Comentarios para documentación
COMMENT ON COLUMN public.empleados.numero_seguro_social IS 'Número de seguro social del empleado';
COMMENT ON COLUMN public.empleados.sueldo_bruto IS 'Sueldo bruto del empleado';
COMMENT ON COLUMN public.empleados.periodo_pago IS 'Periodo de pago: semanal o quincenal';