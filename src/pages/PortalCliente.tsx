import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, ShoppingCart, FileText, TrendingUp, Truck, MapPin, User, Package, Calendar } from "lucide-react";
import ClientePedidos from "@/components/cliente/ClientePedidos";
import ClienteEstadoCuenta from "@/components/cliente/ClienteEstadoCuenta";
import ClienteNuevoPedido from "@/components/cliente/ClienteNuevoPedido";
import ClienteEntregas from "@/components/cliente/ClienteEntregas";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface VendedorInfo {
  full_name: string;
  phone: string | null;
  email: string;
}

interface EstadisticasCliente {
  pedidosMes: number;
  totalMes: number;
  productoFavorito: string | null;
  ultimaCompra: string | null;
  proximaEntrega: string | null;
}

const PortalCliente = () => {
  const [cliente, setCliente] = useState<any>(null);
  const [vendedor, setVendedor] = useState<VendedorInfo | null>(null);
  const [estadisticas, setEstadisticas] = useState<EstadisticasCliente>({
    pedidosMes: 0,
    totalMes: 0,
    productoFavorito: null,
    ultimaCompra: null,
    proximaEntrega: null,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadClienteData();
  }, []);

  const loadClienteData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: clienteData, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      if (!clienteData) {
        toast({
          title: "Error",
          description: "No se encontró información de cliente asociada a tu usuario",
          variant: "destructive",
        });
        handleSignOut();
        return;
      }

      setCliente(clienteData);

      // Load vendor info if assigned
      if (clienteData.vendedor_asignado) {
        const { data: vendedorData } = await supabase
          .from("profiles")
          .select("full_name, phone, email")
          .eq("id", clienteData.vendedor_asignado)
          .single();
        
        if (vendedorData) {
          setVendedor(vendedorData);
        }
      }

      // Load statistics
      await loadEstadisticas(clienteData.id);

    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo cargar la información del cliente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEstadisticas = async (clienteId: string) => {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    // Orders this month
    const { data: pedidosMes } = await supabase
      .from("pedidos")
      .select("id, total, fecha_pedido")
      .eq("cliente_id", clienteId)
      .gte("fecha_pedido", inicioMes.toISOString());

    const totalMes = pedidosMes?.reduce((sum, p) => sum + (p.total || 0), 0) || 0;

    // Last purchase
    const { data: ultimoPedido } = await supabase
      .from("pedidos")
      .select("fecha_pedido")
      .eq("cliente_id", clienteId)
      .order("fecha_pedido", { ascending: false })
      .limit(1)
      .single();

    // Next scheduled delivery
    const { data: proximaEntrega } = await supabase
      .from("entregas")
      .select("ruta_id, rutas!inner(fecha_ruta)")
      .eq("pedido_id", (await supabase.from("pedidos").select("id").eq("cliente_id", clienteId).limit(1).single())?.data?.id || "")
      .eq("entregado", false)
      .order("created_at", { ascending: true })
      .limit(1);

    // Favorite product (most ordered)
    const { data: productosOrdenados } = await supabase
      .from("pedidos_detalles")
      .select("producto_id, productos!inner(nombre), cantidad")
      .in("pedido_id", pedidosMes?.map(p => p.id) || []);

    let productoFavorito: string | null = null;
    if (productosOrdenados && productosOrdenados.length > 0) {
      const conteo: Record<string, { nombre: string; cantidad: number }> = {};
      productosOrdenados.forEach((p: any) => {
        if (!conteo[p.producto_id]) {
          conteo[p.producto_id] = { nombre: p.productos?.nombre || "", cantidad: 0 };
        }
        conteo[p.producto_id].cantidad += p.cantidad;
      });
      const sorted = Object.values(conteo).sort((a, b) => b.cantidad - a.cantidad);
      productoFavorito = sorted[0]?.nombre || null;
    }

    setEstadisticas({
      pedidosMes: pedidosMes?.length || 0,
      totalMes,
      productoFavorito,
      ultimaCompra: ultimoPedido?.fecha_pedido || null,
      proximaEntrega: (proximaEntrega?.[0] as any)?.rutas?.fecha_ruta || null,
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getUbicacion = () => {
    const parts = [];
    if (cliente?.nombre_localidad) parts.push(cliente.nombre_localidad);
    if (cliente?.nombre_municipio) parts.push(cliente.nombre_municipio);
    if (cliente?.nombre_entidad_federativa) parts.push(cliente.nombre_entidad_federativa);
    return parts.length > 0 ? parts.slice(0, 2).join(", ") : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!cliente) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header personalizado */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Logo del cliente o ALMASA */}
              <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
                {cliente.logo_url ? (
                  <img 
                    src={cliente.logo_url} 
                    alt={cliente.nombre}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <img 
                    src="/logo-almasa-favicon.png" 
                    alt="ALMASA"
                    className="h-10 w-10 object-contain"
                  />
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  ¡Bienvenido, {cliente.nombre}!
                </h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="font-medium text-primary">{cliente.codigo}</span>
                  {getUbicacion() && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {getUbicacion()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Vendedor asignado */}
              {vendedor && (
                <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
                  <User className="h-4 w-4 text-primary" />
                  <div className="text-sm">
                    <p className="font-medium">{vendedor.full_name}</p>
                    {vendedor.phone && (
                      <p className="text-xs text-muted-foreground">{vendedor.phone}</p>
                    )}
                  </div>
                </div>
              )}
              <Button variant="outline" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Tarjetas de estadísticas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Crédito Disponible</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ${((cliente.limite_credito || 0) - (cliente.saldo_pendiente || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                de ${(cliente.limite_credito || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Pendiente</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                ${(cliente.saldo_pendiente || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Por pagar</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos del Mes</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estadisticas.pedidosMes}</div>
              <p className="text-xs text-muted-foreground">
                Total: ${estadisticas.totalMes.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Producto Favorito</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate">
                {estadisticas.productoFavorito || "—"}
              </div>
              <p className="text-xs text-muted-foreground">Más ordenado este mes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Última Compra</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {estadisticas.ultimaCompra 
                  ? format(new Date(estadisticas.ultimaCompra), "dd MMM yyyy", { locale: es })
                  : "—"}
              </div>
              {estadisticas.proximaEntrega && (
                <p className="text-xs text-muted-foreground">
                  Próx. entrega: {format(new Date(estadisticas.proximaEntrega), "dd MMM", { locale: es })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Vendedor en móvil */}
        {vendedor && (
          <Card className="md:hidden mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Tu Vendedor Asignado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{vendedor.full_name}</p>
              {vendedor.phone && (
                <p className="text-sm text-muted-foreground">{vendedor.phone}</p>
              )}
              <p className="text-sm text-muted-foreground">{vendedor.email}</p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="pedidos" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pedidos">
              <ShoppingCart className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Mis Pedidos</span>
              <span className="sm:hidden">Pedidos</span>
            </TabsTrigger>
            <TabsTrigger value="nuevo-pedido">
              <ShoppingCart className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Hacer Pedido</span>
              <span className="sm:hidden">Nuevo</span>
            </TabsTrigger>
            <TabsTrigger value="estado-cuenta">
              <FileText className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Estado de Cuenta</span>
              <span className="sm:hidden">Cuenta</span>
            </TabsTrigger>
            <TabsTrigger value="entregas">
              <Truck className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Mis Entregas</span>
              <span className="sm:hidden">Entregas</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pedidos" className="space-y-4">
            <ClientePedidos clienteId={cliente.id} />
          </TabsContent>

          <TabsContent value="nuevo-pedido" className="space-y-4">
            <ClienteNuevoPedido 
              clienteId={cliente.id}
              limiteCredito={cliente.limite_credito || 0}
              saldoPendiente={cliente.saldo_pendiente || 0}
            />
          </TabsContent>

          <TabsContent value="estado-cuenta" className="space-y-4">
            <ClienteEstadoCuenta clienteId={cliente.id} />
          </TabsContent>

          <TabsContent value="entregas" className="space-y-4">
            <ClienteEntregas clienteId={cliente.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default PortalCliente;
