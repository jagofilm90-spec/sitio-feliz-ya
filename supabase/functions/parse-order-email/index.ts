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

function stripHtmlFast(html: string): string {
  const parts = html.split('<');
  let result = parts[0] || '';
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const closeIndex = part.indexOf('>');
    if (closeIndex === -1) { result += '<' + part; continue; }
    const tag = part.substring(0, closeIndex).toLowerCase();
    const afterTag = part.substring(closeIndex + 1);
    if (tag.startsWith('style') || tag.startsWith('script')) continue;
    if (tag.startsWith('/tr') || tag.startsWith('br') || tag.startsWith('/p') || tag.startsWith('/div')) result += '\n';
    if (tag.startsWith('/td') || tag.startsWith('/th')) result += '\t';
    result += afterTag;
  }
  return result.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n))).replace(/\t+/g, '\t').replace(/[ ]+/g, ' ');
}

function isLecarozEmail(emailFrom: string, emailSubject: string): boolean {
  return emailFrom.includes('lecarozint.com') || emailSubject.toLowerCase().includes('lecaroz');
}

// Known Lecaroz branch names for validation
const LECAROZ_BRANCHES = new Set([
  'LAGO', 'COYOACAN', 'LAFAYETTE', 'NARVARTE', 'XOLA', 'PERISUR', 'UNIVERSIDAD',
  'POLANCO', 'CONDESA', 'ROMA', 'SATELITE', 'INTERLOMAS', 'SANTA FE', 'CUERNAVACA',
  'PUEBLA', 'QUERETARO', 'LEON', 'AGUASCALIENTES', 'GUADALAJARA', 'MONTERREY',
  'TOLUCA', 'MORELIA', 'SAN LUIS', 'VERACRUZ', 'TIJUANA', 'CANCUN', 'MERIDA',
  'AGRICOLA ORIENTAL', 'AGUILAS', 'KANSAS', 'DALLAS', 'MIAMI', 'HOUSTON', 'CHICAGO',
  'LINDAVISTA', 'TLALPAN', 'COAPA', 'CHURUBUSCO', 'INSURGENTES', 'REFORMA', 'CENTRAL',
  'NORTE', 'SUR', 'ORIENTE', 'PONIENTE', 'CENTRO', 'LOMAS', 'PEDREGAL', 'COYUYA',
  'TERMINAL', 'AEROPUERTO', 'ZONA ROSA', 'DEL VALLE', 'NAPOLES', 'MIXCOAC'
]);

// Parse Lecaroz email - handles cell-per-line structure
function parseLecarozEmail(emailBody: string, productosCotizados?: ProductoCotizado[]): { sucursales: ParsedSucursal[], confianza: number } {
  console.log("Lecaroz parser");
  if (!productosCotizados || productosCotizados.length === 0) {
    return { sucursales: [], confianza: 0 };
  }
  
  // Build product lookup with multiple matching strategies
  const productExact = new Map<string, { id: string, nombre: string, unidad: string }>();
  const productWords = new Map<string, { id: string, nombre: string, unidad: string }>();
  
  for (const p of productosCotizados) {
    const key = p.nombre.toLowerCase().trim();
    productExact.set(key, { id: p.producto_id, nombre: p.nombre, unidad: p.unidad });
    // Also index by first significant word
    const words = key.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      productWords.set(words[0], { id: p.producto_id, nombre: p.nombre, unidad: p.unidad });
    }
  }
  
  const findProduct = (text: string): { id: string, nombre: string, unidad: string } | null => {
    const normalized = text.toLowerCase().trim();
    if (normalized.length < 3) return null;
    
    // Exact match
    if (productExact.has(normalized)) return productExact.get(normalized)!;
    
    // Partial match - product name contains input or vice versa
    for (const [key, product] of productExact) {
      if (key.includes(normalized) || normalized.includes(key)) return product;
    }
    
    // Word-based match
    const inputWords = normalized.split(/\s+/).filter(w => w.length > 2);
    for (const word of inputWords) {
      if (productWords.has(word)) return productWords.get(word)!;
    }
    
    return null;
  };
  
  const text = stripHtmlFast(emailBody);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  console.log("Lines:", lines.length);
  
  // Use array to preserve order (not Map)
  const branchOrder: string[] = [];
  const results = new Map<string, Map<string, ParsedProduct>>();
  let currentBranch: string | null = null;
  let pendingProduct: { id: string, nombre: string, unidad: string } | null = null;
  
  // Branch pattern: "1 LAGO", "3 LAFAYETTE", "12 AGRICOLA ORIENTAL"
  const branchPattern = /^(\d{1,3})\s+([A-Z][A-Z\s]*[A-Z]?)$/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 2) continue;
    
    // Skip common headers
    const lower = line.toLowerCase();
    if (lower === 'producto' || lower === 'pedido' || lower === 'entregar' || lower === 'codigo') continue;
    if (lower.includes('total general') || lower.includes('gran total')) continue;
    
    // Check for branch header: "1 LAGO", "12 AGRICOLA ORIENTAL"
    const branchMatch = line.match(branchPattern);
    if (branchMatch) {
      const branchNum = parseInt(branchMatch[1]);
      const name = branchMatch[2].trim().toUpperCase();
      
      // Validate: must be a reasonable branch number and name length
      if (branchNum >= 1 && branchNum <= 200 && name.length >= 2 && name.length <= 30) {
        // Check if it looks like a known branch or has typical branch name structure
        const isKnownBranch = LECAROZ_BRANCHES.has(name);
        const looksLikeBranch = /^[A-Z][A-Z\s]{1,25}$/.test(name) && !name.match(/^\d/) && !name.match(/KILO|PIEZA|BULTO|CAJA|TOTAL/i);
        
        if (isKnownBranch || looksLikeBranch) {
          currentBranch = name;
          if (!results.has(currentBranch)) {
            results.set(currentBranch, new Map());
            branchOrder.push(currentBranch);
          }
          pendingProduct = null;
          continue;
        }
      }
    }
    
    if (!currentBranch) continue;
    
    // Try to match product name - lines starting with letters, not unit names
    if (/^[A-Za-zÀ-ÿ]/.test(line) && !/^(KILOS?|PIEZAS?|BULTOS?|CAJAS?|DE \d|TOTAL)/i.test(line)) {
      const product = findProduct(line);
      if (product) {
        pendingProduct = product;
        continue;
      }
    }
    
    // Try to get quantity - number possibly followed by unit
    if (pendingProduct) {
      const qtyMatch = line.match(/^([\d,\.]+)\s*(KILOS?|PIEZAS?|BULTOS?|CAJAS?)?$/i);
      if (qtyMatch) {
        const qty = parseFloat(qtyMatch[1].replace(/,/g, ''));
        if (qty > 0 && qty < 100000) {
          const branchProducts = results.get(currentBranch)!;
          if (branchProducts.has(pendingProduct.id)) {
            branchProducts.get(pendingProduct.id)!.cantidad += qty;
          } else {
            branchProducts.set(pendingProduct.id, {
              nombre_producto: pendingProduct.nombre,
              cantidad: qty,
              unidad: pendingProduct.unidad,
              precio_sugerido: null,
              notas: null,
              producto_cotizado_id: pendingProduct.id
            });
          }
          pendingProduct = null;
        }
      }
    }
  }
  
  // Build result in original order (not alphabetically)
  const sucursales: ParsedSucursal[] = [];
  for (const name of branchOrder) {
    const products = results.get(name);
    if (products && products.size > 0) {
      sucursales.push({ 
        nombre_sucursal: name, 
        fecha_entrega_solicitada: null, 
        productos: Array.from(products.values()) 
      });
    }
  }
  
  console.log("Branches:", sucursales.length);
  
  if (sucursales.length === 0) return { sucursales: [], confianza: 0 };
  
  // Calculate confidence based on how many products were matched
  const totalProducts = sucursales.reduce((sum, s) => sum + s.productos.length, 0);
  const confidence = totalProducts > 0 ? Math.min(0.95, 0.7 + (totalProducts / 100) * 0.25) : 0;
  
  return { sucursales, confianza: confidence };
}

