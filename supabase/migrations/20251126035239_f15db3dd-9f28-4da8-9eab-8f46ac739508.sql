-- Crear enum para tipos de conversación
CREATE TYPE conversation_type AS ENUM ('individual', 'grupo_personalizado', 'grupo_puesto', 'broadcast');

-- Tabla de conversaciones
CREATE TABLE public.conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo conversation_type NOT NULL,
  nombre TEXT,
  puesto TEXT, -- Para grupos por puesto (Chofer, Vendedor, etc.)
  creado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de participantes
CREATE TABLE public.conversacion_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID REFERENCES public.conversaciones(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ultimo_mensaje_leido_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(conversacion_id, user_id)
);

-- Tabla de mensajes
CREATE TABLE public.mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID REFERENCES public.conversaciones(id) ON DELETE CASCADE NOT NULL,
  remitente_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contenido TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversacion_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;

-- Políticas para conversaciones
-- Los usuarios pueden ver conversaciones donde son participantes
CREATE POLICY "Users can view their conversations"
ON public.conversaciones FOR SELECT
USING (
  id IN (
    SELECT conversacion_id 
    FROM public.conversacion_participantes 
    WHERE user_id = auth.uid()
  )
);

-- Solo admins pueden crear conversaciones
CREATE POLICY "Admins can create conversations"
ON public.conversaciones FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Solo admins pueden actualizar conversaciones
CREATE POLICY "Admins can update conversations"
ON public.conversaciones FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para participantes
-- Los usuarios pueden ver los participantes de sus conversaciones
CREATE POLICY "Users can view participants in their conversations"
ON public.conversacion_participantes FOR SELECT
USING (
  conversacion_id IN (
    SELECT conversacion_id 
    FROM public.conversacion_participantes 
    WHERE user_id = auth.uid()
  )
);

-- Solo admins pueden agregar participantes
CREATE POLICY "Admins can manage participants"
ON public.conversacion_participantes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Los usuarios pueden actualizar su propio estado de lectura
CREATE POLICY "Users can update their own read status"
ON public.conversacion_participantes FOR UPDATE
USING (user_id = auth.uid());

-- Políticas para mensajes
-- Los usuarios pueden ver mensajes de sus conversaciones
CREATE POLICY "Users can view messages in their conversations"
ON public.mensajes FOR SELECT
USING (
  conversacion_id IN (
    SELECT conversacion_id 
    FROM public.conversacion_participantes 
    WHERE user_id = auth.uid()
  )
);

-- Los usuarios pueden enviar mensajes a sus conversaciones
CREATE POLICY "Users can send messages to their conversations"
ON public.mensajes FOR INSERT
WITH CHECK (
  conversacion_id IN (
    SELECT conversacion_id 
    FROM public.conversacion_participantes 
    WHERE user_id = auth.uid()
  )
  AND remitente_id = auth.uid()
);

-- Trigger para actualizar updated_at en conversaciones
CREATE TRIGGER update_conversaciones_updated_at
BEFORE UPDATE ON public.conversaciones
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_mensajes_conversacion_id ON public.mensajes(conversacion_id);
CREATE INDEX idx_mensajes_created_at ON public.mensajes(created_at DESC);
CREATE INDEX idx_participantes_user_id ON public.conversacion_participantes(user_id);
CREATE INDEX idx_participantes_conversacion_id ON public.conversacion_participantes(conversacion_id);

-- Habilitar realtime para mensajes
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes;