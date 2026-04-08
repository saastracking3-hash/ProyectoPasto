// ── Types ──────────────────────────────────────────────────────────────────────

export interface ServiceReportData {
  requestNumber: number;
  serviceType: string;
  clientName: string;
  clientPhone: string | null;
  address: string;
  scheduledDate: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
  crewName: string;
  completionNotes: string | null;
  beforePhotoUrls: string[];
  afterPhotoUrls: string[];
  rating: number | null;
  totalCents: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDateAR(isoDate: string): string {
  try {
    // For date-only strings (YYYY-MM-DD), parse without timezone conversion
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      const [year, month, day] = isoDate.split("-").map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
    const d = new Date(isoDate);
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoDate;
  }
}

function formatPesos(cents: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function renderStars(rating: number): string {
  return Array.from({ length: 5 }, (_, i) =>
    `<span style="color:${i < rating ? "#F59E0B" : "#D1D5DB"};">★</span>`
  ).join("");
}

function renderPhotoGrid(urls: string[], label: string): string {
  if (urls.length === 0) return "";
  const items = urls
    .map(
      (url) =>
        `<div class="photo-item">
          <img src="${url}" alt="${label}" />
        </div>`
    )
    .join("");
  return `
    <div class="section-title">${label}</div>
    <div class="photo-grid">${items}</div>
  `;
}

// ── HTML Report ────────────────────────────────────────────────────────────────

export function generateServiceReportHTML(data: ServiceReportData): string {
  const generatedDate = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasPhotos = data.beforePhotoUrls.length > 0 || data.afterPhotoUrls.length > 0;

  const photosSection = hasPhotos
    ? `
    <div class="block">
      <h2 class="block-title">Registro fotografico</h2>
      ${renderPhotoGrid(data.beforePhotoUrls, "Antes del servicio")}
      ${renderPhotoGrid(data.afterPhotoUrls, "Despues del servicio")}
    </div>
    `
    : "";

  const ratingSection = data.rating !== null
    ? `
    <div class="info-row">
      <span class="info-label">Calificacion del cliente</span>
      <span class="info-value">${renderStars(data.rating)} (${data.rating}/5)</span>
    </div>
    `
    : "";

  const totalSection = data.totalCents !== null
    ? `
    <div class="info-row">
      <span class="info-label">Total facturado</span>
      <span class="info-value total-value">${formatPesos(data.totalCents)}</span>
    </div>
    `
    : "";

  const notesSection = data.completionNotes
    ? `<p class="notes-text">${data.completionNotes.replace(/\n/g, "<br/>")}</p>`
    : `<p class="notes-empty">Sin notas de finalizacion registradas.</p>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Informe de Servicio #${data.requestNumber} - The Green Side</title>
  <style>
    /* ── Reset & Base ──────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: #1F2937;
      background: #fff;
      padding: 32px 40px;
      max-width: 900px;
      margin: 0 auto;
    }

    /* ── Header ────────────────────────────────────────── */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-bottom: 20px;
      border-bottom: 3px solid #2D6A4F;
      margin-bottom: 24px;
    }

    .company-logo {
      font-size: 22px;
      font-weight: 700;
      color: #2D6A4F;
      letter-spacing: -0.3px;
    }

    .report-meta {
      text-align: right;
    }

    .report-title {
      font-size: 18px;
      font-weight: 700;
      color: #1F2937;
    }

    .report-date {
      font-size: 11px;
      color: #6B7280;
      margin-top: 2px;
    }

    /* ── Two-column info table ─────────────────────────── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 24px;
    }

    .info-col {
      padding: 0;
    }

    .info-col-title {
      background: #2D6A4F;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 8px 14px;
    }

    .info-col:first-child {
      border-right: 1px solid #E5E7EB;
    }

    .info-row {
      display: flex;
      flex-direction: column;
      padding: 8px 14px;
      border-bottom: 1px solid #F3F4F6;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-label {
      font-size: 10px;
      font-weight: 600;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
    }

    .info-value {
      font-size: 13px;
      color: #1F2937;
      font-weight: 500;
    }

    .total-value {
      font-weight: 700;
      color: #2D6A4F;
      font-size: 15px;
    }

    /* ── Content blocks ────────────────────────────────── */
    .block {
      margin-bottom: 24px;
    }

    .block-title {
      font-size: 13px;
      font-weight: 700;
      color: #2D6A4F;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding-bottom: 6px;
      border-bottom: 1px solid #D1FAE5;
      margin-bottom: 12px;
    }

    /* ── Notes ─────────────────────────────────────────── */
    .notes-text {
      background: #F9FAFB;
      border-left: 3px solid #2D6A4F;
      padding: 10px 14px;
      border-radius: 0 6px 6px 0;
      font-size: 13px;
      color: #374151;
      white-space: pre-wrap;
    }

    .notes-empty {
      color: #9CA3AF;
      font-style: italic;
      font-size: 12px;
    }

    /* ── Summary rows ──────────────────────────────────── */
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #F3F4F6;
      font-size: 13px;
    }

    .summary-row:last-child { border-bottom: none; }

    .summary-label { color: #6B7280; }
    .summary-value { font-weight: 500; color: #1F2937; }

    /* ── Photo grid ────────────────────────────────────── */
    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
      margin-top: 12px;
    }

    .photo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 8px;
    }

    .photo-item img {
      width: 100%;
      aspect-ratio: 4/3;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid #E5E7EB;
      display: block;
    }

    /* ── Footer ────────────────────────────────────────── */
    .footer {
      margin-top: 32px;
      padding-top: 14px;
      border-top: 1px solid #E5E7EB;
      text-align: center;
      font-size: 10px;
      color: #9CA3AF;
    }

    /* ── Print ─────────────────────────────────────────── */
    @media print {
      body {
        margin: 0;
        padding: 20px 28px;
        font-size: 11px;
      }

      .photo-grid {
        grid-template-columns: repeat(2, 1fr);
        break-inside: avoid;
      }

      .photo-item {
        break-inside: avoid;
      }

      .block {
        break-inside: avoid;
      }

      .info-grid {
        break-inside: avoid;
      }

      .header {
        break-after: avoid;
      }

      @page {
        margin: 15mm 15mm;
        size: A4;
      }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="company-logo">🌿 THE GREEN SIDE</div>
    <div class="report-meta">
      <div class="report-title">Informe de Servicio #${data.requestNumber}</div>
      <div class="report-date">Generado el ${generatedDate}</div>
    </div>
  </div>

  <!-- Client & Service Info Grid -->
  <div class="info-grid">
    <!-- Left: Client info -->
    <div class="info-col">
      <div class="info-col-title">Informacion del cliente</div>
      <div class="info-row">
        <span class="info-label">Nombre</span>
        <span class="info-value">${data.clientName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Telefono</span>
        <span class="info-value">${data.clientPhone ?? "No registrado"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Direccion</span>
        <span class="info-value">${data.address}</span>
      </div>
    </div>
    <!-- Right: Service info -->
    <div class="info-col">
      <div class="info-col-title">Informacion del servicio</div>
      <div class="info-row">
        <span class="info-label">Tipo de servicio</span>
        <span class="info-value">${data.serviceType}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Fecha programada</span>
        <span class="info-value">${formatDateAR(data.scheduledDate)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Inicio real</span>
        <span class="info-value">${data.actualStartAt ? formatDateAR(data.actualStartAt) : "—"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Fin real</span>
        <span class="info-value">${data.actualEndAt ? formatDateAR(data.actualEndAt) : "—"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Cuadrilla</span>
        <span class="info-value">${data.crewName}</span>
      </div>
      ${totalSection}
      ${ratingSection}
    </div>
  </div>

  <!-- Work notes -->
  <div class="block">
    <h2 class="block-title">Trabajo realizado</h2>
    ${notesSection}
  </div>

  <!-- Photos -->
  ${photosSection}

  <!-- Footer -->
  <div class="footer">
    Generado automaticamente por The Green Side &mdash; Sistema de gestion de servicios
  </div>

</body>
</html>`;
}
