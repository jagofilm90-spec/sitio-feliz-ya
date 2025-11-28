-- Create function to generate next purchase order folio
CREATE OR REPLACE FUNCTION public.generar_folio_orden_compra()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year_month TEXT;
  last_folio TEXT;
  last_number INTEGER;
  new_number INTEGER;
  new_folio TEXT;
BEGIN
  -- Get current year-month in YYYYMM format
  current_year_month := TO_CHAR(NOW(), 'YYYYMM');
  
  -- Get the last folio for the current month
  SELECT folio INTO last_folio
  FROM ordenes_compra
  WHERE folio LIKE 'OC-' || current_year_month || '-%'
  ORDER BY folio DESC
  LIMIT 1;
  
  IF last_folio IS NULL THEN
    -- First order of the month, start at 0001
    new_number := 1;
  ELSE
    -- Extract the number part and increment
    last_number := CAST(SUBSTRING(last_folio FROM 12 FOR 4) AS INTEGER);
    new_number := last_number + 1;
  END IF;
  
  -- Format the new folio: OC-YYYYMM-XXXX
  new_folio := 'OC-' || current_year_month || '-' || LPAD(new_number::TEXT, 4, '0');
  
  RETURN new_folio;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.generar_folio_orden_compra() TO authenticated;