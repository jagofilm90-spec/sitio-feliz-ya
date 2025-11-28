
-- Add RLS policy to allow users to view gmail accounts they have permission for
CREATE POLICY "Users can view gmail accounts they have permission for" 
ON public.gmail_cuentas 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR 
  EXISTS (
    SELECT 1 FROM public.gmail_cuenta_permisos 
    WHERE gmail_cuenta_permisos.gmail_cuenta_id = gmail_cuentas.id 
    AND gmail_cuenta_permisos.user_id = auth.uid()
  )
);
