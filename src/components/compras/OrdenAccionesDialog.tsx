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
import { Calendar, CheckCircle, XCircle, Mail, Loader2, Pencil, Trash2, FileText, ShieldCheck, ShieldX, Send, Truck, Plus, X, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ProgramarEntregasDialog from "./ProgramarEntregasDialog";
import RegistrarRecepcionDialog from "./RegistrarRecepcionDialog";
import ConvertirEntregasMultiplesDialog from "./ConvertirEntregasMultiplesDialog";
import logoAlmasa from "@/assets/logo-almasa.png";

// Helper function to convert image to base64
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
  const [programarEntregasOpen, setProgramarEntregasOpen] = useState(false);
  const [registrarRecepcionOpen, setRegistrarRecepcionOpen] = useState(false);
  const [convertirEntregasOpen, setConvertirEntregasOpen] = useState(false);
  
  // Email CC functionality
  const [emailTo, setEmailTo] = useState("");
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [newCcEmail, setNewCcEmail] = useState("");

  // Fetch pending deliveries count
  const { data: entregasPendientes = 0 } = useQuery({
    queryKey: ["entregas-pendientes", orden?.id],
    queryFn: async () => {
      if (!orden?.id || !orden?.entregas_multiples) return 0;
      const { count } = await supabase
        .from("ordenes_compra_entregas")
        .select("*", { count: "exact", head: true })
        .eq("orden_compra_id", orden.id)
        .or("fecha_programada.is.null,status.eq.pendiente_fecha");
      return count || 0;
    },
    enabled: !!orden?.id && orden?.entregas_multiples,
  });

  // Fetch email confirmation status
  const { data: confirmacionProveedor } = useQuery({
    queryKey: ["confirmacion-oc", orden?.id],
    queryFn: async () => {
      if (!orden?.id) return null;
      const { data, error } = await supabase
        .from("ordenes_compra_confirmaciones")
        .select("confirmado_en")
        .eq("orden_compra_id", orden.id)
        .not("confirmado_en", "is", null)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data;
    },
    enabled: !!orden?.id && orden?.status === "enviada",
  });

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
    setEmailTo("");
    setCcEmails([]);
    setNewCcEmail("");
  };

  // Initialize email when action changes
  useEffect(() => {
    if (accion === "enviar_email" && orden?.proveedores?.email) {
      setEmailTo(orden.proveedores.email);
    }
  }, [accion, orden?.proveedores?.email]);

  const handleAddCcEmail = () => {
    const email = newCcEmail.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !ccEmails.includes(email)) {
      setCcEmails([...ccEmails, email]);
      setNewCcEmail("");
    }
  };

  const handleRemoveCcEmail = (emailToRemove: string) => {
    setCcEmails(ccEmails.filter(e => e !== emailToRemove));
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
    // Fetch logo as base64
    const logoBase64 = await getLogoBase64();
    
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

    // Build delivery schedule section with new design
    let entregasHTML = '';
    if (entregasProgramadas.length > 0) {
      const entregasRows = entregasProgramadas.map((e: any) => {
        let fecha = '<span style="color: #d4a024; font-style: italic;">Pendiente de programar</span>';
        if (e.fecha_programada) {
          const [year, month, day] = e.fecha_programada.split('-').map(Number);
          const fechaLocal = new Date(year, month - 1, day);
          fecha = fechaLocal.toLocaleDateString('es-MX', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
        return `<tr>
          <td style="text-align: center;">${e.numero_entrega}</td>
          <td>${fecha}</td>
          <td style="text-align: center;">${e.cantidad_bultos} bultos</td>
        </tr>`;
      }).join('');

      entregasHTML = `
        <div class="entregas-section">
          <h3>📅 Calendario de Entregas Programadas</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 80px; text-align: center;">Entrega #</th>
                <th>Fecha Programada</th>
                <th style="width: 120px; text-align: center;">Cantidad</th>
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

    let fechaEntrega = 'Por confirmar';
    if (orden.fecha_entrega_programada) {
      // Parse date correctly to avoid timezone issues
      const [year, month, day] = orden.fecha_entrega_programada.split('-').map(Number);
      const fechaLocal = new Date(year, month - 1, day);
      fechaEntrega = fechaLocal.toLocaleDateString('es-MX', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }

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
          * { box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            padding: 30px 40px; 
            max-width: 850px; 
            margin: 0 auto;
            font-size: 11px;
            color: #1a1a1a;
            background: #fff;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start;
            padding-bottom: 20px;
            margin-bottom: 25px;
            border-bottom: 3px solid #1e3a5f;
          }
          .company-info { 
            flex: 1;
          }
          .company-logo {
            font-size: 28px; 
            font-weight: 800; 
            color: #1e3a5f;
            margin: 0 0 5px 0;
            letter-spacing: -0.5px;
          }
          .company-logo span {
            color: #d4a024;
          }
          .company-subtitle {
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
          }
          .company-details { 
            font-size: 10px; 
            color: #444;
            line-height: 1.5;
          }
          .company-details strong {
            color: #1e3a5f;
          }
          .order-box { 
            text-align: right;
            background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            min-width: 200px;
          }
          .order-title { 
            font-size: 10px; 
            text-transform: uppercase;
            letter-spacing: 2px;
            opacity: 0.9;
            margin-bottom: 5px;
          }
          .folio { 
            font-size: 22px; 
            font-weight: 700; 
            margin: 5px 0;
          }
          .order-date {
            font-size: 10px;
            opacity: 0.9;
          }
          .status-badge {
            display: inline-block;
            background: #d4a024;
            color: #1e3a5f;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            margin-top: 8px;
          }
          .info-grid {
            display: flex;
            gap: 20px;
            margin-bottom: 25px;
          }
          .info-box {
            flex: 1;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #1e3a5f;
          }
          .info-box.delivery {
            border-left-color: #d4a024;
          }
          .info-box h3 { 
            margin: 0 0 10px 0; 
            font-size: 10px; 
            color: #1e3a5f;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .info-box p { 
            margin: 3px 0; 
            font-size: 11px;
            color: #333;
          }
          .info-box .highlight {
            font-weight: 600;
            color: #1e3a5f;
            font-size: 12px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          th { 
            background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
            color: white; 
            padding: 12px 10px; 
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
          }
          td { 
            padding: 10px; 
            border-bottom: 1px solid #e0e0e0;
            font-size: 11px; 
            background: #fff;
          }
          tbody tr:nth-child(even) td {
            background: #f8f9fa;
          }
          tbody tr:hover td {
            background: #f0f4f8;
          }
          .totals { 
            margin-top: 20px; 
            display: flex;
            justify-content: flex-end;
          }
          .totals-box {
            width: 280px;
            background: #f8f9fa;
            border-radius: 6px;
            overflow: hidden;
          }
          .totals-box .row {
            display: flex;
            justify-content: space-between;
            padding: 10px 15px;
            border-bottom: 1px solid #e0e0e0;
          }
          .totals-box .row:last-child {
            border-bottom: none;
          }
          .totals-box .total-row { 
            background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
            color: white; 
            font-weight: bold;
            font-size: 14px;
          }
          .entregas-section {
            margin-top: 25px;
            background: #f8f9fa;
            border-radius: 6px;
            padding: 15px;
          }
          .entregas-section h3 {
            margin: 0 0 15px 0;
            font-size: 11px;
            color: #1e3a5f;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .entregas-section table {
            margin: 0;
            box-shadow: none;
          }
          .entregas-section th {
            background: #d4a024;
            color: #1e3a5f;
          }
          .notes { 
            margin-top: 25px; 
            padding: 15px; 
            background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);
            border-left: 4px solid #d4a024;
            border-radius: 0 6px 6px 0;
          }
          .notes h4 { 
            margin: 0 0 8px 0;
            color: #1e3a5f;
            font-size: 11px;
            text-transform: uppercase;
          }
          .notes p {
            margin: 0;
            color: #333;
            line-height: 1.5;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 50px;
            padding-top: 20px;
          }
          .signature-box {
            width: 180px;
            text-align: center;
          }
          .signature-line {
            border-top: 2px solid #1e3a5f;
            margin-top: 60px;
            padding-top: 8px;
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .signature-name {
            font-weight: 600;
            margin-top: 5px;
            font-size: 11px;
            color: #1e3a5f;
          }
          .footer { 
            margin-top: 40px; 
            text-align: center; 
            font-size: 9px; 
            color: #999;
            border-top: 1px solid #e0e0e0;
            padding-top: 15px;
          }
          .footer p {
            margin: 3px 0;
          }
          @page { margin: 1cm; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="height: 70px; margin-bottom: 10px;">` : ''}
            <div class="company-details">
              <strong>Abarrotes la Manita SA de CV</strong><br>
              RFC: AMA 700701GI8<br>
              Melchor Ocampo #59, Magdalena Mixiuhca<br>
              Venustiano Carranza, 15850, CDMX<br>
              Tel: 55 5552-0168 / 55 5552-7887<br>
              compras@almasa.com.mx
            </div>
          </div>
          <div class="order-box">
            <div class="order-title">Orden de Compra</div>
            <div class="folio">${orden.folio}</div>
            <div class="order-date">${fechaOrden}</div>
            <div class="status-badge">${orden.status?.toUpperCase()}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <h3>Proveedor</h3>
            <p class="highlight">${orden.proveedores?.nombre || 'Sin proveedor'}</p>
            ${orden.proveedores?.direccion ? `<p>${orden.proveedores.direccion}</p>` : ''}
            ${orden.proveedores?.email ? `<p>📧 ${orden.proveedores.email}</p>` : ''}
            ${orden.proveedores?.telefono ? `<p>📞 ${orden.proveedores.telefono}</p>` : ''}
          </div>
          ${!orden.entregas_multiples ? `
            <div class="info-box delivery">
              <h3>Entrega Programada</h3>
              <p class="highlight">${fechaEntrega}</p>
            </div>
          ` : ''}
        </div>

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
          <div class="totals-box">
            <div class="row">
              <span>Subtotal:</span>
              <span>$${orden.subtotal?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="row">
              <span>IVA (16%):</span>
              <span>$${orden.impuestos?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="row total-row">
              <span>TOTAL:</span>
              <span>$${orden.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        ${entregasHTML}

        ${orden.notas ? `
          <div class="notes">
            <h4>📝 Notas</h4>
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
          <p><strong>Abarrotes la Manita SA de CV</strong> | compras@almasa.com.mx | Tel: 55 5552-0168</p>
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

      // Create internal notification for the creator
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUserId)
        .single();

      await supabase
        .from("notificaciones")
        .insert({
          tipo: "oc_autorizada",
          titulo: `Orden ${orden.folio} autorizada`,
          descripcion: `Tu orden de compra a ${orden.proveedores?.nombre || 'proveedor'} ha sido autorizada por ${adminProfile?.full_name || 'Administrador'}. Ya puedes enviarla al proveedor.`,
          orden_compra_id: orden.id,
          leida: false,
        });

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones"] });

      toast({
        title: "Orden autorizada",
        description: "La orden fue autorizada. El creador puede enviarla al proveedor.",
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
    const destinatario = emailTo.trim();
    if (!destinatario) {
      toast({
        title: "Sin correo",
        description: "Ingresa un correo de destino",
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

      // Confirmation URL for supplier
      const confirmUrl = `https://vrcyjmfpteoccqdmdmqn.supabase.co/functions/v1/confirmar-oc?id=${orden.id}&action=confirm`;
      const trackingPixelUrl = `https://vrcyjmfpteoccqdmdmqn.supabase.co/functions/v1/confirmar-oc?id=${orden.id}&action=track`;

      // Simple email body with reference to attachment and confirmation button
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

          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmUrl}" 
               style="display: inline-block; background-color: #2e7d32; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              ✓ Confirmar Recepción de Orden
            </a>
            <p style="color: #666; font-size: 12px; margin-top: 10px;">
              Por favor haga clic en el botón para confirmar que recibió esta orden.
            </p>
          </div>

          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
          <p style="color: #666; font-size: 12px;">
            Este correo fue enviado desde el sistema de Abarrotes La Manita.<br/>
            <strong>Importante:</strong> Por favor confirme la recepción haciendo clic en el botón verde.
          </p>
          <img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />
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

      // 1. Send email to supplier (with CC if provided)
      const emailPayload: any = {
        action: 'send',
        email: 'compras@almasa.com.mx',
        to: destinatario,
        subject: `Orden de Compra ${orden.folio} - Abarrotes La Manita`,
        body: htmlBody,
        attachments: attachments,
      };
      
      if (ccEmails.length > 0) {
        emailPayload.cc = ccEmails.join(',');
      }

      const { data, error } = await supabase.functions.invoke('gmail-api', {
        body: emailPayload,
      });

      if (error) throw error;

      // 2. Send copy notification to compras@almasa.com.mx
      const copyHtmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2e7d32;">✓ Orden de Compra Enviada</h2>
          <p>Se ha enviado la siguiente orden de compra al proveedor:</p>
          
          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2e7d32;">
            <p style="margin: 5px 0;"><strong>Folio:</strong> ${orden.folio}</p>
            <p style="margin: 5px 0;"><strong>Proveedor:</strong> ${orden.proveedores?.nombre}</p>
            <p style="margin: 5px 0;"><strong>Email del proveedor:</strong> ${destinatario}</p>
            ${ccEmails.length > 0 ? `<p style="margin: 5px 0;"><strong>CC:</strong> ${ccEmails.join(', ')}</p>` : ''}
            <p style="margin: 5px 0;"><strong>Total:</strong> $${orden.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            <p style="margin: 5px 0;"><strong>Fecha de la orden:</strong> ${new Date(orden.fecha_orden).toLocaleDateString('es-MX')}</p>
            <p style="margin: 5px 0;"><strong>Enviado:</strong> ${new Date().toLocaleString('es-MX')}</p>
          </div>
          
          <p>Adjunto encontrarás una copia del documento enviado al proveedor.</p>
          
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
          <p style="color: #666; font-size: 12px;">
            Notificación automática del sistema ERP - Abarrotes La Manita
          </p>
        </div>
      `;

      // Send copy to internal email (don't fail if this fails)
      try {
        await supabase.functions.invoke('gmail-api', {
          body: {
            action: 'send',
            email: 'compras@almasa.com.mx',
            to: 'compras@almasa.com.mx',
            subject: `[COPIA ENVIADA] OC ${orden.folio} enviada a ${orden.proveedores?.nombre}`,
            body: copyHtmlBody,
            attachments: attachments,
          },
        });
        console.log('Copy email sent to compras@almasa.com.mx');
      } catch (copyError) {
        console.error('Error sending copy email:', copyError);
        // Don't fail the main operation if copy fails
      }

      // Update order status to "enviada" and record send time
      await supabase
        .from("ordenes_compra")
        .update({ 
          status: "enviada",
          email_enviado_en: new Date().toISOString()
        })
        .eq("id", orden.id);

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });

      const ccInfo = ccEmails.length > 0 ? ` (CC: ${ccEmails.join(', ')})` : '';
      toast({
        title: "Orden enviada",
        description: `La orden se envió a ${destinatario}${ccInfo} y una copia a compras@almasa.com.mx`,
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
      parcial: { variant: "secondary", label: "Recepción Parcial" },
      recibida: { variant: "default", label: "Recibida" },
      devuelta: { variant: "destructive", label: "Devuelta" },
    };
    const config = statusConfig[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const canRequestAuthorization = orden?.status === "pendiente" && !isAdmin;
  const canAuthorize = isAdmin && orden?.status === "pendiente_autorizacion";
  const canSendToSupplier = orden?.status === "autorizada";
  const canSendDirectly = isAdmin && orden?.status === "pendiente";
  const proveedorTieneEmail = !!(orden?.proveedores?.email);

  // Mark as sent without email (for informal suppliers) - still sends internal copy
  const handleMarcarComoEnviada = async () => {
    setEnviandoEmail(true);
    try {
      // Generate PDF content for the internal copy
      const pdfContent = await generarPDFContent(!!orden.autorizado_por);
      const pdfBase64 = btoa(unescape(encodeURIComponent(pdfContent)));

      // Send internal copy email to compras@almasa.com.mx
      const copyHtmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2e7d32;">📋 Orden de Compra Registrada (Control Interno)</h2>
          <p>Se ha registrado la siguiente orden de compra para un proveedor sin correo electrónico:</p>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 5px 0;"><strong>⚠️ Proveedor sin correo:</strong> Esta orden NO fue enviada por email al proveedor.</p>
          </div>

          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2e7d32;">
            <p style="margin: 5px 0;"><strong>Folio:</strong> ${orden.folio}</p>
            <p style="margin: 5px 0;"><strong>Proveedor:</strong> ${orden.proveedores?.nombre}</p>
            <p style="margin: 5px 0;"><strong>Total:</strong> $${orden.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            <p style="margin: 5px 0;"><strong>Fecha de la orden:</strong> ${new Date(orden.fecha_orden).toLocaleDateString('es-MX')}</p>
            <p style="margin: 5px 0;"><strong>Registrado:</strong> ${new Date().toLocaleString('es-MX')}</p>
          </div>
          
          <p>Adjunto encontrarás el documento de la orden de compra.</p>
          
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
          <p style="color: #666; font-size: 12px;">
            Notificación automática del sistema ERP - Abarrotes La Manita
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
          to: 'compras@almasa.com.mx',
          subject: `[CONTROL INTERNO] OC ${orden.folio} - ${orden.proveedores?.nombre} (sin correo)`,
          body: copyHtmlBody,
          attachments: attachments,
        },
      });

      // Update order status
      await supabase
        .from("ordenes_compra")
        .update({ 
          status: "enviada",
          email_enviado_en: null // No email was sent to supplier
        })
        .eq("id", orden.id);

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });

      toast({
        title: "Orden registrada",
        description: "La orden se marcó como enviada y se envió copia a compras@almasa.com.mx",
      });
      
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error marking order as sent:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la orden",
        variant: "destructive",
      });
    } finally {
      setEnviandoEmail(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Gestionar Orden {orden?.folio}
            {getStatusBadge()}
            {!proveedorTieneEmail && (
              <Badge variant="outline" className="text-muted-foreground">
                Sin correo
              </Badge>
            )}
            {orden?.status === "enviada" && orden?.email_enviado_en && (
              <div className="flex items-center gap-2 ml-auto">
                {orden?.email_leido_en && (
                  <Badge variant="outline" className="text-blue-600 border-blue-300">
                    <Mail className="h-3 w-3 mr-1" />
                    Leído
                  </Badge>
                )}
                {confirmacionProveedor?.confirmado_en ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Confirmado por proveedor
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    <Mail className="h-3 w-3 mr-1" />
                    Pendiente confirmación
                  </Badge>
                )}
              </div>
            )}
            {orden?.status === "enviada" && !orden?.email_enviado_en && (
              <Badge variant="outline" className="text-muted-foreground ml-auto">
                Control interno
              </Badge>
            )}
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
                  Autorizar Orden
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

            {/* Button to send to supplier - visible when authorized */}
            {canSendToSupplier && proveedorTieneEmail && (
              <Button
                variant="outline"
                className="w-full justify-start text-green-600 hover:text-green-700 border-green-200"
                onClick={() => setAccion("enviar_email")}
              >
                <Mail className="mr-2 h-4 w-4" />
                Enviar al Proveedor
              </Button>
            )}

            {/* Button to mark as sent without email - for informal suppliers */}
            {canSendToSupplier && !proveedorTieneEmail && (
              <Button
                variant="outline"
                className="w-full justify-start text-green-600 hover:text-green-700 border-green-200"
                onClick={handleMarcarComoEnviada}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Marcar como Enviada (control interno)
              </Button>
            )}

            {/* Admin can send directly without authorization */}
            {canSendDirectly && proveedorTieneEmail && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setAccion("enviar_email")}
              >
                <Mail className="mr-2 h-4 w-4" />
                Enviar Orden al Proveedor (sin autorizar)
              </Button>
            )}

            {/* Admin can mark as sent without email */}
            {canSendDirectly && !proveedorTieneEmail && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleMarcarComoEnviada}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Marcar como Enviada (control interno)
              </Button>
            )}

            {orden?.entregas_multiples ? (
              <Button
                variant="outline"
                className={`w-full justify-start ${entregasPendientes > 0 ? "border-amber-300 text-amber-600 hover:bg-amber-50" : ""}`}
                onClick={() => setProgramarEntregasOpen(true)}
              >
                <Truck className="mr-2 h-4 w-4" />
                Programar Entregas
                {entregasPendientes > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700">
                    {entregasPendientes} pendientes
                  </Badge>
                )}
              </Button>
            ) : (orden?.status === "enviada" || orden?.status === "confirmada" || orden?.status === "parcial") && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setConvertirEntregasOpen(true)}
              >
                <Truck className="mr-2 h-4 w-4" />
                Dividir en Entregas Múltiples
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
              onClick={() => setRegistrarRecepcionOpen(true)}
              disabled={orden?.status === "recibida"}
            >
              <Package className="mr-2 h-4 w-4" />
              Registrar Recepción
              {orden?.status === "parcial" && (
                <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700">
                  Parcial
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setAccion("devolver")}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Marcar como Devuelta
            </Button>
            {(orden?.status === "pendiente" || isAdmin) && (
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
                {proveedorTieneEmail 
                  ? "Al autorizar, tu nombre aparecerá como firma en el PDF. El creador podrá enviarla al proveedor por correo."
                  : "Al autorizar, tu nombre aparecerá como firma en el PDF. Este proveedor no tiene correo registrado (control interno)."}
              </p>
              <div className="text-sm text-muted-foreground space-y-1 mt-2">
                <p><strong>Folio:</strong> {orden?.folio}</p>
                <p><strong>Proveedor:</strong> {orden?.proveedores?.nombre}</p>
                {proveedorTieneEmail ? (
                  <p><strong>Correo proveedor:</strong> {orden?.proveedores?.email}</p>
                ) : (
                  <p className="text-amber-600"><strong>⚠ Sin correo:</strong> Control interno</p>
                )}
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
              <p className="font-medium">Detalles del envío</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Proveedor:</strong> {orden?.proveedores?.nombre}</p>
                <p><strong>Total de la orden:</strong> ${orden?.total?.toLocaleString()}</p>
                <p><strong>Productos:</strong> {orden?.ordenes_compra_detalles?.length || 0} items</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Se enviará desde: <strong>compras@almasa.com.mx</strong>
              </p>
            </div>
            
            {/* Email destination */}
            <div className="space-y-2">
              <Label htmlFor="emailTo">Correo destino *</Label>
              <Input
                id="emailTo"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="correo@proveedor.com"
              />
            </div>

            {/* CC Emails */}
            <div className="space-y-2">
              <Label>CC (con copia)</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={newCcEmail}
                  onChange={(e) => setNewCcEmail(e.target.value)}
                  placeholder="Agregar correo en copia..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCcEmail();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={handleAddCcEmail}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {ccEmails.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {ccEmails.map((email) => (
                    <Badge key={email} variant="secondary" className="flex items-center gap-1">
                      {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveCcEmail(email)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleEnviarOrden} 
                disabled={enviandoEmail || !emailTo.trim()}
              >
                {enviandoEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar orden"
                )}
              </Button>
              <Button variant="ghost" onClick={() => setAccion(null)}>
                Cancelar
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
        ) : accion === "devolver" ? (
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
        ) : null}
      </DialogContent>
    </Dialog>

    <ProgramarEntregasDialog
      open={programarEntregasOpen}
      onOpenChange={setProgramarEntregasOpen}
      orden={orden}
    />

    <RegistrarRecepcionDialog
      open={registrarRecepcionOpen}
      onOpenChange={setRegistrarRecepcionOpen}
      orden={orden}
    />

    <ConvertirEntregasMultiplesDialog
      open={convertirEntregasOpen}
      onOpenChange={setConvertirEntregasOpen}
      orden={orden}
    />
    </>
  );
};

export default OrdenAccionesDialog;
