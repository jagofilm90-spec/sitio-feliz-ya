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

interface ParsedProduct {
  nombre_producto: string;
  cantidad: number;
  unidad: string;
  precio_sugerido: number | null;
  notas: string | null;
  producto_cotizado_id: string | null;
}

interface ParsedSucursal {
  nombre_sucursal: string;
  fecha_entrega_solicitada: string | null;
  productos: ParsedProduct[];
}

// Fast HTML to text conversion
function stripHtmlFast(html: string): string {
  const parts = html.split('<');
  let result = parts[0] || '';
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const closeIndex = part.indexOf('>');
    if (closeIndex === -1) {
      result += '<' + part;
      continue;
    }
    
    const tag = part.substring(0, closeIndex).toLowerCase();
    const afterTag = part.substring(closeIndex + 1);
    
    if (tag.startsWith('style') || tag.startsWith('script')) continue;
    
    if (tag.startsWith('/tr') || tag.startsWith('br') || tag.startsWith('/p') || tag.startsWith('/div')) {
      result += '\n';
    }
    if (tag.startsWith('/td') || tag.startsWith('/th')) {
      result += '\t';
    }
    
    result += afterTag;
  }
  
  result = result
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
  
  result = result.replace(/\t+/g, '\t').replace(/[ ]+/g, ' ');
  
  return result;
}

function isLecarozEmail(emailFrom: string, emailSubject: string): boolean {
  return emailFrom.includes('lecarozint.com') || 
         emailSubject.toLowerCase().includes('lecaroz');
}

// Parse Lecaroz email - understands their specific table structure
function parseLecarozEmail(emailBody: string, productosCotizados?: ProductoCotizado[]): { sucursales: ParsedSucursal[], confianza: number } {
  console.log("Using Lecaroz specialized parser");
  console.log("Email size:", emailBody.length, "chars");
  
  if (!productosCotizados || productosCotizados.length === 0) {
    console.log("No quoted products, falling back to AI");
    return { sucursales: [], confianza: 0 };
  }
  
  // Build product lookup with normalized names
  const productMap = new Map<string, { id: string, nombre: string, unidad: string }>();
  for (const p of productosCotizados) {
    productMap.set(p.nombre.toLowerCase().trim(), { id: p.producto_id, nombre: p.nombre, unidad: p.unidad });
  }
  console.log("Product map size:", productMap.size);
  
  // Simple product matching - check if text contains or is contained by a product name
  const findProduct = (text: string): { id: string, nombre: string, unidad: string } | null => {
    const normalized = text.toLowerCase().trim();
    if (normalized.length < 3) return null;
    
    // Exact match
    if (productMap.has(normalized)) return productMap.get(normalized)!;
    
    // Fuzzy match
    for (const [key, product] of productMap) {
      if (key.includes(normalized) && normalized.length >= 4) return product;
      if (normalized.includes(key) && key.length >= 4) return product;
    }
    return null;
  };
  
  // Convert HTML to structured text
  const text = stripHtmlFast(emailBody);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
  console.log("Lines to process:", lines.length);
  
  // Helper functions
  const isNumber = (s: string): boolean => /^[\d,\.]+$/.test(s.replace(/,/g, '').trim());
  const parseNum = (s: string): number => parseFloat(s.replace(/,/g, '').trim()) || 0;
  
  // Results: Map<branchName, Map<productId, product>>
  const results = new Map<string, Map<string, ParsedProduct>>();
  let currentProduct: { id: string, nombre: string, unidad: string } | null = null;
  let productCount = 0;
  let branchEntries = 0;
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    
    // Skip totals and headers
    if (lower.includes('total general') || lower.startsWith('total\t') || lower === 'total') continue;
    if (lower.includes('producto') && lower.includes('pedido')) continue;
    
    const cols = line.split('\t').map(c => c.trim()).filter(c => c);
    if (cols.length === 0) continue;
    
    // Check if first non-number column is a product
    let firstTextCol = cols[0];
    let colOffset = 0;
    if (/^\d{1,3}$/.test(firstTextCol) && cols.length > 1) {
      firstTextCol = cols[1];
      colOffset = 1;
    }
    
    // Try to identify product header (usually standalone product name or product name + few numbers)
    const product = findProduct(firstTextCol);
    if (product) {
      // Count how many numbers are in this line
      const numCount = cols.filter(c => isNumber(c)).length;
      // If mostly text or just the product with totals, treat as product header
      if (numCount <= 2 || cols.length <= 3) {
        currentProduct = product;
        productCount++;
        continue;
      }
    }
    
    // Extract branch data if we have a current product
    if (currentProduct && cols.length >= 2) {
      let branchName: string | null = null;
      let quantity = 0;
      
      // Find branch name (first text column that's not tiny and not the product)
      for (let i = colOffset; i < cols.length && !branchName; i++) {
        const col = cols[i];
        if (!isNumber(col) && col.length >= 2) {
          const lowerCol = col.toLowerCase();
          // Skip if it's "total" or looks like a product name
          if (lowerCol !== 'total' && !findProduct(col)) {
            branchName = col.toUpperCase();
          }
        }
      }
      
      // Find quantity (first positive number after we found a branch or after colOffset)
      if (branchName) {
        for (let i = colOffset; i < cols.length; i++) {
          if (isNumber(cols[i])) {
            const num = parseNum(cols[i]);
            if (num > 0 && num < 100000) {
              quantity = num;
              break;
            }
          }
        }
      }
      
      // Store result
      if (branchName && quantity > 0) {
        if (!results.has(branchName)) results.set(branchName, new Map());
        const prods = results.get(branchName)!;
        if (!prods.has(currentProduct.id)) {
          prods.set(currentProduct.id, {
            nombre_producto: currentProduct.nombre,
            cantidad: quantity,
            unidad: currentProduct.unidad,
            precio_sugerido: null,
            notas: null,
            producto_cotizado_id: currentProduct.id
          });
          branchEntries++;
        }
      }
    }
  }
  
  console.log("Products found:", productCount);
  console.log("Branch entries:", branchEntries);
  console.log("Unique branches:", results.size);
  
  // Build final result
  const sucursales: ParsedSucursal[] = [];
  for (const [name, products] of results) {
    const arr = Array.from(products.values());
    if (arr.length > 0) {
      sucursales.push({ nombre_sucursal: name, fecha_entrega_solicitada: null, productos: arr });
    }
  }
  sucursales.sort((a, b) => a.nombre_sucursal.localeCompare(b.nombre_sucursal));
  
  console.log("Final branches:", sucursales.length);
  if (sucursales.length > 0) {
    sucursales.slice(0, 3).forEach(s => console.log(`  ${s.nombre_sucursal}: ${s.productos.length} products`));
  }
  
  if (sucursales.length === 0) {
    console.log("No branches found, falling back to AI");
    return { sucursales: [], confianza: 0 };
  }
  
  return { sucursales, confianza: 0.90 };
}

