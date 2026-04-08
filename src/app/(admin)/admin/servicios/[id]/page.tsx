"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  MapPin,
  Phone,
  FileText,
  Users,
  Clock,
  ImageIcon,
  Star,
  CheckSquare,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Copy,
  Check,
  CalendarPlus,
  Printer,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { getNextStatuses, canTransition } from "@/lib/services/state-machine";
import { SERVICE_STATUS_LABELS } from "@/lib/types";
import type { ServiceStatus } from "@/lib/types";

interface ServiceDetail {
  id: string;
  client_id: string;
  request_number: number;
  status: ServiceStatus;
  urgency: string;
  created_at: string;
  description: string | null;
  client: { full_name: string; phone: string | null };
  address: { street: string; number: string; city: string; zone: string };
  service_type: string;
}

interface QuoteInfo {
  id: string;
  total_cents: number;
  status: string;
  approved_at: string | null;
}

interface AssignmentInfo {
  id: string;
  crew_name: string;
  leader_name: string | null;
  scheduled_date: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
}

interface ChecklistItemInfo {
  id: string;
  description: string;
  is_completed: boolean;
}

interface PhotoInfo {
  id: string;
  photo_type: string;
  url: string;
}

interface ReviewInfo {
  rating: number;
  punctuality_rating: number | null;
  quality_rating: number | null;
  comment: string | null;
}

interface TimelineEntry {
  id: string;
  to_status: ServiceStatus;
  created_at: string;
  changed_by_name: string;
  notes: string | null;
}

