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
  unidad: string; // Presentación calculada para bodegueros
  descripcion: string;
  precio_unitario: number;
  total: number;
  cantidadDisplay?: string; // Cantidad con unidad original (ej: "45 kg")
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
      
      // Usar método de descarga con anchor element (funciona en móvil y escritorio)
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Remision_${datos.folio}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpiar URL después de un momento
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      
      toast.success('PDF descargado');
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

    // Obtener todos los estilos de la página actual
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
          <title>Remisión ${datos?.folio}</title>
          <style>
            ${styles}
            @media print {
              body { 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important;
                margin: 0;
                padding: 0;
              }
              @page { 
                size: letter; 
                margin: 0.5in; 
              }
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              background: white;
            }
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
