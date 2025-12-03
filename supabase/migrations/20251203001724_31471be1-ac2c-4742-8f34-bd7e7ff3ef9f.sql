-- Add 'por_autorizar' to the order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'por_autorizar' BEFORE 'pendiente';