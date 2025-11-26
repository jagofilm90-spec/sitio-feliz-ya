-- Función para vincular automáticamente usuarios con empleados por email
CREATE OR REPLACE FUNCTION public.auto_link_user_employee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si es un INSERT o UPDATE en profiles, buscar empleado con mismo email
  IF TG_TABLE_NAME = 'profiles' THEN
    UPDATE public.empleados
    SET user_id = NEW.id
    WHERE email = NEW.email
      AND user_id IS NULL;
    RETURN NEW;
  END IF;
  
  -- Si es un INSERT o UPDATE en empleados, buscar usuario con mismo email
  IF TG_TABLE_NAME = 'empleados' AND NEW.email IS NOT NULL THEN
    UPDATE public.empleados e
    SET user_id = p.id
    FROM public.profiles p
    WHERE e.id = NEW.id
      AND e.email = p.email
      AND e.user_id IS NULL;
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger en profiles: cuando se crea un usuario, vincular con empleado si existe
CREATE TRIGGER auto_link_on_user_creation
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_user_employee();

-- Trigger en empleados: cuando se crea o actualiza email, vincular con usuario si existe
CREATE TRIGGER auto_link_on_employee_email
  AFTER INSERT OR UPDATE OF email ON public.empleados
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_user_employee();