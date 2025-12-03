import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOrderAuthorizedRequest {
  clienteEmail: string;
  clienteNombre: string;
  pedidoFolio: string;
  total: number;
  fechaEntrega: string;
  ajustesPrecio: number;
  detalles: Array<{
    producto: string;
    cantidad: number;
    unidad: string;
    precioUnitario: number;
    subtotal: number;
    precioAnterior?: number;
    fueAjustado: boolean;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      clienteEmail, 
      clienteNombre, 
      pedidoFolio, 
      total, 
      fechaEntrega,
      ajustesPrecio,
      detalles 
    }: SendOrderAuthorizedRequest = await req.json();

    console.log("Sending order authorized email to:", clienteEmail);

    if (!clienteEmail || !pedidoFolio) {
      throw new Error("Email del cliente y folio del pedido son requeridos");
    }

    const formattedTotal = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(total);

    const formattedDate = new Date(fechaEntrega).toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Build subject line
    let subject = `Pedido Programado - ${pedidoFolio}`;
    if (ajustesPrecio > 0) {
      subject = `Pedido Programado - ${ajustesPrecio} ajuste${ajustesPrecio > 1 ? 's' : ''} de precio - ${pedidoFolio}`;
    }

    // Build alert banner if there were adjustments
    let alertBanner = '';
    if (ajustesPrecio > 0) {
      alertBanner = `
        <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #92400E; font-weight: 600;">
            ⚠️ Hubo ${ajustesPrecio} ajuste${ajustesPrecio > 1 ? 's' : ''} de precio en su pedido
          </p>
          <p style="margin: 8px 0 0 0; color: #92400E; font-size: 14px;">
            Los productos ajustados están marcados en la tabla de abajo.
          </p>
        </div>
      `;
    }

    // Build products table with adjustment indicators
    let productosHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f8f9fa;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Producto</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Cantidad</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Precio</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${detalles.map(d => {
            const rowStyle = d.fueAjustado ? 'background-color: #FEF9C3;' : '';
            const priceCell = d.fueAjustado && d.precioAnterior 
              ? `<span style="text-decoration: line-through; color: #999; font-size: 12px;">$${d.precioAnterior.toFixed(2)}</span><br><strong style="color: #B45309;">$${d.precioUnitario.toFixed(2)}</strong>`
              : `$${d.precioUnitario.toFixed(2)}`;
            return `
              <tr style="${rowStyle}">
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">
                  ${d.producto}
                  ${d.fueAjustado ? '<span style="color: #B45309; font-size: 11px;"> (ajustado)</span>' : ''}
                </td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #dee2e6;">${d.cantidad} ${d.unidad}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">${priceCell}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">$${d.subtotal.toFixed(2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #B22234 0%, #8B0000 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">ALMASA</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Abarrotes La Manita, S.A. de C.V.</p>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <div style="background: #ECFDF5; border: 1px solid #10B981; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 0; color: #047857; font-weight: 600; font-size: 18px;">
              ✓ Pedido Programado
            </p>
          </div>

          <p style="font-size: 16px;">Estimado/a <strong>${clienteNombre}</strong>,</p>
          
          <p>Su pedido ha sido autorizado y programado para entrega:</p>
          
          ${alertBanner}

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px 0;"><strong>Folio:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${pedidoFolio}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Fecha de entrega:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${formattedDate}</td>
              </tr>
              <tr style="border-top: 2px solid #B22234;">
                <td style="padding: 12px 0;"><strong style="font-size: 18px;">Total:</strong></td>
                <td style="padding: 12px 0; text-align: right;"><strong style="font-size: 18px; color: #B22234;">${formattedTotal}</strong></td>
              </tr>
            </table>
          </div>

          ${productosHtml}
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Si tiene alguna pregunta sobre su pedido, no dude en contactarnos.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            Este correo fue enviado automáticamente por el sistema de ALMASA.<br>
            Por favor no responda a este correo.
          </p>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "ALMASA <onboarding@resend.dev>",
      to: [clienteEmail],
      subject: subject,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Correo de pedido autorizado enviado correctamente",
        emailId: (emailResponse as any).id || "sent"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-order-authorized-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
