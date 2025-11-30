import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Loader2, Package, Building2, Calendar, DollarSign, User } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface AutorizacionCotizacionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotizacion: any;
}

const AutorizacionCotizacionDialog = ({ open, onOpenChange, cotizacion }: AutorizacionCotizacionDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [autorizando, setAutorizando] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [showRechazoForm, setShowRechazoForm] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch creator profile
  const { data: creadorProfile } = useQuery({
    queryKey: ["profile", cotizacion?.creado_por],
    queryFn: async () => {
      if (!cotizacion?.creado_por) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", cotizacion.creado_por)
        .single();
      return data;
    },
    enabled: !!cotizacion?.creado_por,
  });

  // Fetch cotizacion details
  const { data: detalles = [] } = useQuery({
    queryKey: ["cotizacion-detalles", cotizacion?.id],
    queryFn: async () => {
      if (!cotizacion?.id) return [];
      const { data } = await supabase
        .from("cotizaciones_detalles")
        .select(`
          id,
          cantidad,
          precio_unitario,
          subtotal,
          producto:productos(nombre, codigo)
        `)
        .eq("cotizacion_id", cotizacion.id);
      return data || [];
    },
    enabled: !!cotizacion?.id,
  });

  const handleAutorizar = async () => {
    setAutorizando(true);
    try {
      // Update cotizacion with authorization
      const { error: updateError } = await supabase
        .from("cotizaciones")
        .update({ 
          status: "autorizada",
          autorizado_por: currentUser?.id,
          fecha_autorizacion: new Date().toISOString()
        })
        .eq("id", cotizacion.id);

      if (updateError) throw updateError;

      // Mark notification as read
      await supabase
        .from("notificaciones")
        .update({ leida: true })
        .eq("cotizacion_id", cotizacion.id)
        .eq("tipo", "autorizacion_cotizacion");

      // Get authorizer name
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUser?.id)
        .single();

      // Create notification for the creator
      await supabase
        .from("notificaciones")
        .insert({
          tipo: "cotizacion_autorizada",
          titulo: `Cotización ${cotizacion.folio} autorizada`,
          descripcion: `Tu cotización para ${cotizacion.cliente?.nombre || 'cliente'} ha sido autorizada por ${adminProfile?.full_name || 'Administrador'}. Ya puedes enviarla al cliente.`,
          cotizacion_id: cotizacion.id,
          leida: false,
        });

      queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones"] });

      toast({
        title: "Cotización autorizada",
        description: `La cotización ${cotizacion.folio} ha sido autorizada. El creador puede enviarla al cliente.`,
      });
      
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAutorizando(false);
    }
  };

  const handleRechazar = async () => {
    if (!motivoRechazo.trim()) {
      toast({
        title: "Motivo requerido",
        description: "Indica el motivo del rechazo",
        variant: "destructive",
      });
      return;
    }

    setRechazando(true);
    try {
      const { error: updateError } = await supabase
        .from("cotizaciones")
        .update({ 
          status: "rechazada",
          rechazado_por: currentUser?.id,
          fecha_rechazo: new Date().toISOString(),
          motivo_rechazo: motivoRechazo
        })
        .eq("id", cotizacion.id);

      if (updateError) throw updateError;

      // Mark notification as read
      await supabase
        .from("notificaciones")
        .update({ leida: true })
        .eq("cotizacion_id", cotizacion.id)
        .eq("tipo", "autorizacion_cotizacion");

      queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones"] });

      toast({
        title: "Cotización rechazada",
        description: `La cotización ${cotizacion.folio} ha sido rechazada`,
      });
      
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRechazando(false);
    }
  };

  if (!cotizacion) return null;

  // Check if it's a prices-only quotation
  const soloPrecios = cotizacion.notas?.includes("[Solo precios]") || detalles.every((d: any) => d.cantidad === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Autorización de Cotización</span>
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
              {cotizacion.folio}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-medium">{cotizacion.cliente?.nombre || "Sin cliente"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Vigencia</p>
                <p className="font-medium">
                  {format(new Date(cotizacion.fecha_vigencia), "dd 'de' MMMM yyyy", { locale: es })}
                </p>
              </div>
            </div>
          </div>

          {/* Solicitante */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="text-muted-foreground">Solicitado por:</span>{" "}
              <span className="font-medium">{creadorProfile?.full_name || "Usuario"}</span>
            </p>
          </div>

          {soloPrecios && (
            <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                📋 Cotización de solo precios (sin cantidades)
              </p>
            </div>
          )}

          <Separator className="my-4" />

          {/* Products Table */}
          <div className="mb-4">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Productos ({detalles.length})
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Producto</th>
                    {!soloPrecios && <th className="text-center p-2">Cant.</th>}
                    <th className="text-right p-2">Precio</th>
                    {!soloPrecios && <th className="text-right p-2">Subtotal</th>}
                  </tr>
                </thead>
                <tbody>
                  {detalles.map((d: any, idx: number) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{d.producto?.codigo}</span>
                        {d.producto?.nombre || "Producto"}
                      </td>
                      {!soloPrecios && <td className="text-center p-2">{d.cantidad?.toLocaleString()}</td>}
                      <td className="text-right p-2">${formatCurrency(d.precio_unitario)}</td>
                      {!soloPrecios && <td className="text-right p-2 font-medium">${formatCurrency(d.subtotal)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          {!soloPrecios && (
            <div className="flex justify-end mb-4">
              <div className="w-64 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>${formatCurrency(cotizacion.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Impuestos:</span>
                  <span>${formatCurrency(cotizacion.impuestos)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-lg">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Total:
                  </span>
                  <span className="text-primary">${formatCurrency(cotizacion.total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notas */}
          {cotizacion.notas && !cotizacion.notas.includes("[Solo precios]") && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm">
                <span className="font-medium">Notas:</span> {cotizacion.notas.replace(/\[.*?\]/g, "").trim()}
              </p>
            </div>
          )}

          {/* Rechazo Form */}
          {showRechazoForm && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <Label className="text-red-700 dark:text-red-400">Motivo del rechazo</Label>
              <Textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Indica el motivo por el cual rechazas esta cotización..."
                className="mt-2"
              />
            </div>
          )}
        </ScrollArea>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          {!showRechazoForm ? (
            <>
              <Button
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setShowRechazoForm(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rechazar
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleAutorizar}
                disabled={autorizando}
              >
                {autorizando ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Autorizar
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowRechazoForm(false);
                  setMotivoRechazo("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleRechazar}
                disabled={rechazando || !motivoRechazo.trim()}
              >
                {rechazando ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Confirmar Rechazo
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AutorizacionCotizacionDialog;
