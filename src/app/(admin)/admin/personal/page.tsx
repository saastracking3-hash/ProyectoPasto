"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User, Plus, Filter, Phone, Users, Star } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS, type UserRole } from "@/lib/types";

interface StaffRow {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  crew_name: string | null;
  avg_rating: number | null;
  avatar_url: string | null;
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initials = name.split(" ").slice(0, 2).map((n) => n[0] || "").join("").toUpperCase();
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 text-green-800 font-semibold text-xs">
      {initials}
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-gray-100">
          {Array.from({ length: 6 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-gray-200 animate-pulse rounded w-20" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function PersonalPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      let query = supabase
        .from("profiles")
        .select(
          "id, full_name, role, phone, is_active, avatar_url, crew_member:crew_members(crew:crews(name))"
        )
        .neq("role", "client")
        .order("full_name");

      if (filterRole) {
        query = query.eq("role", filterRole);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      const mapped: StaffRow[] = (data || []).map(
        (row: Record<string, unknown>) => {
          const crewMembers = row.crew_member as
            | { crew: { name: string } | null }[]
            | null;
          const crewName = crewMembers?.[0]?.crew?.name ?? null;

          return {
            id: row.id as string,
            full_name: row.full_name as string,
            role: row.role as UserRole,
            phone: row.phone as string | null,
            is_active: row.is_active as boolean,
            crew_name: crewName,
            avg_rating: null,
            avatar_url: (row.avatar_url as string | null) ?? null,
          };
        }
      );

      setStaff(mapped);
    } catch {
      setError("Error al cargar personal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRole]);

  const roleFilterOptions: UserRole[] = [
    "admin",
    "supervisor",
    "crew_leader",
    "operator",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personal</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestion de empleados y roles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            Filtros
          </Button>
          <Link href="/admin/personal/nuevo">
            <Button size="sm">
              <Plus size={16} />
              Agregar personal
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {showFilters && (
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rol
              </label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              >
                <option value="">Todos</option>
                {roleFilterOptions.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterRole("")}
            >
              Limpiar filtros
            </Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Rol
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">
                  Cuadrilla
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">
                  Telefono
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Estado
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">
                  Calificacion
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : (
                staff.map((person) => (
                  <tr
                    key={person.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/personal/${person.id}`}
                        className="text-green-700 hover:text-green-800 font-medium flex items-center gap-2"
                      >
                        <Avatar url={person.avatar_url} name={person.full_name} />
                        {person.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {ROLE_LABELS[person.role]}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {person.crew_name ? (
                        <span className="flex items-center gap-1">
                          <Users size={14} className="text-gray-400" />
                          {person.crew_name}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {person.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone size={14} className="text-gray-400" />
                          {person.phone}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          person.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {person.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {person.avg_rating ? (
                        <span className="flex items-center gap-1">
                          <Star
                            size={14}
                            className="text-yellow-500 fill-yellow-500"
                          />
                          {person.avg_rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
              {!loading && staff.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <EmptyState
                      icon={<User size={28} />}
                      title="Sin personal registrado"
                      description="Agrega tu primer empleado"
                      action={
                        <Link href="/admin/personal/nuevo">
                          <Button size="sm">
                            <Plus size={16} />
                            Agregar personal
                          </Button>
                        </Link>
                      }
                    />
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
