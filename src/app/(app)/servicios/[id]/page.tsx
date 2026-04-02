"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_STATUS_LABELS } from "@/lib/types";
import type {
  ServiceStatus,
  ServiceRequest,
  ServiceType,
  Address,
  Quote,
  QuoteItem,
  Assignment,
  Crew,
  ServiceStateLog,
  ServicePhoto,
  Review,
} from "@/lib/types";
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  Clock,
  Ruler,
  FileText,
  Users,
  Star,
  Camera,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useServiceUpdates } from "@/lib/hooks/useServiceUpdates";
import { useToast } from "@/lib/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";
import RealtimeIndicator from "@/components/ui/RealtimeIndicator";

interface ServiceDetail {
  service: ServiceRequest;
  serviceType: ServiceType | null;
  address: Address | null;
  quote: (Quote & { items: QuoteItem[] }) | null;
  assignment: (Assignment & { crew: Crew | null }) | null;
  stateLog: ServiceStateLog[];
  photos: ServicePhoto[];
  review: Review | null;
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-gray-200 animate-pulse rounded-lg" />
        <div>
          <div className="h-8 w-64 bg-gray-200 animate-pulse rounded" />
          <div className="h-4 w-40 bg-gray-200 animate-pulse rounded mt-2" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-40 bg-gray-200 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

export default function ServiceDetailPage() {
  const params = useParams();
  const serviceId = params.id as string;

  const [data, setData] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const [approvingQuote, setApprovingQuote] = useState(false);
  const [rejectingQuote, setRejectingQuote] = useState(false);

  const { toasts, addToast, removeToast } = useToast();

  const refetchDetail = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) return;

      const { data: service, error: svcError } = await supabase
        .from("service_requests")
        .select("*")
        .eq("id", serviceId)
        .eq("client_id", user.id)
        .single();
      if (svcError || !service) return;

      const [
        serviceTypeRes,
        addressRes,
        quoteRes,
        assignmentRes,
        stateLogRes,
        photosRes,
        reviewRes,
      ] = await Promise.all([
        supabase.from("service_types").select("*").eq("id", service.service_type_id).single(),
        supabase.from("addresses").select("*").eq("id", service.address_id).single(),
        supabase.from("quotes").select("*").eq("service_request_id", serviceId).order("created_at", { ascending: false }).limit(1),
        supabase.from("assignments").select("*, crews(*)").eq("service_request_id", serviceId).order("created_at", { ascending: false }).limit(1),
        supabase.from("service_state_log").select("*").eq("service_request_id", serviceId).order("created_at", { ascending: true }),
        supabase.from("service_photos").select("*").eq("assignment_id", serviceId),
        supabase.from("reviews").select("*").eq("service_request_id", serviceId).eq("client_id", user.id).limit(1),
      ]);

      let quoteWithItems = null;
      if (quoteRes.data && quoteRes.data.length > 0) {
        const q = quoteRes.data[0];
        const { data: items } = await supabase.from("quote_items").select("*").eq("quote_id", q.id).order("sort_order");
        quoteWithItems = { ...q, items: items || [] };
      }

      let allPhotos = photosRes.data || [];
      if (assignmentRes.data && assignmentRes.data.length > 0) {
        const { data: assignmentPhotos } = await supabase.from("service_photos").select("*").eq("assignment_id", assignmentRes.data[0].id);
        if (assignmentPhotos && assignmentPhotos.length > 0) allPhotos = assignmentPhotos;
      }

      const assignmentData =
        assignmentRes.data && assignmentRes.data.length > 0
          ? { ...assignmentRes.data[0], crew: assignmentRes.data[0].crews || null }
          : null;

