"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  CheckSquare,
  Wrench,
  GripVertical,
  Save,
  X,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/format";

interface ServiceTypeRow {
  id: string;
  name: string;
  slug: string;
  base_price_cents: number;
  estimated_duration_min: number;
  is_active: boolean;
}

interface TemplateRow {
  id: string;
  service_type_id: string;
  service_type_name: string;
  name: string;
  items: { id: string; description: string; sort_order: number; is_required: boolean }[];
}

export default function ConfiguracionPage() {
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editing service type
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "", base_price_cents: 0, estimated_duration_min: 0 });
  const [savingType, setSavingType] = useState(false);

  // New service type
  const [showNewType, setShowNewType] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", slug: "", base_price_cents: 0, estimated_duration_min: 0 });
  const [creatingType, setCreatingType] = useState(false);

  // New template
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", service_type_id: "", items: "" });
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("No autenticado"); setLoading(false); return; }

      const [typesRes, templatesRes] = await Promise.all([
        supabase
          .from("service_types")
          .select("id, name, slug, base_price_cents, estimated_duration_min, is_active")
          .order("sort_order", { ascending: true }),
        supabase
          .from("checklist_templates")
          .select("id, name, service_type_id, service_types!inner(name), checklist_template_items(id, description, sort_order, is_required)")
          .order("created_at", { ascending: true }),
      ]);

      if (typesRes.error) throw typesRes.error;

      setServiceTypes(
        (typesRes.data || []).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          name: s.name as string,
          slug: s.slug as string,
          base_price_cents: s.base_price_cents as number,
          estimated_duration_min: s.estimated_duration_min as number,
          is_active: s.is_active as boolean,
        }))
      );

      setTemplates(
        (templatesRes.data || []).map((t: Record<string, unknown>) => {
          const st = t.service_types as { name: string } | null;
          const items = t.checklist_template_items as { id: string; description: string; sort_order: number; is_required: boolean }[] | null;
          return {
            id: t.id as string,
            service_type_id: t.service_type_id as string,
            service_type_name: st?.name ?? "-",
            name: t.name as string,
            items: (items || []).sort((a, b) => a.sort_order - b.sort_order),
          };
        })
      );
    } catch {
      setError("Error al cargar la configuracion");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleActive = async (id: string, currentActive: boolean) => {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("service_types")
      .update({ is_active: !currentActive })
      .eq("id", id);

    if (err) {
      setError("Error al actualizar estado");
    } else {
      setServiceTypes((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: !currentActive } : s))
      );
    }
  };

  const startEdit = (st: ServiceTypeRow) => {
    setEditingId(st.id);
    setEditForm({
      name: st.name,
      slug: st.slug,
      base_price_cents: st.base_price_cents,
      estimated_duration_min: st.estimated_duration_min,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSavingType(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("service_types")
      .update({
        name: editForm.name,
        slug: editForm.slug,
        base_price_cents: editForm.base_price_cents,
        estimated_duration_min: editForm.estimated_duration_min,
      })
      .eq("id", editingId);

    if (err) {
      setError("Error al guardar");
    } else {
      setServiceTypes((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? { ...s, ...editForm }
            : s
        )
      );
      setEditingId(null);
    }
    setSavingType(false);
  };

  const createServiceType = async () => {
    if (!newForm.name.trim()) return;
    setCreatingType(true);
    const supabase = createClient();

    const slug = newForm.slug || newForm.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { error: err } = await supabase
      .from("service_types")
      .insert({
        name: newForm.name.trim(),
        slug,
        base_price_cents: newForm.base_price_cents,
        estimated_duration_min: newForm.estimated_duration_min,
        is_active: true,
        sort_order: serviceTypes.length,
      });

    if (err) {
      setError("Error al crear tipo de servicio");
    } else {
      setShowNewType(false);
      setNewForm({ name: "", slug: "", base_price_cents: 0, estimated_duration_min: 0 });
      fetchData();
    }
    setCreatingType(false);
  };

  const createTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.service_type_id) return;
    setCreatingTemplate(true);
    const supabase = createClient();

    const { data: tmpl, error: tmplErr } = await supabase
      .from("checklist_templates")
      .insert({
        name: newTemplate.name.trim(),
        service_type_id: newTemplate.service_type_id,
      })
      .select("id")
      .single();

    if (tmplErr || !tmpl) {
      setError("Error al crear plantilla");
      setCreatingTemplate(false);
      return;
    }

    const itemDescriptions = newTemplate.items.split("\n").map((s) => s.trim()).filter(Boolean);
    if (itemDescriptions.length > 0) {
      await supabase.from("checklist_template_items").insert(
        itemDescriptions.map((desc, idx) => ({
          template_id: tmpl.id,
          description: desc,
          sort_order: idx,
          is_required: true,
        }))
      );
    }

    setShowNewTemplate(false);
    setNewTemplate({ name: "", service_type_id: "", items: "" });
    fetchData();
    setCreatingTemplate(false);
  };

  const deleteTemplate = async (templateId: string) => {
    const supabase = createClient();
    await supabase.from("checklist_template_items").delete().eq("template_id", templateId);
    const { error: err } = await supabase.from("checklist_templates").delete().eq("id", templateId);
    if (err) {
      setError("Error al eliminar plantilla");
    } else {
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 animate-pulse rounded w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings size={24} />
          Configuracion
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Tipos de servicio y plantillas de checklist
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Service Types */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <CardTitle>
            <span className="flex items-center gap-2">
              <Wrench size={18} />
              Tipos de servicio
            </span>
          </CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setShowNewType(!showNewType)}>
            <Plus size={14} />
            Agregar tipo
          </Button>
        </div>

        {showNewType && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <input
                type="text"
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="Nombre"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
              <input
                type="text"
                value={newForm.slug}
                onChange={(e) => setNewForm({ ...newForm, slug: e.target.value })}
                placeholder="Slug"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
              <input
                type="number"
                value={newForm.base_price_cents / 100}
                onChange={(e) => setNewForm({ ...newForm, base_price_cents: (parseFloat(e.target.value) || 0) * 100 })}
                placeholder="Precio base ($)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
              <input
                type="number"
                value={newForm.estimated_duration_min}
                onChange={(e) => setNewForm({ ...newForm, estimated_duration_min: parseInt(e.target.value) || 0 })}
                placeholder="Duracion (min)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
              <Button size="sm" onClick={createServiceType} loading={creatingType}>
                Crear
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Slug</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Precio base</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Duracion est.</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Activo</th>
                <th className="px-4 py-3 font-medium text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {serviceTypes.map((st) => (
                <tr
                  key={st.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  {editingId === st.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editForm.slug}
                          onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={editForm.base_price_cents / 100}
                          onChange={(e) => setEditForm({ ...editForm, base_price_cents: (parseFloat(e.target.value) || 0) * 100 })}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={editForm.estimated_duration_min}
                          onChange={(e) => setEditForm({ ...editForm, estimated_duration_min: parseInt(e.target.value) || 0 })}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">-</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={saveEdit}
                            disabled={savingType}
                            className="p-1.5 text-green-600 hover:bg-green-50 transition-colors rounded"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 transition-colors rounded"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-gray-900">{st.name}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{st.slug}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatCurrency(st.base_price_cents)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {st.estimated_duration_min} min
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleActive(st.id, st.is_active)}
                          className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full transition-colors ${
                            st.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {st.is_active ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(st)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors rounded"
                          >
                            <Edit size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Checklist Templates */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <CheckSquare size={18} />
              Plantillas de checklist
            </span>
          </CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setShowNewTemplate(!showNewTemplate)}>
            <Plus size={14} />
            Nueva plantilla
          </Button>
        </CardHeader>

        {showNewTemplate && (
          <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
            <input
              type="text"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              placeholder="Nombre de la plantilla"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
            <select
              value={newTemplate.service_type_id}
              onChange={(e) => setNewTemplate({ ...newTemplate, service_type_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            >
              <option value="">Seleccionar tipo de servicio</option>
              {serviceTypes.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
            <textarea
              value={newTemplate.items}
              onChange={(e) => setNewTemplate({ ...newTemplate, items: e.target.value })}
              placeholder="Items del checklist (uno por linea)"
              rows={5}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={createTemplate} loading={creatingTemplate}>
                Crear plantilla
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowNewTemplate(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {templates.length === 0 ? (
            <p className="text-sm text-gray-400">No hay plantillas creadas</p>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">
                      {template.name}
                    </h4>
                    <p className="text-xs text-gray-500">
                      Servicio: {template.service_type_name} - {template.items.length} items
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {template.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 text-sm text-gray-600"
                    >
                      <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
                      <span className="text-xs text-gray-400 w-5">{idx + 1}.</span>
                      {item.description}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
