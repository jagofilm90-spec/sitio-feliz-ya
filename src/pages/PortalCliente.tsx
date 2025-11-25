import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, ShoppingCart, FileText, TrendingUp, Truck } from "lucide-react";
import ClientePedidos from "@/components/cliente/ClientePedidos";
import ClienteEstadoCuenta from "@/components/cliente/ClienteEstadoCuenta";
import ClienteNuevoPedido from "@/components/cliente/ClienteNuevoPedido";
import ClienteEntregas from "@/components/cliente/ClienteEntregas";

const PortalCliente = () => {
  const [cliente, setCliente] = useState<any>(null);
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
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
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary">Abarrotes La Manita</h1>
              <p className="text-sm text-muted-foreground">Portal de Cliente</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium">{cliente.nombre}</p>
                <p className="text-sm text-muted-foreground">{cliente.codigo}</p>
              </div>
              <Button variant="outline" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Crédito Disponible</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${((cliente.limite_credito || 0) - (cliente.saldo_pendiente || 0)).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                de ${(cliente.limite_credito || 0).toFixed(2)}
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
                ${(cliente.saldo_pendiente || 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Por pagar
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Término de Crédito</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {cliente.termino_credito === "contado" ? "Contado" :
                 cliente.termino_credito === "8_dias" ? "8 días" :
                 cliente.termino_credito === "15_dias" ? "15 días" : "30 días"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estado</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {cliente.activo ? "Activo" : "Inactivo"}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pedidos" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pedidos">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Mis Pedidos
            </TabsTrigger>
            <TabsTrigger value="nuevo-pedido">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Hacer Pedido
            </TabsTrigger>
            <TabsTrigger value="estado-cuenta">
              <FileText className="h-4 w-4 mr-2" />
              Estado de Cuenta
            </TabsTrigger>
            <TabsTrigger value="entregas">
              <Truck className="h-4 w-4 mr-2" />
              Mis Entregas
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
