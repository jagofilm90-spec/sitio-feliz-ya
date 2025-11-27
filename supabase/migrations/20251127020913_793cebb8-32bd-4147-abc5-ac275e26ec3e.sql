-- Drop existing trigger first
DROP TRIGGER IF EXISTS update_stock_on_movement ON public.inventario_movimientos;

-- Recreate the function to handle both INSERT and DELETE
CREATE OR REPLACE FUNCTION public.update_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Handle INSERT: Add or subtract based on movement type
    IF TG_OP = 'INSERT' THEN
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
    END IF;

    -- Handle DELETE: Revert the stock change
    IF TG_OP = 'DELETE' THEN
        IF OLD.tipo_movimiento = 'entrada' OR OLD.tipo_movimiento = 'ajuste' THEN
            -- Revert entrada/ajuste by subtracting
            UPDATE public.productos
            SET stock_actual = stock_actual - OLD.cantidad
            WHERE id = OLD.producto_id;
        ELSIF OLD.tipo_movimiento = 'salida' THEN
            -- Revert salida by adding back
            UPDATE public.productos
            SET stock_actual = stock_actual + OLD.cantidad
            WHERE id = OLD.producto_id;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$function$;

-- Create trigger for both INSERT and DELETE
CREATE TRIGGER update_stock_on_movement
    AFTER INSERT OR DELETE ON public.inventario_movimientos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_product_stock();