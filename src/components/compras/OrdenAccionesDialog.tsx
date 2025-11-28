import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, CheckCircle, XCircle, Mail, Loader2, Pencil, Trash2, FileText, ShieldCheck, ShieldX, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OrdenAccionesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orden: any;
  onEdit?: (orden: any) => void;
}

const OrdenAccionesDialog = ({ open, onOpenChange, orden, onEdit }: OrdenAccionesDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [accion, setAccion] = useState<"cambiar_fecha" | "recibir" | "devolver" | "enviar_email" | "eliminar" | "solicitar_autorizacion" | "autorizar" | "rechazar" | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [motivoDevolucion, setMotivoDevolucion] = useState("");
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [solicitandoAutorizacion, setSolicitandoAutorizacion] = useState(false);
  const [autorizando, setAutorizando] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch current user info
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        // Check if admin
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        setIsAdmin(roles?.some(r => r.role === 'admin') || false);
      }
    };
    fetchCurrentUser();
  }, []);

  // Fetch creator profile name
  const { data: creadorProfile } = useQuery({
    queryKey: ["profile", orden?.creado_por],
    queryFn: async () => {
      if (!orden?.creado_por) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", orden.creado_por)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orden?.creado_por,
  });

  // Fetch authorizer profile name
  const { data: autorizadorProfile } = useQuery({
    queryKey: ["profile", orden?.autorizado_por],
    queryFn: async () => {
      if (!orden?.autorizado_por) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", orden.autorizado_por)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orden?.autorizado_por,
  });

  const updateOrden = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("ordenes_compra")
        .update(data)
        .eq("id", orden.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["ordenes_calendario"] });
      toast({
        title: "Orden actualizada",
        description: "La orden se ha actualizado correctamente",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteOrden = useMutation({
    mutationFn: async () => {
      // First delete related notifications
      await supabase
        .from("notificaciones")
        .delete()
        .eq("orden_compra_id", orden.id);

      // Delete order deliveries (entregas múltiples)
      await supabase
        .from("ordenes_compra_entregas")
        .delete()
        .eq("orden_compra_id", orden.id);

      // Delete order details
      const { error: detallesError } = await supabase
        .from("ordenes_compra_detalles")
        .delete()
        .eq("orden_compra_id", orden.id);
      if (detallesError) throw detallesError;

      // Finally delete the order
      const { error } = await supabase
        .from("ordenes_compra")
        .delete()
        .eq("id", orden.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["ordenes_calendario"] });
      toast({
        title: "Orden eliminada",
        description: "La orden de compra se ha eliminado correctamente",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setAccion(null);
    setNuevaFecha("");
    setMotivoDevolucion("");
    setMotivoRechazo("");
  };

  const handleCambiarFecha = () => {
    if (!nuevaFecha) {
      toast({
        title: "Fecha requerida",
        description: "Selecciona una nueva fecha de entrega",
        variant: "destructive",
      });
      return;
    }
    updateOrden.mutate({ fecha_entrega_programada: nuevaFecha });
  };

  const handleMarcarRecibida = () => {
    updateOrden.mutate({
      status: "recibida",
      fecha_entrega_real: new Date().toISOString(),
    });
  };

  const handleMarcarDevuelta = () => {
    if (!motivoDevolucion.trim()) {
      toast({
        title: "Motivo requerido",
        description: "Indica el motivo de la devolución",
        variant: "destructive",
      });
      return;
    }
    updateOrden.mutate({
      status: "devuelta",
      motivo_devolucion: motivoDevolucion,
    });
  };

  const generarPDFContent = async (incluirAutorizacion: boolean = false) => {
    // Fetch scheduled deliveries if order has multiple deliveries
    let entregasProgramadas: any[] = [];
    if (orden.entregas_multiples) {
      const { data: entregas } = await supabase
        .from("ordenes_compra_entregas")
        .select("*")
        .eq("orden_compra_id", orden.id)
        .order("numero_entrega", { ascending: true });
      entregasProgramadas = entregas || [];
    }

    const detalles = orden.ordenes_compra_detalles || [];
    const productosHTML = detalles.map((d: any) => 
      `<tr>
        <td style="padding: 10px; border: 1px solid #333;">${d.productos?.codigo || '-'}</td>
        <td style="padding: 10px; border: 1px solid #333;">${d.productos?.nombre || 'Producto'}</td>
        <td style="padding: 10px; border: 1px solid #333; text-align: center;">${d.cantidad_ordenada}</td>
        <td style="padding: 10px; border: 1px solid #333; text-align: right;">$${d.precio_unitario_compra?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 10px; border: 1px solid #333; text-align: right;">$${d.subtotal?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
      </tr>`
    ).join('');

    // Build delivery schedule section
    let entregasHTML = '';
    if (entregasProgramadas.length > 0) {
      const entregasRows = entregasProgramadas.map((e: any) => {
        const fecha = new Date(e.fecha_programada).toLocaleDateString('es-MX', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        return `<tr>
          <td style="padding: 8px; border: 1px solid #333; text-align: center;">${e.numero_entrega}</td>
          <td style="padding: 8px; border: 1px solid #333;">${fecha}</td>
          <td style="padding: 8px; border: 1px solid #333; text-align: center;">${e.cantidad_bultos} bultos</td>
        </tr>`;
      }).join('');

      entregasHTML = `
        <div style="margin-top: 30px;">
          <h3 style="margin-bottom: 10px; font-size: 14px;">CALENDARIO DE ENTREGAS PROGRAMADAS</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #e8f5e9;">
                <th style="padding: 10px; border: 1px solid #333; text-align: center; width: 80px;">Entrega #</th>
                <th style="padding: 10px; border: 1px solid #333; text-align: left;">Fecha Programada</th>
                <th style="padding: 10px; border: 1px solid #333; text-align: center; width: 120px;">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              ${entregasRows}
            </tbody>
          </table>
        </div>
      `;
    }

    const fechaOrden = new Date(orden.fecha_orden).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const fechaEntrega = orden.fecha_entrega_programada 
      ? new Date(orden.fecha_entrega_programada).toLocaleDateString('es-MX', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      : 'Por confirmar';

    // Get creator and authorizer names
    const nombreCreador = creadorProfile?.full_name || 'Usuario';
    const nombreAutorizador = incluirAutorizacion && autorizadorProfile?.full_name 
      ? autorizadorProfile.full_name 
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Orden de Compra ${orden.folio}</title>
        <style>
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { 
            font-family: Arial, sans-serif; 
            padding: 40px; 
            max-width: 800px; 
            margin: 0 auto;
            font-size: 12px;
            color: #000;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start;
            border-bottom: 3px solid #2e7d32;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .company-info h1 { 
            margin: 0; 
            font-size: 24px; 
            color: #2e7d32;
          }
          .company-info p { margin: 5px 0; font-size: 11px; color: #666; }
          .order-info { text-align: right; }
          .order-info h2 { margin: 0; font-size: 18px; color: #333; }
          .order-info p { margin: 5px 0; font-size: 11px; }
          .folio { 
            font-size: 24px; 
            font-weight: bold; 
            color: #2e7d32;
            margin-top: 10px;
          }
          .supplier-section {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 25px;
          }
          .supplier-section h3 { margin: 0 0 10px 0; font-size: 14px; color: #333; }
          .supplier-section p { margin: 3px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { 
            background-color: #2e7d32; 
            color: white; 
            padding: 12px 10px; 
            text-align: left;
            font-size: 11px;
          }
          td { padding: 10px; border: 1px solid #333; font-size: 11px; }
          .totals { margin-top: 20px; }
          .totals table { width: 300px; margin-left: auto; }
          .totals td { padding: 8px 12px; }
          .totals .total-row { 
            background-color: #2e7d32; 
            color: white; 
            font-weight: bold;
            font-size: 14px;
          }
          .notes { 
            margin-top: 30px; 
            padding: 15px; 
            background: #fff3e0; 
            border-left: 4px solid #ff9800;
            border-radius: 4px;
          }
          .notes h4 { margin: 0 0 10px 0; }
          .footer { 
            margin-top: 50px; 
            text-align: center; 
            font-size: 10px; 
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 60px;
          }
          .signature-box {
            width: 200px;
            text-align: center;
          }
          .signature-line {
            border-top: 1px solid #333;
            margin-top: 50px;
            padding-top: 5px;
            font-size: 11px;
          }
          .signature-name {
            font-weight: bold;
            margin-top: 5px;
            font-size: 12px;
          }
          @page { margin: 1cm; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            <h1>ABARROTES LA MANITA</h1>
            <p>Comercializadora de Abarrotes</p>
            <p>México</p>
          </div>
          <div class="order-info">
            <h2>ORDEN DE COMPRA</h2>
            <div class="folio">${orden.folio}</div>
            <p><strong>Fecha:</strong> ${fechaOrden}</p>
            <p><strong>Status:</strong> ${orden.status?.toUpperCase()}</p>
          </div>
        </div>

        <div class="supplier-section">
          <h3>PROVEEDOR</h3>
          <p><strong>${orden.proveedores?.nombre || 'Sin proveedor'}</strong></p>
          ${orden.proveedores?.direccion ? `<p>${orden.proveedores.direccion}</p>` : ''}
          ${orden.proveedores?.email ? `<p>Email: ${orden.proveedores.email}</p>` : ''}
          ${orden.proveedores?.telefono ? `<p>Tel: ${orden.proveedores.telefono}</p>` : ''}
        </div>

        ${!orden.entregas_multiples ? `
          <p style="margin-bottom: 20px;"><strong>Fecha de Entrega Programada:</strong> ${fechaEntrega}</p>
        ` : ''}

        <table>
          <thead>
            <tr>
              <th style="width: 80px;">Código</th>
              <th>Producto</th>
              <th style="width: 80px; text-align: center;">Cantidad</th>
              <th style="width: 100px; text-align: right;">Precio Unit.</th>
              <th style="width: 100px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${productosHTML}
          </tbody>
        </table>

        <div class="totals">
          <table>
            <tr>
              <td style="text-align: right; border: none;"><strong>Subtotal:</strong></td>
              <td style="text-align: right; border: 1px solid #333;">$${orden.subtotal?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style="text-align: right; border: none;"><strong>IVA (16%):</strong></td>
              <td style="text-align: right; border: 1px solid #333;">$${orden.impuestos?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr class="total-row">
              <td style="text-align: right; border: none;"><strong>TOTAL:</strong></td>
              <td style="text-align: right;">$${orden.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            </tr>
          </table>
        </div>

        ${entregasHTML}

        ${orden.notas ? `
          <div class="notes">
            <h4>Notas:</h4>
            <p>${orden.notas}</p>
          </div>
        ` : ''}

        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line">Elaboró</div>
            <div class="signature-name">${nombreCreador}</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">Autorizó</div>
            ${nombreAutorizador ? `<div class="signature-name">${nombreAutorizador}</div>` : ''}
          </div>
          <div class="signature-box">
            <div class="signature-line">Recibió Proveedor</div>
          </div>
        </div>

        <div class="footer">
          <p>Documento generado el ${new Date().toLocaleString('es-MX')}</p>
          <p>Abarrotes La Manita - Sistema ERP</p>
        </div>
      </body>
      </html>
    `;
  };

  const handleGenerarPDF = async () => {
    try {
      const pdfContent = await generarPDFContent(!!orden.autorizado_por);

      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        
        // Wait for content to load then trigger print
        printWindow.onload = () => {
          printWindow.print();
        };
        
        toast({
          title: "PDF generado",
          description: "Puedes imprimir o guardar como PDF desde el diálogo de impresión",
        });
      }
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    }
  };

  const handleSolicitarAutorizacion = async () => {
    setSolicitandoAutorizacion(true);

    try {
      // Get current user name
      const { data: { user } } = await supabase.auth.getUser();
      let nombreSolicitante = 'Usuario';
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        nombreSolicitante = profile?.full_name || 'Usuario';
      }

      // Update order status first
      const { error: statusError } = await supabase
        .from("ordenes_compra")
        .update({ status: "pendiente_autorizacion" })
        .eq("id", orden.id);
      
      if (statusError) {
        console.error("Error updating order status:", statusError);
        // Continue anyway to create notification
      }

      // Create notification for admin (internal notification system)
      const { error: notifError } = await supabase
        .from("notificaciones")
        .insert({
          tipo: "autorizacion_oc",
          titulo: `Autorización requerida: ${orden.folio}`,
          descripcion: `${nombreSolicitante} solicita autorización para la orden de compra a ${orden.proveedores?.nombre || 'proveedor'} por $${orden.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          orden_compra_id: orden.id,
          leida: false,
        });

      if (notifError) {
        console.error('Error creating notification:', notifError);
        // Continue anyway, the order status was updated
      }

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });

      toast({
        title: "Solicitud enviada",
        description: "La solicitud de autorización está pendiente. El administrador la verá en sus notificaciones.",
      });
      
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error sending authorization request:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar la solicitud",
        variant: "destructive",
      });
    } finally {
      setSolicitandoAutorizacion(false);
    }
  };

  const handleAutorizar = async () => {
    setAutorizando(true);

    try {
      // Update order with authorization
      await supabase
        .from("ordenes_compra")
        .update({ 
          status: "autorizada",
          autorizado_por: currentUserId,
          fecha_autorizacion: new Date().toISOString()
        })
        .eq("id", orden.id);

      // Mark related notification as read
      await supabase
        .from("notificaciones")
        .update({ leida: true })
        .eq("orden_compra_id", orden.id)
        .eq("tipo", "autorizacion_oc");

      // Refetch to get updated autorizador name
      const { data: autorizadorData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUserId)
        .single();

      // Now send the order to supplier automatically
      if (orden?.proveedores?.email) {
        // Generate PDF with authorization
        const pdfContent = await generarPDFContent(true);
        const pdfBase64 = btoa(unescape(encodeURIComponent(pdfContent)));

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2e7d32;">Orden de Compra: ${orden.folio}</h2>
            <p>Estimado proveedor <strong>${orden.proveedores?.nombre}</strong>,</p>
            <p>Por medio del presente, le enviamos nuestra orden de compra autorizada.</p>
            <p><strong>Adjunto encontrará el documento formal de la orden de compra.</strong></p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Folio:</strong> ${orden.folio}</p>
              <p style="margin: 5px 0;"><strong>Total:</strong> $${orden.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              <p style="margin: 5px 0;"><strong>Autorizado por:</strong> ${autorizadorData?.full_name || 'Administrador'}</p>
            </div>

            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
            <p style="color: #666; font-size: 12px;">
              Este correo fue enviado desde el sistema de Abarrotes La Manita.<br/>
              Por favor confirme la recepción de esta orden.
            </p>
          </div>
        `;

        const attachments = [
          {
            filename: `Orden_Compra_${orden.folio}.html`,
            content: pdfBase64,
            mimeType: 'text/html'
          }
        ];

        await supabase.functions.invoke('gmail-api', {
          body: {
            action: 'send',
            email: 'compras@almasa.com.mx',
            to: orden.proveedores.email,
            subject: `Orden de Compra ${orden.folio} - Abarrotes La Manita`,
            body: htmlBody,
            attachments: attachments,
          },
        });

        // Update status to enviada
        await supabase
          .from("ordenes_compra")
          .update({ status: "enviada" })
          .eq("id", orden.id);
      }

      // Notify creator about approval
      const creadorEmail = await getCreadorEmail();
      if (creadorEmail) {
        const { data: adminProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", currentUserId)
          .single();

        await supabase.functions.invoke('gmail-api', {
          body: {
            action: 'send',
            email: 'compras@almasa.com.mx',
            to: creadorEmail,
            subject: `[AUTORIZADA] Orden de Compra ${orden.folio}`,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2e7d32;">✓ Orden Autorizada</h2>
                <p>La orden de compra <strong>${orden.folio}</strong> ha sido autorizada y enviada al proveedor.</p>
                <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Autorizado por:</strong> ${adminProfile?.full_name || 'Administrador'}</p>
                  <p style="margin: 5px 0;"><strong>Proveedor:</strong> ${orden.proveedores?.nombre}</p>
                </div>
              </div>
            `,
          },
        });
      }

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });

      toast({
        title: "Orden autorizada",
        description: orden?.proveedores?.email 
          ? "La orden fue autorizada y enviada al proveedor" 
          : "La orden fue autorizada",
      });
      
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error authorizing order:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo autorizar la orden",
        variant: "destructive",
      });
    } finally {
      setAutorizando(false);
    }
  };

  const handleRechazar = async () => {
    if (!motivoRechazo.trim()) {
      toast({
        title: "Motivo requerido",
        description: "Indica el motivo del rechazo",
        variant: "destructive",
      });
      return;
    }

    setAutorizando(true);

    try {
      // Update order status
      await supabase
        .from("ordenes_compra")
        .update({ 
          status: "rechazada",
          rechazado_por: currentUserId,
          fecha_rechazo: new Date().toISOString(),
          motivo_rechazo: motivoRechazo
        })
        .eq("id", orden.id);

      // Mark related notification as read
      await supabase
        .from("notificaciones")
        .update({ leida: true })
        .eq("orden_compra_id", orden.id)
        .eq("tipo", "autorizacion_oc");

      // Notify creator about rejection
      const creadorEmail = await getCreadorEmail();
      if (creadorEmail) {
        const { data: adminProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", currentUserId)
          .single();

        await supabase.functions.invoke('gmail-api', {
          body: {
            action: 'send',
            email: 'compras@almasa.com.mx',
            to: creadorEmail,
            subject: `[RECHAZADA] Orden de Compra ${orden.folio}`,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #d32f2f;">✗ Orden Rechazada</h2>
                <p>La orden de compra <strong>${orden.folio}</strong> ha sido rechazada.</p>
                <div style="background-color: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Rechazado por:</strong> ${adminProfile?.full_name || 'Administrador'}</p>
                  <p style="margin: 5px 0;"><strong>Motivo:</strong> ${motivoRechazo}</p>
                </div>
                <p>Por favor revisa la orden y realiza las correcciones necesarias.</p>
              </div>
            `,
          },
        });
      }

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });

      toast({
        title: "Orden rechazada",
        description: "Se notificó al creador sobre el rechazo",
      });
      
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error rejecting order:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo rechazar la orden",
        variant: "destructive",
      });
    } finally {
      setAutorizando(false);
    }
  };

  const getCreadorEmail = async (): Promise<string | null> => {
    if (!orden?.creado_por) return null;
    const { data } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", orden.creado_por)
      .single();
    return data?.email || null;
  };

  const handleEnviarOrden = async () => {
    if (!orden?.proveedores?.email) {
      toast({
        title: "Sin correo",
        description: "El proveedor no tiene un correo registrado",
        variant: "destructive",
      });
      return;
    }

    setEnviandoEmail(true);

    try {
      // Generate PDF content
      const pdfContent = await generarPDFContent(!!orden.autorizado_por);
      
      // Convert HTML to base64 for attachment
      const pdfBase64 = btoa(unescape(encodeURIComponent(pdfContent)));

      // Simple email body with reference to attachment
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2e7d32;">Orden de Compra: ${orden.folio}</h2>
          <p>Estimado proveedor <strong>${orden.proveedores?.nombre}</strong>,</p>
          <p>Por medio del presente, le enviamos nuestra orden de compra.</p>
          <p><strong>Adjunto encontrará el documento formal de la orden de compra en formato HTML que puede abrir en cualquier navegador e imprimir.</strong></p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Folio:</strong> ${orden.folio}</p>
            <p style="margin: 5px 0;"><strong>Total:</strong> $${orden.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            <p style="margin: 5px 0;"><strong>Fecha de la orden:</strong> ${new Date(orden.fecha_orden).toLocaleDateString('es-MX')}</p>
          </div>
          
          ${orden.notas ? `<p><strong>Notas:</strong> ${orden.notas}</p>` : ''}

          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
          <p style="color: #666; font-size: 12px;">
            Este correo fue enviado desde el sistema de Abarrotes La Manita.<br/>
            Por favor confirme la recepción de esta orden.
          </p>
        </div>
      `;

      // Prepare attachment
      const attachments = [
        {
          filename: `Orden_Compra_${orden.folio}.html`,
          content: pdfBase64,
          mimeType: 'text/html'
        }
      ];

      const { data, error } = await supabase.functions.invoke('gmail-api', {
        body: {
          action: 'send',
          email: 'compras@almasa.com.mx',
          to: orden.proveedores.email,
          subject: `Orden de Compra ${orden.folio} - Abarrotes La Manita`,
          body: htmlBody,
          attachments: attachments,
        },
      });

      if (error) throw error;

      // Update order status to "enviada"
      await supabase
        .from("ordenes_compra")
        .update({ status: "enviada" })
        .eq("id", orden.id);

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });

      toast({
        title: "Orden enviada",
        description: `La orden se envió correctamente a ${orden.proveedores.email} con el PDF adjunto`,
      });
      
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error sending order email:', error);
      toast({
        title: "Error al enviar",
        description: error.message || "No se pudo enviar el correo",
        variant: "destructive",
      });
    } finally {
      setEnviandoEmail(false);
    }
  };

  // Helper to show status badge
  const getStatusBadge = () => {
    const status = orden?.status;
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      pendiente: { variant: "outline", label: "Pendiente" },
      pendiente_autorizacion: { variant: "secondary", label: "Esperando Autorización" },
      autorizada: { variant: "default", label: "Autorizada" },
      rechazada: { variant: "destructive", label: "Rechazada" },
      enviada: { variant: "default", label: "Enviada" },
      recibida: { variant: "default", label: "Recibida" },
      devuelta: { variant: "destructive", label: "Devuelta" },
    };
    const config = statusConfig[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const canRequestAuthorization = orden?.status === "pendiente" && !isAdmin;
  const canAuthorize = isAdmin && orden?.status === "pendiente_autorizacion";
  const canSendDirectly = isAdmin && (orden?.status === "pendiente" || orden?.status === "autorizada");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Gestionar Orden {orden?.folio}
            {getStatusBadge()}
          </DialogTitle>
          <DialogDescription>
            {orden?.status === "rechazada" && orden?.motivo_rechazo && (
              <span className="text-destructive">Motivo rechazo: {orden.motivo_rechazo}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!accion ? (
          <div className="space-y-3">
            {onEdit && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(orden);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar Orden de Compra
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleGenerarPDF}
            >
              <FileText className="mr-2 h-4 w-4" />
              Generar PDF para Imprimir
            </Button>

            {/* Authorization workflow buttons */}
            {canRequestAuthorization && (
              <Button
                variant="outline"
                className="w-full justify-start text-amber-600 hover:text-amber-700"
                onClick={() => setAccion("solicitar_autorizacion")}
              >
                <Send className="mr-2 h-4 w-4" />
                Solicitar Autorización
              </Button>
            )}

            {canAuthorize && (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start text-green-600 hover:text-green-700"
                  onClick={() => setAccion("autorizar")}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Autorizar y Enviar al Proveedor
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => setAccion("rechazar")}
                >
                  <ShieldX className="mr-2 h-4 w-4" />
                  Rechazar Orden
                </Button>
              </>
            )}

            {canSendDirectly && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setAccion("enviar_email")}
              >
                <Mail className="mr-2 h-4 w-4" />
                Enviar Orden al Proveedor
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setAccion("cambiar_fecha")}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Cambiar Fecha de Entrega
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setAccion("recibir")}
              disabled={orden?.status === "recibida"}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Marcar como Recibida
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setAccion("devolver")}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Marcar como Devuelta
            </Button>
            {orden?.status === "pendiente" && (
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={() => setAccion("eliminar")}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar Orden
              </Button>
            )}
          </div>
        ) : accion === "solicitar_autorizacion" ? (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg space-y-2">
              <p className="font-medium text-amber-700 dark:text-amber-400">¿Enviar solicitud de autorización?</p>
              <p className="text-sm text-muted-foreground">
                Se enviará un correo a <strong>jagomez@almasa.com.mx</strong> para solicitar la autorización de esta orden.
              </p>
              <div className="text-sm text-muted-foreground space-y-1 mt-2">
                <p><strong>Folio:</strong> {orden?.folio}</p>
                <p><strong>Proveedor:</strong> {orden?.proveedores?.nombre}</p>
                <p><strong>Total:</strong> ${orden?.total?.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleSolicitarAutorizacion} 
                disabled={solicitandoAutorizacion}
              >
                {solicitandoAutorizacion ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Sí, solicitar"
                )}
              </Button>
              <Button variant="ghost" onClick={() => setAccion(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : accion === "autorizar" ? (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg space-y-2">
              <p className="font-medium text-green-700 dark:text-green-400">¿Autorizar esta orden?</p>
              <p className="text-sm text-muted-foreground">
                Al autorizar, tu nombre aparecerá como firma en el PDF y la orden se enviará automáticamente al proveedor.
              </p>
              <div className="text-sm text-muted-foreground space-y-1 mt-2">
                <p><strong>Folio:</strong> {orden?.folio}</p>
                <p><strong>Proveedor:</strong> {orden?.proveedores?.nombre}</p>
                <p><strong>Correo proveedor:</strong> {orden?.proveedores?.email || 'Sin correo'}</p>
                <p><strong>Total:</strong> ${orden?.total?.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleAutorizar} 
                disabled={autorizando}
                className="bg-green-600 hover:bg-green-700"
              >
                {autorizando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Autorizando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Autorizar y Enviar
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={() => setAccion(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : accion === "rechazar" ? (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg space-y-2">
              <p className="font-medium text-red-700 dark:text-red-400">Rechazar orden de compra</p>
              <p className="text-sm text-muted-foreground">
                Se notificará al creador de la orden sobre el rechazo.
              </p>
            </div>
            <div>
              <Label>Motivo del rechazo *</Label>
              <Textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Explica por qué se rechaza esta orden..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleRechazar} 
                disabled={autorizando}
                variant="destructive"
              >
                {autorizando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rechazando...
                  </>
                ) : (
                  "Rechazar Orden"
                )}
              </Button>
              <Button variant="ghost" onClick={() => setAccion(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : accion === "eliminar" ? (
          <div className="space-y-4">
            <div className="bg-destructive/10 p-4 rounded-lg space-y-2">
              <p className="font-medium text-destructive">¿Estás seguro de eliminar esta orden?</p>
              <p className="text-sm text-muted-foreground">
                Esta acción no se puede deshacer. Se eliminarán todos los detalles de la orden.
              </p>
              <div className="text-sm text-muted-foreground space-y-1 mt-2">
                <p><strong>Folio:</strong> {orden?.folio}</p>
                <p><strong>Proveedor:</strong> {orden?.proveedores?.nombre}</p>
                <p><strong>Total:</strong> ${orden?.total?.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => deleteOrden.mutate()} 
                disabled={deleteOrden.isPending}
                variant="destructive"
              >
                {deleteOrden.isPending ? "Eliminando..." : "Sí, eliminar"}
              </Button>
              <Button variant="ghost" onClick={() => setAccion(null)}>
                No, cancelar
              </Button>
            </div>
          </div>
        ) : accion === "enviar_email" ? (
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="font-medium">¿Estás seguro de que los datos son correctos?</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Proveedor:</strong> {orden?.proveedores?.nombre}</p>
                <p><strong>Correo destino:</strong> {orden?.proveedores?.email || <span className="text-destructive">Sin correo registrado</span>}</p>
                <p><strong>Total de la orden:</strong> ${orden?.total?.toLocaleString()}</p>
                <p><strong>Productos:</strong> {orden?.ordenes_compra_detalles?.length || 0} items</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Se enviará desde: <strong>compras@almasa.com.mx</strong>
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleEnviarOrden} 
                disabled={enviandoEmail || !orden?.proveedores?.email}
              >
                {enviandoEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Sí, enviar"
                )}
              </Button>
              <Button variant="ghost" onClick={() => setAccion(null)}>
                No, regresar
              </Button>
            </div>
          </div>
        ) : accion === "cambiar_fecha" ? (
          <div className="space-y-4">
            <div>
              <Label>Nueva Fecha de Entrega</Label>
              <Input
                type="date"
                value={nuevaFecha}
                onChange={(e) => setNuevaFecha(e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Fecha actual: {orden?.fecha_entrega_programada
                  ? new Date(orden.fecha_entrega_programada).toLocaleDateString()
                  : "Sin programar"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCambiarFecha} disabled={updateOrden.isPending}>
                Actualizar Fecha
              </Button>
              <Button variant="ghost" onClick={() => setAccion(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : accion === "recibir" ? (
          <div className="space-y-4">
            <p>¿Confirmas que la mercancía fue recibida el día de hoy?</p>
            <div className="flex gap-2">
              <Button onClick={handleMarcarRecibida} disabled={updateOrden.isPending}>
                Sí, Marcar como Recibida
              </Button>
              <Button variant="ghost" onClick={() => setAccion(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Motivo de Devolución</Label>
              <Textarea
                value={motivoDevolucion}
                onChange={(e) => setMotivoDevolucion(e.target.value)}
                placeholder="Describe por qué se devuelve la mercancía..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleMarcarDevuelta}
                disabled={updateOrden.isPending}
                variant="destructive"
              >
                Registrar Devolución
              </Button>
              <Button variant="ghost" onClick={() => setAccion(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OrdenAccionesDialog;
