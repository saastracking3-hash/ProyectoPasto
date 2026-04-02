"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, Plus, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { createInvoice, type InvoiceStatus } from "@/app/actions/invoices";
import { formatCurrency } from "@/lib/utils/format";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ServiceOption {
  id: string;
  request_number: number;
  client_id: string;
  client_name: string;
  total_cents: number;
  items: LineItem[];
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
}

const IVA_RATE = 0.21;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function NuevaFacturaPage() {
  const router = useRouter();
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [search, setSearch] = useState("");
  const [filteredServices, setFilteredServices] = useState<ServiceOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const [selectedService, setSelectedService] = useState<ServiceOption | null>(
    null
  );
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load services with quotes
  useEffect(() => {
    async function loadServices() {
      const supabase = createClient();
      const { data } = await supabase
        .from("service_requests")
        .select(
          "id, request_number, client_id, profiles!service_requests_client_id_fkey(full_name), quotes(total_cents, status, items:quote_items(description, quantity, unit_price_cents))"
        )
        .in("status", [
          "approved",
          "scheduled",
          "crew_assigned",
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
              | {
                  total_cents: number;
                  status: string;
                  items: {
                    description: string;
                    quantity: number;
                    unit_price_cents: number;
                  }[];
                }[]
              | null;
            const approvedQuote = quotes?.find(
              (q) => q.status === "approved" || q.status === "sent"
            );
            return {
              id: s.id as string,
              request_number: s.request_number as number,
              client_id: s.client_id as string,
              client_name: profile?.full_name ?? "Sin nombre",
              total_cents: approvedQuote?.total_cents ?? 0,
              items:
                approvedQuote?.items?.map((i) => ({
                  description: i.description,
                  quantity: i.quantity,
                  unit_price_cents: i.unit_price_cents,
                })) || [],
            };
          }
        );
        setServices(mapped);
        setFilteredServices(mapped);
      }
    }

    loadServices();
  }, []);

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

    if (service.items.length > 0) {
      setLineItems(service.items);
    } else if (service.total_cents > 0) {
      setLineItems([
        {
          description: "Servicio",
          quantity: 1,
          unit_price_cents: service.total_cents,
        },
      ]);
    } else {
      setLineItems([{ description: "", quantity: 1, unit_price_cents: 0 }]);
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { description: "", quantity: 1, unit_price_cents: 0 },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (
    index: number,
    field: keyof LineItem,
    value: string | number
  ) => {
    const updated = [...lineItems];
    if (field === "description") {
      updated[index].description = value as string;
    } else if (field === "quantity") {
      updated[index].quantity = Number(value) || 0;
    } else if (field === "unit_price_cents") {
      updated[index].unit_price_cents = Math.round(Number(value) * 100) || 0;
    }
    setLineItems(updated);
  };

  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price_cents,
    0
  );
  const tax = Math.round(subtotal * IVA_RATE);
  const total = subtotal + tax;

  const handleSubmit = async (saveAs: InvoiceStatus) => {
    if (!selectedService) {
      setError("Selecciona un servicio");
      return;
    }
    if (lineItems.length === 0 || lineItems.some((i) => !i.description)) {
      setError("Completa todos los items");
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createInvoice(
      selectedService.id,
      selectedService.client_id,
      subtotal,
      tax,
      total,
      dueDate || undefined,
      saveAs
    );

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      router.push("/admin/finanzas/facturas");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/finanzas/facturas"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Crear factura</h1>
          <p className="text-sm text-gray-500 mt-1">
            Genera una nueva factura para un servicio
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card>
        <div className="space-y-6">
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
                    if (selectedService) {
                      setSelectedService(null);
                      setLineItems([]);
                    }
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

          {/* Line items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Items
              </label>
              <button
                type="button"
                onClick={addLineItem}
                className="text-sm text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
              >
                <Plus size={14} />
                Agregar item
              </button>
            </div>

            {lineItems.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 items-end"
              >
                <div className="col-span-12 sm:col-span-5">
                  {idx === 0 && (
                    <span className="text-xs text-gray-500">Descripcion</span>
                  )}
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      updateLineItem(idx, "description", e.target.value)
                    }
                    placeholder="Descripcion del item"
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  {idx === 0 && (
                    <span className="text-xs text-gray-500">Cant.</span>
                  )}
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLineItem(idx, "quantity", e.target.value)
                    }
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div className="col-span-5 sm:col-span-3">
                  {idx === 0 && (
                    <span className="text-xs text-gray-500">
                      Precio unit. ($)
                    </span>
                  )}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={(item.unit_price_cents / 100).toFixed(2)}
                    onChange={(e) =>
                      updateLineItem(
                        idx,
                        "unit_price_cents",
                        e.target.value
                      )
                    }
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 hidden sm:block">
                    {formatCurrency(item.quantity * item.unit_price_cents)}
                  </span>
                </div>
                <div className="col-span-1">
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(idx)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex flex-col items-end space-y-1">
              <div className="flex justify-between w-full sm:w-64">
                <span className="text-sm text-gray-600">Subtotal</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex justify-between w-full sm:w-64">
                <span className="text-sm text-gray-600">IVA (21%)</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(tax)}
                </span>
              </div>
              <div className="flex justify-between w-full sm:w-64 pt-2 border-t border-gray-200">
                <span className="text-base font-bold text-gray-900">
                  Total
                </span>
                <span className="text-base font-bold text-gray-900">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>

          {/* Due date */}
          <div className="max-w-xs">
            <Input
              label="Fecha de vencimiento"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
            <Link href="/admin/finanzas/facturas">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
            <Button
              type="button"
              variant="secondary"
              loading={submitting}
              onClick={() => handleSubmit("draft")}
            >
              Guardar borrador
            </Button>
            <Button
              type="button"
              loading={submitting}
              onClick={() => handleSubmit("sent")}
            >
              Guardar y enviar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