// AI parsing for non-Lecaroz emails
async function parseWithAI(emailBody: string, emailSubject: string, emailFrom: string, productosCotizados?: ProductoCotizado[]): Promise<{ sucursales: ParsedSucursal[], confianza: number, notas_generales?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }
  
  let cleanEmailBody = stripHtmlFast(emailBody);
  
  const MAX_EMAIL_LENGTH = 30000;
  if (cleanEmailBody.length > MAX_EMAIL_LENGTH) {
    console.log("Truncating email from", cleanEmailBody.length, "to", MAX_EMAIL_LENGTH);
    cleanEmailBody = cleanEmailBody.substring(0, MAX_EMAIL_LENGTH) + "\n\n[... truncado ...]";
  }

  let productosContext = "";
  if (productosCotizados && productosCotizados.length > 0) {
    productosContext = `

PRODUCTOS COTIZADOS:
${productosCotizados.map(p => `- "${p.nombre}" (ID: ${p.producto_id}, unidad: ${p.unidad})`).join('\n')}`;
  }

  const systemPrompt = `Extrae productos y cantidades del pedido, agrupados por sucursal.${productosContext}`;

  const userPrompt = `ASUNTO: ${emailSubject}
DE: ${emailFrom}

${cleanEmailBody}`;

  console.log("Calling AI gateway...");
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  
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
              description: "Extrae productos del pedido",
              parameters: {
                type: "object",
                properties: {
                  sucursales: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nombre_sucursal: { type: "string" },
                        fecha_entrega_solicitada: { type: "string" },
                        productos: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              nombre_producto: { type: "string" },
                              cantidad: { type: "number" },
                              unidad: { type: "string" },
                              precio_sugerido: { type: "number" },
                              notas: { type: "string" },
                              producto_cotizado_id: { type: "string" }
                            },
                            required: ["nombre_producto", "cantidad", "unidad"]
                          }
                        }
                      },
                      required: ["nombre_sucursal", "productos"]
                    }
                  },
                  notas_generales: { type: "string" },
                  confianza: { type: "number" }
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
      
      if (response.status === 429) throw new Error("Límite de solicitudes excedido");
      if (response.status === 402) throw new Error("Créditos insuficientes");
      
      throw new Error(`AI error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== "extract_order") {
      throw new Error("No se pudo extraer el pedido");
    }

    return JSON.parse(toolCall.function.arguments);
    
  } catch (fetchError: unknown) {
    clearTimeout(timeoutId);
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error("Timeout - intente de nuevo");
    }
    throw fetchError;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailBody, emailSubject, emailFrom, clienteId, productosCotizados }: ParseOrderRequest = await req.json();
    
    console.log("Parsing order from:", emailFrom);
    console.log("Subject:", emailSubject);
    console.log("Products available:", productosCotizados?.length || 0);
    console.log("Email size:", emailBody.length, "chars");

    let result: { sucursales: ParsedSucursal[], confianza: number, notas_generales?: string };

    if (isLecarozEmail(emailFrom, emailSubject)) {
      console.log("Detected Lecaroz email");
      result = parseLecarozEmail(emailBody, productosCotizados);
      
      if (result.sucursales.length === 0) {
        console.log("Specialized parser found nothing, trying AI...");
        result = await parseWithAI(emailBody, emailSubject, emailFrom, productosCotizados);
      }
    } else {
      result = await parseWithAI(emailBody, emailSubject, emailFrom, productosCotizados);
    }

    console.log("Result:", result.sucursales.length, "branches");

    return new Response(JSON.stringify({ 
      success: true, 
      order: result 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Error desconocido" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
