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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Mail, Plus, FileText, Users } from "lucide-react";
import ClienteCorreosManager from "@/components/clientes/ClienteCorreosManager";
import { format } from "date-fns";
import { logEmailAction } from "@/hooks/useGmailPermisos";
import logoAlmasa from "@/assets/logo-almasa.png";

interface ClienteCorreo {
  id: string;
  email: string;
  nombre_contacto: string | null;
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

interface ClienteGroup {
  clienteId: string;
  clienteNombre: string;
  cotizaciones: Cotizacion[];
  correos: ClienteCorreo[];
  selectedCorreos: string[];
  asunto: string;
  mensaje: string;
}

interface EnviarCotizacionesAgrupadasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotizaciones: Cotizacion[];
  onSuccess?: () => void;
}

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

const parseDateLocal = (dateStr: string) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const EnviarCotizacionesAgrupadasDialog = ({
  open,
  onOpenChange,
  cotizaciones,
  onSuccess,
}: EnviarCotizacionesAgrupadasDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingCorreos, setLoadingCorreos] = useState(false);
  const [clienteGroups, setClienteGroups] = useState<ClienteGroup[]>([]);
  const [correosManagerClienteId, setCorreosManagerClienteId] = useState<string | null>(null);

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
    if (open && cotizaciones.length > 0) {
      initializeGroups();
    }
  }, [open, cotizaciones]);

  const initializeGroups = async () => {
    setLoadingCorreos(true);
    
    // Group cotizaciones by cliente_id
    const groupedMap = new Map<string, Cotizacion[]>();
    cotizaciones.forEach(cot => {
      const existing = groupedMap.get(cot.cliente_id) || [];
      existing.push(cot);
      groupedMap.set(cot.cliente_id, existing);
    });

    // Fetch correos for all unique clients
    const clienteIds = Array.from(groupedMap.keys());
    const { data: allCorreos } = await supabase
      .from("cliente_correos")
      .select("id, email, nombre_contacto, es_principal, cliente_id")
      .in("cliente_id", clienteIds)
      .eq("activo", true)
      .order("es_principal", { ascending: false });

    // Build groups
    const groups: ClienteGroup[] = [];
    groupedMap.forEach((cots, clienteId) => {
      const clienteCorreos = (allCorreos || []).filter(c => c.cliente_id === clienteId);
      const principal = clienteCorreos.find(c => c.es_principal);
      const nombres = cots.map(c => c.nombre || c.folio).join(" y ");
      
      groups.push({
        clienteId,
        clienteNombre: cots[0].cliente.nombre,
        cotizaciones: cots,
        correos: clienteCorreos,
        selectedCorreos: principal ? [principal.id] : [],
        asunto: `Cotizaciones ${nombres} - Abarrotes La Manita`,
        mensaje: `Estimado cliente,

Adjunto encontrará las cotizaciones solicitadas:
${cots.map(c => `• ${c.nombre || c.folio}`).join('\n')}

Quedamos a sus órdenes para cualquier duda o aclaración.

Saludos cordiales,
Abarrotes La Manita
Tel: (55) 56-00-77-81`,
      });
    });

    setClienteGroups(groups);
    setLoadingCorreos(false);
  };

  const toggleCorreo = (groupIndex: number, correoId: string) => {
    setClienteGroups(prev => prev.map((group, idx) => {
      if (idx !== groupIndex) return group;
      return {
        ...group,
        selectedCorreos: group.selectedCorreos.includes(correoId)
          ? group.selectedCorreos.filter(id => id !== correoId)
          : [...group.selectedCorreos, correoId],
      };
    }));
  };

  const updateGroupField = (groupIndex: number, field: 'asunto' | 'mensaje', value: string) => {
    setClienteGroups(prev => prev.map((group, idx) => {
      if (idx !== groupIndex) return group;
      return { ...group, [field]: value };
    }));
  };

  const reloadCorreosForGroup = async (groupIndex: number) => {
    const group = clienteGroups[groupIndex];
    const { data } = await supabase
      .from("cliente_correos")
      .select("id, email, nombre_contacto, es_principal")
      .eq("cliente_id", group.clienteId)
      .eq("activo", true)
      .order("es_principal", { ascending: false });

    setClienteGroups(prev => prev.map((g, idx) => {
      if (idx !== groupIndex) return g;
      return { ...g, correos: data || [] };
    }));
  };

  const handleEnviar = async () => {
    // Validate all groups have at least one recipient
    const groupsSinCorreo = clienteGroups.filter(g => g.selectedCorreos.length === 0);
    if (groupsSinCorreo.length > 0) {
      toast({
        title: "Faltan destinatarios",
        description: `${groupsSinCorreo.map(g => g.clienteNombre).join(", ")} no tienen correos seleccionados`,
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
    let enviados = 0;
    let errores = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      for (const group of clienteGroups) {
        try {
          const emailsToSend = group.correos
            .filter(c => group.selectedCorreos.includes(c.id))
            .map(c => c.email);

          // Generate HTML for each quotation
          const attachments = await Promise.all(
            group.cotizaciones.map(async (cot) => {
              const htmlContent = await generarHTMLCotizacion(cot.id);
              const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));
              return {
                mimeType: "text/html",
                filename: `Cotizacion_${cot.folio}.html`,
                content: htmlBase64,
              };
            })
          );

          const emailBodyHtml = `<div style="font-family: Arial, sans-serif; white-space: pre-wrap;">${group.mensaje.replace(/\n/g, '<br>')}</div>`;

          const { error: sendError } = await supabase.functions.invoke("gmail-api", {
            body: {
              action: "send",
              email: "1904@almasa.com.mx",
              to: emailsToSend.join(", "),
              subject: group.asunto,
              body: emailBodyHtml,
              attachments,
            },
          });

          if (sendError) throw sendError;

          // Update cotizaciones status
          await supabase
            .from("cotizaciones")
            .update({ status: "enviada" })
            .in("id", group.cotizaciones.map(c => c.id));

          // Register sends
          if (user) {
            const envios = group.cotizaciones.map(cot => ({
              cotizacion_id: cot.id,
              enviado_por: user.id,
              email_destino: emailsToSend.join(", "),
              gmail_cuenta_id: gmailCuenta.id,
            }));
            await supabase.from("cotizaciones_envios").insert(envios);
          }

          await logEmailAction(gmailCuenta.id, "enviar", {
            emailTo: emailsToSend.join(", "),
            emailSubject: group.asunto,
          });

          enviados++;
        } catch (error: any) {
          console.error(`Error sending to ${group.clienteNombre}:`, error);
          errores++;
        }
      }

      if (enviados > 0) {
        toast({
          title: "Cotizaciones enviadas",
          description: `Se enviaron cotizaciones a ${enviados} cliente(s)${errores > 0 ? `. ${errores} error(es).` : ''}`,
        });
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast({
          title: "Error",
          description: "No se pudo enviar ninguna cotización",
          variant: "destructive",
        });
      }
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

  const generarHTMLCotizacion = async (cotizacionId: string) => {
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

    const logoBase64 = await getLogoBase64();
    const soloPrecios = cotizacion.notas?.includes("[Solo precios]") || false;
    const notasLimpias = (cotizacion.notas || "")
      .replace(/\[Cotización para: [^\]]+\]/g, "")
      .replace(/\[Solo precios\]/g, "")
      .trim();
    
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

    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Cotización ${cotizacion.folio}</title></head>
<body style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #333;">
  <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px;">
    <div style="display: flex; align-items: center; gap: 15px;">
      ${logoBase64 ? `<img src="${logoBase64}" alt="ALMASA" style="height: 60px; width: 60px; object-fit: contain;">` : ''}
      <div>
        <h1 style="margin: 0; color: #2563eb; font-size: 24px;">ABARROTES LA MANITA</h1>
        <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">ABARROTES LA MANITA, S.A. DE C.V.</p>
      </div>
    </div>
    <div style="text-align: right;">
      <div style="background: #2563eb; color: white; padding: 10px 20px; border-radius: 5px; font-size: 18px; font-weight: bold;">COTIZACIÓN</div>
      <p style="margin: 8px 0 0 0; font-size: 12px;">Folio: <strong>${cotizacion.folio}</strong></p>
      <p style="margin: 3px 0 0 0; font-size: 12px;">Fecha: ${fechaCreacion}</p>
    </div>
  </div>
  <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 5px; padding: 15px; margin-bottom: 20px;">
    <p style="margin: 0; font-size: 14px;"><strong>Vigencia de esta cotización:</strong> <span style="color: #2563eb; font-size: 18px; font-weight: bold;">${fechaVigencia}</span></p>
    ${cotizacion.nombre ? `<p style="margin: 5px 0 0 0; font-size: 12px;">Referencia: ${cotizacion.nombre}</p>` : ''}
  </div>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
    <p style="margin: 0;"><strong>Cliente:</strong> ${cotizacion.cliente?.nombre}</p>
  </div>
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
    <tbody>${productosHTML}</tbody>
  </table>
  ${!soloPrecios ? `
  <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
    <table style="width: 250px; font-size: 14px;">
      <tr><td style="padding: 8px; text-align: right;"><strong>Total:</strong></td>
      <td style="padding: 8px; text-align: right; background: #1f2937; color: white;"><strong>$${cotizacion.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong></td></tr>
    </table>
  </div>` : ''}
  ${notasLimpias ? `<div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-bottom: 20px;"><p style="margin: 0; font-size: 12px;"><strong>Notas:</strong> ${notasLimpias}</p></div>` : ''}
  <div style="text-align: center; border-top: 1px solid #ddd; padding-top: 15px; font-size: 11px; color: #666;">
    <p style="margin: 0;"><strong>ABARROTES LA MANITA S.A. DE C.V.</strong></p>
    <p style="margin: 3px 0 0 0;">Email: 1904@almasa.com.mx | Tel: (55) 56-00-77-81</p>
  </div>
</body>
</html>`;
  };

  const totalCotizaciones = cotizaciones.length;
  const totalClientes = clienteGroups.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Enviar {totalCotizaciones} Cotizaciones a {totalClientes} Cliente(s)
            </DialogTitle>
          </DialogHeader>

          {loadingCorreos ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm mb-4">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>Se enviará desde: <strong>1904@almasa.com.mx</strong></span>
                </div>

                <Accordion type="multiple" defaultValue={clienteGroups.map((_, i) => `group-${i}`)} className="space-y-2">
                  {clienteGroups.map((group, groupIndex) => (
                    <AccordionItem 
                      key={group.clienteId} 
                      value={`group-${groupIndex}`}
                      className="border rounded-lg px-4"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          <span className="font-medium">{group.clienteNombre}</span>
                          <Badge variant="secondary" className="ml-2">
                            {group.cotizaciones.length} cotización(es)
                          </Badge>
                          {group.selectedCorreos.length === 0 && (
                            <Badge variant="destructive" className="ml-1">
                              Sin destinatario
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-2">
                        {/* Cotizaciones */}
                        <div className="flex flex-wrap gap-1">
                          {group.cotizaciones.map(c => (
                            <Badge key={c.id} variant="outline">
                              <FileText className="h-3 w-3 mr-1" />
                              {c.nombre || c.folio}
                            </Badge>
                          ))}
                        </div>

                        {/* Recipients */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-medium">Destinatarios</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setCorreosManagerClienteId(group.clienteId)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Agregar
                            </Button>
                          </div>
                          
                          {group.correos.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No hay correos registrados</p>
                          ) : (
                            <div className="space-y-1">
                              {group.correos.map((correo) => (
                                <div
                                  key={correo.id}
                                  className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50"
                                >
                                  <Checkbox
                                    id={`${groupIndex}-${correo.id}`}
                                    checked={group.selectedCorreos.includes(correo.id)}
                                    onCheckedChange={() => toggleCorreo(groupIndex, correo.id)}
                                  />
                                  <label
                                    htmlFor={`${groupIndex}-${correo.id}`}
                                    className="flex-1 cursor-pointer text-sm"
                                  >
                                    {correo.email}
                                    {correo.nombre_contacto && (
                                      <span className="text-muted-foreground ml-1">
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
                          <Label htmlFor={`asunto-${groupIndex}`}>Asunto</Label>
                          <Input
                            id={`asunto-${groupIndex}`}
                            value={group.asunto}
                            onChange={(e) => updateGroupField(groupIndex, 'asunto', e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        {/* Message */}
                        <div>
                          <Label htmlFor={`mensaje-${groupIndex}`}>Mensaje</Label>
                          <Textarea
                            id={`mensaje-${groupIndex}`}
                            value={group.mensaje}
                            onChange={(e) => updateGroupField(groupIndex, 'mensaje', e.target.value)}
                            rows={4}
                            className="mt-1"
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEnviar}
              disabled={loading || clienteGroups.some(g => g.selectedCorreos.length === 0)}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar a {totalClientes} cliente(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ClienteCorreosManager for adding emails */}
      {correosManagerClienteId && (
        <ClienteCorreosManager
          clienteId={correosManagerClienteId}
          clienteNombre={clienteGroups.find(g => g.clienteId === correosManagerClienteId)?.clienteNombre || ""}
          open={!!correosManagerClienteId}
          onOpenChange={(open) => {
            if (!open) {
              const groupIndex = clienteGroups.findIndex(g => g.clienteId === correosManagerClienteId);
              if (groupIndex >= 0) {
                reloadCorreosForGroup(groupIndex);
              }
              setCorreosManagerClienteId(null);
            }
          }}
        />
      )}
    </>
  );
};

export default EnviarCotizacionesAgrupadasDialog;
