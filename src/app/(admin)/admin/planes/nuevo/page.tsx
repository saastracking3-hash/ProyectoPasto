"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { createPlan } from "@/app/actions/plans";
import { formatCurrency } from "@/lib/utils/format";

interface ClientOption {
  id: string;
  full_name: string;
}

interface AddressOption {
  id: string;
  label: string;
  street: string;
  number: string;
  zone: string;
}

interface ServiceTypeOption {
  id: string;
  name: string;
}

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Semanal (cada 7 dias)" },
  { value: "biweekly", label: "Quincenal (cada 14 dias)" },
  { value: "monthly", label: "Mensual (cada 30 dias)" },
  { value: "custom", label: "Personalizado" },
];

const DEFAULT_TASKS = [
  "Corte de cesped",
  "Recorte de bordes",
  "Limpieza de senderos",
  "Poda de arbustos",
  "Desmalezado",
  "Rastrillado de hojas",
  "Riego",
  "Fertilizacion",
];

export default function NuevoPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Dropdown options
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Form state
  const [clientId, setClientId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [customDays, setCustomDays] = useState(30);
  const [pricePesos, setPricePesos] = useState("");
  const [tasksIncluded, setTasksIncluded] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  // Load clients and service types
  useEffect(() => {
    async function loadOptions() {
      const supabase = createClient();
      try {
        const [clientsRes, stRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name")
            .eq("role", "client")
            .eq("is_active", true)
            .order("full_name"),
          supabase
            .from("service_types")
            .select("id, name")
            .eq("is_active", true)
            .order("sort_order"),
        ]);

        setClients((clientsRes.data as ClientOption[]) || []);
        setServiceTypes((stRes.data as ServiceTypeOption[]) || []);
      } catch {
        setError("Error al cargar opciones");
      } finally {
        setLoadingOptions(false);
      }
    }
    loadOptions();
  }, []);

  // Load addresses when client changes
  useEffect(() => {
    if (!clientId) {
      setAddresses([]);
      setAddressId("");
      return;
    }
    async function loadAddresses() {
      const supabase = createClient();
      const { data } = await supabase
        .from("addresses")
        .select("id, label, street, number, zone")
        .eq("client_id", clientId)
        .order("is_default", { ascending: false });
      setAddresses((data as AddressOption[]) || []);
      if (data && data.length > 0) {
        setAddressId(data[0].id);
      }
    }
    loadAddresses();
  }, [clientId]);

  const toggleTask = (task: string) => {
    setTasksIncluded((prev) =>
      prev.includes(task) ? prev.filter((t) => t !== task) : [...prev, task]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !addressId || !serviceTypeId || !startDate || !pricePesos) {
      setError("Completa todos los campos obligatorios");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await createPlan({
      client_id: clientId,
      address_id: addressId,
      service_type_id: serviceTypeId,
      frequency: frequency as "weekly" | "biweekly" | "monthly" | "custom",
      custom_interval_days: frequency === "custom" ? customDays : undefined,
      price_cents: Math.round(parseFloat(pricePesos) * 100),
      tasks_included: tasksIncluded,
      start_date: startDate,
      end_date: endDate || undefined,
      notes: notes || undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push("/admin/planes");
  };

  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedAddress = addresses.find((a) => a.id === addressId);
  const selectedServiceType = serviceTypes.find((s) => s.id === serviceTypeId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/planes" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo plan de mantenimiento</h1>
          <p className="text-sm text-gray-500 mt-0.5">Crear un plan recurrente para un cliente</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          {/* Client & Address */}
          <Card>
            <CardHeader>
              <CardTitle>Cliente y ubicacion</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={loadingOptions}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                >
                  <option value="">Seleccionar cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Direccion *</label>
                <select
                  value={addressId}
                  onChange={(e) => setAddressId(e.target.value)}
                  disabled={!clientId || addresses.length === 0}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                >
                  <option value="">Seleccionar direccion...</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} - {a.street} {a.number}, {a.zone}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Service & Frequency */}
          <Card>
            <CardHeader>
              <CardTitle>Servicio y frecuencia</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de servicio *</label>
                <select
                  value={serviceTypeId}
                  onChange={(e) => setServiceTypeId(e.target.value)}
                  disabled={loadingOptions}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                >
                  <option value="">Seleccionar tipo...</option>
                  {serviceTypes.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia *</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  >
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                {frequency === "custom" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo (dias)</label>
                    <input
                      type="number"
                      min={1}
                      value={customDays}
                      onChange={(e) => setCustomDays(parseInt(e.target.value) || 1)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio por servicio (ARS) *</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={pricePesos}
                  onChange={(e) => setPricePesos(e.target.value)}
                  placeholder="Ej: 25000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
              </div>
            </div>
          </Card>

          {/* Tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Tareas incluidas</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEFAULT_TASKS.map((task) => (
                <label key={task} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tasksIncluded.includes(task)}
                    onChange={() => toggleTask(task)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-600"
                  />
                  <span className="text-sm text-gray-700">{task}</span>
                </label>
              ))}
            </div>
          </Card>

          {/* Dates & Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Fechas y notas</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de inicio *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de fin (opcional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Instrucciones especiales, detalles adicionales..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" loading={loading}>
              Crear plan
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowPreview(!showPreview)}>
              <Eye size={16} />
              {showPreview ? "Ocultar vista previa" : "Vista previa"}
            </Button>
          </div>
        </form>

        {/* Preview panel */}
        <div>
          {showPreview && (
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Vista previa del plan</CardTitle>
              </CardHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500">Cliente</p>
                  <p className="font-medium text-gray-900">{selectedClient?.full_name || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Direccion</p>
                  <p className="font-medium text-gray-900">
                    {selectedAddress ? `${selectedAddress.street} ${selectedAddress.number}, ${selectedAddress.zone}` : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Tipo de servicio</p>
                  <p className="font-medium text-gray-900">{selectedServiceType?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Frecuencia</p>
                  <p className="font-medium text-gray-900">
                    {FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.label || "-"}
                    {frequency === "custom" ? ` (${customDays} dias)` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Precio por servicio</p>
                  <p className="font-medium text-gray-900">
                    {pricePesos ? formatCurrency(Math.round(parseFloat(pricePesos) * 100)) : "-"}
                  </p>
                </div>
                {tasksIncluded.length > 0 && (
                  <div>
                    <p className="text-gray-500">Tareas incluidas</p>
                    <ul className="mt-1 space-y-0.5">
                      {tasksIncluded.map((t) => (
                        <li key={t} className="text-gray-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-green-600 rounded-full inline-block" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">Periodo</p>
                  <p className="font-medium text-gray-900">
                    {startDate || "-"} {endDate ? `hasta ${endDate}` : "(sin fecha de fin)"}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
