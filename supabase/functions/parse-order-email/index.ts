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

interface SucursalRegistrada {
  id: string;
  nombre: string;
  codigo_sucursal?: string | null;
}

interface ParseOrderRequest {
  emailBody: string;
  emailSubject: string;
  emailFrom: string;
  clienteId?: string;
  productosCotizados?: ProductoCotizado[];
  sucursalesRegistradas?: SucursalRegistrada[]; // Sucursales from database to validate against
}

interface ParsedProduct {
  nombre_producto: string;
  cantidad: number;
  unidad: string;
  precio_sugerido: number | null;
  notas: string | null;
  producto_cotizado_id: string | null;
  cantidad_original_kg?: number; // For warehouse reference
  match_type?: 'exact' | 'synonym' | 'none'; // For strict validation
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
function parseLecarozEmail(emailBody: string, productosCotizados?: ProductoCotizado[], sucursalesRegistradas?: SucursalRegistrada[]): { sucursales: ParsedSucursal[], confianza: number, notas_generales?: string } {
  console.log("Lecaroz parser with", sucursalesRegistradas?.length || 0, "registered branches");
  if (!productosCotizados || productosCotizados.length === 0) {
    return { sucursales: [], confianza: 0 };
  }
  
  // Build branch lookup map from registered sucursales for STRICT validation
  // This map will be used to validate that detected branches actually exist in the database
  const registeredBranchMap = new Map<string, { id: string, nombre: string }>();
  if (sucursalesRegistradas && sucursalesRegistradas.length > 0) {
    for (const suc of sucursalesRegistradas) {
      // Normalize branch name for matching (uppercase, no extra spaces)
      const normalizedName = suc.nombre.toUpperCase().trim();
      registeredBranchMap.set(normalizedName, { id: suc.id, nombre: suc.nombre });
      // Also add without parenthetical content for partial matching
      const nameWithoutParens = normalizedName.replace(/\([^)]*\)/g, '').trim();
      if (nameWithoutParens !== normalizedName) {
        registeredBranchMap.set(nameWithoutParens, { id: suc.id, nombre: suc.nombre });
      }
    }
    console.log("Registered branch names:", Array.from(registeredBranchMap.keys()).slice(0, 20).join(", "), "...");
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
  
  // Product synonyms mapping - comprehensive mappings for client product names
  // Key: canonical product name (lowercase, no accents) - MUST match database product names
  // Value: client product name variations
  const PRODUCT_SYNONYMS: Record<string, string[]> = {
    // Papeles - mapean a productos reales en la base de datos
    'papel estraza bala rojo': ['papel estraza', 'papel estraza cafe', 'papel estraza(cafe)', 'papel cafe', 'papel kraft', 'estraza', 'papel para rojo', 'papel rojo'],
    'papel estraza liebre': ['papel libre', 'papel liebre', 'estraza liebre'],
    'hoja de polipapel 25x35': ['polipapel', 'poly papel', 'polypapel', 'poli papel', 'hoja polipapel'],
    'bolsa de polipapel 26x32': ['bolsa polipapel', 'bolsa poly'],
    
    // Frutas en lata - nombres EXACTOS de la base de datos
    'pina rodaja 12/850gr (14)': ['pina en lata', 'piña en lata', 'pina lata', 'piña lata', 'pina', 'piña'],
    'mango en rebanadas 24/800gr': ['mango en lata', 'mango lata', 'mango en almibar', 'mango'],
    'durazno': ['durazno en lata', 'durazno lata', 'durazno en almibar', 'duraznos'],
    
    // Almendras - nombre EXACTO de la base de datos
    'almendra non parel 27/30': ['almendra entera', 'almendras', 'almendra natural', 'almendra'],
    
    // Avellana
    'avellana sin casacara': ['avellana entera', 'avellana', 'avellanas'],
    
    // Azúcar
    'azucar estandar': ['azucar', 'azúcar', 'azucar blanca', 'azúcar blanca', 'azucar segunda'],
    'azucar refinada': ['azucar ref', 'azúcar ref'],
    'azucar glass': ['azucar glas', 'azúcar glas', 'glass', 'glas'],
    
    // Sal
    'sal refinada': ['sal', 'sal de mesa', 'sal fina'],
    
    // Féculas
    'fecula de maiz': ['maizena', 'maicena', 'fecula', 'fécula'],
    
    // Pasas
    'uva pasa': ['pasas', 'pasa', 'pasitas', 'uva pasas'],
    
    // Avena
    'avena hojuela': ['avena', 'avena hojuelas', 'avena natural'],
    
    // Girasol
    'girasol pelado': ['semilla de girasol pelado', 'semilla girasol pelado', 'girasol sin cascara'],
    
    // Cereales
    'fruty rueda': ['frutirueda', 'fruti rueda', 'fruty ruedas'],
    
    // Arroz
    'arroz 25/1kg': ['arroz morelos', 'arroz de morelos', 'morelos'],
    
    // Otros
    'canela': ['canela entera', 'canela molida', 'raja de canela'],
    'ajonjoli': ['ajonjolí', 'sesamo', 'sésamo'],
    'nuez': ['nuez entera', 'nueces', 'nuez de castilla'],
    'cacahuate': ['cacahuates', 'cacahuate natural', 'mani', 'maní'],
    
    // Dulces / Confitería
    'caramel cream': ['caramel creme', 'carmel creme', 'caramelo cream'],
  };
  
  // Track unmatched products for UI feedback
  const unmatchedProducts: string[] = [];
  
  // Lines to IGNORE - packaging descriptions, headers, categories (NOT products)
  const IGNORED_LINES = new Set([
    'balon de 50 kilos',
    'balón de 50 kilos',
    'balones de 50 kilos',
    'balones de 50',
    'balon de 50',
    'balón de 50',
    'sacos de 50 kilos',
    'sacos de 50',
    'costales de 50',
    'bultos de 50',
    'bultos de 25',
    'cajas de 24',
    'cajas de 12',
    'litros', // Unit description, not a product
    'litro',
    'kilos',
    'kilo',
    'piezas',
    'pieza',
    'azucar', // Category header, not a product
    'azúcar',
    'harinas',
    'frutas',
    'semillas',
    'granos',
    'enlatados',
    'especias',
    'varios',
    'total',
    'subtotal',
    'gran total',
    'total general',
  ]);
  
  // DETERMINISTIC MATCHING - Exact matches, synonyms, or quotation-based matching
  const findProduct = (text: string): { product: ProductInfo | null; matchType: 'exact' | 'synonym' | 'none' | 'ignored'; originalName: string } => {
    let normalized = text.toLowerCase().trim();
    let normalizedNoAccents = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const originalName = text.trim();
    
    if (normalized.length < 2) return { product: null, matchType: 'none', originalName };
    
    // Skip ignored lines (packaging descriptions, category headers)
    if (IGNORED_LINES.has(normalizedNoAccents) || IGNORED_LINES.has(normalized)) {
      console.log(`IGNORED: "${text}" - packaging description or category header`);
      return { product: null, matchType: 'ignored', originalName };
    }
    
    // Also ignore lines matching common packaging patterns
    if (/^balones?\s+de\s+\d+/i.test(normalized) || 
        /^sacos?\s+de\s+\d+/i.test(normalized) ||
        /^costales?\s+de\s+\d+/i.test(normalized) ||
        /^bultos?\s+de\s+\d+/i.test(normalized) ||
        /^cajas?\s+de\s+\d+/i.test(normalized)) {
      console.log(`IGNORED PATTERN: "${text}" - packaging description`);
      return { product: null, matchType: 'ignored', originalName };
    }
    
    // Clean up common suffixes/prefixes
    normalizedNoAccents = normalizedNoAccents
      .replace(/\(cafe\)/g, '')
      .replace(/\(rojo\)/g, '')
      .replace(/en lata/g, '')
      .replace(/en almibar/g, '')
      .replace(/de \d+ kilos?/g, '')
      .replace(/balones? de \d+/g, '')
      .trim();
    
    // 1. Exact match with accents
    if (productExact.has(normalized)) {
      console.log(`MATCH EXACT: "${text}" -> ${productExact.get(normalized)!.nombre}`);
      return { product: productExact.get(normalized)!, matchType: 'exact', originalName };
    }
    
    // 2. Exact match without accents
    if (productNoAccents.has(normalizedNoAccents)) {
      console.log(`MATCH EXACT (no accents): "${text}" -> ${productNoAccents.get(normalizedNoAccents)!.nombre}`);
      return { product: productNoAccents.get(normalizedNoAccents)!, matchType: 'exact', originalName };
    }
    
    // 3. Check synonyms - map client names to catalog names
    for (const [canonical, synonyms] of Object.entries(PRODUCT_SYNONYMS)) {
      // Check if client text matches any synonym
      if (synonyms.some(s => {
        const sNorm = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalizedNoAccents === sNorm || normalizedNoAccents.includes(sNorm) || sNorm.includes(normalizedNoAccents);
      })) {
        // Look for the canonical product in quotation
        if (productNoAccents.has(canonical)) {
          console.log(`MATCH SYNONYM: "${text}" -> "${canonical}" -> ${productNoAccents.get(canonical)!.nombre}`);
          return { product: productNoAccents.get(canonical)!, matchType: 'synonym', originalName };
        }
      }
      
      // Also check if client text matches the canonical name
      const canonicalNorm = canonical.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalizedNoAccents === canonicalNorm || normalizedNoAccents.includes(canonicalNorm)) {
        if (productNoAccents.has(canonical)) {
          console.log(`MATCH CANONICAL: "${text}" -> ${productNoAccents.get(canonical)!.nombre}`);
          return { product: productNoAccents.get(canonical)!, matchType: 'synonym', originalName };
        }
      }
    }
    
    // 4. NO KEYWORD MATCHING - Disabled to prevent incorrect matches like "papel" -> "polipapel"
    // Only exact matches and configured synonyms are allowed for deterministic parsing
    
    // 5. NO FUZZY MATCHING - If no match found, return null for manual selection
    console.log(`NO MATCH: "${text}" - requires manual selection`);
    if (!unmatchedProducts.includes(originalName)) {
      unmatchedProducts.push(originalName);
    }
    return { product: null, matchType: 'none', originalName };
  };
  
