-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor', 'chofer', 'almacen', 'secretaria');

-- Create enum for credit terms
CREATE TYPE public.credit_term AS ENUM ('contado', '8_dias', '15_dias', '30_dias');

-- Create enum for order status
CREATE TYPE public.order_status AS ENUM ('pendiente', 'en_ruta', 'entregado', 'cancelado');

-- Create enum for unit types
CREATE TYPE public.unit_type AS ENUM ('kg', 'pieza', 'caja', 'bulto', 'costal', 'litro');

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- ============================================
-- USER ROLES TABLE
-- ============================================
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
    ON public.user_roles FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- PRODUCTS TABLE
-- ============================================
CREATE TABLE public.productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    unidad public.unit_type NOT NULL DEFAULT 'pieza',
    precio_venta DECIMAL(10,2) NOT NULL DEFAULT 0,
    precio_compra DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock_actual INTEGER NOT NULL DEFAULT 0,
    stock_minimo INTEGER NOT NULL DEFAULT 0,
    maneja_caducidad BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view products"
    ON public.productos FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Admins and almacen can manage products"
    ON public.productos FOR ALL
    USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'almacen')
    );

-- ============================================
-- CLIENTS TABLE
-- ============================================
CREATE TABLE public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    razon_social TEXT,
    rfc TEXT,
    direccion TEXT,
    telefono TEXT,
    email TEXT,
    termino_credito public.credit_term DEFAULT 'contado' NOT NULL,
    limite_credito DECIMAL(10,2) DEFAULT 0,
    saldo_pendiente DECIMAL(10,2) DEFAULT 0,
    vendedor_asignado UUID REFERENCES public.profiles(id),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view clients"
    ON public.clientes FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Admins and vendedores can manage clients"
    ON public.clientes FOR ALL
    USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'vendedor') OR
        public.has_role(auth.uid(), 'secretaria')
    );

-- ============================================
-- INVENTORY MOVEMENTS TABLE
-- ============================================
CREATE TABLE public.inventario_movimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID REFERENCES public.productos(id) ON DELETE CASCADE NOT NULL,
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('entrada', 'salida', 'ajuste')),
    cantidad INTEGER NOT NULL,
    fecha_caducidad DATE,
    lote TEXT,
    referencia TEXT,
    notas TEXT,
    usuario_id UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.inventario_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view inventory movements"
    ON public.inventario_movimientos FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Admins and almacen can create inventory movements"
    ON public.inventario_movimientos FOR INSERT
    WITH CHECK (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'almacen')
    );

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE public.pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio TEXT UNIQUE NOT NULL,
    cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
    vendedor_id UUID REFERENCES public.profiles(id) NOT NULL,
    fecha_pedido TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    fecha_entrega_estimada DATE,
    status public.order_status DEFAULT 'pendiente' NOT NULL,
    subtotal DECIMAL(10,2) DEFAULT 0,
    impuestos DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view orders"
    ON public.pedidos FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Vendedores can create their own orders"
    ON public.pedidos FOR INSERT
    WITH CHECK (
        public.has_role(auth.uid(), 'vendedor') OR
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'secretaria')
    );

CREATE POLICY "Admins can manage all orders"
    ON public.pedidos FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- ORDER DETAILS TABLE
-- ============================================
CREATE TABLE public.pedidos_detalles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE NOT NULL,
    producto_id UUID REFERENCES public.productos(id) NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.pedidos_detalles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view order details"
    ON public.pedidos_detalles FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Users who can manage orders can manage details"
    ON public.pedidos_detalles FOR ALL
    USING (
        public.has_role(auth.uid(), 'vendedor') OR
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'secretaria')
    );

-- ============================================
-- ROUTES TABLE
-- ============================================
CREATE TABLE public.rutas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio TEXT UNIQUE NOT NULL,
    chofer_id UUID REFERENCES public.profiles(id) NOT NULL,
    ayudante_id UUID REFERENCES public.profiles(id),
    fecha_ruta DATE NOT NULL,
    status TEXT DEFAULT 'programada' CHECK (status IN ('programada', 'en_curso', 'completada', 'cancelada')),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.rutas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view routes"
    ON public.rutas FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Admins can manage routes"
    ON public.rutas FOR ALL
    USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'secretaria')
    );

-- ============================================
-- DELIVERIES TABLE
-- ============================================
CREATE TABLE public.entregas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ruta_id UUID REFERENCES public.rutas(id) ON DELETE CASCADE NOT NULL,
    pedido_id UUID REFERENCES public.pedidos(id) NOT NULL,
    orden_entrega INTEGER NOT NULL,
    entregado BOOLEAN DEFAULT FALSE,
    fecha_entrega TIMESTAMP WITH TIME ZONE,
    firma_recibido TEXT,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view deliveries"
    ON public.entregas FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Admins and choferes can manage deliveries"
    ON public.entregas FOR ALL
    USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'chofer') OR
        public.has_role(auth.uid(), 'secretaria')
    );

-- ============================================
-- INVOICES TABLE
-- ============================================
CREATE TABLE public.facturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio TEXT UNIQUE NOT NULL,
    pedido_id UUID REFERENCES public.pedidos(id) NOT NULL,
    cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
    fecha_emision TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    fecha_vencimiento DATE,
    subtotal DECIMAL(10,2) NOT NULL,
    impuestos DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    pagada BOOLEAN DEFAULT FALSE,
    fecha_pago TIMESTAMP WITH TIME ZONE,
    metodo_pago TEXT,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view invoices"
    ON public.facturas FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Admins and secretarias can manage invoices"
    ON public.facturas FOR ALL
    USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'secretaria')
    );

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_productos_updated_at
    BEFORE UPDATE ON public.productos
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_clientes_updated_at
    BEFORE UPDATE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_pedidos_updated_at
    BEFORE UPDATE ON public.pedidos
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_rutas_updated_at
    BEFORE UPDATE ON public.rutas
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_entregas_updated_at
    BEFORE UPDATE ON public.entregas
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_facturas_updated_at
    BEFORE UPDATE ON public.facturas
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- TRIGGER TO CREATE PROFILE ON USER SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
        NEW.email
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- FUNCTION TO UPDATE PRODUCT STOCK
-- ============================================
CREATE OR REPLACE FUNCTION public.update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
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
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stock_on_movement
    AFTER INSERT ON public.inventario_movimientos
    FOR EACH ROW EXECUTE FUNCTION public.update_product_stock();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_productos_codigo ON public.productos(codigo);
CREATE INDEX idx_productos_activo ON public.productos(activo);
CREATE INDEX idx_clientes_codigo ON public.clientes(codigo);
CREATE INDEX idx_clientes_vendedor ON public.clientes(vendedor_asignado);
CREATE INDEX idx_pedidos_cliente ON public.pedidos(cliente_id);
CREATE INDEX idx_pedidos_vendedor ON public.pedidos(vendedor_id);
CREATE INDEX idx_pedidos_status ON public.pedidos(status);
CREATE INDEX idx_pedidos_fecha ON public.pedidos(fecha_pedido);
CREATE INDEX idx_rutas_fecha ON public.rutas(fecha_ruta);
CREATE INDEX idx_rutas_chofer ON public.rutas(chofer_id);
CREATE INDEX idx_entregas_ruta ON public.entregas(ruta_id);
CREATE INDEX idx_facturas_cliente ON public.facturas(cliente_id);