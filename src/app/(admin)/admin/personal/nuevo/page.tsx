"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createStaffUser } from "@/app/actions/personnel";
import { addCrewMember } from "@/app/actions/crews";
import { ROLE_LABELS, type UserRole } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

interface CrewOption {
  id: string;
  name: string;
}

export default function NuevoPersonalPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crews, setCrews] = useState<CrewOption[]>([]);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "operator" as UserRole,
    password: "",
    crew_id: "",
  });

  useEffect(() => {
    const fetchCrews = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("crews")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setCrews((data || []) as CrewOption[]);
    };
    fetchCrews();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || !form.password) {
      setError("Nombre, email y contrasena son obligatorios");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await createStaffUser(
      form.email.trim(),
      form.password,
      form.full_name.trim(),
      form.phone.trim(),
      form.role
    );

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    // Assign to crew if selected
    if (form.crew_id && result.data) {
      const crewRole =
        form.role === "crew_leader" ? "leader" : "operator";
      await addCrewMember(form.crew_id, result.data.id, crewRole);
    }

    router.push("/admin/personal");
  };

  const roleOptions: UserRole[] = [
    "admin",
    "supervisor",
    "crew_leader",
    "operator",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/personal"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Agregar personal
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Crear nuevo usuario del equipo
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre completo"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              placeholder="Ej: Juan Perez"
              required
            />

            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="juan@ejemplo.com"
              required
            />

            <Input
              label="Telefono"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="Ej: +54 11 1234-5678"
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Rol
              </label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Contrasena"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Minimo 6 caracteres"
              required
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Asignar a cuadrilla (opcional)
              </label>
              <select
                name="crew_id"
                value={form.crew_id}
                onChange={handleChange}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              >
                <option value="">Sin asignar</option>
                {crews.map((crew) => (
                  <option key={crew.id} value={crew.id}>
                    {crew.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" loading={saving}>
              Crear usuario
            </Button>
            <Link href="/admin/personal">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
