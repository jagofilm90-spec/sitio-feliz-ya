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
import { generarCotizacionPDF } from "@/utils/cotizacionPdfGenerator";

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
            producto:productos(nombre, codigo, unidad, aplica_iva, aplica_ieps)
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

  // Generate PDF for the quotation
  const generarPDFCotizacion = async (): Promise<string> => {
    if (!cotizacion) return "";

    const productos = (cotizacion.detalles || []).map((d: any) => ({
      codigo: d.producto?.codigo || "-",
      nombre: d.producto?.nombre || "Producto",
      unidad: d.producto?.unidad || "",
      cantidad: d.cantidad || 0,
      precio_unitario: d.precio_unitario || 0,
      subtotal: d.subtotal || 0,
      cantidad_maxima: d.cantidad_maxima,
      nota_linea: d.nota_linea,
    }));

    // Calcular IVA e IEPS desglosados
    let subtotalConIvaYIeps = 0;
    let subtotalConIva = 0;
    let subtotalSinImpuestos = 0;
    
    (cotizacion.detalles || []).forEach((d: any) => {
      const prod = d.producto;
      if (prod?.aplica_iva && prod?.aplica_ieps) {
        subtotalConIvaYIeps += d.subtotal || 0;
      } else if (prod?.aplica_iva) {
        subtotalConIva += d.subtotal || 0;
      } else {
        subtotalSinImpuestos += d.subtotal || 0;
      }
    });

    const baseConIvaYIeps = subtotalConIvaYIeps / 1.24;
    const iepsCalculado = baseConIvaYIeps * 0.08;
    const ivaDeIeps = baseConIvaYIeps * 0.16;
    const baseConIva = subtotalConIva / 1.16;
    const ivaSolo = subtotalConIva - baseConIva;
    const subtotalReal = baseConIvaYIeps + baseConIva + subtotalSinImpuestos;
    const ivaTotal = ivaSolo + ivaDeIeps;

    return await generarCotizacionPDF({
      folio: cotizacion.folio,
      nombre: cotizacion.nombre,
      fecha_creacion: cotizacion.fecha_creacion,
      fecha_vigencia: cotizacion.fecha_vigencia,
      cliente: {
        nombre: cotizacion.cliente?.nombre || "",
        codigo: cotizacion.cliente?.codigo || "",
        email: cotizacion.cliente?.email,
      },
      sucursal: cotizacion.sucursal ? {
        nombre: cotizacion.sucursal.nombre || "",
        direccion: cotizacion.sucursal.direccion,
      } : null,
      productos,
      subtotal: subtotalReal,
      iva: ivaTotal,
      ieps: iepsCalculado,
      total: cotizacion.total || 0,
      notas: cotizacion.notas,
    });
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

      // Generate PDF for the quotation
      const pdfBase64 = await generarPDFCotizacion();

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
              mimeType: "application/pdf",
              filename: `Cotizacion_${folio}.pdf`,
              content: pdfBase64,
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
