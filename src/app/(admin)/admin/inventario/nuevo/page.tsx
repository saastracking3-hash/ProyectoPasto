"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createEquipment } from "@/app/actions/equipment";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/types";

export default function NuevoEquipoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    type: "cortadora",
    brand: "",
    model: "",
    serial_number: "",
    purchase_date: "",
    next_maintenance: "",
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await createEquipment({
      name: form.name.trim(),
      type: form.type,
      brand: form.brand.trim() || undefined,
      model: form.model.trim() || undefined,
      serial_number: form.serial_number.trim() || undefined,
      purchase_date: form.purchase_date || undefined,
      next_maintenance: form.next_maintenance || undefined,
      notes: form.notes.trim() || undefined,
    });

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    router.push("/admin/inventario");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/inventario"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agregar equipo</h1>
          <p className="text-sm text-gray-500 mt-1">
            Registrar nuevo equipo o herramienta
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
              label="Nombre"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Ej: Cortadora Honda HRX"
              required
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Tipo
              </label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              >
                {Object.entries(EQUIPMENT_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Marca"
              name="brand"
              value={form.brand}
              onChange={handleChange}
              placeholder="Ej: Honda"
            />

            <Input
              label="Modelo"
              name="model"
              value={form.model}
              onChange={handleChange}
              placeholder="Ej: HRX 217"
            />

            <Input
              label="Numero de serie"
              name="serial_number"
              value={form.serial_number}
              onChange={handleChange}
              placeholder="Ej: SN-12345"
            />

            <Input
              label="Fecha de compra"
              name="purchase_date"
              type="date"
              value={form.purchase_date}
              onChange={handleChange}
            />

            <Input
              label="Proximo mantenimiento"
              name="next_maintenance"
              type="date"
              value={form.next_maintenance}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Notas
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Notas adicionales sobre el equipo..."
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" loading={saving}>
              Guardar equipo
            </Button>
            <Link href="/admin/inventario">
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
