"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  MapPin,
  Phone,
  Calendar,
  FileText,
  Users,
  Clock,
  ImageIcon,
  MessageSquare,
  Send,
  Eye,
  CheckCircle,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { SERVICE_STATUS_LABELS } from "@/lib/types";
import type { ServiceStatus } from "@/lib/types";
import { createAssignment } from "@/app/actions/assignments";

interface SolicitudDetail {
  id: string;
  request_number: number;
  status: ServiceStatus;
  urgency: string;
  created_at: string;
  description: string | null;
  preferred_date: string | null;
  preferred_time_slot: string | null;
  estimated_area_sqm: number | null;
  photos: string[];
  internal_notes: string | null;
  client: { full_name: string; phone: string | null };
  address: {
    street: string;
    number: string;
    floor_apt: string | null;
    city: string;
    zone: string;
    postal_code: string | null;
  };
  service_type: {
    name: string;
    estimated_duration_min: number;
    base_price_cents: number;
  };
}

interface TimelineEntry {
  id: string;
  to_status: ServiceStatus;
  created_at: string;
  changed_by_name: string;
  notes: string | null;
}

interface Crew {
  id: string;
  name: string;
}

interface CurrentAssignment {
  id: string;
  crew_name: string;
  scheduled_date: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
}

export default function SolicitudDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [solicitud, setSolicitud] = useState<SolicitudDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [internalNotes, setInternalNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [selectedCrewId, setSelectedCrewId] = useState("");
  const [assignDate, setAssignDate] = useState("");
  const [assignStartTime, setAssignStartTime] = useState("");
  const [assignEndTime, setAssignEndTime] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState<CurrentAssignment | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError("No autenticado"); setLoading(false); return; }

        const [srRes, tlRes, crewsRes, assignmentRes] = await Promise.all([
          supabase
            .from("service_requests")
            .select(
              "*, profiles!service_requests_client_id_fkey(full_name, phone), service_types!inner(name, estimated_duration_min, base_price_cents), addresses!inner(street, number, floor_apt, city, zone, postal_code)"
            )
            .eq("id", id)
            .single(),
          supabase
            .from("service_state_log")
            .select(
              "id, to_status, created_at, notes, profiles!service_state_log_changed_by_fkey(full_name)"
            )
            .eq("service_request_id", id)
            .order("created_at", { ascending: true }),
          supabase
            .from("crews")
            .select("id, name")
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("assignments")
            .select("id, scheduled_date, scheduled_start_time, scheduled_end_time, crew:crews(name)")
            .eq("service_request_id", id)
            .limit(1)
            .maybeSingle(),
        ]);

        if (srRes.error) throw srRes.error;

        const d = srRes.data as Record<string, unknown>;
        const profile = d.profiles as { full_name: string; phone: string | null } | null;
        const st = d.service_types as { name: string; estimated_duration_min: number; base_price_cents: number };
        const addr = d.addresses as { street: string; number: string; floor_apt: string | null; city: string; zone: string; postal_code: string | null };

        const detail: SolicitudDetail = {
          id: d.id as string,
          request_number: d.request_number as number,
          status: d.status as ServiceStatus,
          urgency: d.urgency as string,
          created_at: d.created_at as string,
          description: d.description as string | null,
          preferred_date: d.preferred_date as string | null,
          preferred_time_slot: d.preferred_time_slot as string | null,
          estimated_area_sqm: d.estimated_area_sqm as number | null,
          photos: (d.photos as string[]) || [],
          internal_notes: d.internal_notes as string | null,
          client: {
            full_name: profile?.full_name ?? "Sin nombre",
            phone: profile?.phone ?? null,
          },
          address: addr,
          service_type: st,
        };

        setSolicitud(detail);
        setInternalNotes(detail.internal_notes || "");

        // Get signed URLs for photos
        if (detail.photos.length > 0) {
          const urls: string[] = [];
          for (const path of detail.photos) {
            const { data: signedUrl } = await supabase.storage
              .from("service-photos")
              .createSignedUrl(path, 3600);
            if (signedUrl?.signedUrl) urls.push(signedUrl.signedUrl);
          }
          setPhotoUrls(urls);
        }

        const mappedTl: TimelineEntry[] = (tlRes.data || []).map(
          (row: Record<string, unknown>) => {
            const p = row.profiles as { full_name: string } | null;
            return {
              id: row.id as string,
              to_status: row.to_status as ServiceStatus,
              created_at: row.created_at as string,
              changed_by_name: p?.full_name ?? "Sistema",
              notes: row.notes as string | null,
            };
          }
        );
        setTimeline(mappedTl);

        // Crews
        setCrews((crewsRes.data ?? []).map((c: Record<string, unknown>) => ({ id: c.id as string, name: c.name as string })));

        // Current assignment
        if (assignmentRes.data) {
          const a = assignmentRes.data as Record<string, unknown>;
          const crew = a.crew as { name: string } | null;
          setCurrentAssignment({
            id: a.id as string,
            crew_name: crew?.name ?? "Sin nombre",
            scheduled_date: a.scheduled_date as string,
            scheduled_start_time: a.scheduled_start_time as string | null,
            scheduled_end_time: a.scheduled_end_time as string | null,
          });
        }
      } catch {
        setError("Error al cargar la solicitud");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const saveNotes = async () => {
    if (!solicitud) return;
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("service_requests")
      .update({ internal_notes: internalNotes })
      .eq("id", solicitud.id);
    if (err) setError("Error al guardar notas");
    setSaving(false);
  };

  const transitionTo = async (newStatus: ServiceStatus) => {
    if (!solicitud) return;
    setTransitioning(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setTransitioning(false); return; }

    const { error: upErr } = await supabase
      .from("service_requests")
      .update({ status: newStatus })
      .eq("id", solicitud.id);

    if (upErr) {
      setError("Error al cambiar estado");
      setTransitioning(false);
      return;
    }

    await supabase.from("service_state_log").insert({
      service_request_id: solicitud.id,
      from_status: solicitud.status,
      to_status: newStatus,
      changed_by: user.id,
    });

    router.refresh();
    setSolicitud({ ...solicitud, status: newStatus });
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

  const handleAssign = async () => {
    if (!solicitud || !selectedCrewId || !assignDate) return;
    setAssigning(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAssigning(false); return; }

    const { data, error: assignErr } = await createAssignment(
      solicitud.id,
      selectedCrewId,
      assignDate,
      assignStartTime || null,
      assignEndTime || null,
      user.id
    );

    if (assignErr) {
      setError(assignErr);
      setAssigning(false);
      return;
    }

    const crew = crews.find((c) => c.id === selectedCrewId);
    setCurrentAssignment({
      id: data.id,
      crew_name: crew?.name ?? "",
      scheduled_date: assignDate,
      scheduled_start_time: assignStartTime || null,
      scheduled_end_time: assignEndTime || null,
    });
    setSolicitud({ ...solicitud, status: "crew_assigned" });
    setTimeline([
      ...timeline,
      {
        id: crypto.randomUUID(),
        to_status: "crew_assigned",
        created_at: new Date().toISOString(),
        changed_by_name: "Yo",
        notes: "Cuadrilla asignada",
      },
    ]);
    setAssigning(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="h-4 bg-gray-200 animate-pulse rounded w-1/3 mb-4" />
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-full" />
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 animate-pulse rounded w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !solicitud) {
    return <div className="p-8 text-center text-red-600"><p>{error}</p></div>;
  }

  if (!solicitud) return null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/solicitudes"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Solicitud #{solicitud.request_number}
              </h1>
              <StatusBadge status={solicitud.status} size="md" />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Creada el {formatDateTime(solicitud.created_at)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {solicitud.status === "request_created" && (
            <Button onClick={() => transitionTo("pending_review")} loading={transitioning}>
              <Eye size={16} />
              Marcar en revision
            </Button>
          )}
          <Link href={`/admin/presupuestos/new/editar?serviceId=${solicitud.id}`}>
            <Button variant="secondary">
              <FileText size={16} />
              Crear presupuesto
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle>Datos del cliente</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                  <User size={20} className="text-green-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {solicitud.client.full_name}
                  </p>
                  <p className="text-xs text-gray-500">Cliente</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                  <Phone size={20} className="text-blue-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {solicitud.client.phone || "-"}
                  </p>
                  <p className="text-xs text-gray-500">Telefono</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center">
                  <MapPin size={20} className="text-amber-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {solicitud.address.street} {solicitud.address.number}
                    {solicitud.address.floor_apt ? `, ${solicitud.address.floor_apt}` : ""}
                    , {solicitud.address.city}
                  </p>
                  <p className="text-xs text-gray-500">
                    {solicitud.address.zone}
                    {solicitud.address.postal_code ? ` - CP ${solicitud.address.postal_code}` : ""}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Service Details */}
          <Card>
            <CardHeader>
              <CardTitle>Detalles del servicio</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Tipo de servicio</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">
                    {solicitud.service_type.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Superficie estimada</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">
                    {solicitud.estimated_area_sqm ? `${solicitud.estimated_area_sqm} m2` : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Duracion estimada</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">
                    {solicitud.service_type.estimated_duration_min} min
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Precio base</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">
                    {formatCurrency(solicitud.service_type.base_price_cents)}
                  </p>
                </div>
              </div>

              {(solicitud.preferred_date || solicitud.preferred_time_slot) && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    Fecha y horario preferido
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Calendar size={14} className="text-gray-400" />
                    {solicitud.preferred_date ? formatDate(solicitud.preferred_date) : ""}{" "}
                    {solicitud.preferred_time_slot ? `- ${solicitud.preferred_time_slot}` : ""}
                  </div>
                </div>
              )}

              {solicitud.description && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    Descripcion del cliente
                  </p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                    {solicitud.description}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <ImageIcon size={18} />
                  Fotos del cliente ({solicitud.photos.length})
                </span>
              </CardTitle>
            </CardHeader>
            {photoUrls.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photoUrls.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Foto ${idx + 1}`}
                    className="aspect-square object-cover rounded-lg bg-gray-100"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {solicitud.photos.length > 0
                  ? solicitud.photos.map((_, idx) => (
                      <div
                        key={idx}
                        className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"
                      >
                        <ImageIcon size={32} />
                      </div>
                    ))
                  : (
                    <p className="text-sm text-gray-400 col-span-3">Sin fotos</p>
                  )}
              </div>
            )}
          </Card>

          {/* Asignar cuadrilla */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Users size={18} />
                  Asignar cuadrilla
                </span>
              </CardTitle>
            </CardHeader>
            {currentAssignment ? (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    {currentAssignment.crew_name}
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {formatDate(currentAssignment.scheduled_date)}
                    {currentAssignment.scheduled_start_time && ` — ${currentAssignment.scheduled_start_time}`}
                    {currentAssignment.scheduled_end_time && ` a ${currentAssignment.scheduled_end_time}`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Cuadrilla *
                  </label>
                  <select
                    value={selectedCrewId}
                    onChange={(e) => setSelectedCrewId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  >
                    <option value="">Seleccionar cuadrilla...</option>
                    {crews.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Fecha programada *
                  </label>
                  <input
                    type="date"
                    value={assignDate}
                    onChange={(e) => setAssignDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Hora inicio
                    </label>
                    <input
                      type="time"
                      value={assignStartTime}
                      onChange={(e) => setAssignStartTime(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Hora fin
                    </label>
                    <input
                      type="time"
                      value={assignEndTime}
                      onChange={(e) => setAssignEndTime(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleAssign}
                  loading={assigning}
                  disabled={!selectedCrewId || !assignDate}
                >
                  <Users size={14} />
                  Asignar cuadrilla
                </Button>
              </div>
            )}
          </Card>

          {/* Internal Notes */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <MessageSquare size={18} />
                  Notas internas
                </span>
              </CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Agregar notas internas sobre esta solicitud..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent placeholder:text-gray-400 resize-none"
              />
              <Button size="sm" variant="secondary" onClick={saveNotes} loading={saving}>
                <Send size={14} />
                Guardar nota
              </Button>
            </div>
          </Card>
        </div>

        {/* Right column - Timeline */}
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
                    <div className="pb-4">
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
    </div>
  );
}
