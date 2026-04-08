"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  MapPin,
  Clock,
  User,
  Phone,
  Navigation,
  Camera,
  ClipboardCheck,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";
import { getCrewActions, canTransition } from "@/lib/services/state-machine";
import type { ServiceStatus } from "@/lib/types";

interface JobDetail {
  assignmentId: string;
  serviceRequestId: string;
  requestNumber: number;
  serviceType: string;
  status: ServiceStatus;
  clientName: string;
  clientPhone: string | null;
  street: string;
  number: string;
  city: string;
  lat: number | null;
  lng: number | null;
  scheduledDate: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  description: string | null;
  estimatedArea: number | null;
  internalNotes: string | null;
  assignmentNotes: string | null;
}

// ─── Mandatory modal for "Ya llegue" ────────────────────────────────────────
function ArrivalModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (notes: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Confirmar llegada</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <div className="bg-teal-50 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 size={24} className="text-teal-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-teal-800">Llegaste al domicilio</p>
            <p className="text-xs text-teal-600 mt-0.5">
              Se registrara la hora exacta de llegada
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Observaciones de llegada{" "}
            <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Portero avisado, acceso por cochera, etc."
            rows={3}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-gray-400"
          />
        </div>

        <Button
          onClick={() => onConfirm(notes)}
          loading={loading}
          className="w-full bg-teal-600 hover:bg-teal-700"
        >
          <CheckCircle2 size={18} />
          Confirmar llegada
        </Button>
      </div>
    </div>
  );
}