export default function ServicioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [quote, setQuote] = useState<QuoteInfo | null>(null);
  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItemInfo[]>([]);
  const [photos, setPhotos] = useState<PhotoInfo[]>([]);
  const [review, setReview] = useState<ReviewInfo | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError("No autenticado"); setLoading(false); return; }

        // Fetch service request
        const { data: srData, error: srErr } = await supabase
          .from("service_requests")
          .select(
            "id, client_id, request_number, status, urgency, created_at, description, profiles!service_requests_client_id_fkey(full_name, phone), service_types!inner(name), addresses!inner(street, number, city, zone)"
          )
          .eq("id", id)
          .single();

        if (srErr) throw srErr;

        const sr = srData as Record<string, unknown>;
        const profile = sr.profiles as { full_name: string; phone: string | null } | null;
        const st = sr.service_types as { name: string };
        const addr = sr.addresses as { street: string; number: string; city: string; zone: string };

        setService({
          id: sr.id as string,
          client_id: sr.client_id as string,
          request_number: sr.request_number as number,
          status: sr.status as ServiceStatus,
          urgency: sr.urgency as string,
          created_at: sr.created_at as string,
          description: sr.description as string | null,
          client: { full_name: profile?.full_name ?? "Sin nombre", phone: profile?.phone ?? null },
          address: addr,
          service_type: st.name,
        });

        // Fetch quote
        const { data: quoteData } = await supabase
          .from("quotes")
          .select("id, total_cents, status, approved_at")
          .eq("service_request_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (quoteData) {
          setQuote(quoteData as QuoteInfo);
        }

        // Fetch assignment
        const { data: assignData } = await supabase
          .from("assignments")
          .select(
            "id, scheduled_date, scheduled_start_time, scheduled_end_time, actual_start_at, actual_end_at, crews!inner(name, leader_id, profiles!crews_leader_id_fkey(full_name))"
          )
          .eq("service_request_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (assignData) {
          const a = assignData as Record<string, unknown>;
          const crew = a.crews as Record<string, unknown>;
          const leaderProfile = crew.profiles as { full_name: string } | null;
          setAssignment({
            id: a.id as string,
            crew_name: crew.name as string,
            leader_name: leaderProfile?.full_name ?? null,
            scheduled_date: a.scheduled_date as string,
            scheduled_start_time: a.scheduled_start_time as string | null,
            scheduled_end_time: a.scheduled_end_time as string | null,
            actual_start_at: a.actual_start_at as string | null,
            actual_end_at: a.actual_end_at as string | null,
          });

          // Fetch checklist for this assignment
          const { data: checklistData } = await supabase
            .from("checklists")
            .select("id")
            .eq("assignment_id", a.id as string)
            .maybeSingle();

          if (checklistData) {
            const { data: items } = await supabase
              .from("checklist_items")
              .select("id, description, is_completed")
              .eq("checklist_id", (checklistData as { id: string }).id)
              .order("sort_order", { ascending: true });

            setChecklistItems(
              (items || []).map((i: Record<string, unknown>) => ({
                id: i.id as string,
                description: i.description as string,
                is_completed: i.is_completed as boolean,
              }))
            );
          }

          // Fetch photos
          const { data: photosData } = await supabase
            .from("service_photos")
            .select("id, photo_type, storage_path")
            .eq("assignment_id", a.id as string);

          if (photosData && photosData.length > 0) {
            const photoItems: PhotoInfo[] = [];
            for (const p of photosData as { id: string; photo_type: string; storage_path: string }[]) {
              const { data: signedUrl } = await supabase.storage
                .from("service-photos")
                .createSignedUrl(p.storage_path, 3600);
              photoItems.push({
                id: p.id,
                photo_type: p.photo_type,
                url: signedUrl?.signedUrl ?? "",
              });
            }
            setPhotos(photoItems);
          }
        }

        // Fetch review
        const { data: reviewData } = await supabase
          .from("reviews")
          .select("rating, punctuality_rating, quality_rating, comment")
          .eq("service_request_id", id)
          .maybeSingle();

        if (reviewData) {
          setReview(reviewData as ReviewInfo);
        }

        // Fetch timeline
        const { data: tlData } = await supabase
          .from("service_state_log")
          .select(
            "id, to_status, created_at, notes, profiles!service_state_log_changed_by_fkey(full_name)"
          )
          .eq("service_request_id", id)
          .order("created_at", { ascending: true });

        setTimeline(
          (tlData || []).map((row: Record<string, unknown>) => {
            const p = row.profiles as { full_name: string } | null;
            return {
              id: row.id as string,
              to_status: row.to_status as ServiceStatus,
              created_at: row.created_at as string,
              changed_by_name: p?.full_name ?? "Sistema",
              notes: row.notes as string | null,
            };
          })
        );
      } catch {
        setError("Error al cargar el servicio");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const handleTransition = async (newStatus: ServiceStatus) => {
    if (!service) return;
    setTransitioning(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setTransitioning(false); return; }

    const { error: upErr } = await supabase
      .from("service_requests")
      .update({ status: newStatus })
      .eq("id", service.id);

    if (upErr) {
      setError("Error al cambiar estado");
      setTransitioning(false);
      return;
    }

    await supabase.from("service_state_log").insert({
      service_request_id: service.id,
      from_status: service.status,
      to_status: newStatus,
      changed_by: user.id,
    });

    setService({ ...service, status: newStatus });
    setTimeline([
      ...timeline,
      {
        id: crypto.randomUUID(),
        to_status: newStatus,
        created_at: new Date().toISOString(),
        changed_by_name: "Yo",
        notes: null,
      },
    ]);
    setTransitioning(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-1/3" />
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-full" />
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 animate-pulse rounded w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !service) {
    return <div className="p-8 text-center text-red-600"><p>{error}</p></div>;
  }

  if (!service) return null;

  const nextStatuses = getNextStatuses(service.status, "admin");
  const completedChecklist = checklistItems.filter((c) => c.is_completed).length;
  const totalChecklist = checklistItems.length;

  const photosByType = (type: string) => photos.filter((p) => p.photo_type === type);
  const typeLabels: Record<string, string> = { before: "Antes", during: "Durante", after: "Despues" };

  // Feature 1: Suggested next visit date (+30 days from scheduled date or created_at)
  const showNextVisit = (["completed_by_crew", "validated", "closed"] as ServiceStatus[]).includes(service.status);
  const suggestedNextDate = (() => {
    const baseDate = assignment?.scheduled_date
      ? new Date(assignment.scheduled_date + "T12:00:00")
      : new Date(service.created_at);
    baseDate.setDate(baseDate.getDate() + 30);
    return baseDate;
  })();
  const suggestedDateParam = suggestedNextDate.toISOString().split("T")[0];
  const suggestedDateLabel = suggestedNextDate.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Feature 2: WhatsApp link
  const whatsappHref = service.client.phone
    ? `https://wa.me/54${service.client.phone.replace(/\D/g, "")}?text=Hola%20${encodeURIComponent(service.client.full_name)}%2C%20te%20contactamos%20desde%20The%20Green%20Side%20sobre%20tu%20servicio%20%23${service.request_number}`
    : null;

  // Copy link handler
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/servicios"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Servicio #{service.request_number}
              </h1>
              <StatusBadge status={service.status} size="md" />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {service.service_type} - Creado el {formatDate(service.created_at)}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleCopyLink}
            title="Copiar link del servicio"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copiedLink ? (
              <>
                <Check size={15} className="text-green-600" />
                <span className="text-green-600">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy size={15} />
                Copiar link
              </>
            )}
          </button>
          {nextStatuses.map((ns) => {
            const isValidate = ns === "validated";
            const isClose = ns === "closed";
            const isCancel = ns === "cancelled";
            return (
              <Button
                key={ns}
                variant={isCancel ? "danger" : isValidate || isClose ? "primary" : "secondary"}
                onClick={() => handleTransition(ns)}
                loading={transitioning}
              >
                {isValidate && <CheckCircle2 size={16} />}
                {isCancel && <XCircle size={16} />}
                {SERVICE_STATUS_LABELS[ns]}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client */}
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                  <User size={20} className="text-green-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{service.client.full_name}</p>
                  <p className="text-xs text-gray-500">Cliente</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Phone size={20} className="text-blue-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{service.client.phone || "-"}</p>
                  <p className="text-xs text-gray-500">Telefono</p>
                </div>
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Contactar por WhatsApp"
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </a>
                )}
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center">
                  <MapPin size={20} className="text-amber-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {service.address.street} {service.address.number}, {service.address.city}
                  </p>
                  <p className="text-xs text-gray-500">{service.address.zone}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Quote */}
          {quote && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <FileText size={18} />
                    Presupuesto
                  </span>
                </CardTitle>
                <Link
                  href={`/admin/presupuestos/${quote.id}`}
                  className="text-sm text-green-700 hover:text-green-800 font-medium"
                >
                  Ver detalle
                </Link>
              </CardHeader>
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(quote.total_cents)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Estado</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${
                    quote.status === "approved" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {quote.status === "approved" ? "Aprobado" : quote.status === "sent" ? "Enviado" : quote.status}
                  </span>
                </div>
                {quote.approved_at && (
                  <div>
                    <p className="text-xs text-gray-500">Aprobado el</p>
                    <p className="text-sm text-gray-700">{formatDate(quote.approved_at)}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Assignment & Crew */}
          {assignment && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <Users size={18} />
                    Asignacion
                  </span>
                </CardTitle>
              </CardHeader>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Cuadrilla</p>
                  <p className="text-sm font-medium text-gray-900">{assignment.crew_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Lider</p>
                  <p className="text-sm font-medium text-gray-900">{assignment.leader_name || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fecha programada</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(assignment.scheduled_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Horario</p>
                  <p className="text-sm font-medium text-gray-900">
                    {assignment.scheduled_start_time?.slice(0, 5) ?? "-"}{" "}
                    {assignment.scheduled_end_time ? `- ${assignment.scheduled_end_time.slice(0, 5)}` : ""}
                  </p>
                </div>
              </div>
              {(assignment.actual_start_at || assignment.actual_end_at) && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-6">
                  <div>
                    <p className="text-xs text-gray-500">Inicio real</p>
                    <p className="text-sm text-gray-700">
                      {assignment.actual_start_at ? formatDateTime(assignment.actual_start_at) : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Fin real</p>
                    <p className="text-sm text-gray-400">
                      {assignment.actual_end_at ? formatDateTime(assignment.actual_end_at) : "En curso"}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Checklist */}
          {checklistItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <CheckSquare size={18} />
                    Checklist ({completedChecklist}/{totalChecklist})
                  </span>
                </CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {checklistItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded-lg ${
                      item.is_completed ? "bg-green-50" : "bg-gray-50"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        item.is_completed ? "bg-green-600 border-green-600" : "border-gray-300"
                      }`}
                    >
                      {item.is_completed && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm ${item.is_completed ? "text-gray-500 line-through" : "text-gray-700"}`}>
                      {item.description}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <ImageIcon size={18} />
                    Fotos
                  </span>
                </CardTitle>
              </CardHeader>
              <div className="space-y-4">
                {(["before", "during", "after"] as const).map((type) => {
                  const typePhotos = photosByType(type);
                  return (
                    <div key={type}>
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        {typeLabels[type]} ({typePhotos.length})
                      </p>
                      {typePhotos.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {typePhotos.map((photo) => (
                            <img
                              key={photo.id}
                              src={photo.url}
                              alt={`${typeLabels[type]}`}
                              className="aspect-square object-cover rounded-lg bg-gray-100"
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">Sin fotos todavia</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Review */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Star size={18} />
                  Resena del cliente
                </span>
              </CardTitle>
            </CardHeader>
            {review ? (
              <div>
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={18}
                      className={
                        s <= review.rating ? "text-amber-400 fill-amber-400" : "text-gray-300"
                      }
                    />
                  ))}
                  <span className="text-sm text-gray-600 ml-2">{review.rating}/5</span>
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-700">{review.comment}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                El cliente aun no dejo una resena
              </p>
            )}
          </Card>

          {/* Proxima visita */}
          {showNextVisit && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <CalendarPlus size={18} />
                    Proxima visita
                  </span>
                </CardTitle>
              </CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Proxima visita sugerida</p>
                  <p className="text-base font-semibold text-gray-900">{suggestedDateLabel}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Basado en +30 dias desde la visita anterior
                  </p>
                </div>
                <Link
                  href={`/admin/agenda?suggest_date=${suggestedDateParam}&client_id=${service.client_id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <CalendarPlus size={16} />
                  Crear asignacion
                </Link>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar - Timeline */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Clock size={18} />
                  Linea de tiempo
                </span>
              </CardTitle>
            </CardHeader>
            <div className="space-y-0">
              {timeline.length === 0 ? (
                <p className="text-sm text-gray-400">Sin eventos registrados</p>
              ) : (
                timeline.map((step, idx) => (
                  <div key={step.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full mt-1 bg-green-600" />
                      {idx < timeline.length - 1 && (
                        <div className="w-0.5 flex-1 my-1 bg-green-600" />
                      )}
                    </div>
                    <div className="pb-3">
                      <p className="text-sm font-medium text-gray-900">
                        {SERVICE_STATUS_LABELS[step.to_status]}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDateTime(step.created_at)} - {step.changed_by_name}
                      </p>
                      {step.notes && (
                        <p className="text-xs text-gray-500 mt-0.5">{step.notes}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Generate report */}
      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Link
          href={`/admin/servicios/${service.id}/report`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Printer size={15} />
          Generar informe
        </Link>
      </div>
    </div>
  );
}
