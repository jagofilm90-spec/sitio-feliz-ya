import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Mail, Plus, FileText } from "lucide-react";
import ClienteCorreosManager from "@/components/clientes/ClienteCorreosManager";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { logEmailAction } from "@/hooks/useGmailPermisos";
import { jsPDF } from "jspdf";

interface ClienteCorreo {
  id: string;
  email: string;
  nombre_contacto: string | null;
  proposito: string | null;
  es_principal: boolean | null;
}

interface Cotizacion {
  id: string;
  folio: string;
  nombre: string | null;
  cliente_id: string;
  cliente: { nombre: string; codigo: string };
  fecha_vigencia: string;
}

interface EnviarCotizacionesMultiplesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotizaciones: Cotizacion[];
  onSuccess?: () => void;
}

const parseDateLocal = (dateStr: string) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const EnviarCotizacionesMultiplesDialog = ({
  open,
  onOpenChange,
  cotizaciones,
  onSuccess,
}: EnviarCotizacionesMultiplesDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingCorreos, setLoadingCorreos] = useState(false);
  const [correos, setCorreos] = useState<ClienteCorreo[]>([]);
  const [selectedCorreos, setSelectedCorreos] = useState<string[]>([]);
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [correosManagerOpen, setCorreosManagerOpen] = useState(false);

  // Get unique client from cotizaciones
  const clienteId = cotizaciones[0]?.cliente_id;
  const clienteNombre = cotizaciones[0]?.cliente?.nombre || "";
  const folios = cotizaciones.map(c => c.folio).join(", ");

  // Fetch Gmail account
  const { data: gmailCuenta } = useQuery({
    queryKey: ["gmail-cuenta-1904"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gmail_cuentas")
        .select("*")
        .eq("email", "1904@almasa.com.mx")
        .eq("activo", true)
        .single();
      if (error) return null;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (open && clienteId) {
      loadCorreos();
      const nombres = cotizaciones.map(c => c.nombre || c.folio).join(" y ");
      setAsunto(`Cotizaciones ${nombres} - Abarrotes La Manita`);
      setMensaje(`Estimado cliente,

Adjunto encontrará las cotizaciones solicitadas:
${cotizaciones.map(c => `• ${c.nombre || c.folio}`).join('\n')}

Quedamos a sus órdenes para cualquier duda o aclaración.

Saludos cordiales,
Abarrotes La Manita
Tel: (55) 56-00-77-81`);
    }
  }, [open, clienteId, cotizaciones]);

  const loadCorreos = async () => {
    setLoadingCorreos(true);
    try {
      const { data, error } = await supabase
        .from("cliente_correos")
        .select("id, email, nombre_contacto, proposito, es_principal")
        .eq("cliente_id", clienteId)
        .eq("activo", true)
        .order("es_principal", { ascending: false });

      if (error) throw error;
      setCorreos(data || []);
      
      const principal = data?.find(c => c.es_principal);
      if (principal) {
        setSelectedCorreos([principal.id]);
      }
    } catch (error: any) {
      console.error("Error loading correos:", error);
    } finally {
      setLoadingCorreos(false);
    }
  };

  const toggleCorreo = (correoId: string) => {
    setSelectedCorreos(prev => 
      prev.includes(correoId) 
        ? prev.filter(id => id !== correoId)
        : [...prev, correoId]
    );
  };

  const handleEnviar = async () => {
    if (selectedCorreos.length === 0) {
      toast({
        title: "Selecciona destinatarios",
        description: "Debes seleccionar al menos un correo para enviar",
        variant: "destructive",
      });
      return;
    }

    if (!gmailCuenta) {
      toast({
        title: "Error de configuración",
        description: "No se encontró la cuenta de Gmail 1904@almasa.com.mx",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const emailsToSend = correos
        .filter(c => selectedCorreos.includes(c.id))
        .map(c => c.email);

      // Generate PDF for each quotation
      const attachments = await Promise.all(
        cotizaciones.map(async (cot) => {
          const pdfBase64 = await generarPDFCotizacion(cot.id);
          return {
            mimeType: "application/pdf",
            filename: `Cotizacion_${cot.folio}.pdf`,
            content: pdfBase64,
          };
        })
      );

      const emailBodyHtml = `<div style="font-family: Arial, sans-serif; white-space: pre-wrap;">${mensaje.replace(/\n/g, '<br>')}</div>`;

      const { error: sendError } = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "send",
          email: "1904@almasa.com.mx",
          to: emailsToSend.join(", "),
          subject: asunto,
          body: emailBodyHtml,
          attachments,
        },
      });

      if (sendError) throw sendError;

      // Update all cotizaciones status
      const { error: updateError } = await supabase
        .from("cotizaciones")
        .update({ status: "enviada" })
        .in("id", cotizaciones.map(c => c.id));

      if (updateError) throw updateError;

      // Get current user and register sends
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const envios = cotizaciones.map(cot => ({
          cotizacion_id: cot.id,
          enviado_por: user.id,
          email_destino: emailsToSend.join(", "),
          gmail_cuenta_id: gmailCuenta.id,
        }));
        await supabase.from("cotizaciones_envios").insert(envios);
      }

      await logEmailAction(gmailCuenta.id, "enviar", {
        emailTo: emailsToSend.join(", "),
        emailSubject: asunto,
      });

      toast({
        title: "Cotizaciones enviadas",
        description: `Se enviaron ${cotizaciones.length} cotizaciones a: ${emailsToSend.join(", ")}`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending cotizaciones:", error);
      toast({
        title: "Error al enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generarPDFCotizacion = async (cotizacionId: string): Promise<string> => {
    const { data: cotizacion } = await supabase
      .from("cotizaciones")
      .select(`
        *,
        cliente:clientes(id, nombre, codigo),
        sucursal:cliente_sucursales(nombre, direccion),
        detalles:cotizaciones_detalles(
          id, producto_id, cantidad, precio_unitario, subtotal,
          producto:productos(nombre, codigo, unidad)
        )
      `)
      .eq("id", cotizacionId)
      .single();

    if (!cotizacion) return "";

    const soloPrecios = cotizacion.notas?.includes("[Solo precios]") || false;
    const notasLimpias = (cotizacion.notas || "")
      .replace(/\[Cotización para: [^\]]+\]/g, "")
      .replace(/\[Solo precios\]/g, "")
      .trim();
    
    const fechaCreacion = format(new Date(cotizacion.fecha_creacion), "dd 'de' MMMM 'de' yyyy", { locale: es });
    const fechaVigencia = format(parseDateLocal(cotizacion.fecha_vigencia), "dd 'de' MMMM 'de' yyyy", { locale: es });

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 15;

    const primaryColor: [number, number, number] = [37, 99, 235];
    const darkColor: [number, number, number] = [31, 41, 55];
    const grayColor: [number, number, number] = [107, 114, 128];

    // Header
    doc.setFontSize(20);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text("ABARROTES LA MANITA", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.setFont("helvetica", "normal");
    doc.text("ABARROTES LA MANITA, S.A. DE C.V.", margin, y);

    doc.setFillColor(...primaryColor);
    doc.roundedRect(pageWidth - 60, 10, 45, 12, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("COTIZACIÓN", pageWidth - 37.5, 18, { align: "center" });

    doc.setTextColor(...darkColor);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Folio: ${cotizacion.folio}`, pageWidth - margin, 26, { align: "right" });
    doc.text(`Fecha: ${fechaCreacion}`, pageWidth - margin, 31, { align: "right" });

    y = 35;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(8);
    doc.setTextColor(...darkColor);
    doc.setFont("helvetica", "bold");
    doc.text("Dirección Fiscal:", margin, y);
    doc.setFont("helvetica", "normal");
    y += 4;
    doc.text("Calle: MELCHOR OCAMPO No.Ext: 59", margin, y);
    y += 3.5;
    doc.text("Colonia: MAGDALENA MIXIUHCA", margin, y);
    y += 3.5;
    doc.text("Municipio: VENUSTIANO CARRANZA C.P.:15850", margin, y);
    y += 3.5;
    doc.text("Tel: (55) 56-00-77-81 / (55) 56-94-97-92", margin, y);

    const vigenciaY = 43;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    doc.text("Vigencia de la cotización:", pageWidth / 2 + 10, vigenciaY);
    doc.setFontSize(14);
    doc.text(fechaVigencia, pageWidth / 2 + 10, vigenciaY + 6);
    if (cotizacion.nombre) {
      doc.setFontSize(8);
      doc.setTextColor(...darkColor);
      doc.setFont("helvetica", "normal");
      doc.text(`Referencia: ${cotizacion.nombre}`, pageWidth / 2 + 10, vigenciaY + 12);
    }

    y += 10;

    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 12, 2, 2, "F");
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...darkColor);
    doc.setFont("helvetica", "bold");
    doc.text("Cliente: ", margin + 3, y);
    doc.setFont("helvetica", "normal");
    doc.text(cotizacion.cliente?.nombre || "", margin + 18, y);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Código: ", margin + 3, y);
    doc.setFont("helvetica", "normal");
    doc.text(cotizacion.cliente?.codigo || "", margin + 18, y);

    y += 10;

    const colWidths = soloPrecios 
      ? { codigo: 25, producto: pageWidth - margin * 2 - 55, precio: 30 }
      : { codigo: 22, producto: pageWidth - margin * 2 - 92, cantidad: 22, unidad: 18, precio: 25, subtotal: 25 };

    doc.setFillColor(...darkColor);
    doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");

    let xPos = margin + 2;
    doc.text("Código", xPos, y + 5);
    xPos += colWidths.codigo;
    doc.text("Producto", xPos, y + 5);
    
    if (soloPrecios) {
      doc.text("Precio", pageWidth - margin - 2, y + 5, { align: "right" });
    } else {
      xPos += (colWidths as any).producto;
      doc.text("Cant.", xPos + 5, y + 5);
      xPos += (colWidths as any).cantidad;
      doc.text("Unidad", xPos, y + 5);
      xPos += (colWidths as any).unidad;
      doc.text("Precio", xPos + 10, y + 5);
      doc.text("Subtotal", pageWidth - margin - 2, y + 5, { align: "right" });
    }

    y += 10;
    doc.setTextColor(...darkColor);
    doc.setFont("helvetica", "normal");

    const productos = cotizacion.detalles || [];
    productos.forEach((d: any, index: number) => {
      if (y > 250) { doc.addPage(); y = 20; }
      if (index % 2 === 1) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, y - 4, pageWidth - margin * 2, 7, "F");
      }

      xPos = margin + 2;
      doc.setFont("courier", "normal");
      doc.text(d.producto?.codigo || "-", xPos, y);
      xPos += colWidths.codigo;
      
      doc.setFont("helvetica", "normal");
      const nombreProducto = d.producto?.nombre || "Producto";
      const maxNombreWidth = soloPrecios ? colWidths.producto - 5 : (colWidths as any).producto - 5;
      const nombreLines = doc.splitTextToSize(nombreProducto, maxNombreWidth);
      doc.text(nombreLines[0], xPos, y);

      if (soloPrecios) {
        doc.text(`$${d.precio_unitario?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, pageWidth - margin - 2, y, { align: "right" });
      } else {
        xPos += (colWidths as any).producto;
        doc.text(String(d.cantidad || 0), xPos + 8, y, { align: "center" });
        xPos += (colWidths as any).cantidad;
        doc.text(d.producto?.unidad || "", xPos, y);
        xPos += (colWidths as any).unidad;
        doc.text(`$${d.precio_unitario?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, xPos + 20, y, { align: "right" });
        doc.text(`$${d.subtotal?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, pageWidth - margin - 2, y, { align: "right" });
      }
      y += 7;
    });

    y += 5;

    if (!soloPrecios) {
      const totalsX = pageWidth - margin - 60;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Subtotal:", totalsX, y);
      doc.setFont("helvetica", "normal");
      doc.text(`$${cotizacion.subtotal?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, pageWidth - margin - 2, y, { align: "right" });
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.text("Impuestos:", totalsX, y);
      doc.setFont("helvetica", "normal");
      doc.text(`$${cotizacion.impuestos?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, pageWidth - margin - 2, y, { align: "right" });
      y += 6;

      doc.setFillColor(...darkColor);
      doc.rect(totalsX - 5, y - 4, pageWidth - margin - totalsX + 7, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("Total:", totalsX, y);
      doc.text(`$${cotizacion.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, pageWidth - margin - 2, y, { align: "right" });
      y += 12;
    }

    doc.setTextColor(...darkColor);
    if (notasLimpias) {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 15, 2, 2, "S");
      y += 5;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Notas:", margin + 3, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...grayColor);
      const notasLines = doc.splitTextToSize(notasLimpias, pageWidth - margin * 2 - 10);
      doc.text(notasLines.slice(0, 2), margin + 3, y + 4);
      y += 18;
    }

    if (y > 240) { doc.addPage(); y = 20; }
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 2, 2, "S");
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(...darkColor);
    doc.setFont("helvetica", "bold");
    doc.text("TÉRMINOS Y CONDICIONES", pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const terms = [
      "• Los precios están expresados en pesos mexicanos (MXN).",
      "• Esta cotización tiene vigencia hasta la fecha indicada.",
      "• Los precios pueden variar sin previo aviso después de la fecha de vigencia.",
      "• Los tiempos de entrega se confirmarán al momento de realizar el pedido.",
      "• Los precios incluyen impuestos cuando aplique.",
    ];
    terms.forEach(term => { doc.text(term, margin + 5, y); y += 4; });
    y += 8;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.setFont("helvetica", "bold");
    doc.text("ABARROTES LA MANITA S.A. DE C.V.", pageWidth / 2, y, { align: "center" });
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.text("Email: 1904@almasa.com.mx | Tel: (55) 56-00-77-81", pageWidth / 2, y, { align: "center" });
    y += 4;
    doc.setFont("helvetica", "italic");
    doc.text("Gracias por su preferencia", pageWidth / 2, y, { align: "center" });

    return doc.output("datauristring").split(",")[1];
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Enviar {cotizaciones.length} Cotizaciones
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Cotizaciones to send */}
            <div className="p-3 bg-muted rounded-md space-y-1">
              <Label className="text-sm font-medium">Cotizaciones a enviar:</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {cotizaciones.map(c => (
                  <Badge key={c.id} variant="secondary">
                    <FileText className="h-3 w-3 mr-1" />
                    {c.nombre || c.folio}
                  </Badge>
                ))}
              </div>
            </div>

            {/* From account */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>Se enviará desde: <strong>1904@almasa.com.mx</strong></span>
            </div>

            {/* Recipients */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">
                  Destinatarios de {clienteNombre}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCorreosManagerOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
              
              {loadingCorreos ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : correos.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No hay correos registrados para este cliente
                </div>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {correos.map((correo) => (
                    <div
                      key={correo.id}
                      className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50"
                    >
                      <Checkbox
                        id={correo.id}
                        checked={selectedCorreos.includes(correo.id)}
                        onCheckedChange={() => toggleCorreo(correo.id)}
                      />
                      <label
                        htmlFor={correo.id}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        <span>{correo.email}</span>
                        {correo.nombre_contacto && (
                          <span className="text-muted-foreground ml-2">
                            ({correo.nombre_contacto})
                          </span>
                        )}
                        {correo.es_principal && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Principal
                          </Badge>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subject */}
            <div>
              <Label htmlFor="asunto">Asunto</Label>
              <Input
                id="asunto"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Message */}
            <div>
              <Label htmlFor="mensaje">Mensaje</Label>
              <Textarea
                id="mensaje"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                rows={6}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEnviar} disabled={loading || selectedCorreos.length === 0}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar {cotizaciones.length} cotizaciones
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClienteCorreosManager
        open={correosManagerOpen}
        onOpenChange={(open) => {
          setCorreosManagerOpen(open);
          if (!open) loadCorreos();
        }}
        clienteId={clienteId}
        clienteNombre={clienteNombre}
      />
    </>
  );
};

export default EnviarCotizacionesMultiplesDialog;
