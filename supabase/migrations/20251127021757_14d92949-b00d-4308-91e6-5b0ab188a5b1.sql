-- Update trigger to create notifications when stock falls below minimum
CREATE OR REPLACE FUNCTION public.update_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_stock integer;
  product_info record;
BEGIN
    -- Handle INSERT: apply new movement and capture stock values
    IF TG_OP = 'INSERT' THEN
        -- Get current stock and product info before the change
        SELECT stock_actual, stock_minimo, nombre, codigo 
        INTO product_info
        FROM public.productos 
        WHERE id = NEW.producto_id;
        
        NEW.stock_anterior := product_info.stock_actual;
        
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
        
        -- Create notification if stock fell below minimum
        IF current_stock < product_info.stock_minimo AND product_info.stock_actual >= product_info.stock_minimo THEN
            INSERT INTO public.notificaciones (tipo, titulo, descripcion, leida)
            VALUES (
                'stock_bajo',
                'Stock bajo: ' || product_info.codigo,
                'El producto "' || product_info.nombre || '" ha bajado a ' || current_stock || ' unidades (mínimo: ' || product_info.stock_minimo || ')',
                false
            );
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

        -- Get current stock and product info before new movement
        SELECT stock_actual, stock_minimo, nombre, codigo 
        INTO product_info
        FROM public.productos 
        WHERE id = NEW.producto_id;
        
        NEW.stock_anterior := product_info.stock_actual;

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
        
        -- Create notification if stock fell below minimum
        IF current_stock < product_info.stock_minimo AND product_info.stock_actual >= product_info.stock_minimo THEN
            INSERT INTO public.notificaciones (tipo, titulo, descripcion, leida)
            VALUES (
                'stock_bajo',
                'Stock bajo: ' || product_info.codigo,
                'El producto "' || product_info.nombre || '" ha bajado a ' || current_stock || ' unidades (mínimo: ' || product_info.stock_minimo || ')',
                false
            );
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