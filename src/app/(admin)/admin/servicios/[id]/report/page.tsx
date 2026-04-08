"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  generateServiceReportHTML,
  type ServiceReportData,
} from "@/lib/utils/generateServiceReport";

export default function ServiceReportPage() {
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ServiceReportData | null>(null);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function fetchReportData() {
      try {
        // ── Service request ──────────────────────────────────────────────────
        const { data: srData, error: srErr } = await supabase
          .from("service_requests")
          .select(
            "id, request_number, profiles!service_requests_client_id_fkey(full_name, phone), service_types!inner(name), addresses!inner(street, number, city, zone)"
          )
          .eq("id", id)
          .single();

        if (srErr) throw new Error("No se pudo cargar el servicio");

        const sr = srData as Record<string, unknown>;
        const profile = sr.profiles as { full_name: string; phone: string | null } | null;
        const st = sr.service_types as { name: string };
        const addr = sr.addresses as {
          street: string;
          number: string;
          city: string;
          zone: string;
        };

        const clientName = profile?.full_name ?? "Sin nombre";
        const clientPhone = profile?.phone ?? null;
        const address = `${addr.street} ${addr.number}, ${addr.city}`;
        const requestNumber = sr.request_number as number;
        const serviceType = st.name;

        // ── Quote ────────────────────────────────────────────────────────────
        const { data: quoteData } = await supabase
          .from("quotes")
          .select("total_cents")
          .eq("service_request_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const totalCents = quoteData
          ? (quoteData as { total_cents: number }).total_cents
          : null;

        // ── Assignment ───────────────────────────────────────────────────────
        const { data: assignData } = await supabase
          .from("assignments")
          .select(
            "id, scheduled_date, actual_start_at, actual_end_at, crews!inner(name)"
          )
          .eq("service_request_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let scheduledDate = "";
        let actualStartAt: string | null = null;
        let actualEndAt: string | null = null;
        let crewName = "Sin asignar";
        let assignmentId: string | null = null;
        let completionNotes: string | null = null;

        if (assignData) {
          const a = assignData as Record<string, unknown>;
          const crew = a.crews as { name: string };
          scheduledDate = a.scheduled_date as string;
          actualStartAt = (a.actual_start_at as string | null) ?? null;
          actualEndAt = (a.actual_end_at as string | null) ?? null;
          crewName = crew.name;
          assignmentId = a.id as string;
        }

        // ── Completion notes (from state log) ────────────────────────────────
        const { data: logData } = await supabase
          .from("service_state_log")
          .select("notes")
          .eq("service_request_id", id)
          .eq("to_status", "completed_by_crew")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (logData) {
          completionNotes = (logData as { notes: string | null }).notes;
        }

        // ── Photos ───────────────────────────────────────────────────────────
        const beforePhotoUrls: string[] = [];
        const afterPhotoUrls: string[] = [];

        if (assignmentId) {
          const { data: photosData } = await supabase
            .from("service_photos")
            .select("photo_type, storage_path")
            .eq("assignment_id", assignmentId)
            .in("photo_type", ["before", "after"]);

          if (photosData && photosData.length > 0) {
            for (const p of photosData as {
              photo_type: string;
              storage_path: string;
            }[]) {
              const { data: signed } = await supabase.storage
                .from("service-photos")
                .createSignedUrl(p.storage_path, 7200);

              if (signed?.signedUrl) {
                if (p.photo_type === "before") {
                  beforePhotoUrls.push(signed.signedUrl);
                } else if (p.photo_type === "after") {
                  afterPhotoUrls.push(signed.signedUrl);
                }
              }
            }
          }
        }

        // ── Review ───────────────────────────────────────────────────────────
        const { data: reviewData } = await supabase
          .from("reviews")
          .select("rating")
          .eq("service_request_id", id)
          .maybeSingle();

        const rating = reviewData
          ? (reviewData as { rating: number }).rating
          : null;

        setReportData({
          requestNumber,
          serviceType,
          clientName,
          clientPhone,
          address,
          scheduledDate,
          actualStartAt,
          actualEndAt,
          crewName,
          completionNotes,
          beforePhotoUrls,
          afterPhotoUrls,
          rating,
          totalCents,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al cargar el informe"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchReportData();
  }, [id]);

  const openReport = useCallback(() => {
    if (!reportData) return;
    const html = generateServiceReportHTML(reportData);
    const w = window.open("", "_blank");
    if (!w) {
      alert(
        "El navegador bloqueó la ventana emergente. Permitila para este sitio e intentá de nuevo."
      );
      return;
    }
    w.document.write(html);
    w.document.close();
    w.print();
    setGenerated(true);
  }, [reportData]);

  // Auto-open report once data is loaded
  useEffect(() => {
    if (reportData && !generated) {
      openReport();
    }
  }, [reportData, generated, openReport]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Preparando informe...</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-600 text-sm">{error}</p>
        <Link
          href={`/admin/servicios/${id}`}
          className="text-sm text-green-700 hover:underline flex items-center gap-1"
        >
          <ArrowLeft size={14} />
          Volver al servicio
        </Link>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto mt-16 text-center space-y-6">
      {/* Icon */}
      <div className="flex items-center justify-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
          <FileText size={32} className="text-green-700" />
        </div>
      </div>

      {/* Heading */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Informe generado</h1>
        <p className="text-sm text-gray-500 mt-1">
          El informe se abrió en una nueva ventana lista para imprimir o guardar
          como PDF.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={openReport}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Printer size={16} />
          Descargar PDF
        </button>
        <Link
          href={`/admin/servicios/${id}`}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
        >
          <ArrowLeft size={16} />
          Volver al servicio
        </Link>
      </div>

      <p className="text-xs text-gray-400">
        Si la ventana fue bloqueada, hacé clic en &quot;Descargar PDF&quot; para
        intentarlo de nuevo.
      </p>
    </div>
  );
}
