-- Add structured fields for Lecaroz quotation types and periods
ALTER TABLE cotizaciones 
ADD COLUMN IF NOT EXISTS tipo_cotizacion text DEFAULT 'general',
ADD COLUMN IF NOT EXISTS mes_vigencia text;

-- Add comment for documentation
COMMENT ON COLUMN cotizaciones.tipo_cotizacion IS 'Tipo de cotización: avio, azucar, rosticeria, general';
COMMENT ON COLUMN cotizaciones.mes_vigencia IS 'Mes de vigencia en formato YYYY-MM (ej: 2025-01 para enero 2025)';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_cotizaciones_tipo_mes ON cotizaciones(cliente_id, tipo_cotizacion, mes_vigencia);