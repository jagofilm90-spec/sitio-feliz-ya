import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedProduct {
  nombre_producto: string;
  cantidad: number;
  unidad_mencionada_cliente?: string;
  producto_cotizado_id?: string;
  precio_unitario?: number;
}

interface ParsedSucursal {
  nombre_sucursal: string;
  rfc?: string;
  razon_social?: string;
  productos: ParsedProduct[];
  sucursal_id?: string;
}

interface ParsedOrder {
  sucursales: ParsedSucursal[];
  notas_generales?: string;
  confianza: number;
  esRosticeria?: boolean;
  productoCodigo?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      excelBase64, 
      clienteId, 
      productosCotizados,
      sucursalesRegistradas 
    } = await req.json();

    if (!excelBase64) {
      throw new Error("excelBase64 requerido");
    }

    console.log("Parsing Excel file...");
    console.log(`Productos cotizados: ${productosCotizados?.length || 0}`);
    console.log(`Sucursales registradas: ${sucursalesRegistradas?.length || 0}`);

    // Convert base64 URL-safe to regular base64
    const base64Clean = excelBase64
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    // Decode base64 to binary
    const binaryString = atob(base64Clean);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Parse Excel file
    const workbook = XLSX.read(bytes, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    console.log(`Excel rows: ${jsonData.length}`);
    console.log(`First 5 rows:`, JSON.stringify(jsonData.slice(0, 5)));

    // Detect format: Rosticería (block format with "SUCURSAL:") vs Tabular
    const isRosticeriaFormat = jsonData.some(row => {
      const firstCell = String(row?.[0] || "").trim().toUpperCase();
      return firstCell.startsWith("SUCURSAL:");
    });

    console.log(`Detected format: ${isRosticeriaFormat ? "Rosticería (block)" : "Tabular"}`);

    let order: ParsedOrder;
    if (isRosticeriaFormat) {
      order = parseRosticeriaFormat(jsonData, productosCotizados, sucursalesRegistradas);
    } else {
      order = parseLecarozExcel(jsonData, productosCotizados, sucursalesRegistradas);
    }

    console.log(`Parsed ${order.sucursales.length} sucursales`);
    console.log(`Es Rosticería: ${order.esRosticeria}`);

    return new Response(
      JSON.stringify({ order }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error parsing Excel:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Parser for Rosticería format (block-based with SUCURSAL:, RFC:, RAZON SOCIAL:)
function parseRosticeriaFormat(
  data: any[][],
  productosCotizados: any[] = [],
  sucursalesRegistradas: any[] = []
): ParsedOrder {
  const sucursales: ParsedSucursal[] = [];
  let currentSucursal: ParsedSucursal | null = null;
  let isRosticeria = false;
  let productoCodigo: string | undefined;

  console.log("Parsing Rosticería block format...");

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const firstCell = String(row[0] || "").trim();
    const firstCellUpper = firstCell.toUpperCase();

    // Detect start of sucursal: "SUCURSAL: 301 ROST. CRUCERO"
    if (firstCellUpper.startsWith("SUCURSAL:")) {
      // Save previous sucursal if it has products
      if (currentSucursal && currentSucursal.productos.length > 0) {
        sucursales.push(currentSucursal);
      }

      const nombreSucursal = firstCell.replace(/^SUCURSAL:\s*/i, "").trim();
      
      // Detect Rosticería by "ROST" in branch name
      if (nombreSucursal.toUpperCase().includes("ROST")) {
        isRosticeria = true;
      }

      // Try to match with registered sucursales
      const matchedSucursal = matchSucursal(nombreSucursal, sucursalesRegistradas);

      currentSucursal = {
        nombre_sucursal: nombreSucursal,
        sucursal_id: matchedSucursal?.id,
        productos: []
      };
      
      console.log(`Found sucursal: ${nombreSucursal} (matched: ${matchedSucursal?.nombre || "no"})`);
      continue;
    }

    // Detect RFC
    if (firstCellUpper.startsWith("RFC:") && currentSucursal) {
      currentSucursal.rfc = firstCell.replace(/^RFC:\s*/i, "").trim();
      continue;
    }

    // Detect Razón Social
    if (firstCellUpper.startsWith("RAZON SOCIAL:") && currentSucursal) {
      currentSucursal.razon_social = firstCell.replace(/^RAZON SOCIAL:\s*/i, "").trim();
      continue;
    }

    // Detect products (lines starting with numeric code like "417 BOL.ROLLO...")
    if (currentSucursal && /^\d+\s+/.test(firstCell)) {
      // Extract product code from the beginning
      const codeMatch = firstCell.match(/^(\d+)\s+/);
      if (codeMatch) {
        productoCodigo = codeMatch[1];
      }

      // Get quantity from second column
      const cantidadRaw = String(row[1] || "0").replace(",", ".");
      const cantidad = parseFloat(cantidadRaw);
      
      // Get unit from third column
      const unidad = String(row[2] || "").trim();

      if (cantidad > 0) {
        // Try to match product with cotizaciones
        const matchedProduct = findMatchingProduct(firstCell, productosCotizados);

        currentSucursal.productos.push({
          nombre_producto: matchedProduct?.nombre || firstCell,
          cantidad: cantidad,
          unidad_mencionada_cliente: unidad || "ROLLO",
          producto_cotizado_id: matchedProduct?.producto_id,
          precio_unitario: matchedProduct?.precio_cotizado
        });
      }
    }
  }

  // Save last sucursal
  if (currentSucursal && currentSucursal.productos.length > 0) {
    sucursales.push(currentSucursal);
  }

  console.log(`Total sucursales parsed: ${sucursales.length}`);
  console.log(`Is Rosticería: ${isRosticeria}`);
  console.log(`Product code detected: ${productoCodigo}`);

  return {
    sucursales,
    notas_generales: `Pedido ${isRosticeria ? "Rosticería" : "Lecaroz"} (${sucursales.length} sucursales)`,
    confianza: sucursales.length > 0 ? 0.95 : 0.3,
    esRosticeria: isRosticeria,
    productoCodigo
  };
}

// Original tabular parser for standard Lecaroz format
function parseLecarozExcel(
  data: any[][], 
  productosCotizados: any[] = [],
  sucursalesRegistradas: any[] = []
): ParsedOrder {
  const sucursales: ParsedSucursal[] = [];
  
  // Find header row (contains "NOMBRE" column)
  let headerRowIndex = -1;
  let nombreColIndex = -1;
  let rfcColIndex = -1;
  let razonSocialColIndex = -1;
  let productColumns: { index: number; nombre: string }[] = [];
  
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i];
    if (!row) continue;
    
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || "").toUpperCase().trim();
      if (cell === "NOMBRE" || cell.includes("NOMBRE CLIENTE") || cell.includes("SUCURSAL")) {
        headerRowIndex = i;
        nombreColIndex = j;
        
        // Find RFC and Razón Social columns
        for (let k = 0; k < row.length; k++) {
          const cellVal = String(row[k] || "").toUpperCase().trim();
          if (cellVal === "RFC" || cellVal.includes("R.F.C")) {
            rfcColIndex = k;
          }
          if (cellVal.includes("RAZON") || cellVal.includes("RAZÓN")) {
            razonSocialColIndex = k;
          }
        }
        
        // Find product columns (columns with product codes like "417", "PO-01", etc.)
        for (let k = 0; k < row.length; k++) {
          const cellVal = String(row[k] || "").trim();
          // Product columns are typically numeric codes or have product-like patterns
          if (cellVal && k !== nombreColIndex && k !== rfcColIndex && k !== razonSocialColIndex) {
            // Check if it looks like a product code or name
            const isProductCol = /^\d+$/.test(cellVal) || // numeric code
                                 /^[A-Z]{2,}-\d+/.test(cellVal.toUpperCase()) || // code like "PO-01"
                                 cellVal.includes("BOL") || cellVal.includes("ROLLO") || // product keywords
                                 productosCotizados.some(p => 
                                   cellVal.toUpperCase().includes(p.nombre?.toUpperCase()?.substring(0, 10) || "") ||
                                   cellVal.includes(p.codigo || "")
                                 );
            if (isProductCol) {
              productColumns.push({ index: k, nombre: cellVal });
            }
          }
        }
        break;
      }
    }
    if (headerRowIndex >= 0) break;
  }

  // If no standard header found, try alternative format detection
  if (headerRowIndex < 0) {
    console.log("Standard header not found, trying alternative parsing...");
    return parseAlternativeFormat(data, productosCotizados, sucursalesRegistradas);
  }

  console.log(`Header row: ${headerRowIndex}, Nombre col: ${nombreColIndex}`);
  console.log(`Product columns: ${productColumns.map(p => p.nombre).join(", ")}`);

  // Parse data rows
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    
    const nombreSucursal = String(row[nombreColIndex] || "").trim();
    if (!nombreSucursal || nombreSucursal.toUpperCase().includes("TOTAL")) continue;
    
    const rfc = rfcColIndex >= 0 ? String(row[rfcColIndex] || "").trim() : undefined;
    const razonSocial = razonSocialColIndex >= 0 ? String(row[razonSocialColIndex] || "").trim() : undefined;
    
    const productos: ParsedProduct[] = [];
    
    for (const prodCol of productColumns) {
      const cantidad = parseFloat(String(row[prodCol.index] || "0").replace(",", "."));
      if (cantidad > 0) {
        // Try to match with quoted products
        const matchedProduct = findMatchingProduct(prodCol.nombre, productosCotizados);
        
        productos.push({
          nombre_producto: matchedProduct?.nombre || prodCol.nombre,
          cantidad: cantidad,
          unidad_mencionada_cliente: extractUnit(prodCol.nombre),
          producto_cotizado_id: matchedProduct?.producto_id,
          precio_unitario: matchedProduct?.precio_cotizado
        });
      }
    }
    
    if (productos.length > 0) {
      // Try to match sucursal with registered ones
      const matchedSucursal = matchSucursal(nombreSucursal, sucursalesRegistradas);
      
      sucursales.push({
        nombre_sucursal: matchedSucursal?.nombre || nombreSucursal,
        rfc: rfc || undefined,
        razon_social: razonSocial || undefined,
        productos,
        sucursal_id: matchedSucursal?.id
      });
    }
  }

  return {
    sucursales,
    notas_generales: `Pedido importado desde archivo Excel (${sucursales.length} sucursales)`,
    confianza: sucursales.length > 0 ? 0.9 : 0,
    esRosticeria: false
  };
}

