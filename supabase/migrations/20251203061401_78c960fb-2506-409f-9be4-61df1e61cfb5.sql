-- Crear tabla para tokens de dispositivos móviles (push notifications)
CREATE TABLE public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Índices para búsquedas eficientes
CREATE INDEX idx_device_tokens_user_id ON public.device_tokens(user_id);
CREATE INDEX idx_device_tokens_platform ON public.device_tokens(platform);

-- Habilitar RLS
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Política: usuarios pueden gestionar sus propios tokens
CREATE POLICY "Users can manage own device tokens"
ON public.device_tokens
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política: admins pueden ver todos los tokens (para debugging)
CREATE POLICY "Admins can view all device tokens"
ON public.device_tokens
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para actualizar updated_at
CREATE TRIGGER update_device_tokens_updated_at
BEFORE UPDATE ON public.device_tokens
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();