  const text = stripHtmlFast(emailBody);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  console.log("Lines:", lines.length);
  
  // Use array to preserve order (not Map)
  const branchOrder: string[] = [];
  const results = new Map<string, Map<string, ParsedProduct>>();
  let currentBranch: string | null = null;
  let pendingProduct: ProductInfo | null = null;
  let pendingProductOriginalName: string | null = null;
  let pendingMatchType: 'exact' | 'synonym' | 'none' | 'ignored' | null = null;
  
  // Branch pattern: "199 TEZOZOMOC", "201 LA TROJE (CUAUTITLÁN)", "212 LA LUNA TLALPAN"
  // Extracts: <1-3 digit number> <space> <branch name>
  const branchPattern = /^(\d{1,3})\s+([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\s\(\)\-]+)$/i;
  const branchPatternPipe = /^(\d{1,3})\s+([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\s\(\)\-]+?)\s*\|/i;
  
  // Helper function to check if a name matches a registered branch
  const matchRegisteredBranch = (candidateName: string): { id: string, nombre: string } | null => {
    if (registeredBranchMap.size === 0) return null; // No registered branches to validate against
    
    const normalized = candidateName.toUpperCase().trim();
    
    // Exact match
    if (registeredBranchMap.has(normalized)) {
      return registeredBranchMap.get(normalized)!;
    }
    
    // Match without parenthetical content
    const withoutParens = normalized.replace(/\([^)]*\)/g, '').trim();
    if (registeredBranchMap.has(withoutParens)) {
      return registeredBranchMap.get(withoutParens)!;
    }
    
