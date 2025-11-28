-- Add optional fiscal fields to cliente_sucursales for per-branch invoicing
ALTER TABLE public.cliente_sucursales
ADD COLUMN rfc text,
ADD COLUMN razon_social text,
ADD COLUMN direccion_fiscal text,
ADD COLUMN email_facturacion text;

-- Add comment explaining the usage
COMMENT ON COLUMN public.cliente_sucursales.rfc IS 'RFC for invoicing this specific branch. If null, use parent client RFC.';
COMMENT ON COLUMN public.cliente_sucursales.razon_social IS 'Business name for invoicing this branch. If null, use parent client razon_social.';
COMMENT ON COLUMN public.cliente_sucursales.direccion_fiscal IS 'Fiscal address for invoicing this branch. If null, use parent client direccion.';
COMMENT ON COLUMN public.cliente_sucursales.email_facturacion IS 'Email for sending invoices to this branch. If null, use parent client email.';