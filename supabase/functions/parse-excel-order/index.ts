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
}

interface ParsedSucursal {
  nombre_sucursal: string;
  rfc?: string;
  razon_social?: string;
  productos: ParsedProduct[];
}

interface ParsedOrder {
  sucursales: ParsedSucursal[];
  notas_generales?: string;
  confianza: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

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
    console.log(`First row sample:`, jsonData[0]?.slice(0, 5));

    // Parse Lecaroz Excel format
    const order = parseLecarozExcel(jsonData, productosCotizados, sucursalesRegistradas);

    console.log(`Parsed ${order.sucursales.length} sucursales`);

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
        sucursal_id: matchedSucursal?.id,
      } as ParsedSucursal & { sucursal_id?: string });
    }
  }

  return {
    sucursales,
    notas_generales: `Pedido importado desde archivo Excel (${sucursales.length} sucursales)`,
    confianza: sucursales.length > 0 ? 0.9 : 0,
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
        }],
        sucursal_id: matchedSucursal?.id,
      } as ParsedSucursal & { sucursal_id?: string });
    }
  }

  return {
    sucursales,
    notas_generales: `Pedido importado desde archivo Excel (formato alternativo, ${sucursales.length} sucursales)`,
    confianza: sucursales.length > 0 ? 0.7 : 0,
  };
}

function findMatchingProduct(columnName: string, productosCotizados: any[]): any | null {
  if (!productosCotizados || productosCotizados.length === 0) return null;
  
  const colNorm = columnName.toUpperCase().trim();
  
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

function matchSucursal(nombre: string, sucursalesRegistradas: any[]): any | null {
  if (!sucursalesRegistradas || sucursalesRegistradas.length === 0) return null;
  
  const nombreNorm = nombre.toLowerCase().trim()
    .replace(/\s+/g, " ")
    .replace(/^(sucursal|suc\.?|s\.?)\s*/i, "");
  
  // Extract number if present (e.g., "3 LAFAYETTE" -> "3")
  const numMatch = nombreNorm.match(/^(\d+)\s*/);
  const branchNumber = numMatch ? numMatch[1] : null;
  
  // Try to match by number first
  if (branchNumber) {
    const matchByNum = sucursalesRegistradas.find(s => {
      const sNorm = s.nombre.toLowerCase().trim();
      return sNorm.startsWith(branchNumber + " ") || sNorm === branchNumber;
    });
    if (matchByNum) return matchByNum;
  }
  
  // Try exact match
  const exactMatch = sucursalesRegistradas.find(s => 
    s.nombre.toLowerCase().trim() === nombreNorm
  );
  if (exactMatch) return exactMatch;
  
  // Try partial match
  const partialMatch = sucursalesRegistradas.find(s => {
    const sNorm = s.nombre.toLowerCase().trim();
    return sNorm.includes(nombreNorm) || nombreNorm.includes(sNorm);
  });
  if (partialMatch) return partialMatch;
  
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
