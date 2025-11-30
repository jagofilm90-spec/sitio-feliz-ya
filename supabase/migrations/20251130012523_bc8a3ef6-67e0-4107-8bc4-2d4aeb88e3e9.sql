
-- Create enum for billing preference
CREATE TYPE public.preferencia_facturacion AS ENUM ('siempre_factura', 'siempre_remision', 'variable');

-- Add billing preference to clientes
ALTER TABLE public.clientes
ADD COLUMN preferencia_facturacion public.preferencia_facturacion NOT NULL DEFAULT 'variable';

-- Add invoice tracking fields to pedidos
ALTER TABLE public.pedidos
ADD COLUMN requiere_factura boolean NOT NULL DEFAULT false,
ADD COLUMN facturado boolean NOT NULL DEFAULT false,
ADD COLUMN factura_enviada_al_cliente boolean NOT NULL DEFAULT false,
ADD COLUMN fecha_factura_enviada timestamp with time zone,
ADD COLUMN factura_solicitada_por_cliente boolean NOT NULL DEFAULT false,
ADD COLUMN datos_fiscales_factura jsonb;

-- Add comment explaining the jsonb structure (used only when client requests invoice from portal with custom data)
COMMENT ON COLUMN public.pedidos.datos_fiscales_factura IS 'Used when client requests invoice from portal: {rfc, razon_social, direccion_fiscal, email_factura, regimen_fiscal, uso_cfdi}. For internal orders, fiscal data comes from cliente/sucursal record.';
