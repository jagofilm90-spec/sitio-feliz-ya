import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, CalendarX, Check, Loader2, Pencil, X, Mail } from "lucide-react";

interface Entrega {
  id: string;
  orden_compra_id: string;
  numero_entrega: number;
  cantidad_bultos: number;
  fecha_programada: string | null;
  status: string;
}

interface EntregasPopoverProps {
  orden: any;
  entregas: Entrega[];
  entregasStatus: { total: number; programadas: number } | undefined;
}

const EntregasPopover = ({ orden, entregas, entregasStatus }: EntregasPopoverProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFecha, setEditingFecha] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  // Filter entregas for this order
  const entregasOrden = entregas.filter(e => e.orden_compra_id === orden.id);

  // For single delivery orders
  const isSingleDelivery = !orden.entregas_multiples;

  // Send notification email to supplier for scheduled deliveries
  const sendDeliveryNotificationEmail = async (scheduledEntregas: Entrega[], isDateChange: boolean = false, oldDate?: string) => {
    if (!orden.proveedores?.email) {
      console.log("No supplier email available");
      return;
    }

    try {
      // Get gmail account for sending
      const { data: gmailCuentas } = await supabase
        .from("gmail_cuentas")
        .select("id, email")
        .eq("proposito", "compras")
        .eq("activo", true)
        .limit(1);

      const gmailCuenta = gmailCuentas?.[0];
      if (!gmailCuenta) {
        console.log("No gmail account configured for compras");
        return;
      }

      const totalEntregas = entregasOrden.length;
      const programadasCount = scheduledEntregas.length;
      
      let subject: string;
      let introText: string;
      let entregasText: string;

      if (isDateChange && scheduledEntregas.length === 1 && oldDate) {
        // Single delivery date change
        const entrega = scheduledEntregas[0];
        const oldDateFormatted = format(new Date(oldDate), "dd/MM/yyyy", { locale: es });
        const newDateFormatted = format(new Date(entrega.fecha_programada!), "dd/MM/yyyy", { locale: es });
        
        subject = `[ALMASA] Cambio de fecha de entrega - ${orden.folio}`;
        introText = `Le informamos que <strong>ALMASA</strong> ha modificado la fecha de entrega #${entrega.numero_entrega} de la orden de compra:`;
        entregasText = `
          <p><strong>Fecha anterior:</strong> <span style="text-decoration: line-through; color: #999;">${oldDateFormatted}</span></p>
          <p><strong>Nueva fecha:</strong> <span style="color: #22c55e; font-weight: bold;">${newDateFormatted}</span></p>
          <p><strong>Cantidad:</strong> ${entrega.cantidad_bultos} bultos</p>
        `;
      } else {
        // New scheduling (single or multiple)
        entregasText = scheduledEntregas
          .map(e => `Entrega #${e.numero_entrega}: ${format(new Date(e.fecha_programada!), "dd/MM/yyyy", { locale: es })} (${e.cantidad_bultos} bultos)`)
          .join("<br>");

        const isPartial = programadasCount < totalEntregas;
        subject = isPartial 
          ? `[ALMASA] Programación de ${programadasCount} de ${totalEntregas} entregas - ${orden.folio}`
          : `[ALMASA] Programación de entregas - ${orden.folio}`;
        introText = `Le informamos que <strong>ALMASA</strong> ha programado ${isPartial ? `${programadasCount} de ${totalEntregas}` : "todas las"} entregas de la siguiente orden de compra:`;
        entregasText = `
          <p><strong>Entregas programadas:</strong></p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 4px;">
            ${scheduledEntregas.map(e => `Entrega #${e.numero_entrega}: ${format(new Date(e.fecha_programada!), "dd/MM/yyyy", { locale: es })} (${e.cantidad_bultos} bultos)`).join("<br>")}
          </div>
        `;
      }

      const confirmUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirmar-oc?id=${orden.id}&action=confirm-entregas&entregas=${scheduledEntregas.map(e => e.id).join(",")}`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #B22234; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Abarrotes La Manita</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <p>Estimado proveedor,</p>
            <p>${introText}</p>
            
            <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h2 style="color: #B22234; margin-top: 0;">Orden de Compra: ${orden.folio}</h2>
              ${entregasText}
            </div>

            <p>Por favor confirme la recepción de esta ${isDateChange ? "modificación" : "programación"} haciendo clic en el siguiente botón:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmUrl}" 
                 style="background: #22c55e; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                ✓ Confirmar ${isDateChange ? "Cambio de Fecha de Entrega" : "Fecha de Entrega"}
              </a>
            </div>

            <p style="color: #666; font-size: 14px;">
              Al hacer clic en el botón, usted confirma que ha recibido y acepta ${isDateChange ? "el cambio de fecha" : "las fechas de entrega programadas"}.
            </p>
          </div>
          <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">Abarrotes La Manita SA de CV</p>
          </div>
        </div>
      `;

      const { error } = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "send",
          gmailCuentaId: gmailCuenta.id,
          to: orden.proveedores.email,
          subject,
          htmlBody,
        },
      });

      if (error) throw error;

      toast({
        title: isDateChange ? "Notificación de cambio enviada" : "Notificación enviada",
        description: isDateChange 
          ? "Se notificó al proveedor sobre el cambio de fecha"
          : `Se notificó al proveedor sobre ${programadasCount} entrega(s) programada(s)`,
      });
    } catch (error: any) {
      console.error("Error sending delivery notification:", error);
      // Don't show error toast - the date was saved successfully
    }
  };

  const handleSave = async (entregaId: string) => {
    if (!editingFecha) return;
    
    // Check if this is a NEW date or a DATE CHANGE
    const entregaActual = entregasOrden.find(e => e.id === entregaId);
    const fechaAnterior = entregaActual?.fecha_programada;
    const esNuevaProgramacion = !fechaAnterior;
    const esCambioDeFecha = fechaAnterior && fechaAnterior !== editingFecha;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ordenes_compra_entregas")
        .update({ fecha_programada: editingFecha, status: "pendiente" })
        .eq("id", entregaId);

      if (error) throw error;

      toast({
        title: "Fecha actualizada",
        description: "La fecha de entrega se actualizó correctamente",
      });

      // Refresh data
      await queryClient.invalidateQueries({ queryKey: ["ordenes_compra_entregas_all"] });
      await queryClient.invalidateQueries({ queryKey: ["entregas_calendario"] });

      // Send notification based on scenario
      if (esNuevaProgramacion) {
        // New scheduling - get all pending scheduled entregas
        const { data: updatedEntregas } = await supabase
          .from("ordenes_compra_entregas")
          .select("*")
          .eq("orden_compra_id", orden.id)
          .not("fecha_programada", "is", null)
          .eq("status", "pendiente");

        if (updatedEntregas && updatedEntregas.length > 0) {
          await sendDeliveryNotificationEmail(updatedEntregas, false);
        }
      } else if (esCambioDeFecha) {
        // Date change - notify supplier of the change
        const entregaModificada = { ...entregaActual!, fecha_programada: editingFecha };
        await sendDeliveryNotificationEmail([entregaModificada], true, fechaAnterior);
      }

      setEditingId(null);
      setEditingFecha("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClearDate = async (entregaId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ordenes_compra_entregas")
        .update({ fecha_programada: null })
        .eq("id", entregaId);

      if (error) throw error;

      toast({
        title: "Fecha eliminada",
        description: "La fecha de entrega se eliminó correctamente",
      });

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra_entregas_all"] });
      queryClient.invalidateQueries({ queryKey: ["entregas_calendario"] });
      setEditingId(null);
      setEditingFecha("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSingleDelivery = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ordenes_compra")
        .update({ fecha_entrega_programada: editingFecha || null })
        .eq("id", orden.id);

      if (error) throw error;

      toast({
        title: editingFecha ? "Fecha actualizada" : "Fecha eliminada",
        description: editingFecha 
          ? "La fecha de entrega se actualizó correctamente"
          : "La fecha de entrega se eliminó correctamente",
      });

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["entregas_calendario"] });
      setEditingId(null);
      setEditingFecha("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Determine badge display
  let badgeContent;
  let badgeVariant: "default" | "destructive" | "secondary" | "outline" = "outline";
  let badgeClassName = "";

  if (orden.entregas_multiples && entregasStatus) {
    const { total, programadas } = entregasStatus;
    if (programadas === total) {
      badgeVariant = "default";
      badgeClassName = "bg-green-600 hover:bg-green-700 cursor-pointer";
      badgeContent = (
        <>
          <CalendarCheck className="h-3 w-3" />
          {total}/{total}
        </>
      );
    } else if (programadas === 0) {
      badgeVariant = "destructive";
      badgeClassName = "cursor-pointer";
      badgeContent = (
        <>
          <CalendarX className="h-3 w-3" />
          0/{total}
        </>
      );
    } else {
      badgeVariant = "secondary";
      badgeClassName = "cursor-pointer";
      badgeContent = (
        <>
          <CalendarCheck className="h-3 w-3" />
          {programadas}/{total}
        </>
      );
    }
  } else if (isSingleDelivery) {
    if (orden.fecha_entrega_programada) {
      badgeVariant = "default";
      badgeClassName = "bg-green-600 hover:bg-green-700 cursor-pointer";
      badgeContent = (
        <>
          <CalendarCheck className="h-3 w-3" />
          Programada
        </>
      );
    } else {
      badgeVariant = "outline";
      badgeClassName = "text-muted-foreground cursor-pointer";
      badgeContent = (
        <>
          <CalendarX className="h-3 w-3" />
          Sin programar
        </>
      );
    }
  } else {
    badgeVariant = "outline";
    badgeClassName = "text-muted-foreground cursor-pointer";
    badgeContent = (
      <>
        <CalendarX className="h-3 w-3" />
        Sin programar
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex">
          <Badge 
            variant={badgeVariant} 
            className={`gap-1 ${badgeClassName}`}
          >
            {badgeContent}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="font-medium text-sm">Fechas de Entrega - {orden.folio}</div>
          
          {isSingleDelivery ? (
            // Single delivery order
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <div className="flex-1">
                <div className="text-sm font-medium">Entrega única</div>
                {editingId === "single" ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="date"
                      value={editingFecha}
                      onChange={(e) => setEditingFecha(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={handleSaveSingleDelivery}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingFecha("");
                        handleSaveSingleDelivery();
                      }}
                      disabled={saving}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">
                      {orden.fecha_entrega_programada 
                        ? format(new Date(orden.fecha_entrega_programada), "dd MMM yyyy", { locale: es })
                        : "Sin fecha"}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        setEditingId("single");
                        setEditingFecha(orden.fecha_entrega_programada || "");
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : entregasOrden.length > 0 ? (
            // Multiple deliveries
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {entregasOrden
                .sort((a, b) => a.numero_entrega - b.numero_entrega)
                .map((entrega) => (
                  <div 
                    key={entrega.id} 
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium flex items-center gap-2">
                        Entrega #{entrega.numero_entrega}
                        <span className="font-normal text-muted-foreground">
                          ({entrega.cantidad_bultos} bultos)
                        </span>
                        {entrega.status === "confirmado" && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            <Check className="h-3 w-3 mr-1" />
                            Confirmada
                          </Badge>
                        )}
                      </div>
                      {editingId === entrega.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            type="date"
                            value={editingFecha}
                            onChange={(e) => setEditingFecha(e.target.value)}
                            className="h-8 text-sm"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleSave(entrega.id)}
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleClearDate(entrega.id)}
                            disabled={saving}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-muted-foreground">
                            {entrega.fecha_programada 
                              ? format(new Date(entrega.fecha_programada), "dd MMM yyyy", { locale: es })
                              : "Sin fecha"}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => {
                              setEditingId(entrega.id);
                              setEditingFecha(entrega.fecha_programada || "");
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {entrega.fecha_programada ? (
                      <CalendarCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <CalendarX className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-2">
              No hay entregas registradas
            </div>
          )}

          {!isSingleDelivery && orden.proveedores?.email && (
            <div className="text-xs text-muted-foreground pt-2 border-t flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Al guardar fechas se notificará automáticamente al proveedor
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EntregasPopover;
