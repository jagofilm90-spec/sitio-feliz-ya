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
  kg_por_unidad: number | null;
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
  cantidad_original_kg?: number; // For warehouse reference
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

// Convert quantity from kg/pieces to selling unit
// IMPORTANT: For Lecaroz, emails ALWAYS come in KILOS even if not explicitly stated
function convertToSellingUnit(
  cantidadPedida: number,
  unidadEmail: string, // KILOS, PIEZAS, CAJAS, etc.
  unidadVenta: string, // kg, bulto, caja, etc.
  kgPorUnidad: number | null,
  forceKiloConversion: boolean = false // For Lecaroz emails, force conversion assuming KILOS
): { cantidad: number; cantidadOriginalKg?: number } {
  const unidadVentaLower = unidadVenta.toLowerCase();
  const unidadEmailLower = (unidadEmail || '').toLowerCase();
  
  console.log(`convertToSellingUnit: cantidadPedida=${cantidadPedida}, unidadEmail="${unidadEmail}", unidadVenta="${unidadVenta}", kgPorUnidad=${kgPorUnidad}, forceKilo=${forceKiloConversion}`);
  
  // If product is sold by kg, no conversion needed
  if (unidadVentaLower === 'kg' || unidadVentaLower === 'kilo' || unidadVentaLower === 'kilos') {
    console.log(`  -> Product sold by kg, no conversion: ${cantidadPedida}`);
    return { cantidad: cantidadPedida };
  }
  
  // If we have kg_por_unidad and should convert (forceKilo OR email says KILOS)
  const shouldConvertFromKilos = kgPorUnidad && kgPorUnidad > 0 && (
    forceKiloConversion ||
    unidadEmailLower === '' ||
    unidadEmailLower.includes('kilo') ||
    // AI might return the selling unit but the quantity is still in kg
    (unidadEmailLower === unidadVentaLower && cantidadPedida > kgPorUnidad * 10) // Heuristic: if qty is suspiciously high
  );
  
  if (shouldConvertFromKilos) {
    const cantidadConvertida = Math.round(cantidadPedida / kgPorUnidad!);
    console.log(`  -> CONVERSION: ${cantidadPedida} kg ÷ ${kgPorUnidad} kg/unidad = ${cantidadConvertida} ${unidadVenta}`);
    return { 
      cantidad: cantidadConvertida,
      cantidadOriginalKg: cantidadPedida
    };
  }
  
  // If email already in same unit as selling unit (CAJAS -> caja, BULTOS -> bulto)
  if (
    (unidadEmailLower.includes('caja') && unidadVentaLower === 'caja') ||
    (unidadEmailLower.includes('bulto') && unidadVentaLower === 'bulto') ||
    (unidadEmailLower.includes('saco') && unidadVentaLower === 'bulto') ||
    (unidadEmailLower.includes('balon') && unidadVentaLower === 'balón')
  ) {
    console.log(`  -> Same unit, no conversion: ${cantidadPedida}`);
    return { cantidad: cantidadPedida };
  }
  
  // If email is in PIEZAS and we have piezas_por_unidad (stored in kg_por_unidad for piece-based products)
  if (unidadEmailLower.includes('pieza') && kgPorUnidad && kgPorUnidad > 0) {
    const cantidadConvertida = Math.round(cantidadPedida / kgPorUnidad);
    console.log(`  -> CONVERSION: ${cantidadPedida} piezas ÷ ${kgPorUnidad} piezas/caja = ${cantidadConvertida} ${unidadVenta}`);
    return { cantidad: cantidadConvertida };
  }
  
  // Default: no conversion
  console.log(`  -> No conversion applied: ${cantidadPedida}`);
  return { cantidad: cantidadPedida };
}