function parseAlternativeFormat(
  data: any[][], 
  productosCotizados: any[],
  sucursalesRegistradas: any[]
): ParsedOrder {
  const sucursales: ParsedSucursal[] = [];
  
  // Look for rows that have a sucursal name and quantity
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;
    
    // First non-empty cell could be sucursal name
    let nombreSucursal = "";
    let cantidad = 0;
    
    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (cell === null || cell === undefined) continue;
      
      const cellStr = String(cell).trim();
      if (!cellStr) continue;
      
      // Check if it's a number (quantity)
      const num = parseFloat(cellStr.replace(",", "."));
      if (!isNaN(num) && num > 0 && num < 10000) {
        cantidad = num;
      } else if (cellStr.length > 2 && !nombreSucursal) {
        // Probably a sucursal name
        nombreSucursal = cellStr;
      }
    }
    
    if (nombreSucursal && cantidad > 0) {
      // Find the product (likely only one product per Excel for Lecaroz Rosticería)
      const producto = productosCotizados[0];
      
      const matchedSucursal = matchSucursal(nombreSucursal, sucursalesRegistradas);
      
      sucursales.push({
        nombre_sucursal: matchedSucursal?.nombre || nombreSucursal,
        productos: [{
          nombre_producto: producto?.nombre || "Producto Excel",
          cantidad,
          unidad_mencionada_cliente: "UNIDADES",
          producto_cotizado_id: producto?.producto_id,
          precio_unitario: producto?.precio_cotizado
        }],
        sucursal_id: matchedSucursal?.id
      });
    }
  }

  return {
    sucursales,
    notas_generales: `Pedido importado desde archivo Excel (formato alternativo, ${sucursales.length} sucursales)`,
    confianza: sucursales.length > 0 ? 0.7 : 0,
    esRosticeria: false
  };
}

