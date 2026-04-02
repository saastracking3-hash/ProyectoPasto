import { jsPDF } from "jspdf";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InvoiceCompany {
  name: string;
  address: string;
  phone: string;
  email: string;
  cuit: string;
}

export interface InvoiceClient {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number; // in cents
  total: number; // in cents
}

export interface InvoiceData {
  invoiceNumber: string;
  issuedAt: string; // ISO date string
  dueAt: string; // ISO date string
  company: InvoiceCompany;
  client: InvoiceClient;
  items: InvoiceItem[];
  subtotal: number; // in cents
  tax: number; // in cents (21% IVA)
  total: number; // in cents
  paymentMethod: string;
  notes?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const GREEN = "#2D6A4F";
const DARK = "#1B1B1B";
const GRAY = "#6B7280";
const LIGHT_GRAY = "#F3F4F6";
const WHITE = "#FFFFFF";

function formatPesos(cents: number): string {
  const pesos = cents / 100;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos);
}

function formatDateAR(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

// ── PDF Generation ─────────────────────────────────────────────────────────────

export function generateInvoicePDF(data: InvoiceData): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  let y = 20;

  // ── Header ─────────────────────────────────────────────────────────────────

  // Green accent bar
  doc.setFillColor(GREEN);
  doc.rect(0, 0, pageW, 4, "F");

  // Company name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(GREEN);
  doc.text(data.company.name, marginL, y);

  // "FACTURA" title on the right
  doc.setFontSize(20);
  doc.setTextColor(DARK);
  doc.text("FACTURA", pageW - marginR, y, { align: "right" });

  y += 8;

  // Company details under the name
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(GRAY);
  doc.text(data.company.address, marginL, y);
  y += 4;
  doc.text(
    `Tel: ${data.company.phone}  |  ${data.company.email}`,
    marginL,
    y
  );
  y += 4;
  doc.text(`CUIT: ${data.company.cuit}`, marginL, y);

  // Invoice meta on the right side
  const metaX = pageW - marginR;
  let metaY = y - 8;
  doc.setFontSize(9);
  doc.setTextColor(DARK);

  doc.setFont("helvetica", "bold");
  doc.text("N.:", metaX - 40, metaY);
  doc.setFont("helvetica", "normal");
  doc.text(data.invoiceNumber, metaX, metaY, { align: "right" });
  metaY += 5;

  doc.setFont("helvetica", "bold");
  doc.text("Fecha:", metaX - 40, metaY);
  doc.setFont("helvetica", "normal");
  doc.text(formatDateAR(data.issuedAt), metaX, metaY, { align: "right" });
  metaY += 5;

  doc.setFont("helvetica", "bold");
  doc.text("Vencimiento:", metaX - 40, metaY);
  doc.setFont("helvetica", "normal");
  doc.text(formatDateAR(data.dueAt), metaX, metaY, { align: "right" });

  y += 10;

  // Divider
  doc.setDrawColor(GREEN);
  doc.setLineWidth(0.5);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;

  // ── Client info box ────────────────────────────────────────────────────────

  doc.setFillColor(LIGHT_GRAY);
  doc.roundedRect(marginL, y, contentW, 28, 2, 2, "F");

  const clientX = marginL + 6;
  let clientY = y + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(GREEN);
  doc.text("CLIENTE", clientX, clientY);
  clientY += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(DARK);
  doc.text(data.client.name, clientX, clientY);
  clientY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(GRAY);
  doc.text(data.client.address, clientX, clientY);
  clientY += 4.5;
  doc.text(
    `Tel: ${data.client.phone}  |  ${data.client.email}`,
    clientX,
    clientY
  );

  y += 36;

  // ── Items table ────────────────────────────────────────────────────────────

  const colWidths = {
    desc: contentW * 0.5,
    qty: contentW * 0.12,
    price: contentW * 0.19,
    total: contentW * 0.19,
  };

  const colX = {
    desc: marginL,
    qty: marginL + colWidths.desc,
    price: marginL + colWidths.desc + colWidths.qty,
    total: marginL + colWidths.desc + colWidths.qty + colWidths.price,
  };

  // Table header
  doc.setFillColor(GREEN);
  doc.rect(marginL, y, contentW, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(WHITE);
  const headerY = y + 5.5;
  doc.text("Descripcion", colX.desc + 4, headerY);
  doc.text("Cant.", colX.qty + 4, headerY);
  doc.text("Precio Unit.", colX.price + 4, headerY);
  doc.text("Total", colX.total + 4, headerY);

  y += 8;

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  data.items.forEach((item, i) => {
    const rowH = 8;

    // Alternate row background
    if (i % 2 === 0) {
      doc.setFillColor(LIGHT_GRAY);
      doc.rect(marginL, y, contentW, rowH, "F");
    }

    const rowY = y + 5.5;
    doc.setTextColor(DARK);
    doc.text(item.description, colX.desc + 4, rowY);
    doc.text(String(item.quantity), colX.qty + 4, rowY);
    doc.text(formatPesos(item.unitPrice), colX.price + 4, rowY);
    doc.text(formatPesos(item.total), colX.total + 4, rowY);

    y += rowH;
  });

  // Bottom line of table
  doc.setDrawColor(GREEN);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, pageW - marginR, y);

  y += 6;

  // ── Totals ─────────────────────────────────────────────────────────────────

  const totalsX = colX.price + 4;
  const totalsValX = pageW - marginR - 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(GRAY);
  doc.text("Subtotal:", totalsX, y);
  doc.setTextColor(DARK);
  doc.text(formatPesos(data.subtotal), totalsValX, y, { align: "right" });
  y += 6;

  doc.setTextColor(GRAY);
  doc.text("IVA 21%:", totalsX, y);
  doc.setTextColor(DARK);
  doc.text(formatPesos(data.tax), totalsValX, y, { align: "right" });
  y += 7;

  // Total box
  doc.setFillColor(GREEN);
  doc.roundedRect(colX.price, y - 1, contentW - colWidths.desc - colWidths.qty, 10, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(WHITE);
  doc.text("TOTAL:", totalsX, y + 6);
  doc.text(formatPesos(data.total), totalsValX, y + 6, { align: "right" });

  y += 20;

  // ── Payment info ───────────────────────────────────────────────────────────

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(GREEN);
  doc.text("INFORMACION DE PAGO", marginL, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(DARK);
  doc.text(`Metodo de pago: ${data.paymentMethod}`, marginL, y);
  y += 5;

  if (data.notes) {
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(GREEN);
    doc.text("NOTAS", marginL, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(GRAY);
    const noteLines = doc.splitTextToSize(data.notes, contentW);
    doc.text(noteLines, marginL, y);
    y += noteLines.length * 4;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────

  const footerY = doc.internal.pageSize.getHeight() - 15;

  // Thin green line
  doc.setDrawColor(GREEN);
  doc.setLineWidth(0.3);
  doc.line(marginL, footerY - 4, pageW - marginR, footerY - 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(GRAY);
  doc.text(
    `${data.company.name}  |  ${data.company.address}  |  Tel: ${data.company.phone}  |  ${data.company.email}  |  CUIT: ${data.company.cuit}`,
    pageW / 2,
    footerY,
    { align: "center" }
  );

  // Bottom green accent bar
  doc.setFillColor(GREEN);
  doc.rect(0, doc.internal.pageSize.getHeight() - 4, pageW, 4, "F");

  return doc.output("blob");
}
