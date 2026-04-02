"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { createContract } from "@/app/actions/contracts";

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

interface AuthorizedContact {
  name: string;
  phone: string;
  email: string;
}

export default function NuevoContratoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Options
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Form state
  const [clientId, setClientId] = useState("");
  const [contractName, setContractName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [monthlyAmountPesos, setMonthlyAmountPesos] = useState("");
  const [slaHours, setSlaHours] = useState("");
  const [maxMonthlySpendPesos, setMaxMonthlySpendPesos] = useState("");
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [authorizedContacts, setAuthorizedContacts] = useState<AuthorizedContact[]>([]);
  const [notes, setNotes] = useState("");

  // Load clients
  useEffect(() => {
    async function loadClients() {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "client")
        .eq("is_active", true)
        .order("full_name");
      setClients((data as ClientOption[]) || []);
      setLoadingOptions(false);
    }
    loadClients();
  }, []);

  // Load addresses when client changes
  useEffect(() => {
    if (!clientId) {
      setAddresses([]);
      setSelectedLocationIds([]);
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
    }
    loadAddresses();
  }, [clientId]);

  const toggleLocation = (id: string) => {
    setSelectedLocationIds((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  };

  const addContact = () => {
    setAuthorizedContacts([...authorizedContacts, { name: "", phone: "", email: "" }]);
  };

  const removeContact = (idx: number) => {
    setAuthorizedContacts(authorizedContacts.filter((_, i) => i !== idx));
  };

  const updateContact = (idx: number, field: keyof AuthorizedContact, value: string) => {
    const updated = [...authorizedContacts];
    updated[idx] = { ...updated[idx], [field]: value };
    setAuthorizedContacts(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !contractName || !startDate || !endDate || !monthlyAmountPesos) {
      setError("Completa todos los campos obligatorios");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await createContract({
      client_id: clientId,
      name: contractName,
      start_date: startDate,
      end_date: endDate,
      monthly_amount_cents: Math.round(parseFloat(monthlyAmountPesos) * 100),
      sla_response_hours: slaHours ? parseInt(slaHours) : undefined,
      max_monthly_spend_cents: maxMonthlySpendPesos
        ? Math.round(parseFloat(maxMonthlySpendPesos) * 100)
        : undefined,
      location_ids: selectedLocationIds,
      authorized_contacts: authorizedContacts.filter((c) => c.name.trim()),
      notes: notes || undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push("/admin/contratos");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/contratos" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo contrato</h1>
          <p className="text-sm text-gray-500 mt-0.5">Crear un contrato corporativo</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* Client & Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Datos del contrato</CardTitle>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del contrato *</label>
              <input
                type="text"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                placeholder="Ej: Mantenimiento sede central 2026"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de fin *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Financial */}
        <Card>
          <CardHeader>
            <CardTitle>Condiciones economicas</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto mensual (ARS) *</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={monthlyAmountPesos}
                onChange={(e) => setMonthlyAmountPesos(e.target.value)}
                placeholder="Ej: 150000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SLA de respuesta (horas)</label>
                <input
                  type="number"
                  min={1}
                  value={slaHours}
                  onChange={(e) => setSlaHours(e.target.value)}
                  placeholder="Ej: 24"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gasto maximo mensual (ARS)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={maxMonthlySpendPesos}
                  onChange={(e) => setMaxMonthlySpendPesos(e.target.value)}
                  placeholder="Ej: 200000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Locations */}
        {clientId && addresses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ubicaciones del contrato</CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {addresses.map((addr) => (
                <label key={addr.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-100">
                  <input
                    type="checkbox"
                    checked={selectedLocationIds.includes(addr.id)}
                    onChange={() => toggleLocation(addr.id)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{addr.label}</p>
                    <p className="text-xs text-gray-500">{addr.street} {addr.number}, {addr.zone}</p>
                  </div>
                </label>
              ))}
            </div>
          </Card>
        )}

        {/* Authorized Contacts */}
        <Card>
          <CardHeader>
            <CardTitle>Contactos autorizados</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {authorizedContacts.map((contact, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg relative">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) => updateContact(idx, "name", e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Telefono</label>
                  <input
                    type="text"
                    value={contact.phone}
                    onChange={(e) => updateContact(idx, "phone", e.target.value)}
                    placeholder="Telefono"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => updateContact(idx, "email", e.target.value)}
                    placeholder="Email"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeContact(idx)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addContact}>
              <Plus size={14} />
              Agregar contacto
            </Button>
          </div>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Condiciones especiales, acuerdos, etc."
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent resize-none"
          />
        </Card>

        <div className="flex gap-3">
          <Button type="submit" loading={loading}>
            Crear contrato
          </Button>
          <Link href="/admin/contratos">
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
