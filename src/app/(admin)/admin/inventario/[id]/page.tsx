"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Users,
  Calendar,
  Wrench,
  AlertTriangle,
  Trash2,
  Save,
  CheckCircle2,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";
import {
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_STATUS_COLORS,
  EQUIPMENT_TYPE_LABELS,
  type EquipmentStatus,
  type EquipmentType,
} from "@/lib/types";
import {
  updateEquipment,
  deleteEquipment,
  assignToCrew,
  unassignFromCrew,
} from "@/app/actions/equipment";

interface EquipmentDetail {
  id: string;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: EquipmentStatus;
  assigned_to_crew: string | null;
  purchase_date: string | null;
  last_maintenance: string | null;
  next_maintenance: string | null;
  notes: string | null;
  crew: { id: string; name: string } | null;
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
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded w-3/4" />
        ))}
      </div>
    </div>
  );
}

export default function EquipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [equipment, setEquipment] = useState<EquipmentDetail | null>(null);
  const [crews, setCrews] = useState<CrewOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  const [form, setForm] = useState({
    name: "",
    type: "",
    brand: "",
    model: "",
    serial_number: "",
    purchase_date: "",
    next_maintenance: "",
    notes: "",
  });

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      const [eqResult, crewsResult] = await Promise.all([
        supabase
          .from("equipment")
          .select("*, crew:crews!assigned_to_crew(id, name)")
          .eq("id", id)
          .single(),
        supabase
          .from("crews")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
      ]);

      if (eqResult.error) throw eqResult.error;

      const eq = eqResult.data as EquipmentDetail;
      setEquipment(eq);
      setForm({
        name: eq.name,
        type: eq.type,
        brand: eq.brand || "",
        model: eq.model || "",
        serial_number: eq.serial_number || "",
        purchase_date: eq.purchase_date || "",
        next_maintenance: eq.next_maintenance || "",
        notes: eq.notes || "",
      });

      setCrews(
        (crewsResult.data || []) as CrewOption[]
      );
    } catch {
      setError("Error al cargar equipo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const result = await updateEquipment(id, {
      name: form.name,
      type: form.type,
      brand: form.brand || undefined,
      model: form.model || undefined,
      serial_number: form.serial_number || undefined,
      purchase_date: form.purchase_date || undefined,
      next_maintenance: form.next_maintenance || undefined,
      notes: form.notes || undefined,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setEditing(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Estas seguro de eliminar este equipo?")) return;
    setDeleting(true);
    const result = await deleteEquipment(id);
    if (result.error) {
      setError(result.error);
      setDeleting(false);
    } else {
      router.push("/admin/inventario");
    }
  };

  const handleAssign = async () => {
    if (!selectedCrew) return;
    setAssigning(true);
    const result = await assignToCrew(id, selectedCrew);
    if (result.error) {
      setError(result.error);
    } else {
      setShowAssign(false);
      setSelectedCrew("");
      fetchData();
    }
    setAssigning(false);
  };

  const handleUnassign = async () => {
    setAssigning(true);
    const result = await unassignFromCrew(id);
    if (result.error) {
      setError(result.error);
    } else {
      fetchData();
    }
    setAssigning(false);
  };

  const handleMarkMaintenance = async () => {
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 3);
    const next = nextDate.toISOString().split("T")[0];

    const result = await updateEquipment(id, {
      last_maintenance: today,
      next_maintenance: next,
      status: equipment?.status === "maintenance" ? "available" : undefined,
    });

    if (result.error) {
      setError(result.error);
    } else {
      fetchData();
    }
    setSaving(false);
  };

  const handleSendToMaintenance = async () => {
    setSaving(true);
    const result = await updateEquipment(id, {
      status: "maintenance",
      assigned_to_crew: undefined,
    });
    if (result.error) {
      setError(result.error);
    } else {
      fetchData();
    }
    setSaving(false);
  };

  const handleRetire = async () => {
    if (!confirm("Estas seguro de retirar este equipo?")) return;
    setSaving(true);
    const result = await updateEquipment(id, { status: "retired" });
    if (result.error) {
      setError(result.error);
    } else {
      fetchData();
    }
    setSaving(false);
  };

  if (loading) return <SkeletonDetail />;
  if (!equipment) {
    return (
      <div className="text-center py-12 text-gray-500">
        Equipo no encontrado
      </div>
    );
  }

  const isOverdue =
    equipment.next_maintenance &&
    equipment.next_maintenance <= new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/inventario"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {equipment.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {EQUIPMENT_TYPE_LABELS[equipment.type as EquipmentType] ??
                equipment.type}
              {equipment.brand && ` - ${equipment.brand}`}
              {equipment.model && ` ${equipment.model}`}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${
            EQUIPMENT_STATUS_COLORS[equipment.status]
          }`}
        >
          {EQUIPMENT_STATUS_LABELS[equipment.status]}
        </span>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {isOverdue && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle size={18} />
          <span>Mantenimiento vencido o proximo</span>
        </div>
      )}

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle>Informacion del equipo</CardTitle>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Editar
            </Button>
          )}
        </CardHeader>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombre"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Tipo
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                >
                  {Object.entries(EQUIPMENT_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Marca"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
              <Input
                label="Modelo"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
              <Input
                label="Numero de serie"
                value={form.serial_number}
                onChange={(e) =>
                  setForm({ ...form, serial_number: e.target.value })
                }
              />
              <Input
                label="Fecha de compra"
                type="date"
                value={form.purchase_date}
                onChange={(e) =>
                  setForm({ ...form, purchase_date: e.target.value })
                }
              />
              <Input
                label="Proximo mantenimiento"
                type="date"
                value={form.next_maintenance}
                onChange={(e) =>
                  setForm({ ...form, next_maintenance: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Notas
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
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
              <span className="text-gray-500">Marca</span>
              <p className="font-medium text-gray-900">
                {equipment.brand || "-"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Modelo</span>
              <p className="font-medium text-gray-900">
                {equipment.model || "-"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Numero de serie</span>
              <p className="font-medium text-gray-900">
                {equipment.serial_number || "-"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Fecha de compra</span>
              <p className="font-medium text-gray-900">
                {equipment.purchase_date
                  ? formatDate(equipment.purchase_date)
                  : "-"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Ultimo mantenimiento</span>
              <p className="font-medium text-gray-900">
                {equipment.last_maintenance
                  ? formatDate(equipment.last_maintenance)
                  : "-"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Proximo mantenimiento</span>
              <p
                className={`font-medium ${
                  isOverdue ? "text-red-600" : "text-gray-900"
                }`}
              >
                {equipment.next_maintenance
                  ? formatDate(equipment.next_maintenance)
                  : "-"}
                {isOverdue && " (Vencido)"}
              </p>
            </div>
            {equipment.notes && (
              <div className="sm:col-span-2">
                <span className="text-gray-500">Notas</span>
                <p className="font-medium text-gray-900">{equipment.notes}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Crew assignment */}
      <Card>
        <CardHeader>
          <CardTitle>Asignacion de cuadrilla</CardTitle>
        </CardHeader>

        {equipment.crew ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
              <Users size={20} className="text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">
                  {equipment.crew.name}
                </p>
                <p className="text-sm text-gray-500">Cuadrilla asignada</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnassign}
              loading={assigning}
            >
              Desasignar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Este equipo no esta asignado a ninguna cuadrilla.
            </p>
            {showAssign ? (
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
                  onClick={handleAssign}
                  loading={assigning}
                  disabled={!selectedCrew}
                >
                  Asignar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAssign(false)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAssign(true)}
              >
                <Users size={16} />
                Asignar a cuadrilla
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={handleMarkMaintenance} loading={saving}>
            <CheckCircle2 size={16} />
            Marcar mantenimiento realizado
          </Button>
          {equipment.status !== "maintenance" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendToMaintenance}
              loading={saving}
            >
              <Wrench size={16} />
              Enviar a mantenimiento
            </Button>
          )}
          {equipment.status !== "retired" && (
            <Button variant="outline" size="sm" onClick={handleRetire} loading={saving}>
              <Package size={16} />
              Retirar equipo
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            loading={deleting}
          >
            <Trash2 size={16} />
            Eliminar
          </Button>
        </div>
      </Card>
    </div>
  );
}