      setData({
        service: service as ServiceRequest,
        serviceType: serviceTypeRes.data as ServiceType | null,
        address: addressRes.data as Address | null,
        quote: quoteWithItems,
        assignment: assignmentData,
        stateLog: (stateLogRes.data || []) as ServiceStateLog[],
        photos: allPhotos as ServicePhoto[],
        review: reviewRes.data && reviewRes.data.length > 0 ? (reviewRes.data[0] as Review) : null,
      });
    } catch {
      // Silent refetch failure
    }
  }, [serviceId]);

  // Realtime subscription for this service request
  const { status: realtimeStatus } = useServiceUpdates({
    serviceRequestId: serviceId,
    onStatusChange: useCallback(() => {
      addToast("El estado de tu servicio fue actualizado", "info");
      refetchDetail();
    }, [addToast, refetchDetail]),
  });

  useEffect(() => {
    async function fetchDetail() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("No se pudo obtener el usuario");

        // Fetch service
        const { data: service, error: svcError } = await supabase
          .from("service_requests")
          .select("*")
          .eq("id", serviceId)
          .eq("client_id", user.id)
          .single();
        if (svcError) throw new Error("Servicio no encontrado");

        // Fetch related data in parallel
        const [
          serviceTypeRes,
          addressRes,
          quoteRes,
          assignmentRes,
          stateLogRes,
          photosRes,
          reviewRes,
        ] = await Promise.all([
          supabase
            .from("service_types")
            .select("*")
            .eq("id", service.service_type_id)
            .single(),
          supabase
            .from("addresses")
            .select("*")
            .eq("id", service.address_id)
            .single(),
          supabase
            .from("quotes")
            .select("*")
            .eq("service_request_id", serviceId)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("assignments")
            .select("*, crews(*)")
            .eq("service_request_id", serviceId)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("service_state_log")
            .select("*")
            .eq("service_request_id", serviceId)
            .order("created_at", { ascending: true }),
          supabase
            .from("service_photos")
            .select("*")
            .eq("assignment_id", serviceId),
          supabase
            .from("reviews")
            .select("*")
            .eq("service_request_id", serviceId)
            .eq("client_id", user.id)
            .limit(1),
        ]);

        // If there is a quote, fetch its items
        let quoteWithItems = null;
        if (quoteRes.data && quoteRes.data.length > 0) {
          const q = quoteRes.data[0];
          const { data: items } = await supabase
            .from("quote_items")
            .select("*")
            .eq("quote_id", q.id)
            .order("sort_order");
          quoteWithItems = { ...q, items: items || [] };
        }

        // For photos, also try via assignment
        let allPhotos = photosRes.data || [];
        if (assignmentRes.data && assignmentRes.data.length > 0) {
          const { data: assignmentPhotos } = await supabase
            .from("service_photos")
            .select("*")
            .eq("assignment_id", assignmentRes.data[0].id);
          if (assignmentPhotos && assignmentPhotos.length > 0) {
            allPhotos = assignmentPhotos;
          }
        }

        const assignmentData =
          assignmentRes.data && assignmentRes.data.length > 0
            ? {
                ...assignmentRes.data[0],
                crew: assignmentRes.data[0].crews || null,
              }
            : null;

        setData({
          service: service as ServiceRequest,
          serviceType: serviceTypeRes.data as ServiceType | null,
          address: addressRes.data as Address | null,
          quote: quoteWithItems,
          assignment: assignmentData,
          stateLog: (stateLogRes.data || []) as ServiceStateLog[],
          photos: allPhotos as ServicePhoto[],
          review:
            reviewRes.data && reviewRes.data.length > 0
              ? (reviewRes.data[0] as Review)
              : null,
        });
      } catch (err: any) {
        setError(err.message || "Error al cargar el servicio");
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [serviceId]);

  const handleApproveQuote = async () => {
    if (!data?.quote) return;
    setApprovingQuote(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("quotes")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", data.quote.id);
      if (error) throw error;

      // Also update service status
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase
        .from("service_requests")
        .update({ status: "approved" })
        .eq("id", serviceId);

      if (user) {
        await supabase.from("service_state_log").insert({
          service_request_id: serviceId,
          from_status: data.service.status,
          to_status: "approved",
          changed_by: user.id,
          notes: "Presupuesto aprobado por el cliente",
        });
      }

      // Refresh data
      setData((prev) =>
        prev
          ? {
              ...prev,
              quote: prev.quote
                ? { ...prev.quote, status: "approved" }
                : null,
              service: { ...prev.service, status: "approved" },
            }
          : null
      );
    } catch {
      alert("Error al aprobar el presupuesto");
    } finally {
      setApprovingQuote(false);
    }
  };

  const handleRejectQuote = async () => {
    if (!data?.quote) return;
    setRejectingQuote(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("quotes")
        .update({
          status: "rejected",
          rejected_at: new Date().toISOString(),
        })
        .eq("id", data.quote.id);
      if (error) throw error;

      setData((prev) =>
        prev
          ? {
              ...prev,
              quote: prev.quote
                ? { ...prev.quote, status: "rejected" }
                : null,
            }
          : null
      );
    } catch {
      alert("Error al rechazar el presupuesto");
    } finally {
      setRejectingQuote(false);
    }
  };

  const handleReviewSubmit = async () => {
    if (!data || rating === 0) return;
    setSubmittingReview(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No se pudo obtener el usuario");

      const { error } = await supabase.from("reviews").insert({
        service_request_id: serviceId,
        client_id: user.id,
        rating,
        comment: comment || null,
      });
      if (error) throw error;
      setReviewSubmitted(true);
    } catch {
      alert("Error al enviar la resena");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <DetailSkeleton />;

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-sm">{error || "Servicio no encontrado"}</p>
        <Link
          href="/servicios"
          className="text-green-800 text-sm font-medium mt-2 underline"
        >
          Volver a mis servicios
        </Link>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

  const { service, serviceType, address, quote, assignment, stateLog, photos, review } =
    data;

  // Build timeline from state log
  const timeline = stateLog.map((entry, i) => ({
    status: entry.to_status,
    label: SERVICE_STATUS_LABELS[entry.to_status] || entry.to_status,
    date: entry.created_at,
    completed: i < stateLog.length - 1,
    current: i === stateLog.length - 1,
  }));

  const beforePhotos = photos.filter((p) => p.photo_type === "before");
  const afterPhotos = photos.filter((p) => p.photo_type === "after");

  const showReviewForm =
    (service.status === "closed" || service.status === "completed_by_crew") &&
    !review &&
    !reviewSubmitted;

  const getPhotoUrl = (storagePath: string) => {
    const supabase = createClient();
    const { data } = supabase.storage
      .from("service-photos")
      .getPublicUrl(storagePath);
    return data.publicUrl;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/servicios"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Servicio #{service.request_number}
            </h1>
            <StatusBadge status={service.status} size="md" />
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            Creado el {formatDate(service.created_at)}
          </p>
        </div>
        <RealtimeIndicator status={realtimeStatus} />
      </div>

      {/* Status timeline */}
      {timeline.length > 0 && (
        <Card>
          <CardTitle className="mb-4">Progreso del servicio</CardTitle>
          <div className="relative">
            {timeline.map((step, i) => (
              <div key={i} className="flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  {step.completed ? (
                    <CheckCircle2
                      size={22}
                      className="text-green-800 shrink-0"
                    />
                  ) : step.current ? (
                    <div className="w-[22px] h-[22px] rounded-full border-[3px] border-green-800 bg-green-100 shrink-0" />
                  ) : (
                    <Circle size={22} className="text-gray-300 shrink-0" />
                  )}
                  {i < timeline.length - 1 && (
                    <div
                      className={`w-0.5 flex-1 mt-1 ${
                        step.completed ? "bg-green-800" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
                <div className="pb-2">
                  <p
                    className={`text-sm font-medium ${
                      step.completed || step.current
                        ? "text-gray-900"
                        : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.date && (
                    <p className="text-xs text-gray-400">
                      {formatDateTime(step.date)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Service info */}
      <Card>
        <CardTitle className="mb-4">Informacion del servicio</CardTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <FileText size={16} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Tipo de servicio</p>
              <p className="text-sm font-medium text-gray-900">
                {serviceType?.name || "-"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Direccion</p>
              <p className="text-sm font-medium text-gray-900">
                {address
                  ? `${address.street} ${address.number}, ${address.zone}`
                  : "-"}
              </p>
            </div>
          </div>
          {service.preferred_date && (
            <div className="flex items-start gap-2">
              <CalendarDays
                size={16}
                className="text-gray-400 mt-0.5 shrink-0"
              />
              <div>
                <p className="text-xs text-gray-500">Fecha preferida</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(service.preferred_date)}
                </p>
              </div>
            </div>
          )}
          {service.preferred_time_slot && (
            <div className="flex items-start gap-2">
              <Clock size={16} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Franja horaria</p>
                <p className="text-sm font-medium text-gray-900">
                  {service.preferred_time_slot}
                </p>
              </div>
            </div>
          )}
          {service.estimated_area_sqm && (
            <div className="flex items-start gap-2">
              <Ruler size={16} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Superficie estimada</p>
                <p className="text-sm font-medium text-gray-900">
                  {service.estimated_area_sqm} m2
                </p>
              </div>
            </div>
          )}
        </div>
        {service.description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Descripcion</p>
            <p className="text-sm text-gray-700">{service.description}</p>
          </div>
        )}
      </Card>

      {/* Quote */}
      {quote && (
        <Card>
          <CardHeader>
            <CardTitle>Presupuesto</CardTitle>
            <Link
              href={`/presupuestos/${quote.id}`}
              className="text-sm text-green-800 hover:text-green-700 font-medium"
            >
              Ver detalle
            </Link>
          </CardHeader>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Mano de obra</p>
              <p className="text-sm font-bold text-gray-900">
                {formatCurrency(quote.labor_cost_cents)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Materiales</p>
              <p className="text-sm font-bold text-gray-900">
                {formatCurrency(quote.materials_cost_cents)}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-green-700">Total</p>
              <p className="text-sm font-bold text-green-800">
                {formatCurrency(quote.total_cents)}
              </p>
            </div>
          </div>
          {quote.status === "sent" && (
            <div className="flex gap-3 mt-4">
              <Button
                onClick={handleApproveQuote}
                loading={approvingQuote}
                disabled={approvingQuote || rejectingQuote}
                className="flex-1"
              >
                <CheckCircle2 size={16} />
                Aprobar
              </Button>
              <Button
                variant="outline"
                onClick={handleRejectQuote}
                loading={rejectingQuote}
                disabled={approvingQuote || rejectingQuote}
                className="flex-1"
              >
                Rechazar
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Assignment */}
      {assignment && (
        <Card>
          <CardTitle className="mb-4">Cuadrilla asignada</CardTitle>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
              <Users size={20} className="text-green-800" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {assignment.crew?.name || "Equipo asignado"}
              </p>
              <p className="text-xs text-gray-500">
                {formatDate(assignment.scheduled_date)}
                {assignment.scheduled_start_time &&
                  ` · ${assignment.scheduled_start_time}`}
                {assignment.scheduled_end_time &&
                  ` - ${assignment.scheduled_end_time}`}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Photos */}
      {(beforePhotos.length > 0 ||
        afterPhotos.length > 0 ||
        (service.photos && service.photos.length > 0)) && (
        <Card>
          <CardTitle className="mb-4">
            <Camera size={18} className="inline mr-2" />
            Fotos
          </CardTitle>
          <div className="space-y-4">
            {/* Client-uploaded photos */}
            {service.photos && service.photos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Fotos del cliente
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {service.photos.map((path, i) => (
                    <img
                      key={i}
                      src={getPhotoUrl(path)}
                      alt={`Foto ${i + 1}`}
                      className="aspect-square object-cover rounded-lg bg-gray-100"
                    />
                  ))}
                </div>
              </div>
            )}
            {beforePhotos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Antes
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {beforePhotos.map((photo) => (
                    <img
                      key={photo.id}
                      src={getPhotoUrl(photo.storage_path)}
                      alt={photo.caption || "Antes"}
                      className="aspect-square object-cover rounded-lg bg-gray-100"
                    />
                  ))}
                </div>
              </div>
            )}
            {afterPhotos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Despues
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {afterPhotos.map((photo) => (
                    <img
                      key={photo.id}
                      src={getPhotoUrl(photo.storage_path)}
                      alt={photo.caption || "Despues"}
                      className="aspect-square object-cover rounded-lg bg-gray-100"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Review */}
      {review && (
        <Card>
          <CardTitle className="mb-4">
            <Star size={18} className="inline mr-2" />
            Tu resena
          </CardTitle>
          <div className="flex gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={20}
                className={
                  star <= review.rating
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-300"
                }
              />
            ))}
          </div>
          {review.comment && (
            <p className="text-sm text-gray-700">{review.comment}</p>
          )}
        </Card>
      )}

      {reviewSubmitted && (
        <Card>
          <div className="text-center py-4">
            <CheckCircle2 size={32} className="text-green-800 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">
              Gracias por tu resena
            </p>
          </div>
        </Card>
      )}

      {/* Review form */}
      {showReviewForm && (
        <Card>
          <CardTitle className="mb-4">
            <Star size={18} className="inline mr-2" />
            Deja tu resena
          </CardTitle>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-700 mb-2">
                ¿Como calificas el servicio?
              </p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="p-1"
                  >
                    <Star
                      size={28}
                      className={
                        star <= rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Comentario (opcional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Contanos como fue tu experiencia..."
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent placeholder:text-gray-400"
              />
            </div>
            <Button
              onClick={handleReviewSubmit}
              disabled={rating === 0 || submittingReview}
              loading={submittingReview}
            >
              Enviar resena
            </Button>
          </div>
        </Card>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
