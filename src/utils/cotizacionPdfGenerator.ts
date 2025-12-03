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
  iva: number;
  ieps: number;
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

// Helper to load image as base64
const loadImageAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generarCotizacionPDF = async (datos: DatosCotizacion): Promise<string> => {
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
  // Load and add ALMASA Logo (left)
  const logoWidth = 40;
  const logoHeight = 12;
  try {
    const logoBase64 = await loadImageAsBase64('/logo-almasa-pdf.png');
    doc.addImage(logoBase64, 'PNG', margin, y, logoWidth, logoHeight);
  } catch (e) {
    // Fallback: draw text if image fails
    doc.setTextColor(...brandRed);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("ALMASA", margin, y + 8);
  }

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

    doc.text("IVA (16%):", totalsX, y);
    doc.text(`$${datos.iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, pageWidth - margin, y, { align: "right" });
    y += 5;

    if (datos.ieps > 0) {
      doc.text("IEPS (8%):", totalsX, y);
      doc.text(`$${datos.ieps.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, pageWidth - margin, y, { align: "right" });
      y += 5;
    }

    y += 1;

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