function findMatchingProduct(columnName: string, productosCotizados: any[]): any | null {
  if (!productosCotizados || productosCotizados.length === 0) return null;
  
  const colNorm = columnName.toUpperCase().trim();
  
  // Extract code if present (e.g., "417" from "417 BOL.ROLLO...")
  const codeMatch = columnName.match(/^(\d+)\s+/);
  const productCode = codeMatch ? codeMatch[1] : null;
  
  // Match by code first
  if (productCode) {
    const codeMatch = productosCotizados.find(p => 
      p.codigo?.includes(productCode) || String(p.codigo) === productCode
    );
    if (codeMatch) return codeMatch;
  }
  
  // Exact code match
  const exactMatch = productosCotizados.find(p => 
    p.codigo === colNorm || p.codigo === columnName
  );
  if (exactMatch) return exactMatch;
  
  // Partial name match
  const partialMatch = productosCotizados.find(p => {
    const nombreNorm = (p.nombre || "").toUpperCase();
    return colNorm.includes(nombreNorm.substring(0, 10)) || 
           nombreNorm.includes(colNorm.substring(0, 10));
  });
  if (partialMatch) return partialMatch;
  
  // If only one product in quotation, use it
  if (productosCotizados.length === 1) {
    return productosCotizados[0];
  }
  
  return null;
}

