"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Users,
  Phone,
  Mail,
  Star,
  Clock,
  ClipboardList,
  Save,
  UserX,
  MapPin,
  Camera,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import StatusBadge from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";
import { ROLE_LABELS, type UserRole, type ServiceStatus } from "@/lib/types";
import {
  updateStaffProfile,
  deactivateStaff,
  getStaffStats,
} from "@/app/actions/personnel";
import { addCrewMember, removeCrewMember } from "@/app/actions/crews";

interface StaffDetail {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  avatar_url: string | null;
  crew_info: {
    crew_id: string;
    role_in_crew: string;
    crew: { id: string; name: string };
  } | null;
  recent_assignments: {
    id: string;
    scheduled_date: string;
    service_request: {
      request_number: number;
      status: ServiceStatus;
      service_type: { name: string };
      address: { street: string; number: string; city: string };
    };
  }[];
}

interface StaffStatsData {
  completed_assignments: number;
  avg_rating: number | null;
  total_hours: number;
}

interface CrewOption {
  id: string;
  name: string;
}

function SkeletonDetail() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded w-3/4" />
        ))}
      </div>
    </div>
  );
}

export default function PersonalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [person, setPerson] = useState<StaffDetail | null>(null);
  const [stats, setStats] = useState<StaffStatsData | null>(null);
  const [crews, setCrews] = useState<CrewOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCrewAssign, setShowCrewAssign] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    role: "operator" as UserRole,
  });

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // Fetch profile
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileErr) throw profileErr;

      // Fetch crew membership
      const { data: crewData } = await supabase
        .from("crew_members")
        .select("crew_id, role_in_crew, crew:crews(id, name)")
        .eq("user_id", userId)
        .limit(1);

      const crewInfo = crewData?.[0] ?? null;

      // Fetch recent assignments via crew
      let recentAssignments: StaffDetail["recent_assignments"] = [];
      if (crewInfo) {
        const { data: assignments } = await supabase
          .from("assignments")
          .select(
            "id, scheduled_date, service_request:service_requests(request_number, status, service_type:service_types(name), address:addresses(street, number, city))"
          )
          .eq("crew_id", crewInfo.crew_id)
          .order("scheduled_date", { ascending: false })
          .limit(10);

        recentAssignments = (assignments || []) as unknown as StaffDetail["recent_assignments"];
      }

      // Fetch crews for assignment
      const { data: crewsList } = await supabase
        .from("crews")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      const detail: StaffDetail = {
        ...profile,
        crew_info: crewInfo as StaffDetail["crew_info"],
        recent_assignments: recentAssignments,
      };

      setPerson(detail);
      setAvatarUrl(profile.avatar_url ?? null);
      setForm({
        full_name: detail.full_name,
        phone: detail.phone || "",
        role: detail.role,
      });
      setCrews((crewsList || []) as CrewOption[]);

      // Fetch stats
      const statsResult = await getStaffStats(userId);
      if (statsResult.data) setStats(statsResult.data);
    } catch {
      setError("Error al cargar datos del personal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateStaffProfile(userId, { avatar_url: publicUrl });
      setAvatarUrl(publicUrl);
    } catch {
      setError("Error al subir la foto. Verificá que el bucket 'avatars' exista en Supabase Storage.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await updateStaffProfile(userId, {
      full_name: form.full_name,
      phone: form.phone || undefined,
      role: form.role,
    });
    if (result.error) {
      setError(result.error);
    } else {
      setEditing(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDeactivate = async () => {
    if (!confirm("Estas seguro de desactivar este usuario?")) return;
    setSaving(true);
    const result = await deactivateStaff(userId);
    if (result.error) {
      setError(result.error);
    } else {
      fetchData();
    }
    setSaving(false);
  };

  const handleActivate = async () => {
    setSaving(true);
    const result = await updateStaffProfile(userId, { is_active: true });
    if (result.error) {
      setError(result.error);
    } else {
      fetchData();
    }
    setSaving(false);
  };

  const handleAssignCrew = async () => {
    if (!selectedCrew) return;
    setAssigning(true);
    const role = form.role === "crew_leader" ? "leader" : "operator";
    const result = await addCrewMember(selectedCrew, userId, role as "leader" | "operator");
    if (result.error) {
      setError(result.error);
    } else {
      setShowCrewAssign(false);
      setSelectedCrew("");
      fetchData();
    }
    setAssigning(false);
  };

  const handleRemoveFromCrew = async () => {
    if (!person?.crew_info) return;
    setAssigning(true);
    const result = await removeCrewMember(person.crew_info.crew_id, userId);
    if (result.error) {
      setError(result.error);
    } else {
      fetchData();
    }
    setAssigning(false);
  };

  if (loading) return <SkeletonDetail />;
  if (!person) {
    return (
      <div className="text-center py-12 text-gray-500">
        Usuario no encontrado
      </div>
    );
  }

  const roleOptions: UserRole[] = [
    "admin",
    "supervisor",
    "crew_leader",
    "operator",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/personal"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {person.full_name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {ROLE_LABELS[person.role]}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${
            person.is_active
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {person.is_active ? "Activo" : "Inactivo"}
        </span>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <ClipboardList size={20} className="text-green-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.completed_assignments}
                </p>
                <p className="text-xs text-gray-500">
                  Servicios completados
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Star size={20} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.avg_rating?.toFixed(1) ?? "-"}
                </p>
                <p className="text-xs text-gray-500">
                  Calificacion promedio
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.total_hours}h
                </p>
                <p className="text-xs text-gray-500">Horas trabajadas</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Avatar upload */}
      <Card>
        <div className="flex items-center gap-5">
          <div className="relative group">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative w-20 h-20 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              title="Cambiar foto"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={person.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-green-100 flex items-center justify-center">
                  <span className="text-2xl font-bold text-green-800">
                    {person.full_name.split(" ").slice(0, 2).map((n) => n[0] || "").join("").toUpperCase()}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera size={20} className="text-white" />
                )}
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-lg">{person.full_name}</p>
            <p className="text-sm text-gray-500">{ROLE_LABELS[person.role]}</p>
            <p className="text-xs text-gray-400 mt-1">
              {avatarUrl ? "Clic en la foto para cambiarla" : "Clic para subir una foto"}
            </p>
          </div>
        </div>
      </Card>

      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle>Informacion del perfil</CardTitle>
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Editar
            </Button>
          )}
        </CardHeader>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombre completo"
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
              />
              <Input
                label="Telefono"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Rol
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as UserRole })
                  }
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSave} loading={saving} size="sm">
                <Save size={16} />
                Guardar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
            <div>
              <span className="text-gray-500 flex items-center gap-1">
                <User size={14} /> Nombre
              </span>
              <p className="font-medium text-gray-900">{person.full_name}</p>
            </div>
            <div>
              <span className="text-gray-500 flex items-center gap-1">
                <Phone size={14} /> Telefono
              </span>
              <p className="font-medium text-gray-900">
                {person.phone || "-"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Rol</span>
              <p className="font-medium text-gray-900">
                {ROLE_LABELS[person.role]}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Miembro desde</span>
              <p className="font-medium text-gray-900">
                {formatDate(person.created_at)}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Crew assignment */}
      <Card>
        <CardHeader>
          <CardTitle>Cuadrilla</CardTitle>
        </CardHeader>

        {person.crew_info ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
              <Users size={20} className="text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">
                  {person.crew_info.crew.name}
                </p>
                <p className="text-sm text-gray-500">
                  Rol:{" "}
                  {person.crew_info.role_in_crew === "leader"
                    ? "Lider"
                    : "Operario"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveFromCrew}
              loading={assigning}
            >
              Remover de cuadrilla
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              No esta asignado a ninguna cuadrilla.
            </p>
            {showCrewAssign ? (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cuadrilla
                  </label>
                  <select
                    value={selectedCrew}
                    onChange={(e) => setSelectedCrew(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  >
                    <option value="">Seleccionar cuadrilla...</option>
                    {crews.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  size="sm"
                  onClick={handleAssignCrew}
                  loading={assigning}
                  disabled={!selectedCrew}
                >
                  Asignar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCrewAssign(false)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCrewAssign(true)}
              >
                <Users size={16} />
                Asignar a cuadrilla
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Recent assignments */}
      {person.recent_assignments.length > 0 && (
        <Card padding={false}>
          <div className="px-6 pt-6 pb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              Trabajos recientes
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    #
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Servicio
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">
                    Direccion
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Fecha
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {person.recent_assignments.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-600">
                      #{a.service_request?.request_number}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {a.service_request?.service_type?.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      <span className="flex items-center gap-1">
                        <MapPin size={14} className="text-gray-400" />
                        {a.service_request?.address?.street}{" "}
                        {a.service_request?.address?.number}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(a.scheduled_date)}
                    </td>
                    <td className="px-4 py-3">
                      {a.service_request?.status && (
                        <StatusBadge status={a.service_request.status} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          {person.is_active ? (
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeactivate}
              loading={saving}
            >
              <UserX size={16} />
              Desactivar usuario
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleActivate}
              loading={saving}
            >
              <User size={16} />
              Reactivar usuario
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
