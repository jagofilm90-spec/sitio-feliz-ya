-- Table to store Gmail account configurations and OAuth tokens
CREATE TABLE public.gmail_cuentas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  proposito TEXT NOT NULL, -- 'pedidos', 'general', 'facturas_proveedores', 'banca'
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gmail_cuentas ENABLE ROW LEVEL SECURITY;

-- Only admins can manage Gmail accounts
CREATE POLICY "Admins can manage Gmail accounts"
ON public.gmail_cuentas
FOR ALL
USING (
  has_role(auth.uid(), 'admin')
);

-- Trigger for updated_at using existing function
CREATE TRIGGER update_gmail_cuentas_updated_at
BEFORE UPDATE ON public.gmail_cuentas
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();