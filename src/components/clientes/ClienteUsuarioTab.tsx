import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, Key, Copy, RefreshCw, Check, Eye, EyeOff, UserPlus, Loader2 } from "lucide-react";

interface ClienteUsuarioTabProps {
  cliente: {
    id: string;
    nombre: string;
    email?: string;
    user_id?: string | null;
  };
  onUserCreated?: () => void;
}

export function ClienteUsuarioTab({ cliente, onUserCreated }: ClienteUsuarioTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Create user state
  const [email, setEmail] = useState(cliente.email || "");
  const [password, setPassword] = useState("");
  
  // Reset password state
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  const handleCopyCredentials = async (emailToCopy: string, passwordToCopy: string) => {
    const credentials = `Email: ${emailToCopy}\nContraseña: ${passwordToCopy}`;
    await navigator.clipboard.writeText(credentials);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Credenciales copiadas al portapapeles" });
  };

  const handleCreateUser = async () => {
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Email y contraseña son requeridos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-client-user", {
        body: {
          email,
          password,
          cliente_id: cliente.id,
          nombre_cliente: cliente.nombre,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Acceso creado",
        description: `Usuario creado para ${cliente.nombre}`,
      });
      
      onUserCreated?.();
    } catch (error: any) {
      toast({
        title: "Error al crear acceso",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: {
          userId: cliente.user_id,
          newPassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Contraseña actualizada",
        description: "La nueva contraseña ha sido establecida",
      });
      
      // Clear the field after successful reset
      setNewPassword("");
    } catch (error: any) {
      toast({
        title: "Error al resetear contraseña",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Client has portal access
  if (cliente.user_id) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium">{cliente.nombre}</p>
            <p className="text-sm text-muted-foreground">{cliente.email || "Sin email registrado"}</p>
          </div>
          <Badge variant="default" className="bg-green-500">
            <Check className="h-3 w-3 mr-1" />
            Acceso activo
          </Badge>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Key className="h-4 w-4" />
            Resetear Contraseña
          </h4>
          <p className="text-sm text-muted-foreground">
            Genera una nueva contraseña para el cliente. Deberás compartírsela manualmente.
          </p>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showNewPassword ? "text" : "password"}
                placeholder="Nueva contraseña"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-8 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setNewPassword(generatePassword())}
                title="Generar contraseña"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={handleResetPassword}
              disabled={loading || !newPassword}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Actualizar"}
            </Button>
          </div>

          {newPassword && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopyCredentials(cliente.email || "", newPassword)}
              className="w-full"
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copiado" : "Copiar credenciales"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Client doesn't have portal access - show creation form
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-medium">{cliente.nombre}</p>
          <p className="text-sm text-muted-foreground">Sin acceso al portal</p>
        </div>
        <Badge variant="secondary">Sin acceso</Badge>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Crear Acceso al Portal
        </h4>
        <p className="text-sm text-muted-foreground">
          Crea credenciales para que el cliente pueda acceder al portal y realizar pedidos.
        </p>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="cliente@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Contraseña</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPassword(generatePassword())}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {email && password && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopyCredentials(email, password)}
              className="w-full"
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copiado" : "Copiar credenciales"}
            </Button>
          )}

          <Button
            onClick={handleCreateUser}
            disabled={loading || !email || !password}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Crear Acceso
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
