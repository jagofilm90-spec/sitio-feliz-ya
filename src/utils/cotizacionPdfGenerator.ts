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

  // Professional color palette - Almasa brand colors
  const brandRed: [number, number, number] = [139, 35, 50]; // Almasa burgundy/maroon
  const accentGold: [number, number, number] = [180, 142, 58]; // Elegant gold
  const darkText: [number, number, number] = [33, 37, 41];
  const mediumGray: [number, number, number] = [108, 117, 125];
  const lightGray: [number, number, number] = [233, 236, 239];
  const white: [number, number, number] = [255, 255, 255];

  // === HEADER SECTION ===
  // Top accent line
  doc.setFillColor(...brandRed);
  doc.rect(0, 0, pageWidth, 3, "F");

  // Gold accent line
  doc.setFillColor(...accentGold);
  doc.rect(0, 3, pageWidth, 1.5, "F");

  y = 15;

  // Company name - elegant typography
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...brandRed);
  doc.text("ABARROTES LA MANITA", margin, y);
  
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...mediumGray);
  doc.text("S.A. DE C.V.", margin, y);

  // Cotización badge - more elegant
  const badgeWidth = 50;
  const badgeHeight = 18;
  const badgeX = pageWidth - margin - badgeWidth;
  const badgeY = 10;

  // Badge background
  doc.setFillColor(...brandRed);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2, 2, "F");
  
  // Badge text
  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("COTIZACIÓN", badgeX + badgeWidth / 2, badgeY + 7, { align: "center" });
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(datos.folio, badgeX + badgeWidth / 2, badgeY + 13, { align: "center" });

  // Date below badge
  doc.setTextColor(...darkText);
  doc.setFontSize(8);
  doc.text(fechaCreacion, pageWidth - margin, badgeY + badgeHeight + 5, { align: "right" });

  y = 35;

  // Elegant separator line
  doc.setDrawColor(...accentGold);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 8;

  // === TWO COLUMN INFO SECTION ===
  const colWidth = (pageWidth - margin * 2 - 10) / 2;

  // LEFT COLUMN - Company info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...brandRed);
  doc.text("INFORMACIÓN DE CONTACTO", margin, y);
  
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...darkText);
  
  const companyInfo = [
    "Calle Melchor Ocampo No. 59",
    "Col. Magdalena Mixiuhca",
    "Venustiano Carranza, C.P. 15850",
    "Ciudad de México",
    "",
    "Tel: (55) 5600-7781 / 5694-9792",
    "Email: 1904@almasa.com.mx"
  ];
  
  companyInfo.forEach(line => {
    if (line === "") {
      y += 2;
    } else {
      doc.text(line, margin, y);
      y += 3.5;
    }
  });

  // RIGHT COLUMN - Vigencia (highlighted)
  const rightColX = margin + colWidth + 10;
  let rightY = 43;

  // Vigencia box with elegant styling
  doc.setFillColor(250, 248, 245);
  doc.setDrawColor(...accentGold);
  doc.setLineWidth(0.8);
  doc.roundedRect(rightColX, rightY, colWidth, 22, 3, 3, "FD");

  rightY += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...brandRed);
  doc.text("VIGENCIA DE COTIZACIÓN", rightColX + colWidth / 2, rightY, { align: "center" });

  rightY += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...accentGold);
  doc.text(fechaVigencia, rightColX + colWidth / 2, rightY, { align: "center" });

  if (datos.nombre) {
    rightY += 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...mediumGray);
    const refText = `Ref: ${datos.nombre}`;
    const truncatedRef = refText.length > 40 ? refText.substring(0, 37) + "..." : refText;
    doc.text(truncatedRef, rightColX + colWidth / 2, rightY, { align: "center" });
  }

  y = Math.max(y, 68) + 5;

  // === CLIENT INFO BOX ===
  const clientBoxHeight = datos.sucursal ? 20 : 14;
  
  doc.setFillColor(...lightGray);
  doc.setDrawColor(...brandRed);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, pageWidth - margin * 2, clientBoxHeight, 2, 2, "FD");

  y += 5;
  const clientCol1 = margin + 4;
  const clientCol2 = pageWidth / 2 + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...brandRed);
  doc.text("CLIENTE", clientCol1, y);

  doc.setTextColor(...darkText);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const clienteName = datos.cliente.nombre.length > 35 
    ? datos.cliente.nombre.substring(0, 32) + "..." 
    : datos.cliente.nombre;
  doc.text(clienteName, clientCol1 + 18, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...brandRed);
  doc.text("CÓDIGO", clientCol2, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkText);
  doc.text(datos.cliente.codigo, clientCol2 + 18, y);

  if (datos.sucursal) {
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...brandRed);
    doc.text("SUCURSAL", clientCol1, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkText);
    doc.setFontSize(8);
    const sucursalName = datos.sucursal.nombre.length > 30 
      ? datos.sucursal.nombre.substring(0, 27) + "..." 
      : datos.sucursal.nombre;
    doc.text(sucursalName, clientCol1 + 20, y);

    if (datos.sucursal.direccion) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...brandRed);
      doc.text("DIRECCIÓN", clientCol2, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...darkText);
      const maxDirWidth = pageWidth - margin - clientCol2 - 25;
      const direccionLines = doc.splitTextToSize(datos.sucursal.direccion, maxDirWidth);
      doc.text(direccionLines[0], clientCol2 + 22, y);
    }
  }

  y += clientBoxHeight - 3;

  // === PRODUCTS TABLE ===
  y += 8;
  const tableStartY = y;

  // Column definitions
  const cols = soloPrecios
    ? {
        codigo: { x: margin, width: 28, label: "CÓDIGO" },
        producto: { x: margin + 28, width: pageWidth - margin * 2 - 58, label: "PRODUCTO" },
        precio: { x: pageWidth - margin - 30, width: 30, label: "PRECIO", align: "right" as const }
      }
    : {
        codigo: { x: margin, width: 24, label: "CÓDIGO" },
        producto: { x: margin + 24, width: pageWidth - margin * 2 - 104, label: "PRODUCTO" },
        cantidad: { x: pageWidth - margin - 80, width: 18, label: "CANT.", align: "center" as const },
        unidad: { x: pageWidth - margin - 62, width: 16, label: "UND." },
        precio: { x: pageWidth - margin - 46, width: 22, label: "PRECIO", align: "right" as const },
        subtotal: { x: pageWidth - margin - 24, width: 24, label: "SUBTOTAL", align: "right" as const }
      };

  // Table header
  doc.setFillColor(...brandRed);
  doc.rect(margin, y, pageWidth - margin * 2, 8, "F");

  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);

  Object.values(cols).forEach((col: any) => {
    const textX = col.align === "right" ? col.x + col.width - 2 : col.align === "center" ? col.x + col.width / 2 : col.x + 2;
    doc.text(col.label, textX, y + 5.5, { align: col.align || "left" });
  });

  y += 10;

  // Table rows
  doc.setTextColor(...darkText);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  const rowHeight = 7;
  datos.productos.forEach((producto, index) => {
    // Check for page break
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
      
      // Redraw header on new page
      doc.setFillColor(...brandRed);
      doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
      doc.setTextColor(...white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      Object.values(cols).forEach((col: any) => {
        const textX = col.align === "right" ? col.x + col.width - 2 : col.align === "center" ? col.x + col.width / 2 : col.x + 2;
        doc.text(col.label, textX, y + 5.5, { align: col.align || "left" });
      });
      y += 10;
      doc.setTextColor(...darkText);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
    }

    // Alternating row background
    if (index % 2 === 0) {
      doc.setFillColor(252, 252, 253);
      doc.rect(margin, y - 3, pageWidth - margin * 2, rowHeight, "F");
    }

    // Row content
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.text(producto.codigo || "-", cols.codigo.x + 2, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const maxNombreWidth = cols.producto.width - 4;
    let nombreDisplay = producto.nombre;
    if (doc.getTextWidth(nombreDisplay) > maxNombreWidth) {
      while (doc.getTextWidth(nombreDisplay + "...") > maxNombreWidth && nombreDisplay.length > 0) {
        nombreDisplay = nombreDisplay.slice(0, -1);
      }
      nombreDisplay += "...";
    }
    doc.text(nombreDisplay, cols.producto.x + 2, y);

    // Add max quantity and notes if present
    if (producto.cantidad_maxima || producto.nota_linea) {
      doc.setFontSize(6);
      doc.setTextColor(...accentGold);
      let noteText = "";
      if (producto.cantidad_maxima) {
        noteText += `Máx: ${producto.cantidad_maxima.toLocaleString()} ${producto.unidad}`;
      }
      if (producto.cantidad_maxima && producto.nota_linea) noteText += " • ";
      if (producto.nota_linea) {
        const notaTruncada = producto.nota_linea.length > 30 
          ? producto.nota_linea.substring(0, 27) + "..." 
          : producto.nota_linea;
        noteText += notaTruncada;
      }
      doc.text(noteText, cols.producto.x + 2, y + 3);
      doc.setTextColor(...darkText);
      doc.setFontSize(7.5);
    }

    if (soloPrecios) {
      doc.text(
        `$${producto.precio_unitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        cols.precio.x + cols.precio.width - 2,
        y,
        { align: "right" }
      );
    } else {
      const colsTyped = cols as any;
      doc.text(String(producto.cantidad), colsTyped.cantidad.x + colsTyped.cantidad.width / 2, y, { align: "center" });
      doc.text(producto.unidad, colsTyped.unidad.x + 2, y);
      doc.text(
        `$${producto.precio_unitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        colsTyped.precio.x + colsTyped.precio.width - 2,
        y,
        { align: "right" }
      );
      doc.text(
        `$${producto.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        colsTyped.subtotal.x + colsTyped.subtotal.width - 2,
        y,
        { align: "right" }
      );
    }

    // Bottom border for row
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.1);
    doc.line(margin, y + 3, pageWidth - margin, y + 3);

    y += rowHeight;
  });

  y += 5;

  // === TOTALS SECTION (if not solo precios) ===
  if (!soloPrecios) {
    const totalsWidth = 70;
    const totalsX = pageWidth - margin - totalsWidth;

    // Subtotal
    doc.setFontSize(8);
    doc.setTextColor(...darkText);
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", totalsX, y);
    doc.text(`$${datos.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, pageWidth - margin, y, { align: "right" });
    y += 5;

    // Impuestos
    doc.text("Impuestos:", totalsX, y);
    doc.text(`$${datos.impuestos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, pageWidth - margin, y, { align: "right" });
    y += 6;

    // Total with elegant styling
    doc.setFillColor(...brandRed);
    doc.roundedRect(totalsX - 5, y - 4, totalsWidth + 5, 10, 2, 2, "F");
    doc.setTextColor(...white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("TOTAL:", totalsX, y + 2);
    doc.text(`$${datos.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, pageWidth - margin, y + 2, { align: "right" });

    y += 15;
  }

  // === NOTES SECTION ===
  if (notasLimpias) {
    doc.setDrawColor(...accentGold);
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 252, 245);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 16, 2, 2, "FD");

    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...brandRed);
    doc.text("OBSERVACIONES:", margin + 4, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkText);
    doc.setFontSize(7);
    const notasLines = doc.splitTextToSize(notasLimpias, pageWidth - margin * 2 - 10);
    doc.text(notasLines.slice(0, 2), margin + 4, y + 4);

    y += 16;
  }

  // === TERMS AND CONDITIONS ===
  if (y > pageHeight - 50) {
    doc.addPage();
    y = 20;
  }

  y += 3;
  doc.setDrawColor(...mediumGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 2, 2, "S");

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...brandRed);
  doc.text("TÉRMINOS Y CONDICIONES", pageWidth / 2, y, { align: "center" });

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...mediumGray);

  const terms = [
    "• Los precios están expresados en pesos mexicanos (MXN) e incluyen impuestos cuando aplique.",
    "• Esta cotización tiene vigencia hasta la fecha indicada. Los precios pueden variar después de dicha fecha.",
    "• Los tiempos de entrega se confirmarán al momento de realizar el pedido.",
    "• Para hacer válida esta cotización, favor de enviar confirmación por escrito.",
    "• Sujeto a disponibilidad de existencias al momento de la confirmación del pedido."
  ];

  terms.forEach(term => {
    doc.text(term, margin + 4, y);
    y += 3.8;
  });

  // === FOOTER ===
  y = pageHeight - 18;

  // Footer line
  doc.setDrawColor(...accentGold);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...brandRed);
  doc.text("ABARROTES LA MANITA S.A. DE C.V.", pageWidth / 2, y, { align: "center" });

  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...mediumGray);
  doc.text("Tel: (55) 5600-7781  •  Email: 1904@almasa.com.mx  •  www.almasa.com.mx", pageWidth / 2, y, { align: "center" });

  y += 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...accentGold);
  doc.text("Gracias por su preferencia", pageWidth / 2, y, { align: "center" });

  // Return base64 PDF
  return doc.output("datauristring").split(",")[1];
};

export default generarCotizacionPDF;
