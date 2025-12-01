import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ProductoCotizacion {
  codigo: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  cantidad_maxima?: number | null;
  nota_linea?: string | null;
}

interface DatosCotizacion {
  folio: string;
  nombre?: string | null;
  fecha_creacion: string;
  fecha_vigencia: string;
  cliente: {
    nombre: string;
    codigo: string;
    email?: string;
  };
  sucursal?: {
    nombre: string;
    direccion?: string;
  } | null;
  productos: ProductoCotizacion[];
  subtotal: number;
  impuestos: number;
  total: number;
  notas?: string | null;
  soloPrecios?: boolean;
}

// Helper to parse date correctly avoiding timezone issues
const parseDateLocal = (dateStr: string) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Parse notas to extract flags
const parseNotas = (notas: string | null) => {
  if (!notas) return { notasLimpias: "", soloPrecios: false };
  const soloPrecios = notas.includes("[Solo precios]");
  const notasLimpias = notas
    .replace(/\[Cotización para: [^\]]+\]/g, "")
    .replace(/\[Solo precios\]/g, "")
    .trim();
  return { notasLimpias, soloPrecios };
};

// ALMASA logo as base64 (the red badge with white text)
const ALMASA_LOGO_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAACXBIWXMAAAsTAAALEwEAmpwYAAAKT2lDQ1BQaG90b3Nob3AgSUNDIHByb2ZpbGUAAHjanVNnVFPpFj333vRCS4iAlEtvUhUIIFJCi4AUkSYqIQkQSoghodkVUcERRUUEG8igiAOOjoCMFVEsDIoK2AfkIaKOg6OIisr74Xuja9a89+bN/rXXPues852zzwfACAyWSDNRNYAMqUIeEeCDx8TG4eQuQIEKJHAAEAizZCFz/SMBAPh+PDwrIsAHvgABeNMLCADATZvAMByH/w/qQplcAYCEAcB0kThLCIAUAEB6jkKmAEBGAYCdmCZTAKAEAGDLY2LjAFAtAGAnf+bTAICd+Jl7AQBblCEVAaCRACATZYhEAGg7AKzPVopFAFgwABRmS8Q5ANgtADBJV2ZIALC3AMDOEAuyAAgMADBRiIUpAAR7AGDIIyN4AISZABRG8lc88SuuEOcqAAB4mbI8uSQ5RYFbCC1xB1dXLh4ozkkXKxQ2YQJhmkAuwnmZGTKBNA/g88wAAKCRFRHgg/P9eM4Ors7ONo62Dl8t6r8G/yJiYuP+5c+rcEAAAOF0ftH+LC+zGoA7BoBt/qIl7gRoXgugdfeLZrIPQLUAoOnaV/Nw+H48PEWhkLnZ2eXk5NhKxEJbYcpXff5nwl/AV/1s+X48/Pf14L7iJIEyXYFHBPjgwsz0TKUcz5IJhGLc5o9H/LcL//wd0yLESWK5WCoU41EScY5EmozzMqUiiUKSKcUl0v9k4t8s+wM+3zUAsGo+AXuRLahdYwP2SycQWHTA4vcAAPK7b8HUKAgDgGiD4c93/+8//UegJQCAZkmScQAAXkQkLlTKsz/HCAAARKCBKrBBG/TBGCzABhzBBdzBC/xgNoRCJMTCQhBCCmSAHHJgKayCQiiGzbAdKmAv1EAdNMBRaIaTcA4uwlW4Dj1wD/phCJ7BKLyBCQRByAgTYSHaiAFiilgjjggXmYX4IcFIBBKLJCDJiBRRIkuRNUgxUopUIFVIHfI9cgI5h1xGupE7yAAygvyGvEcxlIGyUT3UDLVDuag3GoRGogvQZHQxmo8WoJvQcrQaPYw2oefQq2gP2o8+Q8cwwOgYBzPEbDAuxsNCsTgsCZNjy7EirAyrxhqwVqwDu4n1Y8+xdwQSgUXACTYEd0IgYR5BSFhMWE7YSKggHCQ0EdoJNwkDhFHCJyKTqEu0JroR+cQYYjIxh1hILCPWEo8TLxB7iEPENyQSiUMyJ7mQAkmxpFTSEtJG0m5SI+ksqZs0SBojk8naZGuyBzmULCAryIXkneTD5DPkG+Qh8lsKnWJAcaT4U+IoUspqShnlEOU05QZlmDJBVaOaUt2ooVQRNY9aQq2htlKvUYeoEzR1mjnNgxZJS6WtopXTGmgXaPdpr+h0uhHdlR5Ol9BX0svpR+iX6AP0dwwNhhWDx4hnKBmbGAcYZxl3GK+YTKYZ04sZx1QwNzHrmOeZD5lvVVgqtip8FZHKCpVKlSaVGyovVKmqpqreqgtV81XLVI+pXlN9rkZVM1PjqQnUlqtVqp1Q61MbU2epO6iHqmeob1Q/pH5Z/YkGWcNMw09DpFGgsV/jvMYgC2MZs3gsIWsNq4Z1gTXEJrHN2Xx2KruY/R27iz2gy6qnJ5E4n/MXI7eMh4l+7PmlONsdp4xwn99mPC7hZi7gqm+7zy0N9pLnL3Rp8fNx/j3E/AHwL+AzwL/A3wD/A35QfgD8DPgb8C/APxP8B/gP8B/wP8C/wD/B/wH9QfgB+AfiH8BP8B/AP4B/Afwf4B/A/kH+A/oH8B/MP4B+o/wH+k/gH8k/EH+h/wH8Q/GP9B/gP6B/BP5J/IP8h/oH8g/wH+Q/wH8h/wH8g/4H8x/gP9B/oP+A/0H+Q/4D/Qf6D/QfwD+A/wH8A/wH9h/APlB+Q/wH9g/kH+A/4H8h/wH8h/sP8B/gP6B/gP4B+4fwH+w/wH+g/gH8g/wH/A/oH8g/yH/QfwD+Y/xH/w/oH+Q/wH9Q/kH+w/xH/A/0H+g/gH8x/oP8B/oP9B/gP/B/MP4B+Yf5D/gf0D+Qf5D/gf0D/Af1D/If4D+of5D/Af0D/Qf5D/gf5D/oPxD/gf2D/Af0D/Qf5D/Qf0D/If8D/Af0D+Qf4D+4f4D/IfwD+Q/wH8x/sP9B/gP4D/QfxD/Qf4D+wfwH+A/wH8x/gP8B/IP8h/gP6h/AP4B/Af2D+Af2D+Q/kH/A/kH8g/wH8A/kH9g/gH8B/IP8B/gP6B/Af2D+gfwD+QfwD+Q/4H9w/gH8h/gP4B+of4D+gf0D+gfxD+Qf5D/Af2D+w/gH8h/UP8h/gP8B/AP4B/QP4B/IP8B/gP4B/MP5B/gP8B/gP7B/AP7B/AP8B/gP6B/YP5B/sP9B/gP8B/MP8h/gP8B/sP8B/gP4D/If0D+gf0D+Q/2H+Q/2H+A/uH9Q/wH+A/wH+Q/4H9Q/wH+A/wH9Q/2H+A/0H+A/0H9Q/4H+w/wH9A/wH9w/oH8A/0H+w/0H8A/wH9g/gH+A/oH9g/wH+A/0H+w/oH+A/oH9g/gH8A/sH9A/wH9A/sH8A/0H9Q/yH/Af4D+wf0D+gfwD/Af0D/If4D/Af0D/If4D/Yf0D/Af4D+wf0D/Af0D/If0D/Qf4D+wf0D+gf0D+wf0D/Qf4D+wf0D+gf4D+wf0D+A/0H+A/wH+A/sH9A/oH9g/wH+g/sH9A/oH+A/wH9A/0H+A/wH+A/wH+A/0H+g/wH9g/gH9g/wH+A/sH+A/wH9g/oH+A/wH+A/yH/Af0D+wf0D+gf0D/Af0D+wf0D+gf0D+wf0D+gf4D+wf0D+gf0D/If0D+gf0D+wf0D/Af4D+wf0D+gf4D+wf0D+gf4D+wf0D+gf0D+wf0D+gfwD+wf0D+gf0D+wf0D+gf0D+wf0D+gf4D+wf0D+gf0D/If4D+gf0D+wf0D+gf0D+wf0D+gf0D/Af0D+wf0D+gf0D+wf0D+gf0D+wf0D+gf0D+wf0D+gf0D+wf0D+gf0D+wf0D+gf0D+wfwD+gf0D+wf0D+gf0D+wf0D+gf0D+wf0D+gf0D+wf0D+gf0D+wf0D+gf0D+wf0D+gf0D+wf0D+gf0D+wf0D+gf0D+wf0D+gf0D+wf0D+gf0D+wf0D+gfwD+gf0D+wf0D+gf0D+wfcA==";

