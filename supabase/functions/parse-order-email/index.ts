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

// Fast HTML to text conversion - optimized for large emails
function stripHtmlFast(html: string): string {
  // Remove style and script blocks first
  let text = html;
  
  // Simple approach: split by < and process
  const parts = text.split('<');
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
    
    // Skip content inside style and script
    if (tag.startsWith('style') || tag.startsWith('script')) continue;
    
    // Add newlines for block elements
    if (tag.startsWith('/tr') || tag.startsWith('br') || tag.startsWith('/p') || tag.startsWith('/div')) {
      result += '\n';
    }
    // Add tabs for table cells
    if (tag.startsWith('/td') || tag.startsWith('/th')) {
      result += '\t';
    }
    
    result += afterTag;
  }
  
  // Decode common entities
  result = result
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
  
  // Clean up whitespace
  result = result.replace(/\t+/g, '\t').replace(/[ ]+/g, ' ');
  
  return result;
}

// Check if email is from Lecaroz system
function isLecarozEmail(emailFrom: string, emailSubject: string): boolean {
  return emailFrom.includes('lecarozint.com') || 
         emailSubject.toLowerCase().includes('lecaroz');
}

// Parse Lecaroz email - ultra-optimized for large emails
function parseLecarozEmail(emailBody: string, productosCotizados?: ProductoCotizado[]): { sucursales: ParsedSucursal[], confianza: number } {
  const startTime = Date.now();
  console.log("Using Lecaroz specialized parser");
  console.log("Email size:", emailBody.length, "chars");
  
  // Build product lookup map for fast matching
  const productMap = new Map<string, { id: string, nombre: string, unidad: string }>();
  const productKeywords = new Set<string>();
  
  if (productosCotizados && productosCotizados.length > 0) {
    for (const p of productosCotizados) {
      const key = p.nombre.toLowerCase().trim();
      productMap.set(key, { id: p.producto_id, nombre: p.nombre, unidad: p.unidad });
      
      // Extract keywords for partial matching
      const words = key.split(/\s+/).filter(w => w.length > 3);
      for (const word of words) {
        productKeywords.add(word);
      }
    }
  }
  
  console.log("Product map built with", productMap.size, "products,", productKeywords.size, "keywords");
  
  // Fast product matching
  const findProduct = (text: string): { id: string | null, nombre: string, unidad: string } | null => {
    if (!text || text.length < 3) return null;
    
    const normalized = text.toLowerCase().trim();
    
    // Exact match
    const exact = productMap.get(normalized);
    if (exact) return exact;
    
    // Partial match - check if text contains any product name or vice versa
    for (const [key, product] of productMap) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return product;
      }
      // Check if significant words match
      const textWords = normalized.split(/\s+/).filter(w => w.length > 3);
      const keyWords = key.split(/\s+/).filter(w => w.length > 3);
      const matchCount = textWords.filter(w => keyWords.some(k => k.includes(w) || w.includes(k))).length;
      if (matchCount > 0 && matchCount >= Math.ceil(textWords.length * 0.5)) {
        return product;
      }
    }
    
    return null;
  };
  
  // Convert to text - use fast method
  console.log("Converting HTML to text...");
  const text = stripHtmlFast(emailBody);
  console.log("Text conversion done in", Date.now() - startTime, "ms, result:", text.length, "chars");
  
  // Parse line by line
  const lines = text.split('\n');
  console.log("Processing", lines.length, "lines");
  
  const sucursalesMap = new Map<string, Map<string, ParsedProduct>>();
  let currentProduct: { id: string | null, nombre: string, unidad: string } | null = null;
  let productsFound = 0;
  let branchesFound = 0;
  
  const isNumeric = (s: string): boolean => {
    const cleaned = s.replace(/,/g, '').trim();
    return /^\d+(\.\d+)?$/.test(cleaned);
  };
  
  const parseNumber = (s: string): number => {
    return parseFloat(s.replace(/,/g, '').trim()) || 0;
  };
  
  for (const line of lines) {
    if (!line || line.length < 2) continue;
    
    // Split by tabs to get columns
    const cols = line.split('\t').map(c => c.trim()).filter(c => c.length > 0);
    if (cols.length === 0) continue;
    
    // Skip obvious header/footer lines
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('total') || lowerLine.includes('producto') && lowerLine.includes('pedido')) {
      continue;
    }
    
    // Check if first column might be a product name
    const firstCol = cols[0];
    if (firstCol && !isNumeric(firstCol) && firstCol.length > 2) {
      const match = findProduct(firstCol);
      if (match) {
        currentProduct = match;
        productsFound++;
        continue;
      }
    }
    
    // If we have a current product, look for branch + quantity patterns
    if (currentProduct && cols.length >= 2) {
      // Look for: [index?] [branch_name] [qty_pedido] [qty_entregar?]
      let branchName: string | null = null;
      let quantity = 0;
      
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        
        // Skip single-digit index numbers
        if (/^\d{1,2}$/.test(col) && i === 0) continue;
        
        // Find branch name (text, not numeric, not too short)
        if (!branchName && !isNumeric(col) && col.length >= 2) {
          // Skip known non-branch values
          const lowerCol = col.toLowerCase();
          if (!lowerCol.includes('total') && !lowerCol.includes('producto')) {
            branchName = col.toUpperCase();
          }
        }
        
        // Find quantity (first non-zero number after branch)
        if (branchName && isNumeric(col)) {
          const num = parseNumber(col);
          if (num > 0) {
            quantity = num;
            break; // Take first quantity (usually "Pedido" column)
          }
        }
      }
      
      // Add to results if we found valid data
      if (branchName && quantity > 0) {
        if (!sucursalesMap.has(branchName)) {
          sucursalesMap.set(branchName, new Map());
          branchesFound++;
        }
        
        const branchProducts = sucursalesMap.get(branchName)!;
        // Use product ID as key to avoid duplicates
        const productKey = currentProduct.id || currentProduct.nombre;
        
        if (!branchProducts.has(productKey)) {
          branchProducts.set(productKey, {
            nombre_producto: currentProduct.nombre,
            cantidad: quantity,
            unidad: currentProduct.unidad,
            precio_sugerido: null,
            notas: null,
            producto_cotizado_id: currentProduct.id
          });
        }
      }
    }
  }
  
  console.log("Parsing complete in", Date.now() - startTime, "ms");
  console.log("Found", productsFound, "product matches,", branchesFound, "unique branches");
  
  // Convert to result format
  const sucursales: ParsedSucursal[] = [];
  for (const [branchName, products] of sucursalesMap) {
    const productArray = Array.from(products.values());
    if (productArray.length > 0) {
      sucursales.push({
        nombre_sucursal: branchName,
        fecha_entrega_solicitada: null,
        productos: productArray
      });
    }
  }
  
  // Sort by branch name for consistent results
  sucursales.sort((a, b) => a.nombre_sucursal.localeCompare(b.nombre_sucursal));
  
  console.log("Final result:", sucursales.length, "branches");
  if (sucursales.length > 0 && sucursales.length <= 10) {
    for (const s of sucursales) {
      console.log(`  - ${s.nombre_sucursal}: ${s.productos.length} products`);
    }
  }
  
  if (sucursales.length === 0) {
    console.log("No branches found, will fall back to AI");
    return { sucursales: [], confianza: 0 };
  }
  
  return { sucursales, confianza: 0.90 };
}

