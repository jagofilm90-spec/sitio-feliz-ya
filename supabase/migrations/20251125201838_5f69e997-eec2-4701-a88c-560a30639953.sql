-- Fix search_path for security functions
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_product_stock()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.tipo_movimiento = 'entrada' OR NEW.tipo_movimiento = 'ajuste' THEN
        UPDATE public.productos
        SET stock_actual = stock_actual + NEW.cantidad
        WHERE id = NEW.producto_id;
    ELSIF NEW.tipo_movimiento = 'salida' THEN
        UPDATE public.productos
        SET stock_actual = stock_actual - NEW.cantidad
        WHERE id = NEW.producto_id;
    END IF;
    RETURN NEW;
END;
$$;