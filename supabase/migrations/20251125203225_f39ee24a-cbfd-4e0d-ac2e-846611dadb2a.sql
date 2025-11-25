-- Agregar rol 'cliente' al enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'cliente';

-- Agregar user_id a la tabla clientes para vincular con auth
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON public.clientes(user_id);

-- Actualizar RLS policies para pedidos - clientes pueden ver sus propios pedidos
DROP POLICY IF EXISTS "Clientes can view their own orders" ON public.pedidos;
CREATE POLICY "Clientes can view their own orders" 
ON public.pedidos 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.clientes 
    WHERE clientes.id = pedidos.cliente_id 
    AND clientes.user_id = auth.uid()
  )
);

-- Clientes pueden crear sus propios pedidos
DROP POLICY IF EXISTS "Clientes can create their own orders" ON public.pedidos;
CREATE POLICY "Clientes can create their own orders" 
ON public.pedidos 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes 
    WHERE clientes.id = pedidos.cliente_id 
    AND clientes.user_id = auth.uid()
  )
);

-- Actualizar RLS policies para pedidos_detalles - clientes pueden ver detalles de sus pedidos
DROP POLICY IF EXISTS "Clientes can view their order details" ON public.pedidos_detalles;
CREATE POLICY "Clientes can view their order details" 
ON public.pedidos_detalles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.pedidos p
    JOIN public.clientes c ON p.cliente_id = c.id
    WHERE p.id = pedidos_detalles.pedido_id 
    AND c.user_id = auth.uid()
  )
);

-- Clientes pueden crear detalles para sus propios pedidos
DROP POLICY IF EXISTS "Clientes can create their order details" ON public.pedidos_detalles;
CREATE POLICY "Clientes can create their order details" 
ON public.pedidos_detalles 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pedidos p
    JOIN public.clientes c ON p.cliente_id = c.id
    WHERE p.id = pedidos_detalles.pedido_id 
    AND c.user_id = auth.uid()
  )
);

-- Actualizar RLS policies para facturas - clientes pueden ver sus propias facturas
DROP POLICY IF EXISTS "Clientes can view their own invoices" ON public.facturas;
CREATE POLICY "Clientes can view their own invoices" 
ON public.facturas 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.clientes 
    WHERE clientes.id = facturas.cliente_id 
    AND clientes.user_id = auth.uid()
  )
);

-- Actualizar RLS policies para entregas - clientes pueden ver sus propias entregas
DROP POLICY IF EXISTS "Clientes can view their own deliveries" ON public.entregas;
CREATE POLICY "Clientes can view their own deliveries" 
ON public.entregas 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.pedidos p
    JOIN public.clientes c ON p.cliente_id = c.id
    WHERE p.id = entregas.pedido_id 
    AND c.user_id = auth.uid()
  )
);

-- Clientes pueden ver su propia información
DROP POLICY IF EXISTS "Clientes can view their own data" ON public.clientes;
CREATE POLICY "Clientes can view their own data" 
ON public.clientes 
FOR SELECT 
USING (user_id = auth.uid());

-- Función helper para obtener el cliente_id del usuario actual
CREATE OR REPLACE FUNCTION public.get_cliente_id_for_user(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.clientes WHERE user_id = user_uuid LIMIT 1;
$$;