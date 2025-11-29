import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar, Truck, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Entrega {
  id: string;
  cantidad_bultos: number;
  fecha_programada: string;
}

interface ConvertirEntregasMultiplesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orden: any;
}

const ConvertirEntregasMultiplesDialog = ({ open, onOpenChange, orden }: ConvertirEntregasMultiplesDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [guardando, setGuardando] = useState(false);
  const [entregas, setEntregas] = useState<Entrega[]>([]);

  // Calculate total units from order details
  const totalUnidades = orden?.ordenes_compra_detalles?.reduce(
    (sum: number, d: any) => sum + (d.cantidad_ordenada || 0),
    0
  ) || 0;

  // Calculate total already assigned
  const totalAsignado = entregas.reduce((sum, e) => sum + (e.cantidad_bultos || 0), 0);
  const faltante = totalUnidades - totalAsignado;

  // Initialize with current scheduled date as first delivery
  useEffect(() => {
    if (open && orden) {
      setEntregas([
        {
          id: crypto.randomUUID(),
          cantidad_bultos: 0,
          fecha_programada: orden.fecha_entrega_programada || "",
        },
      ]);
    }
  }, [open, orden]);

  const handleAddEntrega = () => {
    setEntregas([
      ...entregas,
      {
        id: crypto.randomUUID(),
        cantidad_bultos: 0,
        fecha_programada: "",
      },
    ]);
  };

  const handleRemoveEntrega = (id: string) => {
    if (entregas.length <= 1) return;
    setEntregas(entregas.filter((e) => e.id !== id));
  };

  const handleEntregaChange = (id: string, field: keyof Entrega, value: any) => {
    setEntregas(
      entregas.map((e) =>
        e.id === id ? { ...e, [field]: field === "cantidad_bultos" ? parseInt(value) || 0 : value } : e
      )
    );
  };

  const handleAsignarFaltante = (id: string) => {
    if (faltante > 0) {
      handleEntregaChange(id, "cantidad_bultos", faltante + (entregas.find(e => e.id === id)?.cantidad_bultos || 0));
    }
  };

  const handleGuardar = async () => {
    // Validations
    if (entregas.length < 2) {
      toast({
        title: "Mínimo 2 entregas",
        description: "Para dividir la orden necesitas al menos 2 entregas programadas",
        variant: "destructive",
      });
      return;
    }

    if (totalAsignado !== totalUnidades) {
      toast({
        title: "Cantidades no coinciden",
        description: `El total asignado (${totalAsignado}) debe ser igual al total de la orden (${totalUnidades})`,
        variant: "destructive",
      });
      return;
    }

    const entregasSinFecha = entregas.filter((e) => !e.fecha_programada);
    if (entregasSinFecha.length > 0) {
      toast({
        title: "Fechas requeridas",
        description: "Todas las entregas deben tener fecha programada",
        variant: "destructive",
      });
      return;
    }

    const entregasSinCantidad = entregas.filter((e) => !e.cantidad_bultos || e.cantidad_bultos <= 0);
    if (entregasSinCantidad.length > 0) {
      toast({
        title: "Cantidades requeridas",
        description: "Todas las entregas deben tener cantidad mayor a 0",
        variant: "destructive",
      });
      return;
    }

    setGuardando(true);
    try {
      // 1. Create delivery entries
      const entregasData = entregas.map((e, index) => ({
        orden_compra_id: orden.id,
        numero_entrega: index + 1,
        cantidad_bultos: e.cantidad_bultos,
        fecha_programada: e.fecha_programada,
        status: "programada",
      }));

      const { error: entregasError } = await supabase
        .from("ordenes_compra_entregas")
        .insert(entregasData);

      if (entregasError) throw entregasError;

      // 2. Update order to mark as multiple deliveries
      const { error: ordenError } = await supabase
        .from("ordenes_compra")
        .update({
          entregas_multiples: true,
          // Keep the first delivery date as the main date
          fecha_entrega_programada: entregas[0].fecha_programada,
        })
        .eq("id", orden.id);

      if (ordenError) throw ordenError;

      // 3. Send notification email to supplier if they have email
      if (orden?.proveedores?.email) {
        try {
          const entregasHtml = entregas.map((e, i) => {
            // Parse date without timezone conversion to avoid shifting dates
            const [year, month, day] = e.fecha_programada.split('-').map(Number);
            const fechaLocal = new Date(year, month - 1, day);
            const fecha = fechaLocal.toLocaleDateString("es-MX", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            return `<li><strong>Entrega ${i + 1}:</strong> ${e.cantidad_bultos.toLocaleString()} bultos - ${fecha}</li>`;
          }).join("");

          const htmlBody = `
            <h2>Calendario de entregas - ${orden.folio}</h2>
            <p>Se ha programado la entrega de su orden en múltiples fechas:</p>
            <ul>${entregasHtml}</ul>
            <p><strong>Total de la orden:</strong> ${totalUnidades.toLocaleString()} unidades</p>
            <p>Saludos cordiales,<br>Abarrotes La Manita</p>
          `;

          await supabase.functions.invoke("gmail-api", {
            body: {
              action: "send",
              email: "compras@almasa.com.mx",
              to: orden.proveedores.email,
              subject: `Calendario de entregas - ${orden.folio}`,
              body: htmlBody,
            },
          });

          toast({
            title: "Entregas programadas",
            description: `Se crearon ${entregas.length} entregas y se notificó al proveedor`,
          });
        } catch (emailError) {
          console.error("Error sending email:", emailError);
          toast({
            title: "Entregas programadas",
            description: "Las entregas se programaron pero no se pudo enviar el correo",
          });
        }
      } else {
        toast({
          title: "Entregas programadas",
          description: `Se crearon ${entregas.length} entregas correctamente`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["ordenes_calendario"] });
      queryClient.invalidateQueries({ queryKey: ["entregas-oc", orden.id] });
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
              <Truck className="h-5 w-5" />
              Dividir en Entregas Múltiples
            </span>
            <Badge variant="outline">{orden.folio}</Badge>
          </DialogTitle>
          <DialogDescription>
            Divide la orden en varias entregas con diferentes fechas. El proveedor será notificado.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Proveedor</p>
              <p className="font-medium">{orden.proveedores?.nombre}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Total Unidades</p>
              <p className="font-medium">{totalUnidades.toLocaleString()}</p>
            </div>
          </div>

          {/* Summary */}
          <div className={`p-3 rounded-lg mb-4 ${faltante === 0 ? "bg-green-50 dark:bg-green-950/20 border border-green-200" : "bg-amber-50 dark:bg-amber-950/20 border border-amber-200"}`}>
            <div className="flex justify-between items-center">
              <span className="text-sm">
                Asignado: <strong>{totalAsignado.toLocaleString()}</strong> / {totalUnidades.toLocaleString()}
              </span>
              {faltante !== 0 && (
                <Badge variant="secondary" className={faltante > 0 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}>
                  {faltante > 0 ? `Faltan ${faltante.toLocaleString()}` : `Exceso de ${Math.abs(faltante).toLocaleString()}`}
                </Badge>
              )}
              {faltante === 0 && (
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  ✓ Completo
                </Badge>
              )}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Deliveries List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Entregas Programadas</h4>
              <Button variant="outline" size="sm" onClick={handleAddEntrega}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar Entrega
              </Button>
            </div>

            {entregas.map((entrega, index) => (
              <div
                key={entrega.id}
                className="p-4 border rounded-lg space-y-3 bg-card"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Entrega {index + 1}</Badge>
                  {entregas.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveEntrega(entrega.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Cantidad (bultos/unidades)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={entrega.cantidad_bultos || ""}
                        onChange={(e) =>
                          handleEntregaChange(entrega.id, "cantidad_bultos", e.target.value)
                        }
                        placeholder="0"
                      />
                      {faltante > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAsignarFaltante(entrega.id)}
                          title="Asignar faltante"
                        >
                          +{faltante}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Fecha Programada</Label>
                    <Input
                      type="date"
                      value={entrega.fecha_programada}
                      onChange={(e) =>
                        handleEntregaChange(entrega.id, "fecha_programada", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Warning */}
          {entregas.length < 2 && (
            <div className="flex items-center gap-2 text-amber-600 text-sm mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              Agrega al menos 2 entregas para dividir la orden
            </div>
          )}
        </ScrollArea>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleGuardar}
            disabled={guardando || entregas.length < 2 || faltante !== 0}
          >
            {guardando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4 mr-2" />
                Guardar Entregas
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConvertirEntregasMultiplesDialog;
