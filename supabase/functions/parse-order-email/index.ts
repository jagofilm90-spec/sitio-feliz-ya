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

// Parse Lecaroz email directly without AI - handles HTML table structure
function parseLecarozEmail(emailBody: string, productosCotizados?: ProductoCotizado[]): { sucursales: ParsedSucursal[], confianza: number } {
  console.log("Using Lecaroz specialized parser");
  
  const sucursalesMap = new Map<string, ParsedProduct[]>();
  
  // Helper to find matching product from quotation
  const findMatchingProduct = (productName: string): { id: string | null, nombre: string, unidad: string } => {
    if (!productosCotizados || productosCotizados.length === 0) {
      return { id: null, nombre: productName, unidad: 'bulto' };
    }
    
    const normalizedName = productName.toLowerCase().trim();
    
    // Exact match first
    for (const p of productosCotizados) {
      if (p.nombre.toLowerCase().trim() === normalizedName) {
        return { id: p.producto_id, nombre: p.nombre, unidad: p.unidad };
      }
    }
    
    // Partial match - check if product name contains or is contained
    for (const p of productosCotizados) {
      const pName = p.nombre.toLowerCase().trim();
      if (pName.includes(normalizedName) || normalizedName.includes(pName)) {
        return { id: p.producto_id, nombre: p.nombre, unidad: p.unidad };
      }
    }
    
    // Word match - at least 50% of significant words match
    const words = normalizedName.split(/\s+/).filter(w => w.length > 3);
    for (const p of productosCotizados) {
      const pName = p.nombre.toLowerCase();
      const matchCount = words.filter(w => pName.includes(w)).length;
      if (words.length > 0 && matchCount >= Math.ceil(words.length * 0.5)) {
        return { id: p.producto_id, nombre: p.nombre, unidad: p.unidad };
      }
    }
    
    return { id: null, nombre: productName, unidad: 'bulto' };
  };

  // Try to parse HTML tables directly
  // Lecaroz emails have tables where each product has rows for each branch
  // Format: Product header, then rows with branch name and quantities
  
  // Extract all table content - look for patterns in HTML
  const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const tables = emailBody.match(tablePattern) || [];
  
  console.log("Found", tables.length, "HTML tables");
  
  // Process each table looking for order data
  for (const table of tables) {
    // Extract rows
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = table.match(rowPattern) || [];
    
    let currentProductName: string | null = null;
    let currentProductMatch: { id: string | null, nombre: string, unidad: string } | null = null;
    
    for (const row of rows) {
      // Extract cells (td and th)
      const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const cells: string[] = [];
      let cellMatch;
      while ((cellMatch = cellPattern.exec(row)) !== null) {
        // Clean the cell content
        let cellContent = cellMatch[1]
          .replace(/<[^>]+>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim();
        cells.push(cellContent);
      }
      
      if (cells.length === 0) continue;
      
      // Skip header rows
      const firstCell = cells[0].toLowerCase();
      if (firstCell.includes('producto') || firstCell.includes('pedido') || 
          firstCell.includes('entregar') || firstCell.includes('total') ||
          firstCell === '' || firstCell === '#') {
        continue;
      }
      
      // Check if this might be a product row (has product name)
      // Product rows usually have the product name in first cell and may span multiple columns
      const isNumeric = (s: string) => /^\d+([.,]\d+)?$/.test(s.replace(/,/g, '').trim());
      
      // If we have a cell with text that matches a quoted product, it's a product header
      if (cells.length >= 1 && !isNumeric(cells[0]) && cells[0].length > 2) {
        const possibleProduct = cells[0];
        const match = findMatchingProduct(possibleProduct);
        
        // If it matches a quoted product, update current product
        if (match.id) {
          currentProductName = match.nombre;
          currentProductMatch = match;
          console.log("Found product:", currentProductName);
        }
      }
      
      // Look for branch + quantity patterns
      // Typical format: [index] [branch name] [qty pedido] [qty entregar] or similar
      if (currentProductName && currentProductMatch && cells.length >= 2) {
        // Find the branch name (text) and quantity (number)
        let branchName: string | null = null;
        let quantity: number = 0;
        
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i].trim();
          
          // Skip empty cells and index numbers
          if (!cell || cell === '' || /^\d{1,2}$/.test(cell)) continue;
          
          // If cell is text (not purely numeric), it might be a branch name
          if (!isNumeric(cell) && cell.length >= 2 && !branchName) {
            // Skip known non-branch values
            if (!cell.toLowerCase().includes('total') && 
                !cell.toLowerCase().includes('producto') &&
                !cell.toLowerCase().includes('pedido')) {
              branchName = cell.toUpperCase();
            }
          }
          
          // If cell is numeric and we have a branch, it's the quantity
          if (isNumeric(cell) && branchName) {
            const num = parseFloat(cell.replace(/,/g, ''));
            if (num > 0 && quantity === 0) {
              quantity = num;
              break; // Take first non-zero quantity (usually "Pedido" column)
            }
          }
        }
        
        // Add to sucursales map if we found valid data
        if (branchName && quantity > 0) {
          if (!sucursalesMap.has(branchName)) {
            sucursalesMap.set(branchName, []);
          }
          
          const products = sucursalesMap.get(branchName)!;
          const existing = products.find(p => p.nombre_producto === currentProductName);
          
          if (!existing) {
            products.push({
              nombre_producto: currentProductName,
              cantidad: quantity,
              unidad: currentProductMatch.unidad,
              precio_sugerido: null,
              notas: null,
              producto_cotizado_id: currentProductMatch.id
            });
          }
        }
      }
    }
  }
  
  // If HTML parsing didn't work well, try plain text parsing
  if (sucursalesMap.size === 0) {
    console.log("HTML parsing found nothing, trying text-based parsing...");
    
    // Clean the email body for text parsing
    const cleanBody = stripHtml(emailBody);
    const lines = cleanBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    console.log("Lecaroz email lines:", lines.length);
    
    let currentProduct: string | null = null;
    let currentProductMatch: { id: string | null, nombre: string, unidad: string } | null = null;
    
    for (const line of lines) {
      const parts = line.split(/\t+/).map(p => p.trim()).filter(p => p.length > 0);
      if (parts.length === 0) continue;
      
      const isNumeric = (s: string) => /^\d+([.,]\d+)?$/.test(s.replace(/,/g, '').trim());
      
      // Check if first part might be a product name from our quoted products
      if (parts[0] && !isNumeric(parts[0]) && parts[0].length > 2) {
        const match = findMatchingProduct(parts[0]);
        if (match.id) {
          currentProduct = match.nombre;
          currentProductMatch = match;
        }
      }
      
      // Look for branch patterns: text followed by numbers
      if (currentProduct && currentProductMatch) {
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          const nextPart = parts[i + 1];
          
          if (!isNumeric(part) && part.length >= 2 && isNumeric(nextPart)) {
            const branchName = part.toUpperCase();
            const qty = parseFloat(nextPart.replace(/,/g, ''));
            
            if (qty > 0 && !branchName.toLowerCase().includes('total')) {
              if (!sucursalesMap.has(branchName)) {
                sucursalesMap.set(branchName, []);
              }
              
              const products = sucursalesMap.get(branchName)!;
              if (!products.find(p => p.nombre_producto === currentProduct)) {
                products.push({
                  nombre_producto: currentProduct,
                  cantidad: qty,
                  unidad: currentProductMatch.unidad,
                  precio_sugerido: null,
                  notas: null,
                  producto_cotizado_id: currentProductMatch.id
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
  
  console.log("Lecaroz parser found", sucursales.length, "branches with products");
  
  // Log summary for debugging
  for (const suc of sucursales) {
    console.log(`  - ${suc.nombre_sucursal}: ${suc.productos.length} products`);
  }
  
  // If still no good results, fall back to AI parsing
  if (sucursales.length === 0) {
    console.log("Lecaroz parser found no branches, will fall back to AI");
    return { sucursales: [], confianza: 0 };
  }
  
  return { 
    sucursales, 
    confianza: 0.90
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
