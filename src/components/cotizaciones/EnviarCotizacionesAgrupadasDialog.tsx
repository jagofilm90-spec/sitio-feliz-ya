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
import { es } from "date-fns/locale";
import { logEmailAction } from "@/hooks/useGmailPermisos";
import { generarCotizacionPDF } from "@/utils/cotizacionPdfGenerator";

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

          // Generate PDF for each quotation
          const attachments = await Promise.all(
            group.cotizaciones.map(async (cot) => {
              const pdfBase64 = await generarPDFCotizacion(cot.id);
              return {
                mimeType: "application/pdf",
                filename: `Cotizacion_${cot.folio}.pdf`,
                content: pdfBase64,
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

  const generarPDFCotizacion = async (cotizacionId: string): Promise<string> => {
    const { data: cotizacion } = await supabase
      .from("cotizaciones")
      .select(`
        *,
        cliente:clientes(id, nombre, codigo),
        sucursal:cliente_sucursales(nombre, direccion),
        detalles:cotizaciones_detalles(
          id, producto_id, cantidad, precio_unitario, subtotal, cantidad_maxima, nota_linea,
          producto:productos(nombre, codigo, unidad)
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
      subtotal: cotizacion.subtotal || 0,
      impuestos: cotizacion.impuestos || 0,
      total: cotizacion.total || 0,
      notas: cotizacion.notas,
    });
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
