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
import { generarCotizacionPDF } from "@/utils/cotizacionPdfGenerator";

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
          id, producto_id, cantidad, precio_unitario, subtotal, cantidad_maxima, nota_linea,
          producto:productos(nombre, codigo, unidad, aplica_iva, aplica_ieps)
        )
      `)
      .eq("id", cotizacionId)
      .single();

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
