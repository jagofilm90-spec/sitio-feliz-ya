-- Update stock trigger to handle INSERT, UPDATE and DELETE correctly
DROP TRIGGER IF EXISTS update_stock_on_movement ON public.inventario_movimientos;

CREATE OR REPLACE FUNCTION public.update_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Handle INSERT: apply new movement
    IF TG_OP = 'INSERT' THEN
        IF NEW.tipo_movimiento IN ('entrada', 'ajuste') THEN
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

    -- Handle UPDATE: revert OLD and apply NEW
    IF TG_OP = 'UPDATE' THEN
        -- Revert old movement
        IF OLD.tipo_movimiento IN ('entrada', 'ajuste') THEN
            UPDATE public.productos
            SET stock_actual = stock_actual - OLD.cantidad
            WHERE id = OLD.producto_id;
        ELSIF OLD.tipo_movimiento = 'salida' THEN
            UPDATE public.productos
            SET stock_actual = stock_actual + OLD.cantidad
            WHERE id = OLD.producto_id;
        END IF;

        -- Apply new movement
        IF NEW.tipo_movimiento IN ('entrada', 'ajuste') THEN
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

    -- Handle DELETE: revert the stock change
    IF TG_OP = 'DELETE' THEN
        IF OLD.tipo_movimiento IN ('entrada', 'ajuste') THEN
            UPDATE public.productos
            SET stock_actual = stock_actual - OLD.cantidad
            WHERE id = OLD.producto_id;
        ELSIF OLD.tipo_movimiento = 'salida' THEN
            UPDATE public.productos
            SET stock_actual = stock_actual + OLD.cantidad
            WHERE id = OLD.producto_id;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$function$;

CREATE TRIGGER update_stock_on_movement
    AFTER INSERT OR UPDATE OR DELETE ON public.inventario_movimientos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_product_stock();