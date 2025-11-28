-- Enable Row Level Security on conversaciones table
-- This table contains internal company chat conversations
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;

-- Enable Row Level Security on cliente_sucursales table
-- This table contains customer PII (phone, RFC, addresses, fiscal data)
ALTER TABLE public.cliente_sucursales ENABLE ROW LEVEL SECURITY;