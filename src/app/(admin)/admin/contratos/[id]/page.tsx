"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Clock,
  Building2,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { ContractStatus } from "@/app/actions/contracts";
import type { ServiceStatus } from "@/lib/types";

const STATUS_LABELS: Record<ContractStatus, string> = {
  active: "Activo",
  paused: "Pausado",
  expired: "Vencido",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<ContractStatus, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  expired: "bg-gray-200 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

interface AuthorizedContact {
  name: string;
  phone: string;
  email: string;
}

interface LocationInfo {
  id: string;
  label: string;
  street: string;
  number: string;
  city: string;
  zone: string;
}

interface ContractDetail {
  id: string;
  name: string;
  status: ContractStatus;
  start_date: string;
  end_date: string;
  monthly_amount_cents: number;
  sla_response_hours: number | null;
  max_monthly_spend_cents: number | null;
  authorized_contacts: AuthorizedContact[];
  notes: string | null;
  created_at: string;
  client: { id: string; full_name: string; phone: string | null };
  locations: LocationInfo[];
}

interface ServiceRow {
  id: string;
  request_number: number;
  status: ServiceStatus;
  created_at: string;
  preferred_date: string | null;
  service_type: { name: string } | null;
  address: { street: string; number: string; zone: string } | null;
}

export default function ContratoDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      try {
        // Get contract
        const { data: contractData, error: contractError } = await supabase
          .from("contracts")
          .select("*, profiles!contracts_client_id_fkey(id, full_name, phone)")
          .eq("id", id)
          .single();

        if (contractError) throw contractError;

        const profile = contractData.profiles as { id: string; full_name: string; phone: string | null };

        // Get locations
        let locations: LocationInfo[] = [];
        if (contractData.location_ids && contractData.location_ids.length > 0) {
          const { data: addrData } = await supabase
            .from("addresses")
            .select("id, label, street, number, city, zone")
            .in("id", contractData.location_ids);
          locations = (addrData as LocationInfo[]) || [];
        }

        setContract({
          id: contractData.id,
          name: contractData.name,
          status: contractData.status as ContractStatus,
          start_date: contractData.start_date,
          end_date: contractData.end_date,
          monthly_amount_cents: contractData.monthly_amount_cents,
          sla_response_hours: contractData.sla_response_hours,
          max_monthly_spend_cents: contractData.max_monthly_spend_cents,
          authorized_contacts: contractData.authorized_contacts || [],
          notes: contractData.notes,
          created_at: contractData.created_at,
          client: profile,
          locations,
        });

        // Get services under this contract
        const { data: servicesData } = await supabase
          .from("service_requests")
          .select("id, request_number, status, created_at, preferred_date, service_types(name), addresses(street, number, zone)")
          .eq("contract_id", id)
          .order("created_at", { ascending: false });

        const mapped: ServiceRow[] = (servicesData || []).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          request_number: s.request_number as number,
          status: s.status as ServiceStatus,
          created_at: s.created_at as string,
          preferred_date: s.preferred_date as string | null,
          service_type: s.service_types as { name: string } | null,
          address: s.addresses as { street: string; number: string; zone: string } | null,
        }));
        setServices(mapped);
      } catch {
        setError("Error al cargar el contrato");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="h-4 bg-gray-200 animate-pulse rounded w-1/3 mb-4" />
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-full" />
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !contract) {
    return <div className="p-8 text-center text-red-600"><p>{error}</p></div>;
  }

  if (!contract) return null;

  // Financial summary
  const totalServicesCost = services.length > 0 ? services.length * 0 : 0; // Placeholder: would need actual cost data
  const monthsDuration = Math.max(
    1,
    Math.ceil(
      (new Date(contract.end_date).getTime() - new Date(contract.start_date).getTime()) /
        (1000 * 60 * 60 * 24 * 30)
    )
  );
  const totalContractValue = contract.monthly_amount_cents * monthsDuration;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/contratos" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{contract.name}</h1>
              <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${STATUS_COLORS[contract.status]}`}>
                {STATUS_LABELS[contract.status]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {contract.client.full_name} - {formatDate(contract.start_date)} a {formatDate(contract.end_date)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contract Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informacion del contrato</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Monto mensual</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{formatCurrency(contract.monthly_amount_cents)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">SLA respuesta</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {contract.sla_response_hours ? `${contract.sla_response_hours} horas` : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Gasto maximo mensual</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {contract.max_monthly_spend_cents ? formatCurrency(contract.max_monthly_spend_cents) : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Duracion</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{monthsDuration} meses</p>
              </div>
            </div>
            {contract.notes && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-1">Notas</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{contract.notes}</p>
              </div>
            )}
          </Card>

          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <User size={18} />
                  Cliente
                </span>
              </CardTitle>
            </CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                <User size={20} className="text-green-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{contract.client.full_name}</p>
                <p className="text-xs text-gray-500">{contract.client.phone || "-"}</p>
              </div>
            </div>
          </Card>

          {/* Locations */}
          {contract.locations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <Building2 size={18} />
                    Ubicaciones ({contract.locations.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {contract.locations.map((loc) => (
                  <div key={loc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin size={16} className="text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{loc.label}</p>
                      <p className="text-xs text-gray-500">{loc.street} {loc.number}, {loc.city} - {loc.zone}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Authorized Contacts */}
          {contract.authorized_contacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Contactos autorizados</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {contract.authorized_contacts.map((contact, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center mt-0.5">
                      <User size={14} className="text-blue-600" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                      {contact.phone && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone size={12} />
                          {contact.phone}
                        </p>
                      )}
                      {contact.email && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Mail size={12} />
                          {contact.email}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Services */}
          <Card padding={false}>
            <div className="p-6 pb-0">
              <CardHeader>
                <CardTitle>Servicios del contrato ({services.length})</CardTitle>
              </CardHeader>
            </div>
            {services.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-gray-400">Aun no hay servicios asociados a este contrato</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">#</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Servicio</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Ubicacion</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((s) => (
                      <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/admin/solicitudes/${s.id}`} className="text-green-700 hover:text-green-800 font-medium">
                            {s.request_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{s.service_type?.name ?? "-"}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {s.address ? `${s.address.street} ${s.address.number}, ${s.address.zone}` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(s.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <DollarSign size={18} />
                  Resumen financiero
                </span>
              </CardTitle>
            </CardHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Monto mensual</span>
                <span className="font-medium text-gray-900">{formatCurrency(contract.monthly_amount_cents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duracion</span>
                <span className="font-medium text-gray-900">{monthsDuration} meses</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-gray-500">Valor total del contrato</span>
                <span className="font-bold text-gray-900">{formatCurrency(totalContractValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Servicios realizados</span>
                <span className="font-medium text-gray-900">{services.length}</span>
              </div>
              {contract.max_monthly_spend_cents && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Tope mensual</span>
                  <span className="font-medium text-gray-900">{formatCurrency(contract.max_monthly_spend_cents)}</span>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Calendar size={18} />
                  Vigencia
                </span>
              </CardTitle>
            </CardHeader>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Inicio</span>
                <span className="font-medium text-gray-900">{formatDate(contract.start_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fin</span>
                <span className="font-medium text-gray-900">{formatDate(contract.end_date)}</span>
              </div>
            </div>
          </Card>

          {contract.sla_response_hours && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <Clock size={18} />
                    SLA
                  </span>
                </CardTitle>
              </CardHeader>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-700">{contract.sla_response_hours}h</p>
                <p className="text-sm text-gray-500 mt-1">Tiempo de respuesta</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
