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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Mail, Plus, FileText, Eye } from "lucide-react";
import ClienteCorreosManager from "@/components/clientes/ClienteCorreosManager";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { logEmailAction } from "@/hooks/useGmailPermisos";
import logoAlmasa from "@/assets/logo-almasa.png";

interface ClienteCorreo {
  id: string;
  email: string;
  nombre_contacto: string | null;
  proposito: string | null;
  es_principal: boolean | null;
}

interface EnviarCotizacionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotizacionId: string;
  clienteId: string;
  clienteNombre: string;
  folio: string;
  onSuccess?: () => void;
}

// Helper to convert image to base64
const getLogoBase64 = async (): Promise<string> => {
  try {
    const response = await fetch(logoAlmasa);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading logo:', error);
    return '';
  }
};

// Helper to parse date correctly
const parseDateLocal = (dateStr: string) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const EnviarCotizacionDialog = ({
  open,
  onOpenChange,
  cotizacionId,
  clienteId,
  clienteNombre,
  folio,
  onSuccess,
}: EnviarCotizacionDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingCorreos, setLoadingCorreos] = useState(false);
  const [correos, setCorreos] = useState<ClienteCorreo[]>([]);
  const [selectedCorreos, setSelectedCorreos] = useState<string[]>([]);
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [correosManagerOpen, setCorreosManagerOpen] = useState(false);

  // Fetch cotizacion details
  const { data: cotizacion } = useQuery({
    queryKey: ["cotizacion-enviar", cotizacionId],
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

  // Fetch Gmail account (1904@almasa.com.mx)
  const { data: gmailCuenta } = useQuery({
    queryKey: ["gmail-cuenta-1904"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gmail_cuentas")
        .select("*")
        .eq("email", "1904@almasa.com.mx")
        .eq("activo", true)
        .single();

      if (error) {
        console.error("Error fetching gmail account:", error);
        return null;
      }
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (open && clienteId) {
      loadCorreos();
    }
  }, [open, clienteId]);

  useEffect(() => {
    if (cotizacion) {
      const fechaVigencia = format(parseDateLocal(cotizacion.fecha_vigencia), "dd 'de' MMMM 'de' yyyy", { locale: es });
      setAsunto(`Cotización ${folio} - Abarrotes La Manita`);
      setMensaje(`Estimado cliente,

Adjunto encontrará la cotización ${folio} solicitada.

Esta cotización tiene vigencia hasta el ${fechaVigencia}.

Quedamos a sus órdenes para cualquier duda o aclaración.

Saludos cordiales,
Abarrotes La Manita
Tel: (55) 56-00-77-81`);
    }
  }, [cotizacion, folio]);

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
      
      // Auto-select principal email
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

  // Parse notas
  const parseNotas = (notas: string | null) => {
    if (!notas) return { notasLimpias: "", soloPrecios: false };
    const soloPrecios = notas.includes("[Solo precios]");
    const notasLimpias = notas
      .replace(/\[Cotización para: [^\]]+\]/g, "")
      .replace(/\[Solo precios\]/g, "")
      .trim();
    return { notasLimpias, soloPrecios };
  };

  // Generate HTML for the quotation
  const generarHTMLCotizacion = async () => {
    if (!cotizacion) return "";

    const logoBase64 = await getLogoBase64();
    const { soloPrecios, notasLimpias } = parseNotas(cotizacion.notas);
    
    const fechaCreacion = format(new Date(cotizacion.fecha_creacion), "dd/MM/yyyy");
    const fechaVigencia = format(parseDateLocal(cotizacion.fecha_vigencia), "dd/MM/yyyy");

    const productosHTML = cotizacion.detalles?.map((d: any) => 
      soloPrecios 
        ? `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-family: monospace;">${d.producto?.codigo || '-'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${d.producto?.nombre || 'Producto'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${d.precio_unitario?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
          </tr>`
        : `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-family: monospace;">${d.producto?.codigo || '-'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${d.producto?.nombre || 'Producto'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${d.cantidad} ${d.producto?.unidad || ''}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${d.precio_unitario?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${d.subtotal?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
          </tr>`
    ).join('') || '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Cotización ${cotizacion.folio}</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #333;">
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px;">
    <div style="display: flex; align-items: center; gap: 15px;">
      ${logoBase64 ? `<img src="${logoBase64}" alt="ALMASA" style="height: 60px; width: 60px; object-fit: contain;">` : ''}
      <div>
        <h1 style="margin: 0; color: #2563eb; font-size: 24px;">ABARROTES LA MANITA</h1>
        <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">ABARROTES LA MANITA, S.A. DE C.V.</p>
      </div>
    </div>
    <div style="text-align: right;">
      <div style="background: #2563eb; color: white; padding: 10px 20px; border-radius: 5px; font-size: 18px; font-weight: bold;">
        COTIZACIÓN
      </div>
      <p style="margin: 8px 0 0 0; font-size: 12px;">Folio: <strong>${cotizacion.folio}</strong></p>
      <p style="margin: 3px 0 0 0; font-size: 12px;">Fecha: ${fechaCreacion}</p>
    </div>
  </div>

  <!-- Vigencia -->
  <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 5px; padding: 15px; margin-bottom: 20px;">
    <p style="margin: 0; font-size: 14px;"><strong>Vigencia de esta cotización:</strong> <span style="color: #2563eb; font-size: 18px; font-weight: bold;">${fechaVigencia}</span></p>
    ${cotizacion.nombre ? `<p style="margin: 5px 0 0 0; font-size: 12px;">Referencia: ${cotizacion.nombre}</p>` : ''}
  </div>

  <!-- Client Info -->
  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
    <table style="width: 100%; font-size: 12px;">
      <tr>
        <td style="width: 50%; vertical-align: top;">
          <p style="margin: 0;"><strong>Cliente:</strong> ${cotizacion.cliente?.nombre}</p>
          <p style="margin: 3px 0 0 0;"><strong>Código:</strong> ${cotizacion.cliente?.codigo}</p>
        </td>
        <td style="width: 50%; vertical-align: top;">
          ${cotizacion.sucursal ? `
            <p style="margin: 0;"><strong>Sucursal:</strong> ${cotizacion.sucursal.nombre}</p>
            ${cotizacion.sucursal.direccion ? `<p style="margin: 3px 0 0 0;"><strong>Dirección:</strong> ${cotizacion.sucursal.direccion}</p>` : ''}
          ` : ''}
        </td>
      </tr>
    </table>
  </div>

  <!-- Products Table -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
    <thead>
      <tr style="background: #1f2937; color: white;">
        <th style="padding: 10px; text-align: left;">Código</th>
        <th style="padding: 10px; text-align: left;">Producto</th>
        ${!soloPrecios ? '<th style="padding: 10px; text-align: center;">Cantidad</th>' : ''}
        <th style="padding: 10px; text-align: right;">Precio</th>
        ${!soloPrecios ? '<th style="padding: 10px; text-align: right;">Subtotal</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${productosHTML}
    </tbody>
  </table>

  ${!soloPrecios ? `
  <!-- Totals -->
  <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
    <table style="width: 250px; font-size: 14px;">
      <tr>
        <td style="padding: 8px; text-align: right;"><strong>Subtotal:</strong></td>
        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">$${cotizacion.subtotal?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td style="padding: 8px; text-align: right;"><strong>Impuestos:</strong></td>
        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">$${cotizacion.impuestos?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr style="background: #1f2937; color: white;">
        <td style="padding: 8px; text-align: right;"><strong>Total:</strong></td>
        <td style="padding: 8px; text-align: right;"><strong>$${cotizacion.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong></td>
      </tr>
    </table>
  </div>
  ` : ''}

  ${notasLimpias ? `
  <!-- Notes -->
  <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
    <p style="margin: 0; font-size: 12px;"><strong>Notas:</strong></p>
    <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">${notasLimpias}</p>
  </div>
  ` : ''}

  <!-- Terms -->
  <div style="border: 2px solid #ddd; padding: 15px; border-radius: 5px; margin-bottom: 20px; font-size: 10px;">
    <p style="margin: 0 0 10px 0; text-align: center; font-weight: bold;">TÉRMINOS Y CONDICIONES</p>
    <ul style="margin: 0; padding-left: 20px;">
      <li>Los precios están expresados en pesos mexicanos (MXN).</li>
      <li>Esta cotización tiene vigencia hasta la fecha indicada.</li>
      <li>Los precios pueden variar sin previo aviso después de la fecha de vigencia.</li>
      <li>Los tiempos de entrega se confirmarán al momento de realizar el pedido.</li>
    </ul>
  </div>

  <!-- Footer -->
  <div style="text-align: center; border-top: 1px solid #ddd; padding-top: 15px; font-size: 11px; color: #666;">
    <p style="margin: 0;"><strong>ABARROTES LA MANITA S.A. DE C.V.</strong></p>
    <p style="margin: 3px 0 0 0;">Email: 1904@almasa.com.mx | Tel: (55) 56-00-77-81</p>
    <p style="margin: 5px 0 0 0; font-style: italic;">Gracias por su preferencia</p>
  </div>
</body>
</html>`;
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
        description: "No se encontró la cuenta de Gmail 1904@almasa.com.mx. Verifica que esté configurada y activa.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get selected email addresses
      const emailsToSend = correos
        .filter(c => selectedCorreos.includes(c.id))
        .map(c => c.email);

      // Generate HTML for the quotation
      const htmlCotizacion = await generarHTMLCotizacion();
      
      // Convert HTML to base64 for attachment
      const htmlBase64 = btoa(unescape(encodeURIComponent(htmlCotizacion)));

      // Create email body with the message
      const emailBodyHtml = `<div style="font-family: Arial, sans-serif; white-space: pre-wrap;">${mensaje.replace(/\n/g, '<br>')}</div>`;

      // Send email via Gmail API edge function
      const { data: sendResult, error: sendError } = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "send",
          email: "1904@almasa.com.mx",
          to: emailsToSend.join(", "),
          subject: asunto,
          body: emailBodyHtml,
          attachments: [
            {
              mimeType: "text/html",
              filename: `Cotizacion_${folio}.html`,
              content: htmlBase64,
            }
          ],
        },
      });

      if (sendError) throw sendError;

      // Update cotizacion status to "enviada"
      const { error: updateError } = await supabase
        .from("cotizaciones")
        .update({ status: "enviada" })
        .eq("id", cotizacionId);

      if (updateError) throw updateError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Register send in history
      if (user) {
        await supabase.from("cotizaciones_envios").insert({
          cotizacion_id: cotizacionId,
          enviado_por: user.id,
          email_destino: emailsToSend.join(", "),
          gmail_cuenta_id: gmailCuenta.id,
        });
      }

      // Log email action
      await logEmailAction(gmailCuenta.id, "enviar", {
        emailTo: emailsToSend.join(", "),
        emailSubject: asunto,
      });

      toast({
        title: "Cotización enviada",
        description: `Se envió a: ${emailsToSend.join(", ")}`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending cotizacion:", error);
      toast({
        title: "Error al enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Enviar Cotización {folio}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* From account info */}
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
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay correos registrados</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setCorreosManagerOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar correo
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                  {correos.map((correo) => (
                    <div 
                      key={correo.id} 
                      className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleCorreo(correo.id)}
                    >
                      <Checkbox
                        checked={selectedCorreos.includes(correo.id)}
                        onCheckedChange={() => toggleCorreo(correo.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{correo.email}</p>
                        {correo.nombre_contacto && (
                          <p className="text-xs text-muted-foreground">{correo.nombre_contacto}</p>
                        )}
                        {correo.es_principal && (
                          <span className="text-xs text-primary font-medium">Principal</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label>Asunto</Label>
              <Input
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label>Mensaje</Label>
              <Textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                rows={6}
              />
            </div>

            {/* Attachment info */}
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm">
              <FileText className="h-4 w-4 text-blue-600" />
              <span>Se adjuntará: <strong>Cotizacion_{folio}.html</strong></span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
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
                  Enviar ({selectedCorreos.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para gestionar correos del cliente */}
      <ClienteCorreosManager
        clienteId={clienteId}
        clienteNombre={clienteNombre}
        open={correosManagerOpen}
        onOpenChange={(open) => {
          setCorreosManagerOpen(open);
          if (!open) {
            loadCorreos();
          }
        }}
      />
    </>
  );
};

export default EnviarCotizacionDialog;
