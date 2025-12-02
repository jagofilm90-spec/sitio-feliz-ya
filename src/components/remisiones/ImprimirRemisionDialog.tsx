import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2 } from "lucide-react";
import { RemisionPrintTemplate } from "./RemisionPrintTemplate";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ProductoRemision {
  cantidad: number;
  unidad: string;
  descripcion: string;
  precio_unitario: number;
  total: number;
}

interface DatosRemision {
  folio: string;
  fecha: string;
  cliente: {
    nombre: string;
    rfc?: string;
    direccion_fiscal?: string;
    telefono?: string;
  };
  sucursal?: {
    nombre: string;
    direccion?: string;
  };
  productos: ProductoRemision[];
  subtotal: number;
  iva: number;
  total: number;
  condiciones_credito: string;
  vendedor?: string;
  notas?: string;
}

interface ImprimirRemisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datos: DatosRemision | null;
}

export const ImprimirRemisionDialog = ({ open, onOpenChange, datos }: ImprimirRemisionDialogProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    const printContent = printRef.current;
    if (!printContent || !datos) return;

    setIsDownloading(true);
    try {
      const canvas = await html2canvas(printContent, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 5;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`Remision_${datos.folio}.pdf`);
      toast.success('PDF descargado correctamente');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Remisión ${datos?.folio}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; font-size: 12px; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            .print-container { padding: 20px; max-width: 8.5in; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #B22234; padding-bottom: 16px; margin-bottom: 16px; }
            .logo-section { display: flex; align-items: center; gap: 16px; }
            .logo { height: 64px; width: 64px; object-fit: contain; }
            .company-name { font-size: 24px; font-weight: bold; color: #B22234; }
            .company-legal { font-size: 10px; color: #666; }
            .nota-badge { background: #B22234; color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold; font-size: 16px; }
            .folio-info { text-align: right; font-size: 10px; margin-top: 4px; }
            .folio-info span { font-weight: bold; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 16px; font-size: 10px; }
            .info-grid p { margin: 2px 0; }
            .info-grid .font-semibold { font-weight: 600; }
            .client-box { background: #f3f4f6; padding: 12px; border-radius: 4px; margin-bottom: 16px; }
            .client-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
            th { background: #1f2937; color: white; padding: 8px; text-align: left; }
            th:nth-child(4), th:nth-child(5) { text-align: right; }
            td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
            td:nth-child(4), td:nth-child(5) { text-align: right; }
            tr:nth-child(even) { background: #f9fafb; }
            .totals-section { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 16px; }
            .bank-info { border: 1px solid #e5e7eb; padding: 8px; border-radius: 4px; font-size: 10px; margin-bottom: 8px; }
            .totals-table { width: 100%; font-size: 12px; }
            .totals-table td { padding: 8px; }
            .totals-table td:first-child { text-align: right; font-weight: 600; }
            .totals-table td:last-child { text-align: right; border: 1px solid #e5e7eb; width: 120px; }
            .total-row { background: #1f2937; color: white; }
            .total-row td { font-weight: bold; border: none !important; }
            .pagare { border: 2px solid #9ca3af; padding: 12px; font-size: 9px; line-height: 1.4; margin-bottom: 16px; }
            .pagare-title { text-align: center; font-weight: bold; margin-bottom: 8px; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 16px; }
            .signature-line { border-bottom: 1px solid black; height: 32px; margin-bottom: 4px; }
            .signature-label { text-align: center; font-size: 9px; }
            .footer { text-align: center; font-size: 10px; color: #666; border-top: 1px solid #e5e7eb; padding-top: 8px; }
            .footer-warning { font-weight: bold; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  if (!datos) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Vista Previa - Remisión {datos.folio}</span>
            <div className="flex gap-2">
              <Button 
                onClick={handleDownloadPdf} 
                variant="outline" 
                className="gap-2"
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Descargar PDF
              </Button>
              <Button onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div ref={printRef} className="bg-white border rounded-lg overflow-hidden">
          <RemisionPrintTemplate datos={datos} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
