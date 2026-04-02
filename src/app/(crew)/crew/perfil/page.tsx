"use client";

import { useEffect, useState } from "react";
import { User, Phone, Mail, MapPin, Star, Wrench } from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/types";
import type { UserRole } from "@/lib/types";

interface ProfileData {
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  crewName: string | null;
  crewZone: string | null;
  roleInCrew: string | null;
}

function SkeletonProfile() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-32 bg-gray-200 rounded" />
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full" />
          <div className="space-y-2">
            <div className="h-5 w-36 bg-gray-200 rounded" />
            <div className="h-4 w-28 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="h-5 w-28 bg-gray-200 rounded" />
        <div className="h-4 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-36 bg-gray-200 rounded" />
        <div className="h-4 w-40 bg-gray-200 rounded" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-5 w-28 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-20 bg-gray-200 rounded-lg" />
          <div className="h-20 bg-gray-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function CrewPerfilPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobsThisMonth, setJobsThisMonth] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("No se pudo obtener el usuario");
          return;
        }

        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, phone, role")
          .eq("id", user.id)
          .single();

        if (profileError) {
          setError("Error al cargar perfil: " + profileError.message);
          return;
        }

        // Fetch crew membership
        const { data: crewMember } = await supabase
          .from("crew_members")
          .select(
            `
            role_in_crew,
            crew:crews!inner ( id, name, zone )
          `
          )
          .eq("user_id", user.id)
          .maybeSingle();

        const crew = crewMember?.crew as any;

        setProfile({
          fullName: profileData.full_name,
          email: user.email || "",
          phone: profileData.phone,
          role: profileData.role as UserRole,
          crewName: crew?.name || null,
          crewZone: crew?.zone || null,
          roleInCrew: crewMember?.role_in_crew || null,
        });

        // Fetch stats: assignments completed this month
        if (crewMember) {
          const now = new Date();
          const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            .toISOString()
            .split("T")[0];
          const lastOfMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0
          )
            .toISOString()
            .split("T")[0];

          const { count } = await supabase
            .from("assignments")
            .select("id", { count: "exact", head: true })
            .eq("crew_id", crew.id)
            .not("actual_end_at", "is", null)
            .gte("scheduled_date", firstOfMonth)
            .lte("scheduled_date", lastOfMonth);

          setJobsThisMonth(count || 0);

          // Fetch average rating from reviews for this crew's service requests
          const { data: crewAssignments } = await supabase
            .from("assignments")
            .select("service_request_id")
            .eq("crew_id", crew.id);

          if (crewAssignments && crewAssignments.length > 0) {
            const srIds = crewAssignments.map((a) => a.service_request_id);

            const { data: reviews } = await supabase
              .from("reviews")
              .select("rating")
              .in("service_request_id", srIds);

            if (reviews && reviews.length > 0) {
              const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
              setAvgRating(Math.round((sum / reviews.length) * 10) / 10);
            }
          }
        }
      } catch (err: any) {
        setError("Error inesperado: " + err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  if (loading) return <SkeletonProfile />;

  if (!profile) {
    return (
      <div className="py-16 text-center text-gray-500">
        {error || "No se pudo cargar el perfil"}
      </div>
    );
  }

  const roleInCrewLabel =
    profile.roleInCrew === "leader"
      ? "Jefe de cuadrilla"
      : profile.roleInCrew === "operator"
        ? "Operario"
        : ROLE_LABELS[profile.role];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      <Card>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <User size={28} className="text-green-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {profile.fullName}
            </h2>
            <p className="text-sm text-gray-500">{roleInCrewLabel}</p>
            {profile.crewName && (
              <p className="text-sm text-green-600">{profile.crewName}</p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informacion</CardTitle>
        </CardHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <Mail size={16} className="text-gray-400" />
            <span>{profile.email}</span>
          </div>
          {profile.phone && (
            <div className="flex items-center gap-3">
              <Phone size={16} className="text-gray-400" />
              <a href={`tel:${profile.phone}`} className="text-green-700">
                {profile.phone}
              </a>
            </div>
          )}
          {profile.crewZone && (
            <div className="flex items-center gap-3">
              <MapPin size={16} className="text-gray-400" />
              <span>{profile.crewZone}</span>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estadisticas</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <Wrench size={20} className="mx-auto text-green-700 mb-1" />
            <p className="text-2xl font-bold text-gray-900">{jobsThisMonth}</p>
            <p className="text-xs text-gray-500">Trabajos este mes</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <Star size={20} className="mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold text-gray-900">
              {avgRating !== null ? avgRating : "-"}
            </p>
            <p className="text-xs text-gray-500">Calificacion promedio</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
