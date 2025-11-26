-- Función para sincronizar email de empleado a usuario
CREATE OR REPLACE FUNCTION public.sync_employee_email_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Si el empleado tiene un user_id asociado y el email cambió
  IF NEW.user_id IS NOT NULL AND (OLD.email IS DISTINCT FROM NEW.email) THEN
    UPDATE public.profiles
    SET email = NEW.email
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para sincronizar email cuando se actualiza un empleado
DROP TRIGGER IF EXISTS sync_employee_email_on_update ON public.empleados;
CREATE TRIGGER sync_employee_email_on_update
  AFTER UPDATE OF email ON public.empleados
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_employee_email_to_user();