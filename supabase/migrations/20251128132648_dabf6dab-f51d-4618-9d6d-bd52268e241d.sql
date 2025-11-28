-- Tabla para firmas de correo por cuenta
CREATE TABLE public.gmail_firmas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_cuenta_id UUID NOT NULL REFERENCES public.gmail_cuentas(id) ON DELETE CASCADE,
  firma_html TEXT NOT NULL DEFAULT '',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(gmail_cuenta_id)
);

-- Enable RLS
ALTER TABLE public.gmail_firmas ENABLE ROW LEVEL SECURITY;

-- Políticas usando la función con el orden correcto de parámetros
CREATE POLICY "Admins pueden ver todas las firmas"
  ON public.gmail_firmas FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins pueden crear firmas"
  ON public.gmail_firmas FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins pueden actualizar firmas"
  ON public.gmail_firmas FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Usuarios con permiso pueden ver firmas de sus cuentas"
  ON public.gmail_firmas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.gmail_cuenta_permisos p
      WHERE p.gmail_cuenta_id = gmail_firmas.gmail_cuenta_id
      AND p.user_id = auth.uid()
    )
  );

-- Índice
CREATE INDEX idx_gmail_firmas_cuenta ON public.gmail_firmas(gmail_cuenta_id);