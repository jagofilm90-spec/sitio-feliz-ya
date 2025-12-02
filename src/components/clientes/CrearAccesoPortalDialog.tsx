import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, EyeOff, Copy, Check } from "lucide-react";

interface CrearAccesoPortalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: {
    id: string;
    nombre: string;
    email?: string;
  } | null;
  onSuccess: () => void;
}

export function CrearAccesoPortalDialog({
  open,
  onOpenChange,
  cliente,
  onSuccess,
}: CrearAccesoPortalDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Generate random password
  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pass = "";
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
    setShowPassword(true);
  };

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && cliente) {
      setEmail(cliente.email || "");
      generatePassword();
      setCopied(false);
    }
    onOpenChange(newOpen);
  };

  const handleCopyCredentials = async () => {
    const text = `Email: ${email}\nContraseña: ${password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Credenciales copiadas",
      description: "Puedes enviarlas al cliente",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente || !email || !password) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No hay sesión activa");
      }

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
        description: `Cuenta de portal creada para ${cliente.nombre}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el acceso",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!cliente) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear acceso al portal</DialogTitle>
          <DialogDescription>
            Crea credenciales para que <strong>{cliente.nombre}</strong> pueda acceder al portal de clientes
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@ejemplo.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button type="button" variant="outline" onClick={generatePassword}>
                Generar
              </Button>
            </div>
          </div>

          <div className="bg-muted p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Credenciales</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyCredentials}
                disabled={!email || !password}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className="ml-1">{copied ? "Copiado" : "Copiar"}</span>
              </Button>
            </div>
            <div className="text-sm space-y-1 font-mono">
              <p><span className="text-muted-foreground">Email:</span> {email || "---"}</p>
              <p><span className="text-muted-foreground">Pass:</span> {showPassword ? password : "••••••••••"}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !email || !password}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear acceso
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
