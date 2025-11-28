import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Mail,
  CheckCircle,
  XCircle,
  RefreshCw,
  Link2,
  Unlink,
  ExternalLink,
  Copy,
  Inbox,
  Settings,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import BandejaEntrada from "@/components/correos/BandejaEntrada";

interface GmailCuenta {
  id: string;
  email: string;
  nombre: string;
  proposito: string;
  activo: boolean;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
}

const CorreosCorporativos = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connectingEmail, setConnectingEmail] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("bandeja");

  const { data: cuentas, isLoading, refetch } = useQuery({
    queryKey: ["gmail-cuentas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gmail_cuentas")
        .select("*")
        .order("nombre");

      if (error) throw error;
      return data as GmailCuenta[];
    },
  });

  const isConnected = (cuenta: GmailCuenta) => {
    return !!(cuenta.access_token && cuenta.refresh_token);
  };

  const isTokenExpired = (cuenta: GmailCuenta) => {
    if (!cuenta.token_expires_at) return true;
    return new Date(cuenta.token_expires_at) < new Date();
  };

  // Filter connected accounts for the inbox
  const connectedCuentas = cuentas?.filter(
    (c) => isConnected(c) && c.activo
  ) || [];

  const handleConnect = async (email: string) => {
    setConnectingEmail(email);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Error",
          description: "Debes iniciar sesión para conectar una cuenta",
          variant: "destructive",
        });
        setConnectingEmail(null);
        return;
      }

      const response = await supabase.functions.invoke("gmail-auth", {
        body: { email },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.authUrl) {
        setAuthUrl(response.data.authUrl);
        setAuthEmail(email);
        setConnectingEmail(null);
      } else {
        throw new Error("No se recibió URL de autorización");
      }
    } catch (error: any) {
      console.error("Error connecting Gmail:", error);
      toast({
        title: "Error al conectar",
        description:
          error.message || "No se pudo iniciar el proceso de autorización",
        variant: "destructive",
      });
      setConnectingEmail(null);
    }
  };

  const handleCopyUrl = () => {
    if (authUrl) {
      navigator.clipboard.writeText(authUrl);
      toast({
        title: "URL copiada",
        description: "Pega la URL en una nueva pestaña del navegador",
      });
    }
  };

  const handleCloseAuthDialog = () => {
    setAuthUrl(null);
    setAuthEmail(null);
    refetch();
  };

  const handleDisconnect = async (cuenta: GmailCuenta) => {
    try {
      const { error } = await supabase
        .from("gmail_cuentas")
        .update({
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
        })
        .eq("id", cuenta.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["gmail-cuentas"] });
      toast({
        title: "Cuenta desconectada",
        description: `Se ha desconectado ${cuenta.email}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo desconectar la cuenta",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (cuenta: GmailCuenta) => {
    try {
      const { error } = await supabase
        .from("gmail_cuentas")
        .update({ activo: !cuenta.activo })
        .eq("id", cuenta.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["gmail-cuentas"] });
      toast({
        title: cuenta.activo ? "Cuenta desactivada" : "Cuenta activada",
        description: `${cuenta.email} ha sido ${
          cuenta.activo ? "desactivada" : "activada"
        }`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (cuenta: GmailCuenta) => {
    if (!isConnected(cuenta)) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Sin conectar
        </Badge>
      );
    }

    if (isTokenExpired(cuenta)) {
      return (
        <Badge
          variant="secondary"
          className="gap-1 bg-yellow-500/20 text-yellow-700"
        >
          <RefreshCw className="h-3 w-3" />
          Token expirado
        </Badge>
      );
    }

    return (
      <Badge
        variant="default"
        className="gap-1 bg-green-500/20 text-green-700"
      >
        <CheckCircle className="h-3 w-3" />
        Conectado
      </Badge>
    );
  };

  const getPropositoBadge = (proposito: string) => {
    const colors: Record<string, string> = {
      pedidos: "bg-blue-500/20 text-blue-700",
      general: "bg-purple-500/20 text-purple-700",
      facturas: "bg-orange-500/20 text-orange-700",
      bancario: "bg-emerald-500/20 text-emerald-700",
    };

    return (
      <Badge variant="outline" className={colors[proposito] || "bg-muted"}>
        {proposito.charAt(0).toUpperCase() + proposito.slice(1)}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Correos Corporativos
            </h1>
            <p className="text-muted-foreground">
              Gestiona las cuentas de correo integradas al sistema
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="bandeja" className="gap-2">
              <Inbox className="h-4 w-4" />
              Bandeja de Entrada
            </TabsTrigger>
            <TabsTrigger value="cuentas" className="gap-2">
              <Settings className="h-4 w-4" />
              Cuentas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bandeja" className="mt-6">
            {connectedCuentas.length > 0 ? (
              <BandejaEntrada cuentas={connectedCuentas} />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">
                    No hay cuentas de correo conectadas
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ve a la pestaña "Cuentas" para conectar una cuenta de correo
                  </p>
                  <Button onClick={() => setActiveTab("cuentas")}>
                    Ir a Cuentas
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="cuentas" className="mt-6">
            <div className="flex justify-end mb-4">
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {cuentas?.map((cuenta) => (
                  <Card
                    key={cuenta.id}
                    className={!cuenta.activo ? "opacity-60" : ""}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Mail className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">
                              {cuenta.nombre}
                            </CardTitle>
                            <CardDescription>{cuenta.email}</CardDescription>
                          </div>
                        </div>
                        {getStatusBadge(cuenta)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Propósito:
                        </span>
                        {getPropositoBadge(cuenta.proposito)}
                      </div>

                      {cuenta.token_expires_at && isConnected(cuenta) && (
                        <p className="text-xs text-muted-foreground">
                          Token expira:{" "}
                          {new Date(cuenta.token_expires_at).toLocaleString(
                            "es-MX"
                          )}
                        </p>
                      )}

                      <div className="flex gap-2 pt-2">
                        {!isConnected(cuenta) || isTokenExpired(cuenta) ? (
                          <Button
                            onClick={() => handleConnect(cuenta.email)}
                            disabled={connectingEmail === cuenta.email}
                            className="flex-1"
                          >
                            {connectingEmail === cuenta.email ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Link2 className="h-4 w-4 mr-2" />
                            )}
                            {isTokenExpired(cuenta) ? "Reconectar" : "Conectar"}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => handleDisconnect(cuenta)}
                            className="flex-1"
                          >
                            <Unlink className="h-4 w-4 mr-2" />
                            Desconectar
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActive(cuenta)}
                          title={
                            cuenta.activo
                              ? "Desactivar cuenta"
                              : "Activar cuenta"
                          }
                        >
                          {cuenta.activo ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {cuentas?.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        No hay cuentas de correo configuradas
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Auth URL Dialog */}
      <Dialog
        open={!!authUrl}
        onOpenChange={(open) => !open && handleCloseAuthDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Autorizar {authEmail}</DialogTitle>
            <DialogDescription>
              Haz clic en el botón para abrir Google y autorizar el acceso.
              Después regresa aquí y cierra este diálogo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Button className="w-full" asChild>
              <a
                href={authUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Google para autorizar
              </a>
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  O copia la URL
                </span>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleCopyUrl}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar URL
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Después de autorizar en Google, haz clic en "Actualizar" para
              verificar la conexión.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default CorreosCorporativos;
