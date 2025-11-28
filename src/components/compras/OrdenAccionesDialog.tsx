import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, CheckCircle, XCircle, Mail, Loader2, Pencil } from "lucide-react";

interface OrdenAccionesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orden: any;
  onEdit?: (orden: any) => void;
}

const OrdenAccionesDialog = ({ open, onOpenChange, orden, onEdit }: OrdenAccionesDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [accion, setAccion] = useState<"cambiar_fecha" | "recibir" | "devolver" | "enviar_email" | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [motivoDevolucion, setMotivoDevolucion] = useState("");
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const updateOrden = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("ordenes_compra")
        .update(data)
        .eq("id", orden.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["ordenes_calendario"] });
      toast({
        title: "Orden actualizada",
        description: "La orden se ha actualizado correctamente",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setAccion(null);
    setNuevaFecha("");
    setMotivoDevolucion("");
  };

  const handleCambiarFecha = () => {
    if (!nuevaFecha) {
      toast({
        title: "Fecha requerida",
        description: "Selecciona una nueva fecha de entrega",
        variant: "destructive",
      });
      return;
    }
    updateOrden.mutate({ fecha_entrega_programada: nuevaFecha });
  };

  const handleMarcarRecibida = () => {
    updateOrden.mutate({
      status: "recibida",
      fecha_entrega_real: new Date().toISOString(),
    });
  };

  const handleMarcarDevuelta = () => {
    if (!motivoDevolucion.trim()) {
      toast({
        title: "Motivo requerido",
        description: "Indica el motivo de la devolución",
        variant: "destructive",
      });
      return;
    }
    updateOrden.mutate({
      status: "devuelta",
      motivo_devolucion: motivoDevolucion,
    });
  };

  const handleEnviarOrden = async () => {
    if (!orden?.proveedores?.email) {
      toast({
        title: "Sin correo",
        description: "El proveedor no tiene un correo registrado",
        variant: "destructive",
      });
      return;
    }

    setEnviandoEmail(true);

    try {
      // Build order details HTML
      const detalles = orden.ordenes_compra_detalles || [];
      const productosHTML = detalles.map((d: any) => 
        `<tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${d.productos?.nombre || 'Producto'}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${d.cantidad_ordenada}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${d.precio_unitario_compra?.toLocaleString()}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${d.subtotal?.toLocaleString()}</td>
        </tr>`
      ).join('');

      const fechaEntrega = orden.fecha_entrega_programada 
        ? new Date(orden.fecha_entrega_programada).toLocaleDateString('es-MX', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        : 'Por confirmar';

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Orden de Compra: ${orden.folio}</h2>
          <p>Estimado proveedor <strong>${orden.proveedores?.nombre}</strong>,</p>
          <p>Por medio del presente, le enviamos nuestra orden de compra con los siguientes detalles:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Producto</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Cantidad</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Precio Unit.</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${productosHTML}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 8px; border: 1px solid #ddd; text-align: right;"><strong>Subtotal:</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${orden.subtotal?.toLocaleString()}</td>
              </tr>
              <tr>
                <td colspan="3" style="padding: 8px; border: 1px solid #ddd; text-align: right;"><strong>IVA (16%):</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${orden.impuestos?.toLocaleString()}</td>
              </tr>
              <tr style="background-color: #f5f5f5;">
                <td colspan="3" style="padding: 8px; border: 1px solid #ddd; text-align: right;"><strong>TOTAL:</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;"><strong>$${orden.total?.toLocaleString()}</strong></td>
              </tr>
            </tfoot>
          </table>

          <p><strong>Fecha de entrega programada:</strong> ${fechaEntrega}</p>
          
          ${orden.notas ? `<p><strong>Notas:</strong> ${orden.notas}</p>` : ''}

          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
          <p style="color: #666; font-size: 12px;">
            Este correo fue enviado desde el sistema de Abarrotes La Manita.<br/>
            Por favor confirme la recepción de esta orden.
          </p>
        </div>
      `;

      const { data, error } = await supabase.functions.invoke('gmail-api', {
        body: {
          action: 'send',
          email: 'pedidos@almasa.com.mx',
          to: orden.proveedores.email,
          subject: `Orden de Compra ${orden.folio} - Abarrotes La Manita`,
          body: htmlBody,
        },
      });

      if (error) throw error;

      toast({
        title: "Orden enviada",
        description: `La orden se envió correctamente a ${orden.proveedores.email}`,
      });
      
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error sending order email:', error);
      toast({
        title: "Error al enviar",
        description: error.message || "No se pudo enviar el correo",
        variant: "destructive",
      });
    } finally {
      setEnviandoEmail(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gestionar Orden {orden?.folio}</DialogTitle>
          <DialogDescription>
            Modifica la fecha de entrega, marca como recibida o devuelta
          </DialogDescription>
        </DialogHeader>

        {!accion ? (
          <div className="space-y-3">
            {onEdit && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(orden);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar Orden de Compra
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setAccion("enviar_email")}
            >
              <Mail className="mr-2 h-4 w-4" />
              Enviar Orden de Compra al Proveedor
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setAccion("cambiar_fecha")}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Cambiar Fecha de Entrega
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setAccion("recibir")}
              disabled={orden?.status === "recibida"}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Marcar como Recibida
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setAccion("devolver")}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Marcar como Devuelta
            </Button>
          </div>
        ) : accion === "enviar_email" ? (
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="font-medium">¿Estás seguro de que los datos son correctos?</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Proveedor:</strong> {orden?.proveedores?.nombre}</p>
                <p><strong>Correo destino:</strong> {orden?.proveedores?.email || <span className="text-destructive">Sin correo registrado</span>}</p>
                <p><strong>Total de la orden:</strong> ${orden?.total?.toLocaleString()}</p>
                <p><strong>Productos:</strong> {orden?.ordenes_compra_detalles?.length || 0} items</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Se enviará desde: <strong>pedidos@almasa.com.mx</strong>
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleEnviarOrden} 
                disabled={enviandoEmail || !orden?.proveedores?.email}
              >
                {enviandoEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Sí, enviar"
                )}
              </Button>
              <Button variant="ghost" onClick={() => setAccion(null)}>
                No, regresar
              </Button>
            </div>
          </div>
        ) : accion === "cambiar_fecha" ? (
          <div className="space-y-4">
            <div>
              <Label>Nueva Fecha de Entrega</Label>
              <Input
                type="date"
                value={nuevaFecha}
                onChange={(e) => setNuevaFecha(e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Fecha actual: {orden?.fecha_entrega_programada
                  ? new Date(orden.fecha_entrega_programada).toLocaleDateString()
                  : "Sin programar"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCambiarFecha} disabled={updateOrden.isPending}>
                Actualizar Fecha
              </Button>
              <Button variant="ghost" onClick={() => setAccion(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : accion === "recibir" ? (
          <div className="space-y-4">
            <p>¿Confirmas que la mercancía fue recibida el día de hoy?</p>
            <div className="flex gap-2">
              <Button onClick={handleMarcarRecibida} disabled={updateOrden.isPending}>
                Sí, Marcar como Recibida
              </Button>
              <Button variant="ghost" onClick={() => setAccion(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Motivo de Devolución</Label>
              <Textarea
                value={motivoDevolucion}
                onChange={(e) => setMotivoDevolucion(e.target.value)}
                placeholder="Describe por qué se devuelve la mercancía..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleMarcarDevuelta}
                disabled={updateOrden.isPending}
                variant="destructive"
              >
                Registrar Devolución
              </Button>
              <Button variant="ghost" onClick={() => setAccion(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OrdenAccionesDialog;