// Parse Lecaroz email - handles cell-per-line structure
function parseLecarozEmail(emailBody: string, productosCotizados?: ProductoCotizado[]): { sucursales: ParsedSucursal[], confianza: number } {
  console.log("Lecaroz parser");
  if (!productosCotizados || productosCotizados.length === 0) {
    return { sucursales: [], confianza: 0 };
  }
  
  // Build product lookup with multiple matching strategies
  type ProductInfo = { id: string, nombre: string, unidad: string, kg_por_unidad: number | null };
  const productExact = new Map<string, ProductInfo>(); // exact name match (with accents)
  const productNoAccents = new Map<string, ProductInfo>(); // exact name match (without accents)
  const productPartial = new Map<string, ProductInfo[]>(); // partial word matches
  
  // Log available products for debugging
  console.log("Available products:", productosCotizados.map(p => `${p.nombre} (${p.unidad}, kg_por_unidad: ${p.kg_por_unidad})`).join(", "));
  
  for (const p of productosCotizados) {
    const key = p.nombre.toLowerCase().trim();
    const keyNoAccents = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const info: ProductInfo = { id: p.producto_id, nombre: p.nombre, unidad: p.unidad, kg_por_unidad: p.kg_por_unidad };
    
    productExact.set(key, info);
    productNoAccents.set(keyNoAccents, info);
    
    // Index by significant words for partial matching
    const words = keyNoAccents.split(/\s+/).filter(w => w.length > 2 && !['con', 'sin', 'para', 'por', 'del', 'las', 'los'].includes(w));
    for (const word of words) {
      if (!productPartial.has(word)) {
        productPartial.set(word, []);
      }
      productPartial.get(word)!.push(info);
    }
  }
  
  const findProduct = (text: string): ProductInfo | null => {
    const normalized = text.toLowerCase().trim();
    const normalizedNoAccents = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalized.length < 3) return null;
    
    // 1. Exact match with accents
    if (productExact.has(normalized)) {
      console.log(`MATCH exact: "${text}" -> ${productExact.get(normalized)!.nombre}`);
      return productExact.get(normalized)!;
    }
    
    // 2. Exact match without accents
    if (productNoAccents.has(normalizedNoAccents)) {
      console.log(`MATCH no-accents: "${text}" -> ${productNoAccents.get(normalizedNoAccents)!.nombre}`);
      return productNoAccents.get(normalizedNoAccents)!;
    }
    
    // 3. Partial match - input contains product name or vice versa
    for (const [key, product] of productNoAccents) {
      if (key.includes(normalizedNoAccents) || normalizedNoAccents.includes(key)) {
        console.log(`MATCH partial: "${text}" -> ${product.nombre}`);
        return product;
      }
    }
    
    // 4. Word-based match - find product that matches most words
    const inputWords = normalizedNoAccents.split(/\s+/).filter(w => w.length > 2);
    let bestMatch: ProductInfo | null = null;
    let bestScore = 0;
    
    for (const word of inputWords) {
      const matches = productPartial.get(word);
      if (matches && matches.length === 1) {
        // Unique match by word
        console.log(`MATCH word "${word}": "${text}" -> ${matches[0].nombre}`);
        return matches[0];
      }
    }
    
    // 5. Try matching first significant word
    for (const word of inputWords) {
      if (word.length > 4) {
        const matches = productPartial.get(word);
        if (matches && matches.length > 0) {
          console.log(`MATCH first-word "${word}": "${text}" -> ${matches[0].nombre}`);
          return matches[0];
        }
      }
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
  let pendingProduct: ProductInfo | null = null;
  
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
      const qtyMatch = line.match(/^([\d,\.]+)\s*(KILOS?|PIEZAS?|BULTOS?|CAJAS?|BALONES?|SACOS?)?$/i);
      if (qtyMatch) {
        const rawQty = parseFloat(qtyMatch[1].replace(/,/g, ''));
        const emailUnit = (qtyMatch[2] || 'KILOS').toUpperCase(); // Default to KILOS if not specified
        
        if (rawQty > 0 && rawQty < 100000) {
          // Apply conversion using centralized function - FORCE conversion for Lecaroz
          const conversion = convertToSellingUnit(
            rawQty,
            emailUnit,
            pendingProduct.unidad,
            pendingProduct.kg_por_unidad,
            true // forceKiloConversion for Lecaroz
          );
          
          const branchProducts = results.get(currentBranch)!;
          if (branchProducts.has(pendingProduct.id)) {
            branchProducts.get(pendingProduct.id)!.cantidad += conversion.cantidad;
          } else {
            branchProducts.set(pendingProduct.id, {
              nombre_producto: pendingProduct.nombre,
              cantidad: conversion.cantidad,
              unidad: pendingProduct.unidad,
              precio_sugerido: null,
              notas: conversion.cantidadOriginalKg ? `${conversion.cantidadOriginalKg} kg` : null,
              producto_cotizado_id: pendingProduct.id,
              cantidad_original_kg: conversion.cantidadOriginalKg
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

// Build product lookup for AI post-processing
function buildProductLookup(productosCotizados?: ProductoCotizado[]): Map<string, ProductoCotizado> {
  const lookup = new Map<string, ProductoCotizado>();
  if (!productosCotizados) return lookup;
  
  for (const p of productosCotizados) {
    // Index by ID
    lookup.set(p.producto_id, p);
    // Index by name (lowercase, no accents)
    const nameKey = p.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    lookup.set(nameKey, p);
  }
  return lookup;
}

// Apply unit conversion to AI-parsed results
function applyConversionsToAIResult(
  result: { sucursales: ParsedSucursal[], confianza: number, notas_generales?: string },
  productosCotizados?: ProductoCotizado[],
  isLecaroz: boolean = false
): { sucursales: ParsedSucursal[], confianza: number, notas_generales?: string } {
  if (!productosCotizados || productosCotizados.length === 0) return result;
  
  const productLookup = buildProductLookup(productosCotizados);
  
  for (const sucursal of result.sucursales) {
    for (const producto of sucursal.productos) {
      // Find matching product in catalog
      let catalogProduct: ProductoCotizado | undefined;
      
      if (producto.producto_cotizado_id) {
        catalogProduct = productLookup.get(producto.producto_cotizado_id);
      }
      if (!catalogProduct) {
        const nameKey = producto.nombre_producto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        catalogProduct = productLookup.get(nameKey);
      }
      
      if (catalogProduct) {
        // Apply conversion - force for Lecaroz since they always send KILOS
        const emailUnit = producto.unidad || 'KILOS';
        const conversion = convertToSellingUnit(
          producto.cantidad,
          emailUnit,
          catalogProduct.unidad,
          catalogProduct.kg_por_unidad,
          isLecaroz // forceKiloConversion for Lecaroz
        );
        
        console.log(`AI CONVERSION: ${producto.nombre_producto} - ${producto.cantidad} ${emailUnit} -> ${conversion.cantidad} ${catalogProduct.unidad}`);
        
        producto.cantidad = conversion.cantidad;
        producto.unidad = catalogProduct.unidad;
        producto.producto_cotizado_id = catalogProduct.producto_id;
        if (conversion.cantidadOriginalKg) {
          producto.notas = `${conversion.cantidadOriginalKg} kg`;
          producto.cantidad_original_kg = conversion.cantidadOriginalKg;
        }
      }
    }
  }
  
  return result;
}

async function parseWithAI(emailBody: string, emailSubject: string, emailFrom: string, productosCotizados?: ProductoCotizado[], isLecaroz: boolean = false): Promise<{ sucursales: ParsedSucursal[], confianza: number, notas_generales?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  
  let cleanEmailBody = stripHtmlFast(emailBody);
  if (cleanEmailBody.length > 30000) cleanEmailBody = cleanEmailBody.substring(0, 30000) + "\n\n[... truncado ...]";

  // Build product context with conversion info
  let productosContext = "";
  if (productosCotizados && productosCotizados.length > 0) {
    productosContext = `\n\nPRODUCTOS COTIZADOS (usa el ID exacto del producto):\n${productosCotizados.map(p => 
      `- "${p.nombre}" (ID: ${p.producto_id}, unidad_venta: ${p.unidad}, kg_por_unidad: ${p.kg_por_unidad || 'N/A'})`
    ).join('\n')}`;
  }

  const systemPrompt = `Eres un asistente que extrae productos y cantidades de pedidos por email.

REGLAS IMPORTANTES:
1. Extrae la cantidad TAL COMO VIENE en el email (en kilos, piezas, etc.)
2. Indica la unidad del email (KILOS, PIEZAS, CAJAS, etc.)
3. Usa el producto_cotizado_id EXACTO del catálogo cuando encuentres una coincidencia
4. La conversión a unidad de venta se hará después automáticamente
${productosContext}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `ASUNTO: ${emailSubject}\nDE: ${emailFrom}\n\n${cleanEmailBody}` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_order",
            description: "Extrae productos del pedido con cantidades TAL COMO VIENEN en el email",
            parameters: {
              type: "object",
              properties: {
                sucursales: { type: "array", items: { type: "object", properties: { nombre_sucursal: { type: "string" }, fecha_entrega_solicitada: { type: "string" }, productos: { type: "array", items: { type: "object", properties: { nombre_producto: { type: "string" }, cantidad: { type: "number", description: "Cantidad TAL COMO VIENE en el email" }, unidad: { type: "string", description: "Unidad del email: KILOS, PIEZAS, CAJAS, etc." }, precio_sugerido: { type: "number" }, notas: { type: "string" }, producto_cotizado_id: { type: "string", description: "ID exacto del producto del catálogo" } }, required: ["nombre_producto", "cantidad", "unidad"] } } }, required: ["nombre_sucursal", "productos"] } },
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
    
    const rawResult = JSON.parse(toolCall.function.arguments);
    
    // Apply unit conversions post-processing
    return applyConversionsToAIResult(rawResult, productosCotizados, isLecaroz);
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
    const isLecaroz = isLecarozEmail(emailFrom, emailSubject);

    if (isLecaroz) {
      console.log("Detected Lecaroz email - will force kg conversion");
      result = parseLecarozEmail(emailBody, productosCotizados);
      if (result.sucursales.length === 0) {
        console.log("Falling back to AI...");
        result = await parseWithAI(emailBody, emailSubject, emailFrom, productosCotizados, true);
      }
    } else {
      result = await parseWithAI(emailBody, emailSubject, emailFrom, productosCotizados, false);
    }

    console.log("Result:", result.sucursales.length, "branches");
    return new Response(JSON.stringify({ success: true, order: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
