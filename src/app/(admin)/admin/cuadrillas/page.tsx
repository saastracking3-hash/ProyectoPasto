"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, MapPin, UserCheck, Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

interface CrewRow {
  id: string;
  name: string;
  leader_name: string | null;
  members_count: number;
  zone: string | null;
  is_active: boolean;
  has_active_assignment: boolean;
}

export default function CuadrillasPage() {
  const [crews, setCrews] = useState<CrewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newZone, setNewZone] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("No autenticado"); setLoading(false); return; }

      const { data: crewsData, error: fetchErr } = await supabase
        .from("crews")
        .select(
          "id, name, zone, is_active, leader_id, profiles!crews_leader_id_fkey(full_name), crew_members(id)"
        )
        .order("name", { ascending: true });

      if (fetchErr) throw fetchErr;

      // Check for active assignments today
      const today = new Date().toISOString().split("T")[0];
      const { data: activeAssignments } = await supabase
        .from("assignments")
        .select("crew_id")
        .eq("scheduled_date", today);

      const activeCrewIds = new Set(
        (activeAssignments || []).map((a: { crew_id: string }) => a.crew_id)
      );

      const mapped: CrewRow[] = (crewsData || []).map((row: Record<string, unknown>) => {
        const profile = row.profiles as { full_name: string } | null;
        const members = row.crew_members as { id: string }[] | null;
        return {
          id: row.id as string,
          name: row.name as string,
          leader_name: profile?.full_name ?? null,
          members_count: members?.length ?? 0,
          zone: row.zone as string | null,
          is_active: row.is_active as boolean,
          has_active_assignment: activeCrewIds.has(row.id as string),
        };
      });

      setCrews(mapped);
    } catch {
      setError("Error al cargar cuadrillas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const supabase = createClient();

    try {
      const { error: insertErr } = await supabase
        .from("crews")
        .insert({
          name: newName.trim(),
          zone: newZone.trim() || null,
          is_active: true,
        });

      if (insertErr) throw insertErr;

      setNewName("");
      setNewZone("");
      setShowCreateForm(false);
      fetchData();
    } catch {
      setError("Error al crear cuadrilla");
    } finally {
      setCreating(false);
    }
  };

  const getStatus = (crew: CrewRow) => {
    if (!crew.is_active) return { label: "Inactiva", color: "bg-gray-100 text-gray-600" };
    if (crew.has_active_assignment) return { label: "En servicio", color: "bg-blue-100 text-blue-700" };
    return { label: "Disponible", color: "bg-green-100 text-green-700" };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cuadrillas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestion de equipos de trabajo
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus size={16} />
          Nueva cuadrilla
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {showCreateForm && (
        <Card>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre de la cuadrilla"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
              <input
                type="text"
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
                placeholder="Zona (opcional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>
            <Button onClick={handleCreate} loading={creating}>
              Crear
            </Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Lider</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Miembros</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Zona</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 animate-pulse rounded w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                : crews.map((crew) => {
                    const status = getStatus(crew);
                    return (
                      <tr
                        key={crew.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/cuadrillas/${crew.id}`}
                            className="text-green-700 hover:text-green-800 font-medium flex items-center gap-2"
                          >
                            <Users size={16} className="text-gray-400" />
                            {crew.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          <span className="flex items-center gap-2">
                            <UserCheck size={14} className="text-gray-400" />
                            {crew.leader_name || <span className="text-gray-400">Sin lider</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {crew.members_count}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <span className="flex items-center gap-1">
                            <MapPin size={14} className="text-gray-400" />
                            {crew.zone || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${status.color}`}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              {!loading && crews.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No hay cuadrillas registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
