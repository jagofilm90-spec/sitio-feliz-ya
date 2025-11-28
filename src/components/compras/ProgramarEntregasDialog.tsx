import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar, Truck, Send, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ProgramarEntregasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orden: any;
}

const ProgramarEntregasDialog = ({ open, onOpenChange, orden }: ProgramarEntregasDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [guardando, setGuardando] = useState(false);
  const [fechasActualizadas, setFechasActualizadas] = useState<Record<string, string>>({});

  // Fetch entregas for this order
  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ["entregas-oc", orden?.id],
    queryFn: async () => {
      if (!orden?.id) return [];
      const { data, error } = await supabase
        .from("ordenes_compra_entregas")
        .select("*")
        .eq("orden_compra_id", orden.id)
        .order("numero_entrega");
      if (error) throw error;
      return data || [];
    },
    enabled: !!orden?.id && open,
  });

  const entregasPendientes = entregas.filter((e: any) => !e.fecha_programada || e.status === "pendiente_fecha");
  const entregasProgramadas = entregas.filter((e: any) => e.fecha_programada && e.status !== "pendiente_fecha");

  const handleFechaChange = (entregaId: string, fecha: string) => {
    setFechasActualizadas(prev => ({
      ...prev,
      [entregaId]: fecha
    }));
  };

  const handleGuardarFechas = async () => {
    const fechasParaActualizar = Object.entries(fechasActualizadas).filter(([_, fecha]) => fecha);
    
    if (fechasParaActualizar.length === 0) {
      toast({
        title: "Sin cambios",
        description: "No hay fechas nuevas para guardar",
        variant: "destructive",
      });
      return;
    }

    setGuardando(true);
    try {
      // Update each delivery with new date
      for (const [entregaId, fecha] of fechasParaActualizar) {
        const { error } = await supabase
          .from("ordenes_compra_entregas")
          .update({
            fecha_programada: fecha,
            status: "programada"
          })
          .eq("id", entregaId);
        
        if (error) throw error;
      }

      // Send email to supplier if they have email
      if (orden?.proveedores?.email) {
        const entregasNuevas = fechasParaActualizar.map(([entregaId, fecha]) => {
          const entrega = entregas.find((e: any) => e.id === entregaId);
          return {
            numero: entrega?.numero_entrega,
            bultos: entrega?.cantidad_bultos,
            fecha: new Date(fecha).toLocaleDateString("es-MX", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric"
            })
          };
        });

        // Call edge function to send email (if exists)
        try {
          await supabase.functions.invoke("gmail-api", {
            body: {
              action: "sendEmail",
              email: orden.proveedores.email,
              subject: `Nuevas fechas programadas - ${orden.folio}`,
              body: `
                <h2>Fechas de entrega actualizadas</h2>
                <p>Le informamos las nuevas fechas programadas para la orden <strong>${orden.folio}</strong>:</p>
                <ul>
                  ${entregasNuevas.map(e => `<li>Tráiler ${e.numero}: ${e.bultos?.toLocaleString()} bultos - <strong>${e.fecha}</strong></li>`).join("")}
                </ul>
                <p>Saludos cordiales,<br>Abarrotes La Manita</p>
              `,
              fromEmail: "compras@almasa.com.mx"
            }
          });
          
          toast({
            title: "Fechas guardadas y notificación enviada",
            description: `Se envió notificación a ${orden.proveedores.email}`,
          });
        } catch (emailError) {
          console.error("Error sending email:", emailError);
          toast({
            title: "Fechas guardadas",
            description: "Las fechas se guardaron pero no se pudo enviar el correo al proveedor",
          });
        }
      } else {
        toast({
          title: "Fechas guardadas",
          description: "Las fechas de entrega se han actualizado correctamente",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["entregas-oc", orden?.id] });
      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["ordenes_calendario"] });
      setFechasActualizadas({});
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGuardando(false);
    }
  };

  if (!orden) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Programar Entregas
            </span>
            <Badge variant="outline">{orden.folio}</Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Proveedor</p>
              <p className="font-medium">{orden.proveedores?.nombre}</p>
              {orden.proveedores?.email && (
                <p className="text-xs text-muted-foreground">{orden.proveedores.email}</p>
              )}
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Total Orden</p>
              <p className="font-medium">${formatCurrency(orden.total)}</p>
            </div>
          </div>

          <Separator className="my-4" />

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              {/* Pending Deliveries */}
              {entregasPendientes.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2 text-amber-600">
                    <Truck className="h-4 w-4" />
                    Entregas Pendientes de Programar ({entregasPendientes.length})
                  </h4>
                  <div className="space-y-3">
                    {entregasPendientes.map((entrega: any) => (
                      <div key={entrega.id} className="flex items-center gap-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <Badge variant="outline" className="bg-amber-100 text-amber-700">
                          Tráiler {entrega.numero_entrega}
                        </Badge>
                        <span className="text-sm">
                          {entrega.cantidad_bultos?.toLocaleString()} bultos
                        </span>
                        <div className="flex-1">
                          <Input
                            type="date"
                            value={fechasActualizadas[entrega.id] || ""}
                            onChange={(e) => handleFechaChange(entrega.id, e.target.value)}
                            className="w-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scheduled Deliveries */}
              {entregasProgramadas.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2 text-green-600">
                    <Truck className="h-4 w-4" />
                    Entregas Ya Programadas ({entregasProgramadas.length})
                  </h4>
                  <div className="space-y-2">
                    {entregasProgramadas.map((entrega: any) => (
                      <div key={entrega.id} className="flex items-center gap-4 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                        <Badge variant="outline" className="bg-green-100 text-green-700">
                          Tráiler {entrega.numero_entrega}
                        </Badge>
                        <span className="text-sm">
                          {entrega.cantidad_bultos?.toLocaleString()} bultos
                        </span>
                        <span className="text-sm font-medium">
                          {new Date(entrega.fecha_programada).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {entregasPendientes.length === 0 && entregasProgramadas.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Esta orden no tiene entregas múltiples configuradas
                </p>
              )}
            </>
          )}
        </ScrollArea>

        {/* Actions */}
        {entregasPendientes.length > 0 && (
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              className="flex-1"
              onClick={handleGuardarFechas}
              disabled={guardando || Object.values(fechasActualizadas).filter(Boolean).length === 0}
            >
              {guardando ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Guardar y Notificar Proveedor
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProgramarEntregasDialog;
