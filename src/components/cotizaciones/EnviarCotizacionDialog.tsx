import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Mail, Plus } from "lucide-react";
import ClienteCorreosManager from "@/components/clientes/ClienteCorreosManager";

interface ClienteCorreo {
  id: string;
  email: string;
  nombre_contacto: string | null;
  proposito: string | null;
  es_principal: boolean | null;
}

interface EnviarCotizacionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotizacionId: string;
  clienteId: string;
  clienteNombre: string;
  folio: string;
  onSuccess?: () => void;
}

const EnviarCotizacionDialog = ({
  open,
  onOpenChange,
  cotizacionId,
  clienteId,
  clienteNombre,
  folio,
  onSuccess,
}: EnviarCotizacionDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingCorreos, setLoadingCorreos] = useState(false);
  const [correos, setCorreos] = useState<ClienteCorreo[]>([]);
  const [selectedCorreos, setSelectedCorreos] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [correosManagerOpen, setCorreosManagerOpen] = useState(false);

  useEffect(() => {
    if (open && clienteId) {
      loadCorreos();
    }
  }, [open, clienteId]);

  const loadCorreos = async () => {
    setLoadingCorreos(true);
    try {
      const { data, error } = await supabase
        .from("cliente_correos")
        .select("id, email, nombre_contacto, proposito, es_principal")
        .eq("cliente_id", clienteId)
        .eq("activo", true)
        .order("es_principal", { ascending: false });

      if (error) throw error;
      setCorreos(data || []);
      
      // Auto-select principal email
      const principal = data?.find(c => c.es_principal);
      if (principal) {
        setSelectedCorreos([principal.id]);
      }
    } catch (error: any) {
      console.error("Error loading correos:", error);
      toast({
        title: "Error al cargar correos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingCorreos(false);
    }
  };

  const toggleCorreo = (correoId: string) => {
    setSelectedCorreos(prev => 
      prev.includes(correoId) 
        ? prev.filter(id => id !== correoId)
        : [...prev, correoId]
    );
  };

  const handleEnviar = async () => {
    if (selectedCorreos.length === 0) {
      toast({
        title: "Selecciona destinatarios",
        description: "Debes seleccionar al menos un correo para enviar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get selected email addresses
      const emailsToSend = correos
        .filter(c => selectedCorreos.includes(c.id))
        .map(c => c.email);

      // TODO: Implement actual email sending via edge function
      // For now, just update the status
      const { error } = await supabase
        .from("cotizaciones")
        .update({ status: "enviada" })
        .eq("id", cotizacionId);

      if (error) throw error;

      toast({
        title: "Cotización enviada",
        description: `Se envió a: ${emailsToSend.join(", ")}`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending cotizacion:", error);
      toast({
        title: "Error al enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Enviar Cotización {folio}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">
                  Seleccionar destinatarios de {clienteNombre}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCorreosManagerOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
              
              {loadingCorreos ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : correos.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay correos registrados</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setCorreosManagerOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar correo
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {correos.map((correo) => (
                    <div 
                      key={correo.id} 
                      className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleCorreo(correo.id)}
                    >
                      <Checkbox
                        checked={selectedCorreos.includes(correo.id)}
                        onCheckedChange={() => toggleCorreo(correo.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{correo.email}</p>
                        {correo.nombre_contacto && (
                          <p className="text-xs text-muted-foreground">{correo.nombre_contacto}</p>
                        )}
                        {correo.proposito && (
                          <p className="text-xs text-muted-foreground italic">{correo.proposito}</p>
                        )}
                        {correo.es_principal && (
                          <span className="text-xs text-primary font-medium">Principal</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Mensaje adicional (opcional)</Label>
              <Textarea
                placeholder="Agregar un mensaje personalizado..."
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleEnviar} disabled={loading || selectedCorreos.length === 0}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar ({selectedCorreos.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para gestionar correos del cliente */}
      <ClienteCorreosManager
        clienteId={clienteId}
        clienteNombre={clienteNombre}
        open={correosManagerOpen}
        onOpenChange={(open) => {
          setCorreosManagerOpen(open);
          if (!open) {
            // Reload correos after closing manager
            loadCorreos();
          }
        }}
      />
    </>
  );
};

export default EnviarCotizacionDialog;
