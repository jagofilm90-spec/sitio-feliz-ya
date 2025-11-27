-- Allow admins and almacen to update inventory movements
CREATE POLICY "Admins and almacen can update inventory movements"
ON public.inventario_movimientos
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role));

-- Allow admins and almacen to delete inventory movements
CREATE POLICY "Admins and almacen can delete inventory movements"
ON public.inventario_movimientos
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almacen'::app_role));