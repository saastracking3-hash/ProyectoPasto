"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, Send } from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/format";
import type { QuoteItemType } from "@/lib/types";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  item_type: QuoteItemType;
}

const ITEM_TYPE_LABELS: Record<QuoteItemType, string> = {
  labor: "Mano de obra",
  material: "Material",
  extra: "Extra",
};

export default function PresupuestoEditarPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const quoteId = params.id as string;
  const isNew = quoteId === "new";
  const serviceIdParam = searchParams.get("serviceId");

  const [items, setItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [serviceRequestId, setServiceRequestId] = useState<string>("");
  const [headerInfo, setHeaderInfo] = useState({ request_number: 0, client_name: "", service_type: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError("No autenticado"); setLoading(false); return; }

        if (isNew && serviceIdParam) {
          // Creating new quote for a service request
          setServiceRequestId(serviceIdParam);
          const { data: sr } = await supabase
            .from("service_requests")
            .select(
              "request_number, profiles!service_requests_client_id_fkey(full_name), service_types!inner(name)"
            )
            .eq("id", serviceIdParam)
            .single();

          if (sr) {
            const srTyped = sr as Record<string, unknown>;
            const profile = srTyped.profiles as { full_name: string } | null;
            const st = srTyped.service_types as { name: string } | null;
            setHeaderInfo({
              request_number: srTyped.request_number as number,
              client_name: profile?.full_name ?? "",
              service_type: st?.name ?? "",
            });
          }

          // Set default valid_until to 15 days from now
          const d = new Date();
          d.setDate(d.getDate() + 15);
          setValidUntil(d.toISOString().split("T")[0]);
        } else if (!isNew) {
          // Loading existing quote
          const [quoteRes, itemsRes] = await Promise.all([
            supabase
              .from("quotes")
              .select(
                "*, service_requests!inner(request_number, id, profiles!service_requests_client_id_fkey(full_name), service_types!inner(name))"
              )
              .eq("id", quoteId)
              .single(),
            supabase
              .from("quote_items")
              .select("*")
              .eq("quote_id", quoteId)
              .order("sort_order", { ascending: true }),
          ]);

          if (quoteRes.error) throw quoteRes.error;

          const d = quoteRes.data as Record<string, unknown>;
          const sr = d.service_requests as Record<string, unknown>;
          const profile = sr.profiles as { full_name: string } | null;
          const st = sr.service_types as { name: string } | null;

          setServiceRequestId(d.service_request_id as string);
          setNotes((d.notes as string) || "");
          setValidUntil(d.valid_until ? (d.valid_until as string).split("T")[0] : "");
          setHeaderInfo({
            request_number: sr.request_number as number,
            client_name: profile?.full_name ?? "",
            service_type: st?.name ?? "",
          });

          setItems(
            (itemsRes.data || []).map((item: Record<string, unknown>) => ({
              id: item.id as string,
              description: item.description as string,
              quantity: item.quantity as number,
              unit_price_cents: item.unit_price_cents as number,
              item_type: item.item_type as QuoteItemType,
            }))
          );
        }
      } catch {
        setError("Error al cargar datos");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [quoteId, isNew, serviceIdParam]);

  const addItem = () => {
    setItems([
      ...items,
      {
        id: `new-${Date.now()}`,
        description: "",
        quantity: 1,
        unit_price_cents: 0,
        item_type: "labor",
      },
    ]);
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter((i) => i.id !== itemId));
  };

  const updateItem = (itemId: string, field: keyof LineItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const laborTotal = items
    .filter((i) => i.item_type === "labor")
    .reduce((acc, i) => acc + i.quantity * i.unit_price_cents, 0);

  const materialsTotal = items
    .filter((i) => i.item_type === "material")
    .reduce((acc, i) => acc + i.quantity * i.unit_price_cents, 0);

  const extrasTotal = items
    .filter((i) => i.item_type === "extra")
    .reduce((acc, i) => acc + i.quantity * i.unit_price_cents, 0);

  const grandTotal = laborTotal + materialsTotal + extrasTotal;

  const handleSave = async (andSend: boolean) => {
    if (!serviceRequestId) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const quotePayload = {
        service_request_id: serviceRequestId,
        created_by: user.id,
        status: andSend ? "sent" : "draft",
        labor_cost_cents: laborTotal,
        materials_cost_cents: materialsTotal,
        notes: notes || null,
        valid_until: validUntil || null,
      };

      let savedQuoteId = quoteId;

      if (isNew) {
        const { data: newQuote, error: insertErr } = await supabase
          .from("quotes")
          .insert(quotePayload)
          .select("id")
          .single();
        if (insertErr) throw insertErr;
        savedQuoteId = newQuote.id;

        // Update service request status to quoted
        await supabase
          .from("service_requests")
          .update({ status: "quoted" })
          .eq("id", serviceRequestId);

        await supabase.from("service_state_log").insert({
          service_request_id: serviceRequestId,
          from_status: "pending_review",
          to_status: "quoted",
          changed_by: user.id,
          notes: "Presupuesto creado",
        });
      } else {
        const { error: upErr } = await supabase
          .from("quotes")
          .update(quotePayload)
          .eq("id", savedQuoteId);
        if (upErr) throw upErr;

        // Delete old items
        await supabase.from("quote_items").delete().eq("quote_id", savedQuoteId);
      }

      // Insert new items
      if (items.length > 0) {
        const itemsPayload = items.map((item, idx) => ({
          quote_id: savedQuoteId,
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          item_type: item.item_type,
          sort_order: idx,
        }));
        const { error: itemErr } = await supabase
          .from("quote_items")
          .insert(itemsPayload);
        if (itemErr) throw itemErr;
      }

      if (andSend) {
        await supabase
          .from("service_requests")
          .update({ status: "pending_approval" })
          .eq("id", serviceRequestId);

        await supabase.from("service_state_log").insert({
          service_request_id: serviceRequestId,
          from_status: "quoted",
          to_status: "pending_approval",
          changed_by: user.id,
          notes: "Presupuesto enviado al cliente",
        });
      }

      router.push(`/admin/presupuestos/${savedQuoteId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setError(`Error: ${msg}`);
      console.error("handleSave error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-72 bg-gray-200 animate-pulse rounded" />
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
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/presupuestos"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? "Nuevo presupuesto" : "Editar presupuesto"} - Solicitud #{headerInfo.request_number}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {headerInfo.client_name} - {headerInfo.service_type}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => handleSave(false)} loading={saving}>
            <Save size={16} />
            Guardar borrador
          </Button>
          <Button onClick={() => handleSave(true)} loading={saving}>
            <Send size={16} />
            Enviar al cliente
          </Button>
        </div>
      </div>

      {/* Line Items */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <CardTitle>Items del presupuesto</CardTitle>
          <Button size="sm" variant="secondary" onClick={addItem}>
            <Plus size={14} />
            Agregar item
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-2/5">Descripcion</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 w-20">Cant.</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-32">Precio unit. ($)</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">Tipo</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-32">Subtotal</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                      placeholder="Descripcion del item"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, "quantity", parseInt(e.target.value) || 1)
                      }
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      value={item.unit_price_cents / 100}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "unit_price_cents",
                          (parseFloat(e.target.value) || 0) * 100
                        )
                      }
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={item.item_type}
                      onChange={(e) =>
                        updateItem(item.id, "item_type", e.target.value as QuoteItemType)
                      }
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    >
                      {(
                        Object.entries(ITEM_TYPE_LABELS) as [QuoteItemType, string][]
                      ).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">
                    {formatCurrency(item.quantity * item.unit_price_cents)}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No hay items. Agrega al menos uno.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notes & Valid Until */}
        <Card>
          <CardHeader>
            <CardTitle>Notas y condiciones</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Notas para el cliente
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent placeholder:text-gray-400 resize-none"
                placeholder="Detalles adicionales, condiciones, aclaraciones..."
              />
            </div>
            <Input
              label="Valido hasta"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </Card>

        {/* Totals */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen de totales</CardTitle>
          </CardHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Mano de obra</span>
              <span className="font-medium text-gray-900">{formatCurrency(laborTotal)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Materiales</span>
              <span className="font-medium text-gray-900">{formatCurrency(materialsTotal)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Extras</span>
              <span className="font-medium text-gray-900">{formatCurrency(extrasTotal)}</span>
            </div>
            <div className="flex justify-between py-3 border-t border-gray-200">
              <span className="font-semibold text-gray-900 text-base">Total</span>
              <span className="font-bold text-gray-900 text-lg">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
