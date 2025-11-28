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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Loader2, Package, Building2, Calendar, DollarSign, Truck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface AutorizacionOCDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orden: any;
}

const AutorizacionOCDialog = ({ open, onOpenChange, orden }: AutorizacionOCDialogProps) => {
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
    queryKey: ["profile", orden?.creado_por],
    queryFn: async () => {
      if (!orden?.creado_por) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", orden.creado_por)
        .single();
      return data;
    },
    enabled: !!orden?.creado_por,
  });

  // Fetch scheduled deliveries
  const { data: entregasProgramadas = [] } = useQuery({
    queryKey: ["entregas-oc", orden?.id],
    queryFn: async () => {
      if (!orden?.id) return [];
      const { data } = await supabase
        .from("ordenes_compra_entregas")
        .select("*")
        .eq("orden_compra_id", orden.id)
        .order("numero_entrega");
      return data || [];
    },
    enabled: !!orden?.id && orden?.entregas_multiples,
  });

  const handleAutorizar = async () => {
    setAutorizando(true);
    try {
      // Update order with authorization
      const { error: updateError } = await supabase
        .from("ordenes_compra")
        .update({ 
          status: "autorizada",
          autorizado_por: currentUser?.id,
          fecha_autorizacion: new Date().toISOString()
        })
        .eq("id", orden.id);

      if (updateError) throw updateError;

      // Mark notification as read
      await supabase
        .from("notificaciones")
        .update({ leida: true })
        .eq("orden_compra_id", orden.id)
        .eq("tipo", "autorizacion_oc");

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });

      toast({
        title: "Orden autorizada",
        description: `La orden ${orden.folio} ha sido autorizada exitosamente`,
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
        .from("ordenes_compra")
        .update({ 
          status: "rechazada",
          rechazado_por: currentUser?.id,
          fecha_rechazo: new Date().toISOString(),
          motivo_rechazo: motivoRechazo
        })
        .eq("id", orden.id);

      if (updateError) throw updateError;

      // Mark notification as read
      await supabase
        .from("notificaciones")
        .update({ leida: true })
        .eq("orden_compra_id", orden.id)
        .eq("tipo", "autorizacion_oc");

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });

      toast({
        title: "Orden rechazada",
        description: `La orden ${orden.folio} ha sido rechazada`,
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

  if (!orden) return null;

  const detalles = orden.ordenes_compra_detalles || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Autorización de Orden de Compra</span>
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
              {orden.folio}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Proveedor</p>
                <p className="font-medium">{orden.proveedores?.nombre || "Sin proveedor"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Fecha de Orden</p>
                <p className="font-medium">
                  {new Date(orden.fecha_orden).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Solicitante */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm">
              <span className="text-muted-foreground">Solicitado por:</span>{" "}
              <span className="font-medium">{creadorProfile?.full_name || "Usuario"}</span>
            </p>
          </div>

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
                    <th className="text-center p-2">Cant.</th>
                    <th className="text-right p-2">P. Unit.</th>
                    <th className="text-right p-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {detalles.map((d: any, idx: number) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{d.productos?.nombre || "Producto"}</td>
                      <td className="text-center p-2">{d.cantidad_ordenada?.toLocaleString()}</td>
                      <td className="text-right p-2">${formatCurrency(d.precio_unitario_compra)}</td>
                      <td className="text-right p-2 font-medium">${formatCurrency(d.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scheduled Deliveries */}
          {orden.entregas_multiples && entregasProgramadas.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Entregas Programadas ({entregasProgramadas.length})
              </h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Entrega</th>
                      <th className="text-center p-2">Bultos</th>
                      <th className="text-right p-2">Fecha Programada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entregasProgramadas.map((e: any) => (
                      <tr key={e.id} className="border-t">
                        <td className="p-2">
                          <Badge variant="outline">Tráiler {e.numero_entrega}</Badge>
                        </td>
                        <td className="text-center p-2">{e.cantidad_bultos?.toLocaleString()}</td>
                        <td className="text-right p-2 font-medium">
                          {e.fecha_programada ? (
                            new Date(e.fecha_programada).toLocaleDateString("es-MX", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          ) : (
                            <Badge variant="secondary" className="text-amber-600 bg-amber-100">
                              Pendiente de programar
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="flex justify-end mb-4">
            <div className="w-64 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>${formatCurrency(orden.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA (16%):</span>
                <span>${formatCurrency(orden.impuestos)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-lg">
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Total:
                </span>
                <span className="text-primary">${formatCurrency(orden.total)}</span>
              </div>
            </div>
          </div>

          {/* Notas */}
          {orden.notas && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm">
                <span className="font-medium">Notas:</span> {orden.notas}
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
                placeholder="Indica el motivo por el cual rechazas esta orden..."
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

export default AutorizacionOCDialog;
