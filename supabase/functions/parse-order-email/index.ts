import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParseOrderRequest {
  emailBody: string;
  emailSubject: string;
  emailFrom: string;
  clienteId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailBody, emailSubject, emailFrom, clienteId }: ParseOrderRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Parsing order email from:", emailFrom);
    console.log("Subject:", emailSubject);

    const systemPrompt = `Eres un asistente especializado en procesar correos de pedidos de clientes para una comercializadora de abarrotes.

Tu tarea es extraer los productos y cantidades de un correo de pedido, identificando también la sucursal si se menciona.

Reglas importantes:
1. Extrae TODOS los productos mencionados con sus cantidades
2. Los productos pueden estar en diferentes formatos: listas, tablas, texto libre
3. Las unidades pueden ser: kg, bultos, costales, cajas, piezas, cubetas
4. Si hay varios destinos/sucursales, agrúpalos por sucursal
5. Si no se especifica sucursal, usa "Principal" como nombre
6. Normaliza los nombres de productos (ej: "azucar" -> "Azúcar", "arroz" -> "Arroz")
7. Si hay precios mencionados, inclúyelos, si no, déjalos en null`;

    const userPrompt = `Analiza el siguiente correo de pedido y extrae la información estructurada:

ASUNTO: ${emailSubject}
DE: ${emailFrom}

CONTENIDO:
${emailBody}

Responde con la información estructurada de los productos y cantidades por sucursal.`;

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
                                description: "Nombre del producto normalizado"
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
    });

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
    console.log("AI Response:", JSON.stringify(aiResponse, null, 2));

    // Extract the tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "extract_order") {
      throw new Error("No se pudo extraer la información del pedido");
    }

    const parsedOrder = JSON.parse(toolCall.function.arguments);
    console.log("Parsed order:", JSON.stringify(parsedOrder, null, 2));

    return new Response(JSON.stringify({ 
      success: true, 
      order: parsedOrder 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

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
