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

// Strip HTML tags and clean up email body
function stripHtml(html: string): string {
  let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<\/td>/gi, '\t');
  text = text.replace(/<\/th>/gi, '\t');
  text = text.replace(/<th[^>]*>/gi, '');
  text = text.replace(/<td[^>]*>/gi, '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<p[^>]*>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/\t+/g, '\t');
  text = text.replace(/[ ]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n');
  return text.trim();
}

// Check if email is from Lecaroz system
function isLecarozEmail(emailFrom: string, emailSubject: string): boolean {
  return emailFrom.includes('lecarozint.com') || 
         emailSubject.toLowerCase().includes('lecaroz');
}

// Parse Lecaroz email directly without AI - much faster and handles all branches
function parseLecarozEmail(emailBody: string, productosCotizados?: ProductoCotizado[]): { sucursales: ParsedSucursal[], confianza: number } {
  console.log("Using Lecaroz specialized parser");
  
  const sucursalesMap = new Map<string, ParsedProduct[]>();
  
  // Clean the email body for parsing
  const cleanBody = stripHtml(emailBody);
  const lines = cleanBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log("Lecaroz email lines:", lines.length);
  
  // Track current product being processed
  let currentProduct: string | null = null;
  let currentProductId: string | null = null;
  
  // Helper to find matching product from quotation
  const findMatchingProduct = (productName: string): { id: string | null, nombre: string } => {
    if (!productosCotizados || productosCotizados.length === 0) {
      return { id: null, nombre: productName };
    }
    
    const normalizedName = productName.toLowerCase().trim();
    
    // Exact match first
    for (const p of productosCotizados) {
      if (p.nombre.toLowerCase().trim() === normalizedName) {
        return { id: p.producto_id, nombre: p.nombre };
      }
    }
    
    // Partial match
    for (const p of productosCotizados) {
      const pName = p.nombre.toLowerCase().trim();
      if (pName.includes(normalizedName) || normalizedName.includes(pName)) {
        return { id: p.producto_id, nombre: p.nombre };
      }
    }
    
    // Word match
    const words = normalizedName.split(/\s+/).filter(w => w.length > 3);
    for (const p of productosCotizados) {
      const pName = p.nombre.toLowerCase();
      const matchCount = words.filter(w => pName.includes(w)).length;
      if (matchCount >= Math.ceil(words.length * 0.5)) {
        return { id: p.producto_id, nombre: p.nombre };
      }
    }
    
    return { id: null, nombre: productName };
  };
  
  // Parse the tabular data - Lecaroz format has:
  // Product name in one row, then branch quantities in subsequent rows
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split('\t').map(p => p.trim()).filter(p => p.length > 0);
    
    if (parts.length === 0) continue;
    
    // Check if this is a product header line (usually has "Producto" and "Pedido" and "Entregar")
    if (line.toLowerCase().includes('producto') && line.toLowerCase().includes('pedido')) {
      continue; // Skip header
    }
    
    // Check if this looks like a product name (text followed by numeric columns)
    // Product lines typically have the product name and may have totals
    const firstPart = parts[0];
    const isNumeric = (s: string) => /^\d+([.,]\d+)?$/.test(s.replace(/,/g, ''));
    
    // If first part is text and not a number, and subsequent parts are numbers, it might be a product
    if (firstPart && !isNumeric(firstPart) && firstPart.length > 2) {
      // Check if any remaining parts are numeric (quantities)
      const hasQuantities = parts.slice(1).some(p => isNumeric(p));
      
      if (!hasQuantities && parts.length <= 3) {
        // This might be a product name line
        const match = findMatchingProduct(firstPart);
        currentProduct = match.nombre;
        currentProductId = match.id;
        continue;
      }
    }
    
    // Parse branch lines - format is typically: BranchCode BranchName Qty1 Qty2
    // Or sometimes just: BranchName Qty
    // Look for lines with numeric values
    for (let j = 0; j < parts.length; j++) {
      const part = parts[j];
      
      // Skip if it's clearly not a branch entry
      if (part.length < 2) continue;
      
      // Check if this part is a number (potential quantity)
      if (isNumeric(part)) {
        const qty = parseFloat(part.replace(',', '.'));
        if (qty > 0 && currentProduct) {
          // The branch name should be before this number
          // Could be parts[j-1] or parts[j-2] depending on format
          let branchName = '';
          
          // Look backwards for the branch name
          for (let k = j - 1; k >= 0; k--) {
            if (!isNumeric(parts[k]) && parts[k].length > 1) {
              branchName = parts[k];
              break;
            }
          }
          
          if (branchName && qty > 0) {
            // Add to sucursales map
            if (!sucursalesMap.has(branchName)) {
              sucursalesMap.set(branchName, []);
            }
            
            const existingProducts = sucursalesMap.get(branchName)!;
            const existingProduct = existingProducts.find(p => p.nombre_producto === currentProduct);
            
            if (!existingProduct) {
              existingProducts.push({
                nombre_producto: currentProduct,
                cantidad: qty,
                unidad: 'bulto',
                precio_sugerido: null,
                notas: null,
                producto_cotizado_id: currentProductId
              });
            }
          }
        }
        break; // Move to next line after finding a quantity
      }
    }
  }
  
  // Alternative parsing - look for pattern: number followed by text (branch) followed by numbers (quantities)
  // This handles: "1 LAGO ... 3 0" type format
  if (sucursalesMap.size === 0) {
    console.log("Trying alternative Lecaroz parsing...");
    
    // Pattern: Look for lines that start with a number (branch index) followed by branch name
    const branchPattern = /^(\d+)\s+([A-Z][A-Z\s]+)/;
    const productSections: { product: string, productId: string | null, content: string }[] = [];
    
    let currentSection = '';
    let lastProduct = '';
    let lastProductId: string | null = null;
    
    for (const line of lines) {
      // Check if this is a product header (usually all caps or known product name)
      const trimmedLine = line.trim();
      
      // Product names are usually in the quotation list
      if (productosCotizados) {
        for (const p of productosCotizados) {
          if (trimmedLine.toLowerCase().includes(p.nombre.toLowerCase().substring(0, 10))) {
            if (currentSection && lastProduct) {
              productSections.push({ product: lastProduct, productId: lastProductId, content: currentSection });
            }
            lastProduct = p.nombre;
            lastProductId = p.producto_id;
            currentSection = '';
            break;
          }
        }
      }
      
      currentSection += line + '\n';
    }
    
    if (currentSection && lastProduct) {
      productSections.push({ product: lastProduct, productId: lastProductId, content: currentSection });
    }
    
    // Parse each product section for branches and quantities
    for (const section of productSections) {
      const sectionLines = section.content.split('\n');
      
      for (const sLine of sectionLines) {
        // Look for branch patterns like "1 LAGO 3 0" or "LAGO 3"
        const parts = sLine.split(/\s+/).filter(p => p.length > 0);
        
        for (let i = 0; i < parts.length - 1; i++) {
          const current = parts[i];
          const next = parts[i + 1];
          
          // If current is text (branch name) and next is a number (quantity)
          if (!/^\d+$/.test(current) && current.length > 2 && /^\d+$/.test(next)) {
            const qty = parseInt(next);
            if (qty > 0) {
              const branchName = current;
              
              if (!sucursalesMap.has(branchName)) {
                sucursalesMap.set(branchName, []);
              }
              
              const products = sucursalesMap.get(branchName)!;
              if (!products.find(p => p.nombre_producto === section.product)) {
                products.push({
                  nombre_producto: section.product,
                  cantidad: qty,
                  unidad: 'bulto',
                  precio_sugerido: null,
                  notas: null,
                  producto_cotizado_id: section.productId
                });
              }
            }
          }
        }
      }
    }
  }
  
  // Convert map to array
  const sucursales: ParsedSucursal[] = [];
  for (const [nombre, productos] of sucursalesMap) {
    if (productos.length > 0) {
      sucursales.push({
        nombre_sucursal: nombre,
        fecha_entrega_solicitada: null,
        productos
      });
    }
  }
  
  console.log("Lecaroz parser found", sucursales.length, "branches");
  
  // If still no results, fall back to AI parsing
  if (sucursales.length === 0) {
    console.log("Lecaroz parser found no branches, will fall back to AI");
    return { sucursales: [], confianza: 0 };
  }
  
  return { 
    sucursales, 
    confianza: 0.85
  };
}

