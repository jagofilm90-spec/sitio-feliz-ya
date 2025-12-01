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
  const startTime = Date.now();
  console.log("Using Lecaroz specialized parser");
  console.log("Email size:", emailBody.length, "chars");
  
  // Build STRICT product lookup - only exact or very close matches
  const productNames = new Set<string>();
  const productMap = new Map<string, { id: string, nombre: string, unidad: string }>();
  
  if (productosCotizados && productosCotizados.length > 0) {
    for (const p of productosCotizados) {
      const key = p.nombre.toLowerCase().trim();
      productMap.set(key, { id: p.producto_id, nombre: p.nombre, unidad: p.unidad });
      productNames.add(key);
    }
  }
  
  console.log("Product map built with", productMap.size, "products");
  
  // Strict product matching - must match at least 70% of the product name
  const findProduct = (text: string): { id: string | null, nombre: string, unidad: string } | null => {
    if (!text || text.length < 4) return null;
    
    const normalized = text.toLowerCase().trim();
    
    // Skip common non-product words
    const skipWords = ['total', 'producto', 'pedido', 'entregar', 'cantidad', 'unidad', 'precio'];
    if (skipWords.some(w => normalized === w)) return null;
    
    // Exact match
    const exact = productMap.get(normalized);
    if (exact) return exact;
    
    // Check if text is contained within a product name (must be significant portion)
    for (const [key, product] of productMap) {
      // Text must be at least 60% of product name length to match
      if (key.includes(normalized) && normalized.length >= key.length * 0.6) {
        return product;
      }
      // Or product name is contained in text
      if (normalized.includes(key) && key.length >= normalized.length * 0.6) {
        return product;
      }
    }
    
    return null;
  };
  
  // Convert to text
  console.log("Converting HTML to text...");
  const text = stripHtmlFast(emailBody);
  console.log("Text conversion done in", Date.now() - startTime, "ms, result:", text.length, "chars");
  
  // Parse line by line
  const lines = text.split('\n');
  console.log("Processing", lines.length, "lines");
  
  const sucursalesMap = new Map<string, Map<string, ParsedProduct>>();
  let currentProduct: { id: string | null, nombre: string, unidad: string } | null = null;
  let productsFound = 0;
  
  const isNumeric = (s: string): boolean => {
    const cleaned = s.replace(/,/g, '').trim();
    return /^\d+(\.\d+)?$/.test(cleaned);
  };
  
  const parseNumber = (s: string): number => {
    return parseFloat(s.replace(/,/g, '').trim()) || 0;
  };
  
  // Track what looks like a header row to understand table structure
  let inProductSection = false;
  
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!line || line.length < 2) continue;
    
    const cols = line.split('\t').map(c => c.trim()).filter(c => c.length > 0);
    if (cols.length === 0) continue;
    
    const lowerLine = line.toLowerCase();
    
    // Skip total rows
    if (lowerLine.includes('total general') || (cols[0] && cols[0].toLowerCase() === 'total')) {
      continue;
    }
    
    // Detect product header - typically has "Producto" column header
    if (lowerLine.includes('producto') && (lowerLine.includes('pedido') || lowerLine.includes('entregar'))) {
      inProductSection = true;
      continue;
    }
    
    // Check if this line is a PRODUCT NAME row
    // Product rows in Lecaroz usually have the product name as the main/only text content
    // and might span multiple columns or have minimal numeric data
    
    const firstCol = cols[0];
    
    // A product row typically:
    // - First column is text (not a small number)
    // - Has minimal other data or just column headers/totals
    // - Matches one of our quoted products
    
    if (firstCol && !isNumeric(firstCol) && firstCol.length >= 4) {
      // Skip if it looks like a branch row (starts with number + text pattern)
      const firstTwoMatch = /^\d{1,2}\s+[A-Z]/.test(line.trim());
      if (firstTwoMatch) {
        // This is likely a branch row like "1 LAGO 5 0"
        // Don't try to match as product
      } else {
        const match = findProduct(firstCol);
        if (match) {
          currentProduct = match;
          productsFound++;
          inProductSection = true;
          continue;
        }
      }
    }
    
    // Try to extract branch data if we have a current product
    if (currentProduct && cols.length >= 2) {
      // Lecaroz format: [index] [branch_name] [qty_pedido] [qty_entregar] ...
      // Or sometimes: [branch_name] [qty_pedido] [qty_entregar]
      
      let branchName: string | null = null;
      let quantity = 0;
      let startIndex = 0;
      
      // Check if first column is an index number (1-3 digits)
      if (/^\d{1,3}$/.test(cols[0])) {
        startIndex = 1;
      }
      
      // Look for branch name - it's the first non-numeric text after any index
      for (let i = startIndex; i < cols.length; i++) {
        const col = cols[i];
        
        if (!branchName && !isNumeric(col) && col.length >= 2) {
          const lowerCol = col.toLowerCase();
          // Skip known non-branch values
          if (lowerCol !== 'total' && !lowerCol.includes('producto') && !lowerCol.includes('pedido')) {
            // Make sure this doesn't look like a product name
            const possibleProduct = findProduct(col);
            if (!possibleProduct) {
              branchName = col.toUpperCase();
            }
          }
        }
        
        // Get quantity - first positive number after branch name
        if (branchName && isNumeric(col)) {
          const num = parseNumber(col);
          if (num > 0) {
            quantity = num;
            break;
          }
        }
      }
      
      // Add to results
      if (branchName && quantity > 0) {
        if (!sucursalesMap.has(branchName)) {
          sucursalesMap.set(branchName, new Map());
        }
        
        const branchProducts = sucursalesMap.get(branchName)!;
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
  console.log("Found", productsFound, "products");
  
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
  
  sucursales.sort((a, b) => a.nombre_sucursal.localeCompare(b.nombre_sucursal));
  
  console.log("Final result:", sucursales.length, "branches");
  
  // Debug: log some sample data
  if (sucursales.length > 0) {
    const sample = sucursales.slice(0, 3);
    for (const s of sample) {
      console.log(`  Sample: ${s.nombre_sucursal} has ${s.productos.length} products`);
    }
  }
  
  if (sucursales.length === 0) {
    console.log("No branches found, will fall back to AI");
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