async function parseWithAI(emailBody: string, emailSubject: string, emailFrom: string, productosCotizados?: ProductoCotizado[]): Promise<{ sucursales: ParsedSucursal[], confianza: number, notas_generales?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  
  let cleanEmailBody = stripHtmlFast(emailBody);
  if (cleanEmailBody.length > 30000) cleanEmailBody = cleanEmailBody.substring(0, 30000) + "\n\n[... truncado ...]";

  let productosContext = "";
  if (productosCotizados && productosCotizados.length > 0) {
    productosContext = `\n\nPRODUCTOS COTIZADOS:\n${productosCotizados.map(p => `- "${p.nombre}" (ID: ${p.producto_id}, unidad: ${p.unidad})`).join('\n')}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Extrae productos y cantidades del pedido, agrupados por sucursal.${productosContext}` },
          { role: "user", content: `ASUNTO: ${emailSubject}\nDE: ${emailFrom}\n\n${cleanEmailBody}` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_order",
            description: "Extrae productos del pedido",
            parameters: {
              type: "object",
              properties: {
                sucursales: { type: "array", items: { type: "object", properties: { nombre_sucursal: { type: "string" }, fecha_entrega_solicitada: { type: "string" }, productos: { type: "array", items: { type: "object", properties: { nombre_producto: { type: "string" }, cantidad: { type: "number" }, unidad: { type: "string" }, precio_sugerido: { type: "number" }, notas: { type: "string" }, producto_cotizado_id: { type: "string" } }, required: ["nombre_producto", "cantidad", "unidad"] } } }, required: ["nombre_sucursal", "productos"] } },
                notas_generales: { type: "string" },
                confianza: { type: "number" }
              },
              required: ["sucursales", "confianza"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_order" } }
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
      if (response.status === 429) throw new Error("Límite de solicitudes excedido");
      if (response.status === 402) throw new Error("Créditos insuficientes");
      throw new Error(`AI error: ${response.status}`);
    }
    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "extract_order") throw new Error("No se pudo extraer el pedido");
    return JSON.parse(toolCall.function.arguments);
  } catch (fetchError: unknown) {
    clearTimeout(timeoutId);
    if (fetchError instanceof Error && fetchError.name === 'AbortError') throw new Error("Timeout - intente de nuevo");
    throw fetchError;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { emailBody, emailSubject, emailFrom, productosCotizados }: ParseOrderRequest = await req.json();
    console.log("Parsing from:", emailFrom, "Products:", productosCotizados?.length || 0);

    let result: { sucursales: ParsedSucursal[], confianza: number, notas_generales?: string };

    if (isLecarozEmail(emailFrom, emailSubject)) {
      console.log("Detected Lecaroz email");
      result = parseLecarozEmail(emailBody, productosCotizados);
      if (result.sucursales.length === 0) {
        console.log("Falling back to AI...");
        result = await parseWithAI(emailBody, emailSubject, emailFrom, productosCotizados);
      }
    } else {
      result = await parseWithAI(emailBody, emailSubject, emailFrom, productosCotizados);
    }

    console.log("Result:", result.sucursales.length, "branches");
    return new Response(JSON.stringify({ success: true, order: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
