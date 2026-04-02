"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  Plus,
  Filter,
  AlertTriangle,
  Users,
  Wrench,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";
import {
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_STATUS_COLORS,
  EQUIPMENT_TYPE_LABELS,
  type EquipmentStatus,
  type EquipmentType,
} from "@/lib/types";

interface EquipmentRow {
  id: string;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  status: EquipmentStatus;
  crew_name: string | null;
  next_maintenance: string | null;
  is_overdue: boolean;
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

export default function InventarioPage() {
  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      let query = supabase
        .from("equipment")
        .select("*, crew:crews!assigned_to_crew(id, name)")
        .order("name");

      if (filterType) query = query.eq("type", filterType);
      if (filterStatus) query = query.eq("status", filterStatus);

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      const today = new Date().toISOString().split("T")[0];

      const mapped: EquipmentRow[] = (data || []).map(
        (row: Record<string, unknown>) => {
          const crew = row.crew as { id: string; name: string } | null;
          const nextMaint = row.next_maintenance as string | null;
          return {
            id: row.id as string,
            name: row.name as string,
            type: row.type as string,
            brand: row.brand as string | null,
            model: row.model as string | null,
            status: row.status as EquipmentStatus,
            crew_name: crew?.name ?? null,
            next_maintenance: nextMaint,
            is_overdue: nextMaint ? nextMaint <= today : false,
          };
        }
      );

      setEquipment(mapped);
    } catch {
      setError("Error al cargar inventario");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterStatus]);

  const overdueCount = equipment.filter((e) => e.is_overdue).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestion de equipos y herramientas
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
          <Link href="/admin/inventario/nuevo">
            <Button size="sm">
              <Plus size={16} />
              Agregar equipo
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {overdueCount > 0 && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle size={18} />
          <span>
            <strong>{overdueCount}</strong>{" "}
            {overdueCount === 1 ? "equipo tiene" : "equipos tienen"}{" "}
            mantenimiento vencido o proximo
          </span>
        </div>
      )}

      {showFilters && (
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(EQUIPMENT_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              >
                <option value="">Todos</option>
                {Object.entries(EQUIPMENT_STATUS_LABELS).map(
                  ([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterType("");
                setFilterStatus("");
              }}
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
                  Tipo
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">
                  Marca / Modelo
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Estado
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">
                  Asignado a
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">
                  Mantenimiento
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : (
                equipment.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      item.is_overdue ? "bg-red-50/50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/inventario/${item.id}`}
                        className="text-green-700 hover:text-green-800 font-medium flex items-center gap-2"
                      >
                        <Package size={16} className="text-gray-400" />
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {EQUIPMENT_TYPE_LABELS[
                        item.type as EquipmentType
                      ] ?? item.type}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {[item.brand, item.model]
                        .filter(Boolean)
                        .join(" ") || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          EQUIPMENT_STATUS_COLORS[item.status]
                        }`}
                      >
                        {EQUIPMENT_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {item.crew_name ? (
                        <span className="flex items-center gap-1">
                          <Users size={14} className="text-gray-400" />
                          {item.crew_name}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {item.next_maintenance ? (
                        <span
                          className={`flex items-center gap-1 ${
                            item.is_overdue
                              ? "text-red-600 font-medium"
                              : "text-gray-600"
                          }`}
                        >
                          {item.is_overdue && (
                            <AlertTriangle size={14} />
                          )}
                          {formatDate(item.next_maintenance)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
              {!loading && equipment.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <EmptyState
                      icon={<Wrench size={28} />}
                      title="Sin equipos registrados"
                      description="Agrega tu primer equipo al inventario"
                      action={
                        <Link href="/admin/inventario/nuevo">
                          <Button size="sm">
                            <Plus size={16} />
                            Agregar equipo
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
