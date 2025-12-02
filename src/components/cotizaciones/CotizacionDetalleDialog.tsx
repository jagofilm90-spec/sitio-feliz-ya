import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Send,
  ShoppingCart,
  Download,
  Loader2,
  Calendar,
  Building,
  User,
  Trash2,
  Mail,
  Plus,
  X,
  History,
} from "lucide-react";
import { format, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import logoAlmasa from "@/assets/logo-almasa.png";
import { useGmailPermisos, logEmailAction } from "@/hooks/useGmailPermisos";

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

interface CotizacionDetalleDialogProps {
  cotizacionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const CotizacionDetalleDialog = ({
  cotizacionId,
  open,
  onOpenChange,
  onUpdate,
}: CotizacionDetalleDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [fechaEntrega, setFechaEntrega] = useState("");
  
  const { filterCuentasByPermiso } = useGmailPermisos();

  // Fetch Gmail accounts
  const { data: gmailCuentas = [] } = useQuery({
    queryKey: ["gmail_cuentas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gmail_cuentas")
        .select("*")
        .eq("activo", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: cotizacion, isLoading } = useQuery({
    queryKey: ["cotizacion", cotizacionId],
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
            cantidad_maxima,
            nota_linea,
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

  // Fetch client emails
  const { data: clienteCorreos = [] } = useQuery({
    queryKey: ["cliente_correos", cotizacion?.cliente?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_correos")
        .select("*")
        .eq("cliente_id", cotizacion?.cliente?.id)
        .eq("activo", true)
        .order("es_principal", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!cotizacion?.cliente?.id,
  });

  // Fetch send history
  const { data: historialEnvios = [] } = useQuery({
    queryKey: ["cotizacion_envios", cotizacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotizaciones_envios")
        .select(`
          *,
          enviado_por_profile:profiles!cotizaciones_envios_enviado_por_fkey(full_name),
          gmail_cuenta:gmail_cuentas(email)
        `)
        .eq("cotizacion_id", cotizacionId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Detectar si es cotización "solo precios" (sin cantidades)
  const esSoloPrecios = cotizacion?.detalles?.every((d: any) => !d.cantidad || d.cantidad === 0) ?? false;

  const getStatusBadge = () => {
    if (!cotizacion) return null;
    
    const hoy = new Date();
    const vigencia = new Date(cotizacion.fecha_vigencia);

    if (cotizacion.status === "aceptada") {
      return <Badge className="bg-green-500/20 text-green-700">Aceptada</Badge>;
    }
    if (cotizacion.status === "rechazada") {
      return <Badge variant="destructive">Rechazada</Badge>;
    }
    if (cotizacion.status === "enviada" && isBefore(vigencia, hoy)) {
      return <Badge className="bg-red-500/20 text-red-700">Vencida</Badge>;
    }
    if (cotizacion.status === "enviada") {
      return <Badge className="bg-blue-500/20 text-blue-700">Enviada</Badge>;
    }
    return <Badge variant="secondary">Borrador</Badge>;
  };

  const addAdditionalEmail = () => {
    if (newEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      if (!additionalEmails.includes(newEmail)) {
        setAdditionalEmails([...additionalEmails, newEmail]);
      }
      setNewEmail("");
    } else {
      toast({
        title: "Email inválido",
        description: "Por favor ingresa un email válido",
        variant: "destructive",
      });
    }
  };

  const removeAdditionalEmail = (email: string) => {
    setAdditionalEmails(additionalEmails.filter(e => e !== email));
  };

  const handleOpenEmailDialog = () => {
    if (!cotizacion) return;
    
    // Use client emails if available, otherwise use the single email from cliente
    if (clienteCorreos.length > 0) {
      const principalEmail = clienteCorreos.find((c: any) => c.es_principal)?.email || clienteCorreos[0]?.email || "";
      setEmailTo(principalEmail);
      // Add other emails as additional
      const otherEmails = clienteCorreos
        .filter((c: any) => c.email !== principalEmail)
        .map((c: any) => c.email);
      setAdditionalEmails(otherEmails);
    } else {
      setEmailTo(cotizacion.cliente?.email || "");
      setAdditionalEmails([]);
    }
    
    setEmailSubject(`Cotización ${cotizacion.folio} - Abarrotes La Manita`);
    setEmailBody(`Estimado cliente,\n\nAdjunto encontrará la cotización ${cotizacion.folio} solicitada.\n\nEsta cotización tiene vigencia hasta el ${format(new Date(cotizacion.fecha_vigencia), "dd 'de' MMMM 'de' yyyy", { locale: es })}.\n\nQuedamos a sus órdenes para cualquier duda o aclaración.\n\nSaludos cordiales,\nAbarrotes La Manita`);
    setShowEmailDialog(true);
  };

  const handleEnviarEmail = async () => {
    if (!cotizacion) return;
    
    const allEmails = [emailTo, ...additionalEmails].filter(e => e);
    if (allEmails.length === 0) {
      toast({
        title: "Email requerido",
        description: "Ingresa al menos un email para enviar la cotización",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      // Get the account to send from (pedidos@almasa.com.mx)
      const cuentaEnvio = filterCuentasByPermiso(gmailCuentas).find(
        c => c.email === "pedidos@almasa.com.mx" || c.proposito === "pedidos"
      ) || gmailCuentas[0];

      if (!cuentaEnvio) {
        throw new Error("No hay cuenta de Gmail configurada para enviar emails");
      }

      // Generate PDF content
      const pdfContent = await generarPDFContent();

      // Send email via edge function
      const { error: sendError } = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "send",
          cuentaId: cuentaEnvio.id,
          to: allEmails.join(", "),
          subject: emailSubject,
          body: emailBody,
          html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${emailBody}</pre>`,
        },
      });

      if (sendError) throw sendError;

      // Update status to enviada
      const { error } = await supabase
        .from("cotizaciones")
        .update({ status: "enviada" })
        .eq("id", cotizacionId);

      if (error) throw error;

      // Log email action
      await logEmailAction(cuentaEnvio.id, "enviar", {
        emailTo: allEmails.join(", "),
        emailSubject,
      });

      toast({
        title: "Cotización enviada",
        description: `Se envió la cotización a ${allEmails.length} destinatario(s)`,
      });

      setShowEmailDialog(false);
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error al enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleMarcarEnviada = async () => {
    setSending(true);
    try {
      const { error } = await supabase
        .from("cotizaciones")
        .update({ status: "enviada" })
        .eq("id", cotizacionId);

      if (error) throw error;

      toast({
        title: "Cotización actualizada",
        description: "El estado ha sido cambiado a 'Enviada'",
      });

      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // First delete details
      const { error: detallesError } = await supabase
        .from("cotizaciones_detalles")
        .delete()
        .eq("cotizacion_id", cotizacionId);

      if (detallesError) throw detallesError;

      // Then delete the cotizacion
      const { error } = await supabase
        .from("cotizaciones")
        .delete()
        .eq("id", cotizacionId);

      if (error) throw error;

      toast({
        title: "Cotización eliminada",
        description: `La cotización ${cotizacion?.folio} ha sido eliminada`,
      });

      queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error al eliminar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleOpenConvertDialog = () => {
    // Set default delivery date to 3 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 3);
    setFechaEntrega(defaultDate.toISOString().split('T')[0]);
    setShowConvertDialog(true);
  };

  const handleConvertirPedido = async () => {
    if (!cotizacion) return;
    
    setConverting(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay usuario autenticado");

      // Verificar que todos los productos de la cotización existan
      const productosIds = cotizacion.detalles?.map((d: any) => d.producto_id || d.producto?.id).filter(Boolean) || [];
      
      if (productosIds.length === 0) {
        throw new Error("La cotización no tiene productos");
      }

      const { data: productosExistentes, error: productosError } = await supabase
        .from("productos")
        .select("id, nombre, codigo, activo")
        .in("id", productosIds);

      if (productosError) throw productosError;

      // Identificar productos faltantes o inactivos
      const productosFaltantes = cotizacion.detalles?.filter((d: any) => {
        const productoId = d.producto_id || d.producto?.id;
        const existe = productosExistentes?.find(p => p.id === productoId && p.activo);
        return !existe;
      });

      if (productosFaltantes && productosFaltantes.length > 0) {
        const nombresFaltantes = productosFaltantes.map((d: any) => 
          `${d.producto?.codigo || 'N/A'} - ${d.producto?.nombre || 'Producto desconocido'}`
        ).join('\n');
        
        throw new Error(
          `No se puede crear el pedido. Los siguientes productos de la cotización no existen o están inactivos:\n\n${nombresFaltantes}\n\nPor favor, actualiza la cotización antes de convertirla a pedido.`
        );
      }

      // Generate folio for new pedido
      const currentYearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
      const { data: lastPedido } = await supabase
        .from("pedidos")
        .select("folio")
        .like("folio", `PED-${currentYearMonth}-%`)
        .order("folio", { ascending: false })
        .limit(1)
        .single();

      let newNumber = 1;
      if (lastPedido?.folio) {
        const lastNum = parseInt(lastPedido.folio.slice(-4));
        newNumber = lastNum + 1;
      }
      const newFolio = `PED-${currentYearMonth}-${String(newNumber).padStart(4, '0')}`;

      // Calculate peso_total_kg (sum of quantities in kg, approximate)
      const pesoTotal = cotizacion.detalles?.reduce((acc: number, d: any) => {
        return acc + (d.cantidad || 0);
      }, 0) || 0;

      // Create the pedido
      const { data: newPedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          folio: newFolio,
          cliente_id: cotizacion.cliente_id,
          sucursal_id: cotizacion.sucursal_id,
          vendedor_id: user.id,
          fecha_pedido: new Date().toISOString(),
          fecha_entrega_estimada: fechaEntrega || null,
          status: "pendiente",
          subtotal: cotizacion.subtotal,
          impuestos: cotizacion.impuestos,
          total: cotizacion.total,
          peso_total_kg: pesoTotal,
          notas: `Generado desde cotización ${cotizacion.folio}`,
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      // Create pedido_detalles from cotizacion_detalles
      const detallesInsert = cotizacion.detalles?.map((d: any) => ({
        pedido_id: newPedido.id,
        producto_id: d.producto_id || d.producto?.id,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
        subtotal: d.subtotal,
      }));

      if (detallesInsert && detallesInsert.length > 0) {
        const { error: detallesError } = await supabase
          .from("pedidos_detalles")
          .insert(detallesInsert);

        if (detallesError) throw detallesError;
      }

      // Update cotizacion with pedido_id and set status to aceptada
      const { error: updateError } = await supabase
        .from("cotizaciones")
        .update({ 
          pedido_id: newPedido.id,
          status: "aceptada"
        })
        .eq("id", cotizacionId);

      if (updateError) throw updateError;

      toast({
        title: "Pedido creado exitosamente",
        description: `Se generó el pedido ${newFolio} a partir de la cotización`,
      });

      queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
      queryClient.invalidateQueries({ queryKey: ["cotizacion", cotizacionId] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      setShowConvertDialog(false);
      onUpdate();
    } catch (error: any) {
      console.error("Error converting cotizacion to pedido:", error);
      toast({
        title: "Error al crear pedido",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  const generarPDFContent = async () => {
    if (!cotizacion) return "";

    const logoBase64 = await getLogoBase64();

    const productosHTML = cotizacion.detalles?.map((d: any) => 
      esSoloPrecios 
        ? `<tr>
            <td style="text-align: center;">${d.producto?.codigo || '-'}</td>
            <td>${d.producto?.nombre || 'Producto'}</td>
            <td style="text-align: right;">$${d.precio_unitario?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
          </tr>`
        : `<tr>
            <td style="text-align: center;">${d.producto?.codigo || '-'}</td>
            <td>${d.producto?.nombre || 'Producto'}</td>
            <td style="text-align: center;">${d.cantidad} ${d.producto?.unidad || ''}</td>
            <td style="text-align: right;">$${d.precio_unitario?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            <td style="text-align: right;">$${d.subtotal?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
          </tr>`
    ).join('') || '';

    // Parse dates correctly to avoid timezone issues
    const parseDateLocal = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    const fechaCreacion = parseDateLocal(cotizacion.fecha_creacion).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const fechaVigencia = parseDateLocal(cotizacion.fecha_vigencia).toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Cotización ${cotizacion.folio}</title>
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
              border-bottom: 3px solid #b22234;
            }
            .company-info { 
              flex: 1;
            }
            .company-details { 
              font-size: 10px; 
              color: #444;
              line-height: 1.5;
            }
            .company-details strong {
              color: #b22234;
            }
            .order-box { 
              text-align: right;
              background: linear-gradient(135deg, #b22234 0%, #8b1a28 100%);
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
              font-size: 20px; 
              font-weight: 700; 
              margin: 5px 0;
            }
            .order-date {
              font-size: 10px;
              opacity: 0.9;
            }
            .status-badge {
              display: inline-block;
              background: #ffd700;
              color: #8b1a28;
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
              border-left: 4px solid #b22234;
            }
            .info-box.vigencia {
              border-left-color: #ffd700;
            }
            .info-box h3 { 
              margin: 0 0 10px 0; 
              font-size: 10px; 
              color: #b22234;
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
              color: #b22234;
              font-size: 12px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 20px 0;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            th { 
              background: linear-gradient(135deg, #b22234 0%, #8b1a28 100%);
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
              background: linear-gradient(135deg, #b22234 0%, #8b1a28 100%);
              color: white; 
              font-weight: bold;
              font-size: 14px;
            }
            .vigencia-notice {
              margin-top: 25px;
              padding: 15px;
              background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);
              border-left: 4px solid #ffd700;
              border-radius: 0 6px 6px 0;
            }
            .vigencia-notice h4 {
              margin: 0 0 5px 0;
              color: #8b1a28;
              font-size: 11px;
            }
            .vigencia-notice p {
              margin: 0;
              font-size: 12px;
              font-weight: 600;
              color: #333;
            }
            .notes { 
              margin-top: 20px; 
              padding: 15px; 
              background: #f5f5f5;
              border-left: 4px solid #666;
              border-radius: 0 6px 6px 0;
            }
            .notes h4 { 
              margin: 0 0 8px 0;
              color: #333;
              font-size: 11px;
              text-transform: uppercase;
            }
            .notes p {
              margin: 0;
              color: #333;
              line-height: 1.5;
            }
            .terms {
              margin-top: 30px;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 6px;
              font-size: 10px;
              color: #666;
            }
            .terms h4 {
              margin: 0 0 10px 0;
              color: #b22234;
              font-size: 10px;
              text-transform: uppercase;
            }
            .terms ul {
              margin: 0;
              padding-left: 15px;
            }
            .terms li {
              margin-bottom: 5px;
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
              ${logoBase64 ? `<img src="${logoBase64}" alt="ALMASA" style="height: 70px; margin-bottom: 10px;">` : ''}
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
              <div class="order-title">Cotización</div>
              <div class="folio">${cotizacion.folio}</div>
              <div class="order-date">${fechaCreacion}</div>
              <div class="status-badge">${cotizacion.status?.toUpperCase() || 'BORRADOR'}</div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-box">
              <h3>Cliente</h3>
              <p class="highlight">${cotizacion.cliente?.nombre || 'Sin cliente'}</p>
              <p>Código: ${cotizacion.cliente?.codigo || '-'}</p>
              ${cotizacion.cliente?.email ? `<p>📧 ${cotizacion.cliente.email}</p>` : ''}
              ${cotizacion.sucursal ? `<p>📍 ${cotizacion.sucursal.nombre}</p>` : ''}
            </div>
            <div class="info-box vigencia">
              <h3>Vigencia</h3>
              <p class="highlight">${fechaVigencia}</p>
              <p style="font-size: 10px; color: #666; margin-top: 5px;">
                Esta cotización es válida hasta la fecha indicada
              </p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 80px; text-align: center;">Código</th>
                <th>Producto</th>
                ${esSoloPrecios ? '' : '<th style="width: 100px; text-align: center;">Cantidad</th>'}
                <th style="width: 100px; text-align: right;">Precio Unit.</th>
                ${esSoloPrecios ? '' : '<th style="width: 100px; text-align: right;">Subtotal</th>'}
              </tr>
            </thead>
            <tbody>
              ${productosHTML}
            </tbody>
          </table>

          ${esSoloPrecios ? '' : `
          <div class="totals">
            <div class="totals-box">
              <div class="row">
                <span>Subtotal:</span>
                <span>$${cotizacion.subtotal?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div class="row">
                <span>Impuestos:</span>
                <span>$${cotizacion.impuestos?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div class="row total-row">
                <span>TOTAL:</span>
                <span>$${cotizacion.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
          `}

          <div class="vigencia-notice">
            <h4>⏰ Vigencia de la Cotización</h4>
            <p>Esta cotización tiene validez hasta el ${fechaVigencia}</p>
          </div>

          ${cotizacion.notas ? `
            <div class="notes">
              <h4>📝 Notas</h4>
              <p>${cotizacion.notas}</p>
            </div>
          ` : ''}

          <div class="terms">
            <h4>Términos y Condiciones</h4>
            <ul>
              <li>Los precios están sujetos a cambio sin previo aviso después de la fecha de vigencia.</li>
              <li>La mercancía viaja por cuenta y riesgo del comprador.</li>
              <li>El tiempo de entrega se confirma al momento de la orden de compra.</li>
              <li>Para hacer válida esta cotización, favor de enviar su orden de compra.</li>
            </ul>
          </div>

          <div class="footer">
            <p>Documento generado el ${new Date().toLocaleString('es-MX')}</p>
            <p><strong>Abarrotes la Manita SA de CV</strong> | compras@almasa.com.mx | Tel: 55 5552-0168</p>
          </div>
        </body>
        </html>
      `;
  };

  const handleDescargarPDF = async () => {
    if (!cotizacion) return;

    try {
      const pdfContent = await generarPDFContent();
      
      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        
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

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!cotizacion) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Cotización {cotizacion.folio}
            </DialogTitle>
            {getStatusBadge()}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{cotizacion.cliente?.nombre}</p>
                </div>
              </div>
              {cotizacion.sucursal && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Sucursal</p>
                    <p className="font-medium">{cotizacion.sucursal.nombre}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Fecha creación</p>
                  <p className="font-medium">
                    {format(new Date(cotizacion.fecha_creacion), "dd/MM/yyyy", { locale: es })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Vigencia hasta</p>
                  <p className="font-medium">
                    {format(new Date(cotizacion.fecha_vigencia), "dd/MM/yyyy", { locale: es })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Products table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  {!esSoloPrecios && <TableHead className="text-center">Cantidad</TableHead>}
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  {!esSoloPrecios && <TableHead className="text-right">Subtotal</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cotizacion.detalles?.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{d.producto?.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.producto?.codigo} • {d.producto?.unidad}
                        </p>
                        {(d.cantidad_maxima || d.nota_linea) && (
                          <p className="text-xs text-amber-600 mt-1 font-medium">
                            {d.cantidad_maxima && (
                              <span>Máx: {d.cantidad_maxima.toLocaleString()} {d.producto?.unidad}</span>
                            )}
                            {d.cantidad_maxima && d.nota_linea && <span> • </span>}
                            {d.nota_linea && <span>{d.nota_linea}</span>}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    {!esSoloPrecios && <TableCell className="text-center">{d.cantidad}</TableCell>}
                    <TableCell className="text-right font-mono">
                      ${formatCurrency(d.precio_unitario)}
                    </TableCell>
                    {!esSoloPrecios && (
                      <TableCell className="text-right font-medium font-mono">
                        ${formatCurrency(d.subtotal)}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals - only show if not "solo precios" */}
          {!esSoloPrecios && (
            <div className="flex justify-end">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-mono">${formatCurrency(cotizacion.subtotal)}</span>
                </div>
                <div className="flex justify-between text-blue-600">
                  <span>Impuestos:</span>
                  <span className="font-mono">${formatCurrency(cotizacion.impuestos)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className="font-mono">${formatCurrency(cotizacion.total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {cotizacion.notas && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Notas:</p>
              <p className="text-sm">{cotizacion.notas}</p>
            </div>
          )}

          {/* Send History */}
          {historialEnvios.length > 0 && (
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4 text-muted-foreground" />
                Historial de envíos ({historialEnvios.length})
              </div>
              <div className="space-y-2">
                {historialEnvios.map((envio: any) => (
                  <div key={envio.id} className="flex items-start justify-between text-sm p-2 bg-muted/30 rounded">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{envio.email_destino}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Por: {envio.enviado_por_profile?.full_name || "Usuario"} 
                        {envio.gmail_cuenta?.email && ` desde ${envio.gmail_cuenta.email}`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(envio.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Button 
              variant="outline" 
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDescargarPDF}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              {cotizacion.status === "borrador" && (
                <>
                  <Button variant="outline" onClick={handleMarcarEnviada} disabled={sending}>
                    {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Marcar enviada
                  </Button>
                  <Button onClick={handleOpenEmailDialog}>
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar por email
                  </Button>
                </>
              )}
              {(cotizacion.status === "enviada" || cotizacion.status === "aceptada") && !cotizacion.pedido_id && (
                <Button onClick={handleOpenConvertDialog}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Convertir a pedido
                </Button>
              )}
              {cotizacion.pedido_id && (
                <Badge className="bg-green-500/20 text-green-700 px-3 py-2">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Pedido generado
                </Badge>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Enviar Cotización por Email
            </DialogTitle>
            <DialogDescription>
              Envía la cotización {cotizacion.folio} al cliente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Client saved emails */}
            {clienteCorreos.length > 0 && (
              <div className="space-y-2">
                <Label>Correos del cliente</Label>
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                  {clienteCorreos.map((correo: any) => (
                    <label key={correo.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailTo === correo.email || additionalEmails.includes(correo.email)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (!emailTo) {
                              setEmailTo(correo.email);
                            } else if (!additionalEmails.includes(correo.email)) {
                              setAdditionalEmails([...additionalEmails, correo.email]);
                            }
                          } else {
                            if (emailTo === correo.email) {
                              setEmailTo(additionalEmails[0] || "");
                              setAdditionalEmails(additionalEmails.slice(1));
                            } else {
                              setAdditionalEmails(additionalEmails.filter(e => e !== correo.email));
                            }
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{correo.email}</span>
                      {correo.nombre_contacto && (
                        <span className="text-xs text-muted-foreground">({correo.nombre_contacto})</span>
                      )}
                      {correo.es_principal && (
                        <Badge variant="secondary" className="text-xs">Principal</Badge>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="emailTo">Email principal *</Label>
              <Input
                id="emailTo"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="cliente@ejemplo.com"
              />
            </div>

            {/* Additional emails */}
            <div className="space-y-2">
              <Label>Emails adicionales (CC)</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="otro@ejemplo.com"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAdditionalEmail())}
                />
                <Button type="button" variant="outline" onClick={addAdditionalEmail}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {additionalEmails.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {additionalEmails.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-1">
                      {email}
                      <button onClick={() => removeAdditionalEmail(email)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailSubject">Asunto</Label>
              <Input
                id="emailSubject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailBody">Mensaje</Label>
              <Textarea
                id="emailBody"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={6}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEnviarEmail} disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cotización?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la cotización <strong>{cotizacion.folio}</strong> de forma permanente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert to Pedido Dialog */}
      <AlertDialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Convertir a Pedido
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se creará un nuevo pedido a partir de la cotización <strong>{cotizacion.folio}</strong> con los mismos productos y precios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
              <p><strong>Cliente:</strong> {cotizacion.cliente?.nombre}</p>
              <p><strong>Productos:</strong> {cotizacion.detalles?.length || 0} items</p>
              <p><strong>Total:</strong> ${formatCurrency(cotizacion.total)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaEntrega">Fecha de entrega estimada</Label>
              <Input
                id="fechaEntrega"
                type="date"
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={converting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConvertirPedido}
              disabled={converting}
              className="bg-primary"
            >
              {converting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando pedido...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Crear Pedido
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default CotizacionDetalleDialog;
