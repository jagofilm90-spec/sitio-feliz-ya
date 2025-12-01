import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductoCotizado {
  producto_id: string;
  nombre: string;
  codigo: string;
  unidad: string;
  precio_cotizado: number;
}

interface ParseOrderRequest {
  emailBody: string;
  emailSubject: string;
  emailFrom: string;
  clienteId?: string;
  productosCotizados?: ProductoCotizado[];
}

// Strip HTML tags and clean up email body
function stripHtml(html: string): string {
  // Remove style and script tags with content
  let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Replace table cells/rows with tabs/newlines for structure
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<\/td>/gi, '\t');
  text = text.replace(/<\/th>/gi, '\t');
  text = text.replace(/<th[^>]*>/gi, '');
  text = text.replace(/<td[^>]*>/gi, '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<p[^>]*>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  // Clean up whitespace
  text = text.replace(/\t+/g, '\t');
  text = text.replace(/[ ]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n');
  return text.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailBody, emailSubject, emailFrom, clienteId, productosCotizados }: ParseOrderRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Clean email body - strip HTML
    const cleanEmailBody = stripHtml(emailBody);
    
    console.log("Parsing order email from:", emailFrom);
    console.log("Subject:", emailSubject);
    console.log("Productos cotizados disponibles:", productosCotizados?.length || 0);
    console.log("Clean email length:", cleanEmailBody.length);

    // Construir contexto de productos cotizados para mejor matching
    let productosContext = "";
    if (productosCotizados && productosCotizados.length > 0) {
      productosContext = `

IMPORTANTE - PRODUCTOS COTIZADOS RECIENTEMENTE A ESTE CLIENTE:
El cliente tiene cotizaciones recientes con los siguientes productos. USA ESTOS NOMBRES EXACTOS como referencia para hacer match:

${productosCotizados.map(p => `- "${p.nombre}" (código: ${p.codigo}, ID: ${p.producto_id}, unidad: ${p.unidad})`).join('\n')}

Cuando el cliente use nombres similares o abreviados, debes hacer match con estos productos.
Por ejemplo: si el cliente pide "Uva Pasa" y en la lista está "Uva Pasa Preciosa", usa "Uva Pasa Preciosa".
Si pide "Piña en lata" y hay "Piña en Almíbar (30 rodajas)", usa el nombre completo de la cotización.
PRIORIZA SIEMPRE los productos de esta lista de cotización para el matching.`;
    }

    const systemPrompt = `Eres un asistente especializado en procesar correos de pedidos de clientes para una comercializadora de abarrotes.

Tu tarea es extraer los productos y cantidades de un correo de pedido, identificando también la sucursal si se menciona.

Reglas importantes:
1. Extrae TODOS los productos mencionados con sus cantidades
2. Los productos pueden estar en diferentes formatos: listas, tablas, texto libre
3. Las unidades pueden ser: kg, bultos, costales, cajas, piezas, cubetas
4. Si hay varios destinos/sucursales, agrúpalos por sucursal
5. Si no se especifica sucursal, usa "Principal" como nombre
6. IMPORTANTE: Si hay productos cotizados disponibles, usa esos nombres EXACTOS para normalizar
7. Si hay precios mencionados, inclúyelos, si no, déjalos en null
8. Cuando el cliente escriba nombres abreviados o diferentes, haz match con el producto más similar de la lista cotizada
${productosContext}`;

    const userPrompt = `Analiza el siguiente correo de pedido y extrae la información estructurada:

ASUNTO: ${emailSubject}
DE: ${emailFrom}

CONTENIDO:
${cleanEmailBody}

Responde con la información estructurada de los productos y cantidades por sucursal.
${productosCotizados && productosCotizados.length > 0 ? 
  'RECUERDA: Usa los nombres de productos de la cotización para normalizar los nombres que el cliente escribió.' : ''}`;

    console.log("Calling AI gateway...");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 second timeout
    
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_order",
                description: "Extrae los productos y cantidades del correo de pedido",
                parameters: {
                  type: "object",
                  properties: {
                    sucursales: {
                      type: "array",
                      description: "Lista de sucursales con sus pedidos",
                      items: {
                        type: "object",
                        properties: {
                          nombre_sucursal: { 
                            type: "string",
                            description: "Nombre de la sucursal o destino de entrega"
                          },
                          fecha_entrega_solicitada: {
                            type: "string",
                            description: "Fecha de entrega solicitada en formato YYYY-MM-DD si se menciona, null si no"
                          },
                          productos: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                nombre_producto: { 
                                  type: "string",
                                  description: "Nombre del producto normalizado (usar nombres de cotización si están disponibles)"
                                },
                                cantidad: { 
                                  type: "number",
                                  description: "Cantidad solicitada"
                                },
                                unidad: { 
                                  type: "string",
                                  enum: ["kg", "bulto", "costal", "caja", "pieza", "cubeta", "litro"],
                                  description: "Unidad de medida"
                                },
                                precio_sugerido: {
                                  type: "number",
                                  description: "Precio mencionado si existe, null si no"
                                },
                                notas: {
                                  type: "string",
                                  description: "Notas adicionales sobre el producto si las hay"
                                },
                                producto_cotizado_id: {
                                  type: "string",
                                  description: "ID del producto de la cotización si hubo match, null si no"
                                }
                              },
                              required: ["nombre_producto", "cantidad", "unidad"]
                            }
                          }
                        },
                        required: ["nombre_sucursal", "productos"]
                      }
                    },
                    notas_generales: {
                      type: "string",
                      description: "Notas generales del pedido si las hay"
                    },
                    confianza: {
                      type: "number",
                      description: "Nivel de confianza en la extracción de 0 a 1"
                    }
                  },
                  required: ["sucursales", "confianza"]
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "extract_order" } }
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI Gateway error:", response.status, errorText);
        
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Límite de solicitudes excedido, intente más tarde" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes para IA" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const aiResponse = await response.json();
      console.log("AI Response received successfully");

      // Extract the tool call result
      const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.function.name !== "extract_order") {
        throw new Error("No se pudo extraer la información del pedido");
      }

      const parsedOrder = JSON.parse(toolCall.function.arguments);
      console.log("Parsed order - sucursales:", parsedOrder.sucursales?.length || 0);

      return new Response(JSON.stringify({ 
        success: true, 
        order: parsedOrder 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error("Request timed out");
        return new Response(JSON.stringify({ error: "La solicitud tardó demasiado, intente de nuevo" }), {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw fetchError;
    }

  } catch (error) {
    console.error("Error parsing order email:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Error desconocido" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