// Standard AI-based parsing for non-Lecaroz emails
async function parseWithAI(emailBody: string, emailSubject: string, emailFrom: string, productosCotizados?: ProductoCotizado[]): Promise<{ sucursales: ParsedSucursal[], confianza: number, notas_generales?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }
  
  let cleanEmailBody = stripHtmlFast(emailBody);
  
  // Truncate for AI (max 30K chars)
  const MAX_EMAIL_LENGTH = 30000;
  if (cleanEmailBody.length > MAX_EMAIL_LENGTH) {
    console.log("Truncating email from", cleanEmailBody.length, "to", MAX_EMAIL_LENGTH);
    cleanEmailBody = cleanEmailBody.substring(0, MAX_EMAIL_LENGTH) + "\n\n[... contenido truncado ...]";
  }

  let productosContext = "";
  if (productosCotizados && productosCotizados.length > 0) {
    productosContext = `

IMPORTANTE - PRODUCTOS COTIZADOS:
${productosCotizados.map(p => `- "${p.nombre}" (código: ${p.codigo}, ID: ${p.producto_id}, unidad: ${p.unidad})`).join('\n')}

Haz match con estos productos cuando el cliente use nombres similares.`;
  }

  const systemPrompt = `Eres un asistente que procesa correos de pedidos. Extrae productos y cantidades, agrupados por sucursal.
${productosContext}`;

  const userPrompt = `Analiza este pedido:

ASUNTO: ${emailSubject}
DE: ${emailFrom}

CONTENIDO:
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
              description: "Extrae productos y cantidades del pedido",
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
      
      if (response.status === 429) {
        throw new Error("Límite de solicitudes excedido");
      }
      if (response.status === 402) {
        throw new Error("Créditos insuficientes");
      }
      
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

    // Use specialized parser for Lecaroz emails
    if (isLecarozEmail(emailFrom, emailSubject)) {
      console.log("Detected Lecaroz email - using specialized parser");
      result = parseLecarozEmail(emailBody, productosCotizados);
      
      // Fall back to AI only if specialized parser found nothing
      if (result.sucursales.length === 0) {
        console.log("Specialized parser found nothing, trying AI...");
        result = await parseWithAI(emailBody, emailSubject, emailFrom, productosCotizados);
      }
    } else {
      result = await parseWithAI(emailBody, emailSubject, emailFrom, productosCotizados);
    }

    console.log("Result: ", result.sucursales.length, "branches");

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
