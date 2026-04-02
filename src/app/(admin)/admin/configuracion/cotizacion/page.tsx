"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import QuoteCalculator from "@/components/admin/QuoteCalculator";
import {
  getAllQuoteRules,
  createQuoteRule,
  updateQuoteRule,
  deleteQuoteRule,
  type QuoteRule,
  type QuoteRuleInput,
} from "@/app/actions/quoteRules";
import { createClient } from "@/lib/supabase/client";
import type { ServiceType } from "@/lib/types";

const zones = ["CABA", "Zona Norte", "Zona Oeste"];

function formatCents(cents: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const emptyForm: QuoteRuleInput = {
  service_type_id: "",
  zone: null,
  area_min_sqm: 0,
  area_max_sqm: 9999,
  base_price_cents: 0,
  price_per_sqm_cents: 0,
  multiplier: 1,
  is_active: true,
};

export default function CotizacionConfigPage() {
  const [rules, setRules] = useState<QuoteRule[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QuoteRuleInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [rulesRes, stRes] = await Promise.all([
        getAllQuoteRules(),
        (async () => {
          const supabase = createClient();
          const { data } = await supabase
            .from("service_types")
            .select("*")
            .eq("is_active", true)
            .order("sort_order");
          return data || [];
        })(),
      ]);
      if (rulesRes.data) setRules(rulesRes.data);
      setServiceTypes(stRes as ServiceType[]);
    } catch {
      setError("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (rule: QuoteRule) => {
    setEditingId(rule.id);
    setForm({
      service_type_id: rule.service_type_id,
      zone: rule.zone,
      area_min_sqm: rule.area_min_sqm,
      area_max_sqm: rule.area_max_sqm,
      base_price_cents: rule.base_price_cents,
      price_per_sqm_cents: rule.price_per_sqm_cents,
      multiplier: rule.multiplier,
      is_active: rule.is_active,
    });
    setShowForm(true);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const { error } = await updateQuoteRule(editingId, form);
        if (error) throw new Error(error);
      } else {
        const { error } = await createQuoteRule(form);
        if (error) throw new Error(error);
      }
      setShowForm(false);
      setEditingId(null);
      loadData();
    } catch (e: any) {
      setError(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta regla de cotizacion?")) return;
    const { error } = await deleteQuoteRule(id);
    if (error) {
      setError(error);
    } else {
      loadData();
    }
  };

  const updateForm = (fields: Partial<QuoteRuleInput>) =>
    setForm((prev) => ({ ...prev, ...fields }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Reglas de cotizacion
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Configura precios automaticos por tipo de servicio, zona y superficie
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Rules table */}
      <Card padding={false}>
        <CardHeader className="px-6 pt-6">
          <CardTitle>Reglas activas</CardTitle>
          <Button size="sm" onClick={openAdd}>
            <Plus size={14} />
            Agregar regla
          </Button>
        </CardHeader>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div className="px-6 pb-6">
            <p className="text-sm text-gray-400 text-center py-8">
              No hay reglas configuradas. Agrega la primera.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Servicio
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Zona
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Superficie
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Base
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    $/m2
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mult.
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {rule.service_type_name || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {rule.zone || "Todas"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {rule.area_min_sqm} - {rule.area_max_sqm} m2
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCents(rule.base_price_cents)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCents(rule.price_per_sqm_cents)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      x{rule.multiplier.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          rule.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {rule.is_active ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(rule)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add/Edit form modal */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? "Editar regla" : "Nueva regla de cotizacion"}
            </CardTitle>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X size={20} />
            </button>
          </CardHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tipo de servicio
                </label>
                <select
                  value={form.service_type_id}
                  onChange={(e) => updateForm({ service_type_id: e.target.value })}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                >
                  <option value="">Seleccionar</option>
                  {serviceTypes.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Zona (dejar vacio = todas)
                </label>
                <select
                  value={form.zone || ""}
                  onChange={(e) =>
                    updateForm({ zone: e.target.value || null })
                  }
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                >
                  <option value="">Todas las zonas</option>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Input
                label="Area minima (m2)"
                type="number"
                value={form.area_min_sqm.toString()}
                onChange={(e) =>
                  updateForm({ area_min_sqm: parseFloat(e.target.value) || 0 })
                }
              />
              <Input
                label="Area maxima (m2)"
                type="number"
                value={form.area_max_sqm.toString()}
                onChange={(e) =>
                  updateForm({ area_max_sqm: parseFloat(e.target.value) || 0 })
                }
              />
              <Input
                label="Precio base ($)"
                type="number"
                value={(form.base_price_cents / 100).toString()}
                onChange={(e) =>
                  updateForm({
                    base_price_cents: Math.round(
                      (parseFloat(e.target.value) || 0) * 100
                    ),
                  })
                }
              />
              <Input
                label="Precio/m2 ($)"
                type="number"
                value={(form.price_per_sqm_cents / 100).toString()}
                onChange={(e) =>
                  updateForm({
                    price_per_sqm_cents: Math.round(
                      (parseFloat(e.target.value) || 0) * 100
                    ),
                  })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Multiplicador"
                type="number"
                value={form.multiplier.toString()}
                onChange={(e) =>
                  updateForm({ multiplier: parseFloat(e.target.value) || 1 })
                }
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Estado
                </label>
                <select
                  value={form.is_active ? "true" : "false"}
                  onChange={(e) =>
                    updateForm({ is_active: e.target.value === "true" })
                  }
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                >
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={!form.service_type_id || saving}
                loading={saving}
              >
                <Save size={14} />
                {editingId ? "Guardar cambios" : "Crear regla"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Test Calculator */}
      <QuoteCalculator serviceTypes={serviceTypes} />
    </div>
  );
}