// Prefijos comunes a remover para comparación de sucursales
const SUCURSAL_PREFIXES = [
  /^rost\.?\s*/i,
  /^rosticeria\s*/i,
  /^rosticería\s*/i,
  /^pan\s*/i,
  /^panaderia\s*/i,
  /^panadería\s*/i,
  /^pollos\s*/i,
  /^la\s+/i,
  /^el\s+/i,
  /^los\s+/i,
  /^las\s+/i,
  /^v\.\s*de\s*/i,  // "V. DE" -> Villa de
  /^villa\s+de\s*/i,
  /^av\.\s*/i,      // "AV." -> Avenida
  /^avenida\s*/i,
  /^sucursal\s*/i,
  /^suc\.?\s*/i,
  /^s\.?\s+/i,
];

// Función para extraer nombre clave (sin número ni prefijos)
function extractKeyName(str: string): string {
  let key = str.toLowerCase().trim();
  // Quitar número inicial (ej: "303 ROST. AMATRIAS" -> "ROST. AMATRIAS")
  key = key.replace(/^\d+\s*/, '');
  // Quitar todos los prefijos iterativamente
  let prevKey = "";
  while (prevKey !== key) {
    prevKey = key;
    for (const prefix of SUCURSAL_PREFIXES) {
      key = key.replace(prefix, '').trim();
    }
  }
  return key.trim();
}

// Función de similitud (Dice coefficient)
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length < 2 || str2.length < 2) return 0;
  
  const bigrams1 = new Set<string>();
  const bigrams2 = new Set<string>();
  
  for (let i = 0; i < str1.length - 1; i++) {
    bigrams1.add(str1.substring(i, i + 2));
  }
  for (let i = 0; i < str2.length - 1; i++) {
    bigrams2.add(str2.substring(i, i + 2));
  }
  
  let intersection = 0;
  for (const bigram of bigrams1) {
    if (bigrams2.has(bigram)) intersection++;
  }
  
  return (2 * intersection) / (bigrams1.size + bigrams2.size);
}

