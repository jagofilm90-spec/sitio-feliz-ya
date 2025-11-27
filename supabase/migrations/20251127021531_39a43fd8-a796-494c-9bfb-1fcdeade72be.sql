-- Add columns to track stock changes
ALTER TABLE public.inventario_movimientos 
ADD COLUMN stock_anterior integer,
ADD COLUMN stock_nuevo integer;

-- Update the trigger function to capture stock before and after
CREATE OR REPLACE FUNCTION public.update_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_stock integer;
BEGIN
    -- Handle INSERT: apply new movement and capture stock values
    IF TG_OP = 'INSERT' THEN
        -- Get current stock before the change
        SELECT stock_actual INTO current_stock 
        FROM public.productos 
        WHERE id = NEW.producto_id;
        
        NEW.stock_anterior := current_stock;
        
        -- Apply the movement
        IF NEW.tipo_movimiento IN ('entrada', 'ajuste') THEN
            UPDATE public.productos
            SET stock_actual = stock_actual + NEW.cantidad
            WHERE id = NEW.producto_id
            RETURNING stock_actual INTO current_stock;
        ELSIF NEW.tipo_movimiento = 'salida' THEN
            UPDATE public.productos
            SET stock_actual = stock_actual - NEW.cantidad
            WHERE id = NEW.producto_id
            RETURNING stock_actual INTO current_stock;
        END IF;
        
        NEW.stock_nuevo := current_stock;
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

        -- Get current stock before new movement
        SELECT stock_actual INTO current_stock 
        FROM public.productos 
        WHERE id = NEW.producto_id;
        
        NEW.stock_anterior := current_stock;

        -- Apply new movement
        IF NEW.tipo_movimiento IN ('entrada', 'ajuste') THEN
            UPDATE public.productos
            SET stock_actual = stock_actual + NEW.cantidad
            WHERE id = NEW.producto_id
            RETURNING stock_actual INTO current_stock;
        ELSIF NEW.tipo_movimiento = 'salida' THEN
            UPDATE public.productos
            SET stock_actual = stock_actual - NEW.cantidad
            WHERE id = NEW.producto_id
            RETURNING stock_actual INTO current_stock;
        END IF;

        NEW.stock_nuevo := current_stock;
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

-- Recreate trigger with BEFORE instead of AFTER for INSERT/UPDATE
DROP TRIGGER IF EXISTS update_stock_on_movement ON public.inventario_movimientos;

CREATE TRIGGER update_stock_on_movement
    BEFORE INSERT OR UPDATE OR DELETE ON public.inventario_movimientos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_product_stock();