import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendInvoiceRequest {
  pedidoId: string;
  clienteEmail: string;
  clienteNombre: string;
  pedidoFolio: string;
  total: number;
  fechaPedido: string;
  detalles?: Array<{
    producto: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      pedidoId, 
      clienteEmail, 
      clienteNombre, 
      pedidoFolio, 
      total, 
      fechaPedido,
      detalles 
    }: SendInvoiceRequest = await req.json();

    console.log("Sending invoice email to:", clienteEmail);
    console.log("Pedido folio:", pedidoFolio);

    // Validate required fields
    if (!clienteEmail || !pedidoFolio) {
      throw new Error("Email del cliente y folio del pedido son requeridos");
    }

    // Format the total with Mexican peso format
    const formattedTotal = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(total);

    // Format date
    const formattedDate = new Date(fechaPedido).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Build products table HTML if details provided
    let productosHtml = '';
    if (detalles && detalles.length > 0) {
      productosHtml = `
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Producto</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Cantidad</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Precio Unit.</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${detalles.map(d => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${d.producto}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #dee2e6;">${d.cantidad}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">$${d.precioUnitario.toFixed(2)}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">$${d.subtotal.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #B22234 0%, #8B0000 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Abarrotes La Manita</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Factura de su pedido</p>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px;">Estimado/a <strong>${clienteNombre}</strong>,</p>
          
          <p>Le enviamos la factura correspondiente a su pedido:</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px 0;"><strong>Folio:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${pedidoFolio}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Fecha:</strong></td>
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
            Si tiene alguna pregunta sobre su factura, no dude en contactarnos.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            Este correo fue enviado automáticamente por el sistema de Abarrotes La Manita.<br>
            Por favor no responda a este correo.
          </p>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Abarrotes La Manita <onboarding@resend.dev>",
      to: [clienteEmail],
      subject: `Factura - Pedido ${pedidoFolio}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    // Update the pedido to mark invoice as sent
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await supabase
      .from("pedidos")
      .update({ 
        factura_enviada_al_cliente: true,
        fecha_factura_enviada: new Date().toISOString()
      })
      .eq("id", pedidoId);

    if (updateError) {
      console.error("Error updating pedido:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Factura enviada correctamente",
        emailId: (emailResponse as any).id || "sent"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invoice-email function:", error);
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
