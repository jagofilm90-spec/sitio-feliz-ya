-- Hacer la dirección opcional para permitir guardar solo con código y nombre
ALTER TABLE public.cliente_sucursales ALTER COLUMN direccion DROP NOT NULL;