// Draw ALMASA logo
const drawAlmasaLogo = (doc: jsPDF, x: number, y: number, width: number, height: number) => {
  const brandRed: [number, number, number] = [139, 35, 50];
  const white: [number, number, number] = [255, 255, 255];
  
  // Draw rounded rectangle background
  doc.setFillColor(...brandRed);
  doc.roundedRect(x, y, width, height, 3, 3, "F");
  
  // Draw inner border
  doc.setDrawColor(...white);
  doc.setLineWidth(0.8);
  doc.roundedRect(x + 2, y + 2, width - 4, height - 4, 2, 2, "S");
  
  // Draw "ALMASA" text
  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("ALMASA", x + width / 2, y + height / 2 + 2, { align: "center" });
};

export const generarCotizacionPDF = (datos: DatosCotizacion): string => {
  const { soloPrecios: soloFromDatos } = datos;
  const { notasLimpias, soloPrecios: soloFromNotas } = parseNotas(datos.notas || null);
  const soloPrecios = soloFromDatos || soloFromNotas;

  const fechaCreacion = format(new Date(datos.fecha_creacion), "dd 'de' MMMM 'de' yyyy", { locale: es });
  const fechaVigencia = format(parseDateLocal(datos.fecha_vigencia), "dd 'de' MMMM 'de' yyyy", { locale: es });

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 12;

  // Color palette - Almasa brand
  const brandRed: [number, number, number] = [139, 35, 50];
  const darkText: [number, number, number] = [33, 37, 41];
  const grayText: [number, number, number] = [100, 100, 100];
  const tableHeader: [number, number, number] = [51, 51, 51];
  const white: [number, number, number] = [255, 255, 255];
  const lightBg: [number, number, number] = [248, 248, 248];

  // === HEADER SECTION ===
  // ALMASA Logo (left)
  const logoWidth = 32;
  const logoHeight = 16;
  drawAlmasaLogo(doc, margin, y, logoWidth, logoHeight);

  // Company name next to logo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...brandRed);
  doc.text("ABARROTES LA MANITA", margin + logoWidth + 5, y + 7);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...grayText);
  doc.text("ABARROTES LA MANITA, S.A. DE C.V.", margin + logoWidth + 5, y + 13);

  // COTIZACIÓN badge (right)
  const badgeWidth = 45;
  const badgeHeight = 12;
  const badgeX = pageWidth - margin - badgeWidth;
  doc.setFillColor(...brandRed);
  doc.roundedRect(badgeX, y, badgeWidth, badgeHeight, 2, 2, "F");
  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("COTIZACIÓN", badgeX + badgeWidth / 2, y + 8, { align: "center" });

  // Folio and date below badge
  y += badgeHeight + 3;
  doc.setTextColor(...darkText);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Folio: `, pageWidth - margin - 45, y, { align: "left" });
  doc.setFont("helvetica", "bold");
  doc.text(datos.folio, pageWidth - margin - 35, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${fechaCreacion}`, pageWidth - margin, y, { align: "right" });

  y = 35;

  // Red separator line
  doc.setDrawColor(...brandRed);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);

  y += 8;

  // === TWO COLUMN INFO ===
  const colWidth = (pageWidth - margin * 2) / 2;

  // LEFT: Dirección Fiscal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...darkText);
  doc.text("Dirección Fiscal:", margin, y);
  
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...grayText);
  doc.text("Calle: MELCHOR OCAMPO No.Ext: 59", margin, y);
  y += 4;
  doc.text("Colonia: MAGDALENA MIXIUHCA", margin, y);
  y += 4;
  doc.text("Municipio: VENUSTIANO CARRANZA C.P.: 15850", margin, y);
  y += 4;
  doc.text("Tel: (55) 56-00-77-81 / (55) 56-94-97-92", margin, y);

  // RIGHT: Vigencia (at same starting Y as Dirección Fiscal)
  const rightX = margin + colWidth + 10;
  let rightY = 43;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...brandRed);
  doc.text("Vigencia de la cotización:", rightX, rightY);
  
  rightY += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...darkText);
  doc.text(fechaVigencia, rightX, rightY);

  if (datos.nombre) {
    rightY += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...grayText);
    const refText = `Referencia: ${datos.nombre}`;
    doc.text(refText.length > 45 ? refText.substring(0, 42) + "..." : refText, rightX, rightY);
  }

  y = Math.max(y, rightY) + 8;

  // === CLIENT BOX ===
  const clientBoxHeight = datos.sucursal ? 18 : 14;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, pageWidth - margin * 2, clientBoxHeight, 2, 2, "S");

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...darkText);
  doc.text("Cliente: ", margin + 4, y);
  doc.setFont("helvetica", "normal");
  doc.text(datos.cliente.nombre, margin + 20, y);
  
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Código: ", margin + 4, y);
  doc.setFont("helvetica", "normal");
  doc.text(datos.cliente.codigo, margin + 20, y);

  if (datos.sucursal) {
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Sucursal: ", margin + 4, y);
    doc.setFont("helvetica", "normal");
    doc.text(datos.sucursal.nombre, margin + 22, y);
  }

  y += clientBoxHeight - (datos.sucursal ? 7 : 2);

  // === PRODUCTS TABLE ===
  y += 8;

  // Column definitions
  const cols = soloPrecios
    ? {
        codigo: { x: margin, width: 30, label: "Código" },
        producto: { x: margin + 30, width: pageWidth - margin * 2 - 60, label: "Producto" },
        precio: { x: pageWidth - margin - 30, width: 30, label: "Precio", align: "right" as const }
      }
    : {
        codigo: { x: margin, width: 25, label: "Código" },
        producto: { x: margin + 25, width: pageWidth - margin * 2 - 105, label: "Producto" },
        cantidad: { x: pageWidth - margin - 80, width: 18, label: "Cant.", align: "center" as const },
        unidad: { x: pageWidth - margin - 62, width: 15, label: "Und." },
        precio: { x: pageWidth - margin - 47, width: 22, label: "Precio", align: "right" as const },
        subtotal: { x: pageWidth - margin - 25, width: 25, label: "Subtotal", align: "right" as const }
      };

  // Table header (dark)
  doc.setFillColor(...tableHeader);
  doc.rect(margin, y, pageWidth - margin * 2, 8, "F");

  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);

  Object.values(cols).forEach((col: any) => {
    const textX = col.align === "right" ? col.x + col.width - 3 : col.align === "center" ? col.x + col.width / 2 : col.x + 3;
    doc.text(col.label, textX, y + 5.5, { align: col.align || "left" });
  });

  y += 10;

  // Table rows
  doc.setTextColor(...darkText);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const rowHeight = 8;
  datos.productos.forEach((producto, index) => {
    // Check for page break
    if (y > pageHeight - 70) {
      doc.addPage();
      y = 20;
      
      // Redraw header
      doc.setFillColor(...tableHeader);
      doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
      doc.setTextColor(...white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      Object.values(cols).forEach((col: any) => {
        const textX = col.align === "right" ? col.x + col.width - 3 : col.align === "center" ? col.x + col.width / 2 : col.x + 3;
        doc.text(col.label, textX, y + 5.5, { align: col.align || "left" });
      });
      y += 10;
      doc.setTextColor(...darkText);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
    }

    // Alternating row background
    if (index % 2 === 1) {
      doc.setFillColor(...lightBg);
      doc.rect(margin, y - 3, pageWidth - margin * 2, rowHeight, "F");
    }

    // Row content
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...darkText);
    doc.text(producto.codigo || "-", cols.codigo.x + 3, y);

    // Product name with truncation
    const maxNombreWidth = cols.producto.width - 6;
    let nombreDisplay = producto.nombre;
    if (doc.getTextWidth(nombreDisplay) > maxNombreWidth) {
      while (doc.getTextWidth(nombreDisplay + "...") > maxNombreWidth && nombreDisplay.length > 0) {
        nombreDisplay = nombreDisplay.slice(0, -1);
      }
      nombreDisplay += "...";
    }
    doc.text(nombreDisplay, cols.producto.x + 3, y);

    if (soloPrecios) {
      doc.text(
        `$${producto.precio_unitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        cols.precio.x + cols.precio.width - 3,
        y,
        { align: "right" }
      );
    } else {
      const colsTyped = cols as any;
      doc.text(String(producto.cantidad), colsTyped.cantidad.x + colsTyped.cantidad.width / 2, y, { align: "center" });
      doc.text(producto.unidad, colsTyped.unidad.x + 3, y);
      doc.text(
        `$${producto.precio_unitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        colsTyped.precio.x + colsTyped.precio.width - 3,
        y,
        { align: "right" }
      );
      doc.text(
        `$${producto.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        colsTyped.subtotal.x + colsTyped.subtotal.width - 3,
        y,
        { align: "right" }
      );
    }

    // Row bottom line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.1);
    doc.line(margin, y + 4, pageWidth - margin, y + 4);

    y += rowHeight;
  });

  y += 5;

  // === TOTALS (if not solo precios) ===
  if (!soloPrecios) {
    const totalsWidth = 70;
    const totalsX = pageWidth - margin - totalsWidth;

    doc.setFontSize(9);
    doc.setTextColor(...darkText);
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", totalsX, y);
    doc.text(`$${datos.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, pageWidth - margin, y, { align: "right" });
    y += 5;

    doc.text("Impuestos:", totalsX, y);
    doc.text(`$${datos.impuestos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, pageWidth - margin, y, { align: "right" });
    y += 6;

    // Total box
    doc.setFillColor(...brandRed);
    doc.roundedRect(totalsX - 5, y - 4, totalsWidth + 5, 10, 2, 2, "F");
    doc.setTextColor(...white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("TOTAL:", totalsX, y + 2);
    doc.text(`$${datos.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, pageWidth - margin, y + 2, { align: "right" });

    y += 15;
  }

  // === TERMS AND CONDITIONS BOX ===
  if (y > pageHeight - 55) {
    doc.addPage();
    y = 20;
  }

  y += 5;
  const termsBoxHeight = 32;
  doc.setFillColor(...lightBg);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, pageWidth - margin * 2, termsBoxHeight, 2, 2, "FD");

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...darkText);
  doc.text("TÉRMINOS Y CONDICIONES", pageWidth / 2, y, { align: "center" });

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...grayText);

  const terms = [
    "• Los precios están expresados en pesos mexicanos (MXN).",
    "• Esta cotización tiene vigencia hasta la fecha indicada.",
    "• Los precios pueden variar sin previo aviso después de la fecha de vigencia.",
    "• Los tiempos de entrega se confirmarán al momento de realizar el pedido.",
    "• Los precios incluyen impuestos cuando aplique."
  ];

  terms.forEach(term => {
    doc.text(term, margin + 5, y);
    y += 4;
  });

  // === FOOTER ===
  y = pageHeight - 25;

  // Separator line
  doc.setDrawColor(...brandRed);
  doc.setLineWidth(0.5);
  doc.line(margin + 30, y, pageWidth - margin - 30, y);

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...darkText);
  doc.text("ABARROTES LA MANITA S.A. DE C.V.", pageWidth / 2, y, { align: "center" });

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...grayText);
  doc.text("Email: 1904@almasa.com.mx | Tel: (55) 56-00-77-81", pageWidth / 2, y, { align: "center" });

  y += 5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...brandRed);
  doc.text("Gracias por su preferencia", pageWidth / 2, y, { align: "center" });

  return doc.output("datauristring").split(",")[1];
};

export default generarCotizacionPDF;