    // Partial match: check if any registered branch name is contained in the candidate
    for (const [regName, branchData] of registeredBranchMap.entries()) {
      if (normalized.includes(regName) || regName.includes(normalized)) {
        return branchData;
      }
    }
    
    return null;
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 2) continue;
    
    // Skip common headers
    const lower = line.toLowerCase();
    if (lower === 'producto' || lower === 'pedido' || lower === 'entregar' || lower === 'codigo') continue;
    if (lower.includes('total general') || lower.includes('gran total')) continue;
    
    // Check for branch header: "199 TEZOZOMOC", "201 LA TROJE (CUAUTITLÁN)"
    let branchMatch = line.match(branchPattern);
    
    // Try pipe-separated format if main pattern didn't match
    if (!branchMatch) {
      branchMatch = line.match(branchPatternPipe);
    }
    
    if (branchMatch) {
      const branchNum = parseInt(branchMatch[1]);
      const name = branchMatch[2].trim().toUpperCase();
      
      // STRICT VALIDATION: Branch must exist in registered sucursales
      // This is the key change - we only accept branches that are in the database
      const registeredMatch = matchRegisteredBranch(name);
      
      if (registeredMatch) {
        // Valid branch - found in registered sucursales
        const branchKey = `${branchNum} ${name}`;
        console.log(`VALID BRANCH: "${branchKey}" -> matches registered: "${registeredMatch.nombre}"`);
        
        currentBranch = branchKey;
        if (!results.has(currentBranch)) {
          results.set(currentBranch, new Map());
          branchOrder.push(currentBranch);
        }
        pendingProduct = null;
        pendingProductOriginalName = null;
        pendingMatchType = null;
        continue;
      } else if (registeredBranchMap.size > 0) {
        // Branch pattern matched but NOT in registered sucursales - treat as product line
        console.log(`REJECTED BRANCH: "${branchNum} ${name}" - not in registered sucursales`);
      } else {
        // No registered sucursales to validate against - use fallback validation
        // This is the legacy behavior for when no sucursales are passed
        const invalidKeywords = /KILO|KILOS|PIEZA|PIEZAS|BULTO|BULTOS|CAJA|CAJAS|TOTAL|ENTREGAR|PRODUCTO|CANTIDAD|LITRO|LITROS|PESO|UNIDAD|CODIGO|PEDIDO|KG|\d$/i;
        const nameClean = name.replace(/\([^)]*\)/g, '').trim();
        
        if (branchNum >= 1 && branchNum <= 500 && 
            nameClean.length >= 3 && nameClean.length <= 40 && 
            !invalidKeywords.test(nameClean)) {
          const branchKey = `${branchNum} ${name}`;
          console.log(`BRANCH DETECTED (fallback): "${branchKey}"`);
          
          currentBranch = branchKey;
          if (!results.has(currentBranch)) {
            results.set(currentBranch, new Map());
            branchOrder.push(currentBranch);
          }
          pendingProduct = null;
          pendingProductOriginalName = null;
          pendingMatchType = null;
          continue;
        }
      }
    }
    
    if (!currentBranch) continue;
    
    // Check for pipe-separated product format: "<id> <producto> | <cantidad> (KILOS) | <entregar>"
    const pipeProductMatch = line.match(/^(\d+)?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\(\)]+?)\s*\|\s*([\d,\.]+)\s*(KILOS?|PIEZAS?|LITROS?|BULTOS?|CAJAS?)?\s*\|?\s*([\d,\.]*)?$/i);
    if (pipeProductMatch) {
      const productName = pipeProductMatch[2].trim();
      const cantidad = parseFloat((pipeProductMatch[3] || '0').replace(/,/g, ''));
      const emailUnit = (pipeProductMatch[4] || 'KILOS').toUpperCase();
      
      if (productName.length > 2 && cantidad > 0) {
        const match = findProduct(productName);
        
        if (match.matchType !== 'ignored') {
          const branchProducts = results.get(currentBranch)!;
          
          if (match.product) {
            // MATCHED PRODUCT - Apply conversion
            const conversion = convertToSellingUnit(
              cantidad,
              emailUnit,
              match.product.unidad,
              match.product.kg_por_unidad,
              true // forceKiloConversion for Lecaroz
            );
            
            if (branchProducts.has(match.product.id)) {
              branchProducts.get(match.product.id)!.cantidad += conversion.cantidad;
            } else {
              branchProducts.set(match.product.id, {
                nombre_producto: match.product.nombre,
                cantidad: conversion.cantidad,
                unidad: match.product.unidad,
                precio_sugerido: null,
                notas: conversion.cantidadOriginalKg ? `${conversion.cantidadOriginalKg} kg` : null,
                producto_cotizado_id: match.product.id,
                cantidad_original_kg: conversion.cantidadOriginalKg,
                match_type: match.matchType || undefined
              });
            }
          } else {
            // UNMATCHED PRODUCT - Store for manual selection
            const unmatchedKey = `__unmatched__${productName}`;
            branchProducts.set(unmatchedKey, {
              nombre_producto: productName,
              cantidad: cantidad,
              unidad: emailUnit,
              precio_sugerido: null,
              notas: `⚠️ REQUIERE SELECCIÓN MANUAL - ${cantidad} ${emailUnit}`,
              producto_cotizado_id: null,
              cantidad_original_kg: cantidad,
              match_type: 'none'
            });
          }
        }
        continue;
      }
    }
    
    // Try to match product name - lines starting with letters, not unit names
    if (/^[A-Za-zÀ-ÿ]/.test(line) && !/^(KILOS?|PIEZAS?|BULTOS?|CAJAS?|DE \d|TOTAL)/i.test(line)) {
      const match = findProduct(line);
      
      // Skip ignored lines (packaging descriptions, category headers)
      if (match.matchType === 'ignored') {
        pendingProduct = null;
        pendingProductOriginalName = null;
        pendingMatchType = null;
        continue;
      }
      
      if (match.product) {
        pendingProduct = match.product;
        pendingProductOriginalName = match.originalName;
        pendingMatchType = match.matchType;
        continue;
      } else if (match.matchType === 'none' && match.originalName.length > 3) {
        // Track unmatched product for later - store with null product
        pendingProduct = null;
        pendingProductOriginalName = match.originalName;
        pendingMatchType = 'none';
      }
    }
    
    // Try to get quantity - number possibly followed by unit
    const qtyMatch = line.match(/^([\d,\.]+)\s*(KILOS?|PIEZAS?|BULTOS?|CAJAS?|BALONES?|SACOS?)?$/i);
    if (qtyMatch && (pendingProduct || pendingMatchType === 'none')) {
      const rawQty = parseFloat(qtyMatch[1].replace(/,/g, ''));
      const emailUnit = (qtyMatch[2] || 'KILOS').toUpperCase();
      
      if (rawQty > 0 && rawQty < 100000) {
        const branchProducts = results.get(currentBranch)!;
        
        if (pendingProduct) {
          // MATCHED PRODUCT - Apply conversion
          const conversion = convertToSellingUnit(
            rawQty,
            emailUnit,
            pendingProduct.unidad,
            pendingProduct.kg_por_unidad,
            true // forceKiloConversion for Lecaroz
          );
          
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
              cantidad_original_kg: conversion.cantidadOriginalKg,
              match_type: pendingMatchType || undefined
            });
          }
        } else if (pendingProductOriginalName) {
          // UNMATCHED PRODUCT - Store for manual selection (NO GUESSING)
          const unmatchedKey = `__unmatched__${pendingProductOriginalName}`;
          branchProducts.set(unmatchedKey, {
            nombre_producto: pendingProductOriginalName,
            cantidad: rawQty, // Keep original quantity, conversion will happen after manual match
            unidad: emailUnit,
            precio_sugerido: null,
            notas: `⚠️ REQUIERE SELECCIÓN MANUAL - ${rawQty} ${emailUnit}`,
            producto_cotizado_id: null,
            cantidad_original_kg: rawQty,
            match_type: 'none'
          });
        }
        
        pendingProduct = null;
        pendingProductOriginalName = null;
        pendingMatchType = null;
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
  
  // DETERMINISTIC VALIDATION - Count exact matches vs unmatched
  let productosCoincidentes = 0;
  let productosSinCoincidencia = 0;
  
  for (const suc of sucursales) {
    for (const prod of suc.productos) {
      if (prod.producto_cotizado_id && prod.match_type !== 'none') {
        productosCoincidentes++;
      } else {
        productosSinCoincidencia++;
      }
    }
  }
  
  console.log(`VALIDATION: ${productosCoincidentes} matched, ${productosSinCoincidencia} unmatched`);
  
  // Confidence is now binary: 1.0 if all match, 0 if any don't
  const confidence = productosSinCoincidencia === 0 ? 1.0 : 0;
  
  return { 
    sucursales, 
    confianza: confidence,
    notas_generales: `✓ ${productosCoincidentes} productos coinciden | ⚠️ ${productosSinCoincidencia} requieren selección manual`
  };
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

