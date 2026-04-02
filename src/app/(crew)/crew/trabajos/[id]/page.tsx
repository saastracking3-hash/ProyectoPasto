"use client";

import { useEffect, useState, useCallback } from "react";
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

export default function CrewJobDetailPage() {
  const params = useParams();
  const assignmentId = params.id as string;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [observation, setObservation] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<ServiceStatus | null>(
    null
  );
  const [userId, setUserId] = useState<string | null>(null);

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

  const handleStatusChange = async (newStatus: ServiceStatus) => {
    if (!job || !userId) return;

    // Validate transition
    if (!canTransition(job.status, newStatus, "crew_leader")) {
      setError("Transicion de estado no permitida");
      return;
    }

    setUpdatingStatus(newStatus);
    setError(null);

    try {
      const supabase = createClient();

      // 1. Update service_request status
      const { error: updateError } = await supabase
        .from("service_requests")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", job.serviceRequestId);

      if (updateError) throw updateError;

      // 2. Insert state log
      const { error: logError } = await supabase
        .from("service_state_log")
        .insert({
          service_request_id: job.serviceRequestId,
          from_status: job.status,
          to_status: newStatus,
          changed_by: userId,
        });

      if (logError) throw logError;

      // 3. Update assignment timestamps based on status
      if (newStatus === "in_progress" && job.status !== "paused") {
        await supabase
          .from("assignments")
          .update({ actual_start_at: new Date().toISOString() })
          .eq("id", job.assignmentId);
      }

      if (newStatus === "completed_by_crew") {
        await supabase
          .from("assignments")
          .update({ actual_end_at: new Date().toISOString() })
          .eq("id", job.assignmentId);
      }

      // Refresh data
      setLoading(true);
      await fetchJob();
    } catch (err: any) {
      setError("Error al cambiar estado: " + err.message);
    } finally {
      setUpdatingStatus(null);
    }
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
        : encodeURIComponent(
            `${job.street} ${job.number}, ${job.city}`
          );
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
        <p className="text-gray-600">
          {error || "No se encontro el trabajo"}
        </p>
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono text-gray-400">
            #{job.requestNumber}
          </span>
          <h1 className="text-xl font-bold text-gray-900">
            {job.serviceType}
          </h1>
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
              <a
                href={`tel:${job.clientPhone}`}
                className="text-green-700 underline"
              >
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
          {actions.map((action) => (
            <button
              key={action.status}
              onClick={() => handleStatusChange(action.status)}
              disabled={updatingStatus !== null}
              className={`w-full py-4 rounded-xl text-white font-bold text-lg ${action.color} hover:opacity-90 transition-opacity disabled:opacity-50`}
            >
              {updatingStatus === action.status ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
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
  );
}
