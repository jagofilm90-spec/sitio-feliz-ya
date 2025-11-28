
-- Table to assign email accounts to users
CREATE TABLE public.gmail_cuenta_permisos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gmail_cuenta_id UUID NOT NULL REFERENCES public.gmail_cuentas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  asignado_por UUID REFERENCES public.profiles(id),
  UNIQUE(user_id, gmail_cuenta_id)
);

-- Enable RLS
ALTER TABLE public.gmail_cuenta_permisos ENABLE ROW LEVEL SECURITY;

-- Admins can manage all permissions
CREATE POLICY "Admins can manage email permissions"
ON public.gmail_cuenta_permisos
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own permissions
CREATE POLICY "Users can view their own email permissions"
ON public.gmail_cuenta_permisos
FOR SELECT
USING (user_id = auth.uid());

-- Table to log email actions (who sent what)
CREATE TABLE public.gmail_auditoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  gmail_cuenta_id UUID NOT NULL REFERENCES public.gmail_cuentas(id),
  accion TEXT NOT NULL, -- 'enviar', 'responder', 'reenviar', 'leer', 'eliminar'
  email_to TEXT,
  email_subject TEXT,
  gmail_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gmail_auditoria ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "Admins can view all email audit logs"
ON public.gmail_auditoria
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert audit logs
CREATE POLICY "Authenticated users can create audit logs"
ON public.gmail_auditoria
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Index for faster queries
CREATE INDEX idx_gmail_cuenta_permisos_user ON public.gmail_cuenta_permisos(user_id);
CREATE INDEX idx_gmail_auditoria_user ON public.gmail_auditoria(user_id);
CREATE INDEX idx_gmail_auditoria_cuenta ON public.gmail_auditoria(gmail_cuenta_id);
