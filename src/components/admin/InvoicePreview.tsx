"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import Button from "@/components/ui/Button";
import {
  generateInvoicePDF,
  type InvoiceData,
} from "@/lib/utils/generateInvoicePDF";

interface InvoicePreviewProps {
  data: InvoiceData;
}

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

export default function InvoicePreview({ data }: InvoicePreviewProps) {
  const [downloading, setDownloading] = useState(false);

  function handlePrint() {
    window.print();
  }

  function handleDownload() {
    setDownloading(true);
    try {
      const blob = generateInvoicePDF(data);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `factura-${data.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error generando PDF:", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      {/* Print stylesheet */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-preview,
          #invoice-preview * {
            visibility: visible;
          }
          #invoice-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          #invoice-actions {
            display: none !important;
          }
        }
      `}</style>

      {/* Action buttons */}
      <div id="invoice-actions" className="flex gap-3 mb-6 print:hidden">
        <Button variant="primary" onClick={handleDownload} loading={downloading}>
          <Download className="h-4 w-4" />
          Descargar PDF
        </Button>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* Invoice HTML preview */}
      <div
        id="invoice-preview"
        className="bg-white border border-gray-200 rounded-lg shadow-sm max-w-[210mm] mx-auto"
        style={{ fontFamily: "Helvetica, Arial, sans-serif" }}
      >
        {/* Top accent bar */}
        <div className="h-1 bg-[#2D6A4F] rounded-t-lg" />

        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[#2D6A4F]">
                {data.company.name}
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                {data.company.address}
              </p>
              <p className="text-xs text-gray-500">
                Tel: {data.company.phone} | {data.company.email}
              </p>
              <p className="text-xs text-gray-500">
                CUIT: {data.company.cuit}
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-gray-900">FACTURA</h2>
              <table className="text-sm mt-2 ml-auto">
                <tbody>
                  <tr>
                    <td className="font-semibold text-gray-700 pr-3">N.:</td>
                    <td className="text-gray-900 text-right">
                      {data.invoiceNumber}
                    </td>
                  </tr>
                  <tr>
                    <td className="font-semibold text-gray-700 pr-3">
                      Fecha:
                    </td>
                    <td className="text-gray-900 text-right">
                      {formatDateAR(data.issuedAt)}
                    </td>
                  </tr>
                  <tr>
                    <td className="font-semibold text-gray-700 pr-3">
                      Vencimiento:
                    </td>
                    <td className="text-gray-900 text-right">
                      {formatDateAR(data.dueAt)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#2D6A4F] mb-6" />

          {/* Client box */}
          <div className="bg-gray-50 rounded-lg p-5 mb-6">
            <p className="text-xs font-bold text-[#2D6A4F] mb-1">CLIENTE</p>
            <p className="text-sm font-bold text-gray-900">
              {data.client.name}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {data.client.address}
            </p>
            <p className="text-xs text-gray-500">
              Tel: {data.client.phone}
              {data.client.email && ` | ${data.client.email}`}
            </p>
          </div>

          {/* Items table */}
          <table className="w-full mb-6 text-sm">
            <thead>
              <tr className="bg-[#2D6A4F] text-white">
                <th className="text-left py-2 px-3 rounded-tl font-semibold">
                  Descripcion
                </th>
                <th className="text-left py-2 px-3 font-semibold w-16">
                  Cant.
                </th>
                <th className="text-left py-2 px-3 font-semibold w-28">
                  Precio Unit.
                </th>
                <th className="text-right py-2 px-3 rounded-tr font-semibold w-28">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}
                >
                  <td className="py-2 px-3 text-gray-900">
                    {item.description}
                  </td>
                  <td className="py-2 px-3 text-gray-900">{item.quantity}</td>
                  <td className="py-2 px-3 text-gray-900">
                    {formatPesos(item.unitPrice)}
                  </td>
                  <td className="py-2 px-3 text-gray-900 text-right">
                    {formatPesos(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-64">
              <div className="flex justify-between py-1.5 text-sm">
                <span className="text-gray-500">Subtotal:</span>
                <span className="text-gray-900">
                  {formatPesos(data.subtotal)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 text-sm">
                <span className="text-gray-500">IVA 21%:</span>
                <span className="text-gray-900">{formatPesos(data.tax)}</span>
              </div>
              <div className="flex justify-between py-2.5 px-3 mt-2 bg-[#2D6A4F] text-white rounded-lg font-bold text-base">
                <span>TOTAL:</span>
                <span>{formatPesos(data.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment info */}
          <div className="mb-4">
            <p className="text-xs font-bold text-[#2D6A4F] mb-1">
              INFORMACION DE PAGO
            </p>
            <p className="text-sm text-gray-900">
              Metodo de pago: {data.paymentMethod}
            </p>
          </div>

          {/* Notes */}
          {data.notes && (
            <div className="mb-4">
              <p className="text-xs font-bold text-[#2D6A4F] mb-1">NOTAS</p>
              <p className="text-sm text-gray-500 whitespace-pre-line">
                {data.notes}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4 mt-8">
            <p className="text-center text-[10px] text-gray-400">
              {data.company.name} | {data.company.address} | Tel:{" "}
              {data.company.phone} | {data.company.email} | CUIT:{" "}
              {data.company.cuit}
            </p>
          </div>
        </div>

        {/* Bottom accent bar */}
        <div className="h-1 bg-[#2D6A4F] rounded-b-lg" />
      </div>
    </>
  );
}
