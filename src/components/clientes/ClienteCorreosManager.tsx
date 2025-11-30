import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Mail, Star, Loader2 } from "lucide-react";

interface ClienteCorreosManagerProps {
  clienteId: string;
  clienteNombre: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ClienteCorreo {
  id: string;
  cliente_id: string;
  email: string;
  nombre_contacto: string | null;
  es_principal: boolean;
  proposito: string | null;
  activo: boolean;
}

const ClienteCorreosManager = ({
  clienteId,
  clienteNombre,
  open,
  onOpenChange,
}: ClienteCorreosManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [newNombreContacto, setNewNombreContacto] = useState("");
  const [newProposito, setNewProposito] = useState("general");
  const [adding, setAdding] = useState(false);

  const { data: correos = [], isLoading } = useQuery({
    queryKey: ["cliente_correos", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_correos")
        .select("*")
        .eq("cliente_id", clienteId)
        .eq("activo", true)
        .order("es_principal", { ascending: false })
        .order("created_at");
      
      if (error) throw error;
      return data as ClienteCorreo[];
    },
    enabled: open && !!clienteId,
  });

  const addCorreo = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast({
        title: "Email inválido",
        description: "Por favor ingresa un email válido",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase.from("cliente_correos").insert({
        cliente_id: clienteId,
        email: newEmail,
        nombre_contacto: newNombreContacto || null,
        proposito: newProposito,
        es_principal: correos.length === 0, // First email is principal
      });

      if (error) throw error;

      toast({ title: "Correo agregado" });
      queryClient.invalidateQueries({ queryKey: ["cliente_correos", clienteId] });
      setNewEmail("");
      setNewNombreContacto("");
      setNewProposito("general");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const deleteCorreo = async (correoId: string) => {
    try {
      const { error } = await supabase
        .from("cliente_correos")
        .update({ activo: false })
        .eq("id", correoId);

      if (error) throw error;

      toast({ title: "Correo eliminado" });
      queryClient.invalidateQueries({ queryKey: ["cliente_correos", clienteId] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const setPrincipal = async (correoId: string) => {
    try {
      // First remove principal from all
      await supabase
        .from("cliente_correos")
        .update({ es_principal: false })
        .eq("cliente_id", clienteId);

      // Then set the new principal
      const { error } = await supabase
        .from("cliente_correos")
        .update({ es_principal: true })
        .eq("id", correoId);

      if (error) throw error;

      toast({ title: "Correo principal actualizado" });
      queryClient.invalidateQueries({ queryKey: ["cliente_correos", clienteId] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getPropositoLabel = (proposito: string | null) => {
    const labels: Record<string, string> = {
      general: "General",
      cotizaciones: "Cotizaciones",
      facturas: "Facturas",
      pedidos: "Pedidos",
    };
    return labels[proposito || "general"] || proposito;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Correos de {clienteNombre}
          </DialogTitle>
          <DialogDescription>
            Administra los correos electrónicos de este cliente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new email */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-medium text-sm">Agregar nuevo correo</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nombre contacto</Label>
                <Input
                  placeholder="Juan Pérez"
                  value={newNombreContacto}
                  onChange={(e) => setNewNombreContacto(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Propósito</Label>
                <Select value={newProposito} onValueChange={setNewProposito}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="cotizaciones">Cotizaciones</SelectItem>
                    <SelectItem value="facturas">Facturas</SelectItem>
                    <SelectItem value="pedidos">Pedidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={addCorreo} 
                disabled={adding || !newEmail}
                className="self-end"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Agregar
              </Button>
            </div>
          </div>

          {/* Email list */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Correos registrados</h4>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : correos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay correos registrados para este cliente
              </p>
            ) : (
              <div className="space-y-2">
                {correos.map((correo) => (
                  <div
                    key={correo.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-background"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{correo.email}</span>
                        {correo.es_principal && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Principal
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {getPropositoLabel(correo.proposito)}
                        </Badge>
                      </div>
                      {correo.nombre_contacto && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {correo.nombre_contacto}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {!correo.es_principal && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPrincipal(correo.id)}
                          title="Marcar como principal"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCorreo(correo.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClienteCorreosManager;