// Standard AI-based parsing for non-Lecaroz emails
async function parseWithAI(emailBody: string, emailSubject: string, emailFrom: string, productosCotizados?: ProductoCotizado[]): Promise<{ sucursales: ParsedSucursal[], confianza: number, notas_generales?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }
  
  let cleanEmailBody = stripHtml(emailBody);
  
  // Truncate for AI (max 30K chars for standard emails)
  const MAX_EMAIL_LENGTH = 30000;
  if (cleanEmailBody.length > MAX_EMAIL_LENGTH) {
    console.log("Truncating email from", cleanEmailBody.length, "to", MAX_EMAIL_LENGTH);
    cleanEmailBody = cleanEmailBody.substring(0, MAX_EMAIL_LENGTH) + "\n\n[... contenido truncado ...]";
  }

  let productosContext = "";
  if (productosCotizados && productosCotizados.length > 0) {
    productosContext = `

IMPORTANTE - PRODUCTOS COTIZADOS RECIENTEMENTE A ESTE CLIENTE:
${productosCotizados.map(p => `- "${p.nombre}" (código: ${p.codigo}, ID: ${p.producto_id}, unidad: ${p.unidad})`).join('\n')}

Cuando el cliente use nombres similares o abreviados, debes hacer match con estos productos.`;
  }

  const systemPrompt = `Eres un asistente especializado en procesar correos de pedidos de clientes para una comercializadora de abarrotes. Extrae TODOS los productos mencionados con sus cantidades, agrupados por sucursal si aplica.
${productosContext}`;

  const userPrompt = `Analiza el siguiente correo de pedido:

ASUNTO: ${emailSubject}
DE: ${emailFrom}

CONTENIDO:
${cleanEmailBody}`;

  console.log("Calling AI gateway for standard email...");
  
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
                        nombre_sucursal: { type: "string" },
                        fecha_entrega_solicitada: { type: "string" },
                        productos: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              nombre_producto: { type: "string" },
                              cantidad: { type: "number" },
                              unidad: { type: "string", enum: ["kg", "bulto", "costal", "caja", "pieza", "cubeta", "litro"] },
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
        throw new Error("Límite de solicitudes excedido, intente más tarde");
      }
      if (response.status === 402) {
        throw new Error("Créditos insuficientes para IA");
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== "extract_order") {
      throw new Error("No se pudo extraer la información del pedido");
    }

    return JSON.parse(toolCall.function.arguments);
    
  } catch (fetchError: unknown) {
    clearTimeout(timeoutId);
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error("La solicitud tardó demasiado, intente de nuevo");
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
    
    console.log("Parsing order email from:", emailFrom);
    console.log("Subject:", emailSubject);
    console.log("Productos cotizados disponibles:", productosCotizados?.length || 0);
    console.log("Email body length:", emailBody.length);

    let result: { sucursales: ParsedSucursal[], confianza: number, notas_generales?: string };

    // Check if this is a Lecaroz email - use specialized parser
    if (isLecarozEmail(emailFrom, emailSubject)) {
      console.log("Detected Lecaroz email - using specialized parser");
      result = parseLecarozEmail(emailBody, productosCotizados);
      
      // If specialized parser didn't find anything, fall back to AI
      if (result.sucursales.length === 0) {
        console.log("Lecaroz parser failed, falling back to AI");
        result = await parseWithAI(emailBody, emailSubject, emailFrom, productosCotizados);
      }
    } else {
      // Standard emails use AI
      result = await parseWithAI(emailBody, emailSubject, emailFrom, productosCotizados);
    }

    console.log("Parsed order - sucursales:", result.sucursales.length);

    return new Response(JSON.stringify({ 
      success: true, 
      order: result 
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