function matchSucursal(nombre: string, sucursalesRegistradas: any[]): any | null {
  if (!sucursalesRegistradas || sucursalesRegistradas.length === 0) return null;
  
  const nombreNorm = nombre.toLowerCase().trim().replace(/\s+/g, " ");
  
  // Extraer número si existe (ej: "303 ROST. AMATRIAS" -> "303")
  const numMatch = nombreNorm.match(/^(\d+)\s*/);
  const branchNumber = numMatch ? numMatch[1] : null;
  
  // Extraer nombre clave del Excel
  const keyName = extractKeyName(nombreNorm);
  
  console.log(`Matching: "${nombre}" -> keyName: "${keyName}", branchNum: ${branchNumber}`);
  
  // === PASO 1: Match exacto por número (si ambos tienen número) ===
  if (branchNumber) {
    const matchByNum = sucursalesRegistradas.find(s => {
      const sNorm = s.nombre.toLowerCase().trim();
      return sNorm.startsWith(branchNumber + " ") || sNorm === branchNumber;
    });
    if (matchByNum) {
      console.log(`  → Matched by number: ${matchByNum.nombre}`);
      return matchByNum;
    }
  }
  
  // === PASO 2: Match por nombre clave exacto ===
  const exactKeyMatch = sucursalesRegistradas.find(s => {
    const sKeyName = extractKeyName(s.nombre);
    return sKeyName === keyName && keyName.length > 0;
  });
  if (exactKeyMatch) {
    console.log(`  → Matched by exact key: ${exactKeyMatch.nombre}`);
    return exactKeyMatch;
  }
  
  // === PASO 3: Match si una contiene a la otra (después de normalizar) ===
  if (keyName.length >= 3) {
    const partialKeyMatch = sucursalesRegistradas.find(s => {
      const sKeyName = extractKeyName(s.nombre);
      return (sKeyName.includes(keyName) || keyName.includes(sKeyName)) && sKeyName.length > 0;
    });
    if (partialKeyMatch) {
      console.log(`  → Matched by partial key: ${partialKeyMatch.nombre}`);
      return partialKeyMatch;
    }
  }
  
  // === PASO 4: Match por similitud de palabras ===
  const keyWords = keyName.split(/\s+/).filter(w => w.length > 2);
  if (keyWords.length > 0) {
    const wordMatch = sucursalesRegistradas.find(s => {
      const sKeyName = extractKeyName(s.nombre);
      const sWords = sKeyName.split(/\s+/).filter(w => w.length > 2);
      // Si alguna palabra clave coincide exactamente
      return keyWords.some(kw => sWords.some(sw => sw === kw));
    });
    if (wordMatch) {
      console.log(`  → Matched by word: ${wordMatch.nombre}`);
      return wordMatch;
    }
  }
  
  // === PASO 5: Match por similitud de texto (Dice coefficient) ===
  let bestMatch = null;
  let bestScore = 0;
  
  for (const s of sucursalesRegistradas) {
    const sKeyName = extractKeyName(s.nombre);
    if (sKeyName.length < 2) continue;
    
    const score = calculateSimilarity(keyName, sKeyName);
    if (score > 0.7 && score > bestScore) { // 70% similitud mínima
      bestScore = score;
      bestMatch = s;
    }
  }
  
  if (bestMatch) {
    console.log(`  → Matched by similarity (${(bestScore * 100).toFixed(0)}%): ${bestMatch.nombre}`);
    return bestMatch;
  }
  
  console.log(`  → No match found for: "${nombre}"`);
  return null;
}

function extractUnit(productName: string): string {
  const upper = productName.toUpperCase();
  if (upper.includes("KG") || upper.includes("KILO")) return "KILOS";
  if (upper.includes("BOL") || upper.includes("ROLLO")) return "UNIDADES";
  if (upper.includes("CAJA")) return "CAJAS";
  if (upper.includes("PIEZA") || upper.includes("PZA")) return "PIEZAS";
  return "UNIDADES";
}