const systemPrompt = `Eres un asistente que extrae productos y cantidades de pedidos por email o PDF.

REGLA CRÍTICA - SEPARACIÓN DE SUCURSALES:
- Cada sucursal empieza con un ENCABEZADO en formato: "<numero> <NOMBRE_SUCURSAL>"
- Ejemplos: "199 TEZOZOMOC", "201 LA TROJE (CUAUTITLÁN)", "212 LA LUNA TLALPAN"
- CADA ENCABEZADO = UN PEDIDO SEPARADO (una sucursal nueva)
- NUNCA mezcles productos de diferentes sucursales en el mismo pedido
- Los productos que siguen a un encabezado pertenecen SOLO a esa sucursal
- Cuando encuentres un NUEVO encabezado, ese es el inicio de una NUEVA sucursal

FORMATO DE PRODUCTOS:
- Los productos pueden venir en formato: "<id> <nombre> | <cantidad> (KILOS) | <entregar>"
- O en líneas separadas: primero el nombre del producto, luego la cantidad

REGLAS DE EXTRACCIÓN:
1. Extrae la cantidad TAL COMO VIENE (en kilos, piezas, etc.)
2. Indica la unidad del email (KILOS, PIEZAS, CAJAS, etc.)
3. Usa el producto_cotizado_id EXACTO del catálogo cuando encuentres una coincidencia
4. La conversión a unidad de venta se hará después automáticamente

SINÓNIMOS DE PRODUCTOS:
- "Maizena" o "MAIZENA" = "Fécula de Maíz"
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
    const { emailBody, emailSubject, emailFrom, productosCotizados, sucursalesRegistradas }: ParseOrderRequest = await req.json();
    console.log("Parsing from:", emailFrom, "Products:", productosCotizados?.length || 0, "Registered branches:", sucursalesRegistradas?.length || 0);

    let result: { sucursales: ParsedSucursal[], confianza: number, notas_generales?: string };
    const isLecaroz = isLecarozEmail(emailFrom, emailSubject);

    if (isLecaroz) {
      console.log("Detected Lecaroz email - will force kg conversion");
      result = parseLecarozEmail(emailBody, productosCotizados, sucursalesRegistradas);
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
