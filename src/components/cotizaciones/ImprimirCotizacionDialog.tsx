import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Printer, Download } from "lucide-react";
import { CotizacionPrintTemplate } from "./CotizacionPrintTemplate";

interface ImprimirCotizacionDialogProps {
  cotizacionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ImprimirCotizacionDialog = ({
  cotizacionId,
  open,
  onOpenChange,
}: ImprimirCotizacionDialogProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  const { data: cotizacion, isLoading } = useQuery({
    queryKey: ["cotizacion-print", cotizacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select(`
          *,
          cliente:clientes(id, nombre, codigo, email),
          sucursal:cliente_sucursales(nombre, direccion),
          detalles:cotizaciones_detalles(
            id,
            producto_id,
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

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Extract and copy stylesheets
    const styles = Array.from(document.styleSheets)
      .map((styleSheet) => {
        try {
          return Array.from(styleSheet.cssRules)
            .map((rule) => rule.cssText)
            .join("\n");
        } catch {
          return "";
        }
      })
      .join("\n");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cotización ${cotizacion?.folio}</title>
          <style>
            ${styles}
            @media print {
              body { margin: 0; padding: 0; }
              @page { size: letter; margin: 0.5in; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Parse notas to remove system tags and check if "solo precios"
  const parseNotas = (notas: string | null) => {
    if (!notas) return { notasLimpias: "", soloPrecios: false };
    const soloPrecios = notas.includes("[Solo precios]");
    const notasLimpias = notas
      .replace(/\[Cotización para: [^\]]+\]/g, "")
      .replace(/\[Solo precios\]/g, "")
      .trim();
    return { notasLimpias, soloPrecios };
  };

  const { notasLimpias, soloPrecios } = parseNotas(cotizacion?.notas);

  const datosCotizacion = cotizacion ? {
    folio: cotizacion.folio,
    nombre: cotizacion.nombre || undefined,
    fecha_creacion: cotizacion.fecha_creacion,
    fecha_vigencia: cotizacion.fecha_vigencia,
    cliente: {
      nombre: cotizacion.cliente?.nombre || "Cliente",
      codigo: cotizacion.cliente?.codigo || "",
      email: cotizacion.cliente?.email || undefined,
    },
    sucursal: cotizacion.sucursal ? {
      nombre: cotizacion.sucursal.nombre,
      direccion: cotizacion.sucursal.direccion || undefined,
    } : undefined,
    productos: cotizacion.detalles?.map((d: any) => ({
      codigo: d.producto?.codigo || "",
      nombre: d.producto?.nombre || "Producto",
      unidad: d.producto?.unidad || "pieza",
      cantidad: d.cantidad || 0,
      precio_unitario: d.precio_unitario || 0,
      subtotal: d.subtotal || 0,
    })) || [],
    subtotal: cotizacion.subtotal || 0,
    impuestos: cotizacion.impuestos || 0,
    total: cotizacion.total || 0,
    notas: notasLimpias || undefined,
    soloPrecios,
  } : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Vista previa - Cotización {cotizacion?.folio}</span>
            <div className="flex gap-2">
              <Button onClick={handlePrint} disabled={isLoading}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : datosCotizacion ? (
            <div ref={printRef} className="shadow-lg">
              <CotizacionPrintTemplate datos={datosCotizacion} />
            </div>
          ) : (
            <p className="text-center text-muted-foreground">No se pudo cargar la cotización</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImprimirCotizacionDialog;