// ─── Mandatory modal for "Trabajo terminado" ─────────────────────────────────
function CompletionModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (data: { summary: string; issues: string; clientSatisfied: boolean }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [summary, setSummary] = useState("");
  const [issues, setIssues] = useState("");
  const [clientSatisfied, setClientSatisfied] = useState(true);

  const canSubmit = summary.trim().length >= 10;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Cierre del trabajo</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <p className="text-sm text-gray-600">
          Completa el informe antes de cerrar el trabajo. El resumen es{" "}
          <strong>obligatorio</strong>.
        </p>

        {/* Summary — required */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Resumen del trabajo realizado{" "}
            <span className="text-red-500">*</span>
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Describe todo lo que se hizo: corte, poda, limpieza, materiales usados..."
            rows={4}
            className={`block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 placeholder:text-gray-400 ${
              summary.trim().length > 0 && summary.trim().length < 10
                ? "border-red-400 focus:ring-red-400"
                : "border-gray-300 focus:ring-green-600"
            }`}
          />
          {summary.trim().length > 0 && summary.trim().length < 10 && (
            <p className="text-xs text-red-500 mt-1">
              Minimo 10 caracteres requeridos
            </p>
          )}
        </div>

        {/* Issues — optional */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Problemas o inconvenientes{" "}
            <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            value={issues}
            onChange={(e) => setIssues(e.target.value)}
            placeholder="Ej: Maquina con bajo rendimiento, zona con mucha humedad..."
            rows={2}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 placeholder:text-gray-400"
          />
        </div>

        {/* Client satisfied */}
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={clientSatisfied}
              onChange={(e) => setClientSatisfied(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
          </label>
          <span className="text-sm text-gray-700">Cliente satisfecho con el trabajo</span>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm({ summary, issues, clientSatisfied })}
            disabled={!canSubmit || loading}
            className="flex-1 py-3 rounded-xl bg-green-700 text-white text-sm font-bold disabled:opacity-40 hover:bg-green-800 transition-colors"
          >
            {loading ? "Guardando..." : "Cerrar trabajo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────
function SkeletonDetail() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-4 w-16 bg-gray-200 rounded mb-2" />
          <div className="h-6 w-44 bg-gray-200 rounded" />
        </div>
        <div className="h-7 w-32 bg-gray-200 rounded-full" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="h-4 w-40 bg-gray-200 rounded" />
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="h-4 w-56 bg-gray-200 rounded" />
        <div className="h-4 w-44 bg-gray-200 rounded" />
        <div className="h-12 w-full bg-gray-200 rounded-lg" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-2">
        <div className="h-5 w-28 bg-gray-200 rounded" />
        <div className="h-4 w-full bg-gray-200 rounded" />
        <div className="h-4 w-3/4 bg-gray-200 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 bg-gray-200 rounded-xl" />
        <div className="h-20 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function CrewJobDetailPage() {
  const params = useParams();
  const assignmentId = params.id as string;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [observation, setObservation] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<ServiceStatus | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Modal state
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ServiceStatus | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("No se pudo obtener el usuario");
        return;
      }
      setUserId(user.id);

      const { data: assignment, error: fetchError } = await supabase
        .from("assignments")
        .select(
          `
          id,
          service_request_id,
          scheduled_date,
          scheduled_start_time,
          scheduled_end_time,
          notes,
          service_request:service_requests!inner (
            id,
            request_number,
            status,
            description,
            estimated_area_sqm,
            internal_notes,
            client:profiles!service_requests_client_id_fkey ( full_name, phone ),
            service_type:service_types!inner ( name ),
            address:addresses!inner ( street, number, city, lat, lng )
          )
        `
        )
        .eq("id", assignmentId)
        .single();

      if (fetchError) {
        setError("Error al cargar el trabajo: " + fetchError.message);
        return;
      }

      const sr = assignment.service_request as any;
      const addr = sr.address;
      const client = sr.client;

      const detail: JobDetail = {
        assignmentId: assignment.id,
        serviceRequestId: sr.id,
        requestNumber: sr.request_number,
        serviceType: sr.service_type.name,
        status: sr.status as ServiceStatus,
        clientName: client?.full_name || "Cliente",
        clientPhone: client?.phone || null,
        street: addr.street,
        number: addr.number,
        city: addr.city,
        lat: addr.lat,
        lng: addr.lng,
        scheduledDate: assignment.scheduled_date,
        scheduledStartTime: assignment.scheduled_start_time,
        scheduledEndTime: assignment.scheduled_end_time,
        description: sr.description,
        estimatedArea: sr.estimated_area_sqm,
        internalNotes: sr.internal_notes,
        assignmentNotes: assignment.notes,
      };

      setJob(detail);
      setObservation(assignment.notes || "");
    } catch (err: any) {
      setError("Error inesperado: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // GPS tracking — start when in_transit, stop when arrived/completed
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!job || !userId) return;

    const isTracking = job.status === "in_transit" || job.status === "arrived";

    if (isTracking && watchIdRef.current === null && "geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          try {
            const supabase = createClient();
            await supabase.from("crew_locations").upsert(
              {
                assignment_id: job.assignmentId,
                user_id: userId,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "assignment_id" }
            );
          } catch {
            // Silently ignore GPS upsert errors
          }
        },
        undefined,
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
      );
    }

    if (!isTracking && watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [job?.status, userId, job?.assignmentId]);

  // ─── Core status change (runs after modal confirms) ──────────────────────
  const applyStatusChange = async (
    newStatus: ServiceStatus,
    extraNotes?: string
  ) => {
    if (!job || !userId) return;
    if (!canTransition(job.status, newStatus, "crew_leader")) {
      setError("Transicion de estado no permitida");
      return;
    }

    setUpdatingStatus(newStatus);
    setError(null);

    try {
      const supabase = createClient();

      await supabase
        .from("service_requests")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", job.serviceRequestId);

      await supabase.from("service_state_log").insert({
        service_request_id: job.serviceRequestId,
        from_status: job.status,
        to_status: newStatus,
        changed_by: userId,
        notes: extraNotes || null,
      });

      if (newStatus === "in_progress" && job.status !== "paused") {
        await supabase
          .from("assignments")
          .update({ actual_start_at: new Date().toISOString() })
          .eq("id", job.assignmentId);
      }

      if (newStatus === "arrived") {
        await supabase
          .from("assignments")
          .update({
            notes: extraNotes
              ? `${observation ? observation + "\n" : ""}[Llegada] ${extraNotes}`
              : observation,
          })
          .eq("id", job.assignmentId);
      }

      if (newStatus === "completed_by_crew") {
        await supabase
          .from("assignments")
          .update({ actual_end_at: new Date().toISOString() })
          .eq("id", job.assignmentId);
      }

      setLoading(true);
      await fetchJob();
    } catch (err: any) {
      setError("Error al cambiar estado: " + err.message);
    } finally {
      setUpdatingStatus(null);
    }
  };

  // ─── Button click handler — intercepts mandatory modals ──────────────────
  const handleStatusClick = (newStatus: ServiceStatus) => {
    if (newStatus === "arrived") {
      setPendingStatus(newStatus);
      setShowArrivalModal(true);
      return;
    }
    if (newStatus === "completed_by_crew") {
      setPendingStatus(newStatus);
      setShowCompletionModal(true);
      return;
    }
    applyStatusChange(newStatus);
  };

  const handleArrivalConfirm = async (notes: string) => {
    setShowArrivalModal(false);
    await applyStatusChange("arrived", notes || undefined);
    setPendingStatus(null);
  };

  const handleCompletionConfirm = async (data: {
    summary: string;
    issues: string;
    clientSatisfied: boolean;
  }) => {
    setShowCompletionModal(false);
    const notes = [
      `Resumen: ${data.summary}`,
      data.issues ? `Problemas: ${data.issues}` : null,
      `Cliente satisfecho: ${data.clientSatisfied ? "Sí" : "No"}`,
    ]
      .filter(Boolean)
      .join(" | ");
    await applyStatusChange("completed_by_crew", notes);
    setPendingStatus(null);
  };

  const handleSaveNotes = async () => {
    if (!job) return;
    setSavingNotes(true);
    try {
      const supabase = createClient();
      const { error: saveError } = await supabase
        .from("assignments")
        .update({ notes: observation })
        .eq("id", job.assignmentId);

      if (saveError) throw saveError;
    } catch (err: any) {
      setError("Error al guardar notas: " + err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  const openMaps = () => {
    if (!job) return;
    const destination =
      job.lat && job.lng
        ? `${job.lat},${job.lng}`
        : encodeURIComponent(`${job.street} ${job.number}, ${job.city}`);
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
      "_blank"
    );
  };

  if (loading) return <SkeletonDetail />;

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle size={32} className="text-gray-400 mb-3" />
        <p className="text-gray-600">{error || "No se encontro el trabajo"}</p>
      </div>
    );
  }

  const addressFull = `${job.street} ${job.number}, ${job.city}`;
  const timeSlot =
    job.scheduledStartTime && job.scheduledEndTime
      ? `${job.scheduledStartTime.slice(0, 5)} - ${job.scheduledEndTime.slice(0, 5)}`
      : job.scheduledStartTime
        ? job.scheduledStartTime.slice(0, 5)
        : null;

  const actions = getCrewActions(job.status);

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-gray-400">
              #{job.requestNumber}
            </span>
            <h1 className="text-xl font-bold text-gray-900">{job.serviceType}</h1>
          </div>
          <StatusBadge status={job.status} size="md" />
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Client info */}
        <Card>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User size={16} className="text-gray-400" />
              <span className="font-medium">{job.clientName}</span>
            </div>
            {job.clientPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone size={16} className="text-gray-400" />
                <a href={`tel:${job.clientPhone}`} className="text-green-700 underline">
                  {job.clientPhone}
                </a>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={16} className="text-gray-400" />
              <span>{addressFull}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} className="text-gray-400" />
              <span>
                {formatDate(job.scheduledDate)}
                {timeSlot ? ` | ${timeSlot}` : ""}
              </span>
            </div>
          </div>

          <button
            onClick={openMaps}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            <Navigation size={18} />
            Navegar al lugar
          </button>
        </Card>

        {/* Description */}
        {(job.description || job.internalNotes || job.estimatedArea) && (
          <Card>
            <h3 className="font-semibold text-gray-900 mb-2">Descripcion</h3>
            {job.description && (
              <p className="text-sm text-gray-600">{job.description}</p>
            )}
            {job.internalNotes && (
              <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Nota:</strong> {job.internalNotes}
                </p>
              </div>
            )}
            {job.estimatedArea && (
              <p className="text-sm text-gray-500 mt-2">
                Area estimada: {job.estimatedArea} m2
              </p>
            )}
          </Card>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/crew/trabajos/${assignmentId}/checklist`}
            className="flex flex-col items-center gap-2 bg-white border border-gray-200 rounded-xl p-4 hover:border-green-300 transition-colors"
          >
            <ClipboardCheck size={24} className="text-green-700" />
            <span className="text-sm font-medium">Checklist</span>
          </Link>
          <Link
            href={`/crew/trabajos/${assignmentId}/fotos`}
            className="flex flex-col items-center gap-2 bg-white border border-gray-200 rounded-xl p-4 hover:border-green-300 transition-colors"
          >
            <Camera size={24} className="text-green-700" />
            <span className="text-sm font-medium">Fotos</span>
          </Link>
        </div>

        {/* Observation */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <MessageSquare size={16} />
            Observaciones
          </h3>
          <textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Agregar observacion del trabajo..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            loading={savingNotes}
            onClick={handleSaveNotes}
          >
            Guardar notas
          </Button>
        </Card>

        {/* Status action buttons */}
        {actions.length > 0 && (
          <div className="space-y-3 pb-4">
            {/* Helper text for mandatory steps */}
            {actions.some((a) => a.status === "arrived") && (
              <p className="text-xs text-center text-gray-400">
                Al confirmar llegada se registra la hora exacta
              </p>
            )}
            {actions.some((a) => a.status === "completed_by_crew") && (
              <p className="text-xs text-center text-amber-600 font-medium">
                Deberas completar un informe obligatorio antes de cerrar el trabajo
              </p>
            )}

            {actions.map((action) => (
              <button
                key={action.status}
                onClick={() => handleStatusClick(action.status)}
                disabled={updatingStatus !== null}
                className={`w-full py-4 rounded-xl text-white font-bold text-lg ${action.color} hover:opacity-90 transition-opacity disabled:opacity-50`}
              >
                {updatingStatus === action.status ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Actualizando...
                  </span>
                ) : (
                  action.label
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showArrivalModal && (
        <ArrivalModal
          onConfirm={handleArrivalConfirm}
          onCancel={() => {
            setShowArrivalModal(false);
            setPendingStatus(null);
          }}
          loading={updatingStatus === "arrived"}
        />
      )}

      {showCompletionModal && (
        <CompletionModal
          onConfirm={handleCompletionConfirm}
          onCancel={() => {
            setShowCompletionModal(false);
            setPendingStatus(null);
          }}
          loading={updatingStatus === "completed_by_crew"}
        />
      )}
    </>
  );
}
