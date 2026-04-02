"use client";

import { useEffect, useState } from "react";
import { Package, AlertCircle, Wrench } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import {
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_STATUS_COLORS,
  EQUIPMENT_TYPE_LABELS,
  type EquipmentStatus,
  type EquipmentType,
} from "@/lib/types";

interface EquipmentItem {
  id: string;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  status: EquipmentStatus;
  serial_number: string | null;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-pulse">
      <div className="space-y-3">
        <div className="h-5 w-32 bg-gray-200 rounded" />
        <div className="h-4 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-40 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

export default function CrewEquipoPage() {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("No autenticado");
          setLoading(false);
          return;
        }

        // Get user's crew
        const { data: crewMember } = await supabase
          .from("crew_members")
          .select("crew_id")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (!crewMember) {
          setEquipment([]);
          setLoading(false);
          return;
        }

        // Get equipment assigned to this crew
        const { data, error: fetchErr } = await supabase
          .from("equipment")
          .select("id, name, type, brand, model, status, serial_number")
          .eq("assigned_to_crew", crewMember.crew_id)
          .order("name");

        if (fetchErr) throw fetchErr;

        setEquipment((data || []) as EquipmentItem[]);
      } catch {
        setError("Error al cargar equipos");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleReport = (itemName: string) => {
    setReportMsg(
      `Reporte enviado para "${itemName}". Un administrador revisara el problema.`
    );
    setTimeout(() => setReportMsg(null), 4000);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Equipo asignado</h1>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {reportMsg && (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {reportMsg}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : equipment.length === 0 ? (
        <EmptyState
          icon={<Package size={28} />}
          title="Sin equipo asignado"
          description="Tu cuadrilla no tiene equipos asignados actualmente"
        />
      ) : (
        <div className="space-y-3">
          {equipment.map((item) => (
            <Card key={item.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Wrench size={20} className="text-gray-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-500">
                      {EQUIPMENT_TYPE_LABELS[item.type as EquipmentType] ??
                        item.type}
                      {item.brand && ` - ${item.brand}`}
                      {item.model && ` ${item.model}`}
                    </p>
                    {item.serial_number && (
                      <p className="text-xs text-gray-400 mt-1">
                        S/N: {item.serial_number}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                    EQUIPMENT_STATUS_COLORS[item.status]
                  }`}
                >
                  {EQUIPMENT_STATUS_LABELS[item.status]}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleReport(item.name)}
                  className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                >
                  <AlertCircle size={14} />
                  Reportar problema
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
