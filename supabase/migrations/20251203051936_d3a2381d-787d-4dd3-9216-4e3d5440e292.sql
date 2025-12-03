-- Add logo_url field to clientes table for client portal personalization
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS logo_url text;