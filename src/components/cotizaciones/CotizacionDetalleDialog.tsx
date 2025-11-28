import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Send,
  ShoppingCart,
  Download,
  Loader2,
  Mail,
  Calendar,
  Building,
  User,
} from "lucide-react";
import { format, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";

interface CotizacionDetalleDialogProps {
  cotizacionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const CotizacionDetalleDialog = ({
  cotizacionId,
  open,
  onOpenChange,
  onUpdate,
}: CotizacionDetalleDialogProps) => {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const { data: cotizacion, isLoading } = useQuery({
    queryKey: ["cotizacion", cotizacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select(`
          *,
          cliente:clientes(nombre, codigo, email),
          sucursal:cliente_sucursales(nombre, direccion),
          detalles:cotizaciones_detalles(
            id,
            cantidad,
            precio_unitario,
            subtotal,
            producto:productos(nombre, codigo, unidad)
          )
        `)
        .eq("id", cotizacionId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const getStatusBadge = () => {
    if (!cotizacion) return null;
    
    const hoy = new Date();
    const vigencia = new Date(cotizacion.fecha_vigencia);

    if (cotizacion.status === "aceptada") {
      return <Badge className="bg-green-500/20 text-green-700">Aceptada</Badge>;
    }
    if (cotizacion.status === "rechazada") {
      return <Badge variant="destructive">Rechazada</Badge>;
    }
    if (cotizacion.status === "enviada" && isBefore(vigencia, hoy)) {
      return <Badge className="bg-red-500/20 text-red-700">Vencida</Badge>;
    }
    if (cotizacion.status === "enviada") {
      return <Badge className="bg-blue-500/20 text-blue-700">Enviada</Badge>;
    }
    return <Badge variant="secondary">Borrador</Badge>;
  };

  const handleEnviarEmail = async () => {
    setSending(true);
    try {
      // Update status to enviada
      const { error } = await supabase
        .from("cotizaciones")
        .update({ status: "enviada" })
        .eq("id", cotizacionId);

      if (error) throw error;

      toast({
        title: "Cotización enviada",
        description: "El estado ha sido actualizado a 'Enviada'",
      });

      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleConvertirPedido = async () => {
    toast({
      title: "Próximamente",
      description: "La conversión a pedido estará disponible pronto",
    });
  };

  const handleDescargarPDF = () => {
    toast({
      title: "Próximamente",
      description: "La descarga de PDF estará disponible pronto",
    });
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!cotizacion) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Cotización {cotizacion.folio}
            </DialogTitle>
            {getStatusBadge()}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{cotizacion.cliente?.nombre}</p>
                </div>
              </div>
              {cotizacion.sucursal && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Sucursal</p>
                    <p className="font-medium">{cotizacion.sucursal.nombre}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Fecha creación</p>
                  <p className="font-medium">
                    {format(new Date(cotizacion.fecha_creacion), "dd/MM/yyyy", { locale: es })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Vigencia hasta</p>
                  <p className="font-medium">
                    {format(new Date(cotizacion.fecha_vigencia), "dd/MM/yyyy", { locale: es })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Products table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-center">Cantidad</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cotizacion.detalles?.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{d.producto?.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.producto?.codigo} • {d.producto?.unidad}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{d.cantidad}</TableCell>
                    <TableCell className="text-right font-mono">
                      ${formatCurrency(d.precio_unitario)}
                    </TableCell>
                    <TableCell className="text-right font-medium font-mono">
                      ${formatCurrency(d.subtotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-mono">${formatCurrency(cotizacion.subtotal)}</span>
              </div>
              <div className="flex justify-between text-blue-600">
                <span>Impuestos:</span>
                <span className="font-mono">${formatCurrency(cotizacion.impuestos)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span className="font-mono">${formatCurrency(cotizacion.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {cotizacion.notas && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Notas:</p>
              <p className="text-sm">{cotizacion.notas}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleDescargarPDF}>
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
            {cotizacion.status === "borrador" && (
              <Button onClick={handleEnviarEmail} disabled={sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Marcar como enviada
              </Button>
            )}
            {(cotizacion.status === "enviada" || cotizacion.status === "aceptada") && (
              <Button onClick={handleConvertirPedido}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Convertir a pedido
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CotizacionDetalleDialog;
