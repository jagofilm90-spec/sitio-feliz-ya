import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, User } from "lucide-react";

interface EditarEmailClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  clienteNombre: string;
  sucursalId?: string | null;
  onEmailUpdated: () => void;
}

const EditarEmailClienteDialog = ({
  open,
  onOpenChange,
  clienteId,
  clienteNombre,
  sucursalId,
  onEmailUpdated,
}: EditarEmailClienteDialogProps) => {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!email.trim()) {
      toast({
        title: "Error",
        description: "Ingresa un correo electrónico válido",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({
        title: "Error",
        description: "El formato del correo electrónico no es válido",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // If there's a sucursal, update the sucursal's email_facturacion
      // Otherwise, update the client's email
      if (sucursalId) {
        const { error } = await supabase
          .from("cliente_sucursales")
          .update({ email_facturacion: email.trim() })
          .eq("id", sucursalId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("clientes")
          .update({ email: email.trim() })
          .eq("id", clienteId);

        if (error) throw error;
      }

      toast({
        title: "Correo actualizado",
        description: "El correo electrónico ha sido guardado correctamente",
      });
      
      setEmail("");
      onOpenChange(false);
      onEmailUpdated();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo guardar el correo electrónico",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar correo para facturación</DialogTitle>
          <DialogDescription>
            El cliente no tiene correo registrado. Ingresa el correo para poder enviar la factura.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium">{clienteNombre}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico de facturación</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !email.trim()}>
            {saving ? "Guardando..." : "Guardar y continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditarEmailClienteDialog;

