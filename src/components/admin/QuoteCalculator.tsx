"use client";

import { useEffect, useState } from "react";
import { Calculator, Check } from "lucide-react";
import Card, { CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { calculateAutoQuote, type AutoQuoteResult } from "@/app/actions/quoteRules";
import type { ServiceType } from "@/lib/types";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const zones = ["CABA", "Zona Norte", "Zona Oeste"];

interface QuoteCalculatorProps {
  serviceTypes: ServiceType[];
  initialServiceTypeId?: string;
  initialZone?: string;
  initialArea?: number;
  onUsePrice?: (totalCents: number) => void;
}

export default function QuoteCalculator({
  serviceTypes,
  initialServiceTypeId = "",
  initialZone = "",
  initialArea,
  onUsePrice,
}: QuoteCalculatorProps) {
  const [serviceTypeId, setServiceTypeId] = useState(initialServiceTypeId);
  const [zone, setZone] = useState(initialZone);
  const [area, setArea] = useState(initialArea?.toString() || "");
  const [result, setResult] = useState<AutoQuoteResult | null>(null);
  const [noRule, setNoRule] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    setResult(null);
    setNoRule(false);
  }, [serviceTypeId, zone, area]);

  const canCalculate = !!serviceTypeId && !!zone && !!area && parseFloat(area) > 0;

  const handleCalculate = async () => {
    if (!canCalculate) return;
    setCalculating(true);
    setResult(null);
    setNoRule(false);

    try {
      const { data } = await calculateAutoQuote(
        serviceTypeId,
        zone,
        parseFloat(area)
      );
      if (data) {
        setResult(data);
      } else {
        setNoRule(true);
      }
    } catch {
      setNoRule(true);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <Card>
      <CardTitle className="mb-4 flex items-center gap-2">
        <Calculator size={20} className="text-green-700" />
        Calculadora de cotizacion
      </CardTitle>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Tipo de servicio
            </label>
            <select
              value={serviceTypeId}
              onChange={(e) => setServiceTypeId(e.target.value)}
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
              Zona
            </label>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            >
              <option value="">Seleccionar zona</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Superficie (m2)
            </label>
            <input
              type="number"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Ej: 50"
              min="1"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent placeholder:text-gray-400"
            />
          </div>
        </div>

        <Button
          onClick={handleCalculate}
          disabled={!canCalculate || calculating}
          loading={calculating}
          className="w-full sm:w-auto"
        >
          <Calculator size={16} />
          Calcular precio
        </Button>

        {/* Result */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-white rounded-lg p-3 border border-green-100">
                <p className="text-xs text-gray-500 mb-1">Precio base</p>
                <p className="font-semibold text-gray-900">
                  {formatCents(result.base_price_cents)}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-100">
                <p className="text-xs text-gray-500 mb-1">
                  Costo por superficie ({area} m2)
                </p>
                <p className="font-semibold text-gray-900">
                  {formatCents(result.area_cost_cents)}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-100">
                <p className="text-xs text-gray-500 mb-1">Multiplicador</p>
                <p className="font-semibold text-gray-900">
                  x{result.multiplier.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-green-800 text-white rounded-lg p-4">
              <div>
                <p className="text-xs text-green-200">Precio estimado</p>
                <p className="text-2xl font-bold">
                  {formatCents(result.total_cents)}
                </p>
              </div>
              {onUsePrice && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUsePrice(result.total_cents)}
                  className="border-white text-white hover:bg-green-700"
                >
                  <Check size={14} />
                  Usar este precio
                </Button>
              )}
            </div>

            <p className="text-xs text-gray-500 text-center">
              Formula: (base + area x precio/m2) x multiplicador = total
            </p>
          </div>
        )}

        {noRule && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
            No se encontro una regla para esta combinacion. Se requiere cotizacion manual.
          </div>
        )}
      </div>
    </Card>
  );
}
