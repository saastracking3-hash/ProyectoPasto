"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { MapPin, TrendingUp, BarChart3, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawServiceRequest {
  id: string;
  status: string;
  created_at: string;
  address_id: string;
  addresses: {
    zone: string | null;
    city: string | null;
  } | null;
}

interface ZoneData {
  zone: string;
  city: string;
  total: number;
  completed: number;
  pending: number;
  thisMonth: number;
  lastMonth: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPLETED_STATUSES = ["completed_by_crew", "validated", "closed"];
const PENDING_STATUSES = [
  "request_created",
  "pending_review",
  "quoted",
  "pending_approval",
  "approved",
  "scheduled",
  "crew_assigned",
];

const PERIOD_OPTIONS = [
  { value: "month", label: "Ultimo mes" },
  { value: "3months", label: "Ultimos 3 meses" },
  { value: "all", label: "Todo el tiempo" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreenShade(ratio: number): string {
  // ratio 0–1, returns a Tailwind-compatible inline style color
  const lightness = Math.round(90 - ratio * 55); // 90% (light) → 35% (dark)
  return `hsl(142, 70%, ${lightness}%)`;
}

function getStartDate(period: string): Date | null {
  const now = new Date();
  if (period === "month") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d;
  }
  if (period === "3months") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return d;
  }
  return null; // all time
}

function aggregateRows(rows: RawServiceRequest[], period: string): ZoneData[] {
  const cutoff = getStartDate(period);
  const now = new Date();

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const map = new Map<string, ZoneData>();

  for (const row of rows) {
    if (row.status === "cancelled") continue;
    if (!row.addresses?.zone) continue;

    const createdAt = new Date(row.created_at);
    if (cutoff && createdAt < cutoff) continue;

    const key = row.addresses.zone;
    if (!map.has(key)) {
      map.set(key, {
        zone: row.addresses.zone,
        city: row.addresses.city ?? "Buenos Aires",
        total: 0,
        completed: 0,
        pending: 0,
        thisMonth: 0,
        lastMonth: 0,
      });
    }

    const entry = map.get(key)!;
    entry.total += 1;

    if (COMPLETED_STATUSES.includes(row.status)) entry.completed += 1;
    if (PENDING_STATUSES.includes(row.status)) entry.pending += 1;
    if (createdAt >= thisMonthStart) entry.thisMonth += 1;
    if (createdAt >= lastMonthStart && createdAt <= lastMonthEnd) entry.lastMonth += 1;
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBanner({
  zones,
}: {
  zones: ZoneData[];
}) {
  const totalZones = zones.length;
  const champion = zones[0];
  const top3Total = zones.slice(0, 3).reduce((s, z) => s + z.total, 0);
  const grandTotal = zones.reduce((s, z) => s + z.total, 0);
  const top3Pct = grandTotal > 0 ? Math.round((top3Total / grandTotal) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Total zones */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <MapPin size={20} className="text-green-700" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Zonas con presencia</p>
            <p className="text-2xl font-bold text-gray-900">{totalZones}</p>
          </div>
        </div>
      </Card>

      {/* Champion zone */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🏆</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-500">Zona mas demandada</p>
            {champion ? (
              <p className="text-xl font-bold text-gray-900 truncate">
                {champion.zone}{" "}
                <span className="text-sm font-normal text-gray-500">
                  ({champion.total} servicios)
                </span>
              </p>
            ) : (
              <p className="text-gray-400 text-sm">Sin datos</p>
            )}
          </div>
        </div>
      </Card>

      {/* Top 3 concentration */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <BarChart3 size={20} className="text-blue-700" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Concentracion top 3</p>
            <p className="text-2xl font-bold text-gray-900">{top3Pct}%</p>
            <p className="text-xs text-gray-400">{top3Total} de {grandTotal} servicios</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ZoneBarRow({
  zone,
  rank,
  maxTotal,
}: {
  zone: ZoneData;
  rank: number;
  maxTotal: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const ratio = maxTotal > 0 ? zone.total / maxTotal : 0;
  const barColor = getGreenShade(ratio);
  const barWidthPct = Math.max(2, Math.round(ratio * 100));

  const completedPct = zone.total > 0 ? Math.round((zone.completed / zone.total) * 100) : 0;
  const pendingPct = zone.total > 0 ? Math.round((zone.pending / zone.total) * 100) : 0;

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      {/* Main row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        {/* Rank */}
        <span className="text-sm font-bold text-gray-400 w-6 flex-shrink-0 text-right">
          #{rank}
        </span>

        {/* Zone name */}
        <span className="font-medium text-gray-900 w-28 flex-shrink-0 truncate text-sm">
          {zone.zone}
        </span>

        {/* Bar track */}
        <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${barWidthPct}%`, backgroundColor: barColor }}
          />
        </div>

        {/* Count */}
        <span className="text-sm font-semibold text-gray-700 w-24 flex-shrink-0 text-right">
          {zone.total} servicios
        </span>

        {/* Expand icon */}
        <span className="text-gray-400 flex-shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 bg-gray-50 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-bold text-gray-900">{zone.total}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Completados</p>
              <p className="text-lg font-bold text-green-700">{zone.completed}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Pendientes</p>
              <p className="text-lg font-bold text-amber-600">{zone.pending}</p>
            </div>
          </div>

          {/* Visual breakdown bar */}
          <div className="h-4 rounded-full overflow-hidden flex gap-0.5">
            {zone.completed > 0 && (
              <div
                className="bg-green-500 h-full rounded-l-full transition-all"
                style={{ width: `${completedPct}%` }}
                title={`Completados: ${completedPct}%`}
              />
            )}
            {zone.pending > 0 && (
              <div
                className="bg-amber-400 h-full transition-all"
                style={{ width: `${pendingPct}%` }}
                title={`Pendientes: ${pendingPct}%`}
              />
            )}
            {zone.total - zone.completed - zone.pending > 0 && (
              <div
                className="bg-gray-300 h-full flex-1 rounded-r-full"
                title="Otros"
              />
            )}
          </div>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />
              Completados {completedPct}%
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
              Pendientes {pendingPct}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ZoneCard({ zone }: { zone: ZoneData }) {
  const growing = zone.thisMonth > zone.lastMonth;
  const stable = zone.thisMonth === zone.lastMonth;

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{zone.zone}</h3>
          <p className="text-xs text-gray-400">{zone.city}</p>
        </div>
        <span
          className={`flex-shrink-0 ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            growing
              ? "bg-green-100 text-green-700"
              : stable
              ? "bg-gray-100 text-gray-600"
              : "bg-red-50 text-red-600"
          }`}
        >
          {growing ? (
            <>
              <TrendingUp size={11} />
              Creciendo
            </>
          ) : stable ? (
            <>→ Estable</>
          ) : (
            <>↓ Bajando</>
          )}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-500 mb-0.5">Total</p>
          <p className="text-base font-bold text-gray-900">{zone.total}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-2">
          <p className="text-xs text-green-600 mb-0.5">Complet.</p>
          <p className="text-base font-bold text-green-700">{zone.completed}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-2">
          <p className="text-xs text-amber-600 mb-0.5">Pendient.</p>
          <p className="text-base font-bold text-amber-700">{zone.pending}</p>
        </div>
      </div>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MapaDemandaPage() {
  const [rawData, setRawData] = useState<RawServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [period, setPeriod] = useState("3months");
  const [minServices, setMinServices] = useState(1);
  const [showAllZones, setShowAllZones] = useState(false);

  // Fetch once
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: err } = await supabase
          .from("service_requests")
          .select(
            `id, status, created_at, address_id,
             addresses ( zone, city )`
          )
          .neq("status", "cancelled");

        if (err) throw err;
        setRawData((data as unknown as RawServiceRequest[]) ?? []);
      } catch (e) {
        setError((e as Error).message ?? "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Aggregate in JS
  const allZones = useMemo(() => aggregateRows(rawData, period), [rawData, period]);

  const filteredZones = useMemo(
    () => allZones.filter((z) => z.total >= minServices),
    [allZones, minServices]
  );

  const visibleBarZones = showAllZones ? filteredZones : filteredZones.slice(0, 10);
  const maxTotal = filteredZones[0]?.total ?? 1;
  const hasMore = filteredZones.length > 10;

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/reportes"
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MapPin size={22} className="text-green-700" />
              Mapa de demanda por zona
            </h1>
          </div>
          <p className="text-gray-500 text-sm ml-7">
            Distribucion geografica de servicios en Buenos Aires
          </p>
        </div>
      </div>

      {/* ── Filters ── */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Periodo:</span>
            <div className="flex gap-1.5">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    period === opt.value
                      ? "bg-green-800 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Min services slider */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Min. servicios: <span className="text-green-700 font-bold">{minServices}</span>
            </span>
            <input
              type="range"
              min={1}
              max={5}
              value={minServices}
              onChange={(e) => setMinServices(Number(e.target.value))}
              className="w-24 accent-green-700"
            />
          </div>
        </div>
      </Card>

      {/* ── Stats banner ── */}
      {filteredZones.length > 0 ? (
        <>
          <StatBanner zones={filteredZones} />

          {/* ── Ranked bar chart ── */}
          <Card padding={false}>
            <div className="p-6 pb-4">
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <BarChart3 size={18} className="text-green-700" />
                    Zonas por demanda
                  </span>
                </CardTitle>
                <span className="text-sm text-gray-400">
                  {filteredZones.length} zonas
                </span>
              </CardHeader>
            </div>

            <div className="px-4 pb-4 space-y-2">
              {visibleBarZones.map((zone, idx) => (
                <ZoneBarRow
                  key={zone.zone}
                  zone={zone}
                  rank={idx + 1}
                  maxTotal={maxTotal}
                />
              ))}
            </div>

            {hasMore && (
              <div className="px-4 pb-4">
                <button
                  onClick={() => setShowAllZones((v) => !v)}
                  className="w-full py-2 text-sm text-green-700 font-medium border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                >
                  {showAllZones
                    ? "Ver menos"
                    : `Ver mas (${filteredZones.length - 10} zonas mas)`}
                </button>
              </div>
            )}
          </Card>

          {/* ── Zone cards grid ── */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin size={18} className="text-green-700" />
              Detalle por zona
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredZones.map((zone) => (
                <ZoneCard key={zone.zone} zone={zone} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MapPin size={40} className="text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Sin datos para mostrar</p>
            <p className="text-gray-400 text-sm mt-1">
              {rawData.length === 0
                ? "No hay servicios registrados"
                : "Ajusta los filtros para ver resultados"}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
