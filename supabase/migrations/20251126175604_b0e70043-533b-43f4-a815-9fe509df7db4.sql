-- Tabla de proveedores
CREATE TABLE public.proveedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  nombre_contacto TEXT,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  pais TEXT NOT NULL DEFAULT 'México',
  rfc TEXT,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de órdenes de compra
CREATE TABLE public.ordenes_compra (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folio TEXT NOT NULL UNIQUE,
  proveedor_id UUID NOT NULL REFERENCES public.proveedores(id),
  fecha_orden TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fecha_entrega_programada DATE,
  fecha_entrega_real DATE,
  status TEXT NOT NULL DEFAULT 'pendiente',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  impuestos NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notas TEXT,
  motivo_devolucion TEXT,
  creado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT ordenes_compra_status_check CHECK (status IN ('pendiente', 'recibida_completa', 'recibida_parcial', 'devuelta', 'cancelada'))
);

-- Tabla de detalles de órdenes de compra
CREATE TABLE public.ordenes_compra_detalles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_compra_id UUID NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  cantidad_ordenada INTEGER NOT NULL,
  cantidad_recibida INTEGER NOT NULL DEFAULT 0,
  precio_unitario_compra NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agregar campos a la tabla productos para tracking de última compra
ALTER TABLE public.productos
ADD COLUMN ultimo_costo_compra NUMERIC,
ADD COLUMN fecha_ultima_compra TIMESTAMP WITH TIME ZONE;

-- Trigger para actualizar updated_at en proveedores
CREATE TRIGGER update_proveedores_updated_at
BEFORE UPDATE ON public.proveedores
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Trigger para actualizar updated_at en órdenes de compra
CREATE TRIGGER update_ordenes_compra_updated_at
BEFORE UPDATE ON public.ordenes_compra
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies para proveedores
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y secretarias pueden gestionar proveedores"
ON public.proveedores
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Todos los usuarios autenticados pueden ver proveedores"
ON public.proveedores
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- RLS Policies para órdenes de compra
ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y secretarias pueden gestionar órdenes de compra"
ON public.ordenes_compra
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Almacenistas pueden ver y actualizar órdenes de compra"
ON public.ordenes_compra
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'almacen') OR auth.uid() IS NOT NULL);

CREATE POLICY "Almacenistas pueden actualizar recepciones"
ON public.ordenes_compra
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'almacen') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria'));

-- RLS Policies para detalles de órdenes de compra
ALTER TABLE public.ordenes_compra_detalles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y secretarias pueden gestionar detalles de órdenes"
ON public.ordenes_compra_detalles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Todos los usuarios autenticados pueden ver detalles"
ON public.ordenes_compra_detalles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);