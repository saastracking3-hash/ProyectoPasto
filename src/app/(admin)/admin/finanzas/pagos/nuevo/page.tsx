"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { createPayment, type PaymentMethod } from "@/app/actions/payments";
import { formatCurrency } from "@/lib/utils/format";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ServiceOption {
  id: string;
  request_number: number;
  client_name: string;
  total_cents: number;
}

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia bancaria" },
  { value: "qr", label: "QR" },
  { value: "mercadopago", label: "MercadoPago" },
  { value: "other", label: "Otro" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function NuevoPagoPage() {
  const router = useRouter();
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [search, setSearch] = useState("");
  const [filteredServices, setFilteredServices] = useState<ServiceOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const [selectedService, setSelectedService] = useState<ServiceOption | null>(
    null
  );
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load services with approved quotes
  useEffect(() => {
    async function loadServices() {
      const supabase = createClient();
      const { data } = await supabase
        .from("service_requests")
        .select(
          "id, request_number, profiles!service_requests_client_id_fkey(full_name), quotes(total_cents, status)"
        )
        .in("status", [
          "approved",
          "scheduled",
          "crew_assigned",
          "in_transit",
          "arrived",
          "in_progress",
          "completed_by_crew",
          "validated",
          "closed",
        ])
        .order("request_number", { ascending: false });

      if (data) {
        const mapped: ServiceOption[] = data.map(
          (s: Record<string, unknown>) => {
            const profile = s.profiles as { full_name: string } | null;
            const quotes = s.quotes as
              | { total_cents: number; status: string }[]
              | null;
            const approvedQuote = quotes?.find(
              (q) => q.status === "approved" || q.status === "sent"
            );
            return {
              id: s.id as string,
              request_number: s.request_number as number,
              client_name: profile?.full_name ?? "Sin nombre",
              total_cents: approvedQuote?.total_cents ?? 0,
            };
          }
        );
        setServices(mapped);
        setFilteredServices(mapped);
      }
    }

    loadServices();
  }, []);

  // Filter services by search
  useEffect(() => {
    if (!search.trim()) {
      setFilteredServices(services);
      return;
    }
    const q = search.toLowerCase();
    setFilteredServices(
      services.filter(
        (s) =>
          s.request_number.toString().includes(q) ||
          s.client_name.toLowerCase().includes(q)
      )
    );
  }, [search, services]);

  const handleSelectService = (service: ServiceOption) => {
    setSelectedService(service);
    setSearch(`#${service.request_number} - ${service.client_name}`);
    setShowDropdown(false);
    if (service.total_cents > 0) {
      setAmount((service.total_cents / 100).toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) {
      setError("Selecciona un servicio");
      return;
    }
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setError("Ingresa un monto valido");
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createPayment(
      selectedService.id,
      amountCents,
      method,
      reference || undefined,
      notes || undefined
    );

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      router.push("/admin/finanzas/pagos");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/finanzas/pagos"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registrar pago</h1>
          <p className="text-sm text-gray-500 mt-1">
            Registra un nuevo pago recibido
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Service selector */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Servicio
            </label>
            <div className="relative">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowDropdown(true);
                    if (selectedService) setSelectedService(null);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Buscar por # o nombre de cliente..."
                  className="block w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
              </div>
              {showDropdown && filteredServices.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredServices.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectService(s)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-900">
                            #{s.request_number}
                          </span>
                          <span className="text-gray-500 ml-2">
                            {s.client_name}
                          </span>
                        </div>
                        {s.total_cents > 0 && (
                          <span className="text-sm font-medium text-gray-700">
                            {formatCurrency(s.total_cents)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Monto (ARS)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="block w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                required
              />
            </div>
            {selectedService && selectedService.total_cents > 0 && (
              <p className="text-xs text-gray-500">
                Monto del presupuesto:{" "}
                {formatCurrency(selectedService.total_cents)}
              </p>
            )}
          </div>

          {/* Method */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Metodo de pago
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {METHOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMethod(opt.value)}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    method === opt.value
                      ? "border-green-600 bg-green-50 text-green-800"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reference */}
          <Input
            label="Referencia / Comprobante"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Ej: Transferencia #12345"
          />

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notas adicionales..."
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Link href="/admin/finanzas/pagos">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" loading={submitting}>
              Registrar pago
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
