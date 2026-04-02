"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card, { CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { calculateAutoQuote, type AutoQuoteResult } from "@/app/actions/quoteRules";
import type { ServiceType, Address, UrgencyLevel } from "@/lib/types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  MapPin,
  Plus,
  CalendarDays,
  Clock,
  Ruler,
  AlertTriangle,
  X,
  DollarSign,
} from "lucide-react";

const STEPS = [
  "Tipo de servicio",
  "Direccion",
  "Detalles",
  "Fotos",
  "Confirmar",
];

const zones = ["CABA", "Zona Norte", "Zona Oeste"];

const timeSlots = [
  "Manana (8:00 - 12:00)",
  "Tarde (12:00 - 17:00)",
  "A coordinar",
];

interface FormState {
  serviceTypeId: string;
  addressMode: "saved" | "new";
  savedAddressId: string;
  label: string;
  street: string;
  number: string;
  city: string;
  zone: string;
  addressNotes: string;
  description: string;
  preferredDate: string;
  timeSlot: string;
  estimatedArea: string;
  urgency: UrgencyLevel;
  photos: File[];
}

const initialForm: FormState = {
  serviceTypeId: "",
  addressMode: "saved",
  savedAddressId: "",
  label: "",
  street: "",
  number: "",
  city: "",
  zone: "",
  addressNotes: "",
  description: "",
  preferredDate: "",
  timeSlot: "",
  estimatedArea: "",
  urgency: "normal",
  photos: [],
};

function StepSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 bg-gray-200 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

export default function SolicitarPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);

  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [autoQuote, setAutoQuote] = useState<AutoQuoteResult | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  const update = (fields: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...fields }));

  // Fetch service types on mount
  useEffect(() => {
    async function fetchServiceTypes() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("service_types")
          .select("*")
          .eq("is_active", true)
          .order("sort_order");
        if (error) throw error;
        setServiceTypes(data || []);
      } catch {
        // silent
      } finally {
        setLoadingTypes(false);
      }
    }
    fetchServiceTypes();
  }, []);

  // Fetch addresses when step changes to 1
  useEffect(() => {
    if (step !== 1) return;
    async function fetchAddresses() {
      setLoadingAddresses(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from("addresses")
          .select("*")
          .eq("client_id", user.id)
          .order("created_at");
        if (error) throw error;
        setSavedAddresses(data || []);
      } catch {
        // silent
      } finally {
        setLoadingAddresses(false);
      }
    }
    fetchAddresses();
  }, [step]);

  // Auto-quote calculation when reaching step 5 (review)
  useEffect(() => {
    if (step !== 4) return;
    const zone =
      form.addressMode === "saved" && selectedAddress
        ? selectedAddress.zone
        : form.zone;
    const area = form.estimatedArea ? parseFloat(form.estimatedArea) : 0;

    if (!form.serviceTypeId || !zone || area <= 0) {
      setAutoQuote(null);
      return;
    }

    setLoadingQuote(true);
    calculateAutoQuote(form.serviceTypeId, zone, area)
      .then(({ data }) => setAutoQuote(data))
      .catch(() => setAutoQuote(null))
      .finally(() => setLoadingQuote(false));
  }, [step]);

  const canNext = (): boolean => {
    switch (step) {
      case 0:
        return !!form.serviceTypeId;
      case 1:
        return form.addressMode === "saved"
          ? !!form.savedAddressId
          : !!form.street && !!form.number && !!form.zone;
      case 2:
        return !!form.description;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handlePhotosChange = (files: FileList) => {
    const newFiles = Array.from(files);
    update({ photos: [...form.photos, ...newFiles] });
    const newUrls = newFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviewUrls((prev) => [...prev, ...newUrls]);
  };

  const removePhoto = (idx: number) => {
    update({ photos: form.photos.filter((_, i) => i !== idx) });
    URL.revokeObjectURL(photoPreviewUrls[idx]);
    setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("No se pudo obtener el usuario");

      let addressId = form.savedAddressId;

      // Create new address if needed
      if (form.addressMode === "new") {
        const { data: newAddr, error: addrError } = await supabase
          .from("addresses")
          .insert({
            client_id: user.id,
            label: form.label || "Direccion nueva",
            street: form.street,
            number: form.number,
            city: form.city || "",
            zone: form.zone,
            notes: form.addressNotes || null,
            is_default: false,
          })
          .select("id")
          .single();
        if (addrError) throw addrError;
        addressId = newAddr.id;
      }

      // Upload photos to Supabase Storage
      const photoPaths: string[] = [];
      for (const photo of form.photos) {
        const ext = photo.name.split(".").pop() || "jpg";
        const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("service-photos")
          .upload(filePath, photo);
        if (uploadError) throw uploadError;
        photoPaths.push(filePath);
      }

      // Insert service request
      const { data: newService, error: svcError } = await supabase
        .from("service_requests")
        .insert({
          client_id: user.id,
          address_id: addressId,
          service_type_id: form.serviceTypeId,
          status: "request_created",
          urgency: form.urgency,
          description: form.description || null,
          preferred_date: form.preferredDate || null,
          preferred_time_slot: form.timeSlot || null,
          estimated_area_sqm: form.estimatedArea
            ? parseFloat(form.estimatedArea)
            : null,
          photos: photoPaths,
        })
        .select("id")
        .single();
      if (svcError) throw svcError;

      // Insert initial state log
      await supabase.from("service_state_log").insert({
        service_request_id: newService.id,
        from_status: null,
        to_status: "request_created",
        changed_by: user.id,
        notes: "Solicitud creada por el cliente",
      });

      router.push(`/servicios/${newService.id}`);
    } catch (err: any) {
      setSubmitError(err.message || "Error al enviar la solicitud");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedServiceType = serviceTypes.find(
    (s) => s.id === form.serviceTypeId
  );
  const selectedAddress =
    form.addressMode === "saved"
      ? savedAddresses.find((a) => a.id === form.savedAddressId)
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Solicitar servicio
        </h1>
        <p className="text-gray-500 mt-1">
          Completa los datos para pedir un presupuesto.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                  i < step
                    ? "bg-green-800 text-white"
                    : i === step
                    ? "bg-green-800 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {i < step ? <Check size={16} /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  i <= step ? "text-green-800" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-full mx-2 ${
                  i < step ? "bg-green-800" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Service type */}
      {step === 0 && (
        <Card>
          <CardTitle className="mb-4">¿Que servicio necesitas?</CardTitle>
          {loadingTypes ? (
            <StepSkeleton />
          ) : serviceTypes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No hay tipos de servicio disponibles.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {serviceTypes.map((type) => {
                const selected = form.serviceTypeId === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => update({ serviceTypeId: type.id })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      selected
                        ? "border-green-800 bg-green-50 text-green-800"
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <span className="text-sm font-medium text-center">
                      {type.name}
                    </span>
                    {type.description && (
                      <span className="text-xs text-gray-400 text-center">
                        {type.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Step 2: Address */}
      {step === 1 && (
        <Card>
          <CardTitle className="mb-4">
            <MapPin size={20} className="inline mr-2" />
            Direccion del servicio
          </CardTitle>

          {loadingAddresses ? (
            <StepSkeleton />
          ) : (
            <>
              {/* Toggle saved/new */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => update({ addressMode: "saved" })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.addressMode === "saved"
                      ? "bg-green-800 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Direccion guardada
                </button>
                <button
                  onClick={() => update({ addressMode: "new" })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.addressMode === "new"
                      ? "bg-green-800 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <Plus size={14} className="inline mr-1" />
                  Nueva direccion
                </button>
              </div>

              {form.addressMode === "saved" ? (
                <div className="space-y-2">
                  {savedAddresses.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No tenes direcciones guardadas. Agrega una nueva.
                    </p>
                  ) : (
                    savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        onClick={() => update({ savedAddressId: addr.id })}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          form.savedAddressId === addr.id
                            ? "border-green-800 bg-green-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <p className="font-medium text-sm text-gray-900">
                          {addr.label}
                        </p>
                        <p className="text-xs text-gray-500">
                          {addr.street} {addr.number}, {addr.zone}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    label="Etiqueta (opcional)"
                    value={form.label}
                    onChange={(e) => update({ label: e.target.value })}
                    placeholder="Ej: Casa, Oficina"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Input
                        label="Calle"
                        value={form.street}
                        onChange={(e) => update({ street: e.target.value })}
                        placeholder="Av. Libertador"
                      />
                    </div>
                    <Input
                      label="Numero"
                      value={form.number}
                      onChange={(e) => update({ number: e.target.value })}
                      placeholder="1234"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Zona
                    </label>
                    <select
                      value={form.zone}
                      onChange={(e) => update({ zone: e.target.value })}
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
                  <Input
                    label="Notas de acceso (opcional)"
                    value={form.addressNotes}
                    onChange={(e) => update({ addressNotes: e.target.value })}
                    placeholder="Timbre, indicaciones para llegar, etc."
                  />
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Step 3: Details */}
      {step === 2 && (
        <Card>
          <CardTitle className="mb-4">Detalles del servicio</CardTitle>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Descripcion del trabajo
              </label>
              <textarea
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={4}
                placeholder="Describi que necesitas, estado actual del jardin, etc."
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent placeholder:text-gray-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <CalendarDays size={14} className="inline mr-1" />
                  Fecha preferida
                </label>
                <input
                  type="date"
                  value={form.preferredDate}
                  onChange={(e) => update({ preferredDate: e.target.value })}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Clock size={14} className="inline mr-1" />
                  Franja horaria
                </label>
                <select
                  value={form.timeSlot}
                  onChange={(e) => update({ timeSlot: e.target.value })}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                >
                  <option value="">Seleccionar</option>
                  {timeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Ruler size={14} className="inline mr-1" />
                  Superficie estimada (m2)
                </label>
                <input
                  type="number"
                  value={form.estimatedArea}
                  onChange={(e) => update({ estimatedArea: e.target.value })}
                  placeholder="Ej: 50"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <AlertTriangle size={14} className="inline mr-1" />
                  Urgencia
                </label>
                <select
                  value={form.urgency}
                  onChange={(e) =>
                    update({ urgency: e.target.value as UrgencyLevel })
                  }
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                >
                  <option value="normal">Normal</option>
                  <option value="priority">Prioritario</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Step 4: Photos */}
      {step === 3 && (
        <Card>
          <CardTitle className="mb-4">
            Fotos del espacio (opcional)
          </CardTitle>
          <p className="text-sm text-gray-500 mb-4">
            Subi fotos del jardin o espacio para que podamos darte un
            presupuesto mas preciso.
          </p>
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-green-600 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-700">
              Arrastra tus fotos aca o hace click para subir
            </p>
            <p className="text-xs text-gray-400 mt-1">
              JPG, PNG hasta 10 MB cada una
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handlePhotosChange(e.target.files);
                }
                e.target.value = "";
              }}
            />
          </div>
          {form.photos.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-green-800 font-medium mb-2">
                {form.photos.length} foto(s) seleccionada(s)
              </p>
              <div className="grid grid-cols-4 gap-2">
                {photoPreviewUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={url}
                      alt={`Foto ${i + 1}`}
                      className="aspect-square object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Step 5: Review */}
      {step === 4 && (
        <Card>
          <CardTitle className="mb-4">Revisa tu solicitud</CardTitle>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Tipo de servicio</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedServiceType?.name || "-"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Direccion</p>
                <p className="text-sm font-medium text-gray-900">
                  {form.addressMode === "saved" && selectedAddress
                    ? `${selectedAddress.street} ${selectedAddress.number}, ${selectedAddress.zone}`
                    : `${form.street} ${form.number}, ${form.zone}`}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Fecha preferida</p>
                <p className="text-sm font-medium text-gray-900">
                  {form.preferredDate
                    ? new Date(
                        form.preferredDate + "T12:00:00"
                      ).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "Sin preferencia"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Franja horaria</p>
                <p className="text-sm font-medium text-gray-900">
                  {form.timeSlot || "Sin preferencia"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Superficie</p>
                <p className="text-sm font-medium text-gray-900">
                  {form.estimatedArea
                    ? `${form.estimatedArea} m2`
                    : "No especificada"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Urgencia</p>
                <p className="text-sm font-medium text-gray-900">
                  {form.urgency === "normal"
                    ? "Normal"
                    : form.urgency === "priority"
                    ? "Prioritario"
                    : "Urgente"}
                </p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Descripcion</p>
              <p className="text-sm text-gray-900">{form.description}</p>
            </div>
            {form.photos.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Fotos adjuntas</p>
                <p className="text-sm font-medium text-gray-900">
                  {form.photos.length} foto(s)
                </p>
              </div>
            )}

            {/* Auto-quote estimate */}
            {loadingQuote && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-pulse">
                <div className="h-5 bg-green-100 rounded w-48" />
              </div>
            )}
            {autoQuote && !loadingQuote && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={16} className="text-green-700" />
                  <p className="text-sm font-semibold text-green-800">
                    Precio estimado:{" "}
                    {new Intl.NumberFormat("es-AR", {
                      style: "currency",
                      currency: "ARS",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(autoQuote.total_cents / 100)}
                  </p>
                </div>
                <p className="text-xs text-green-600">
                  Sujeto a confirmacion tras la visita del equipo
                </p>
              </div>
            )}

            {submitError && (
              <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">
                {submitError}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          <ArrowLeft size={16} />
          Anterior
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
            Siguiente
            <ArrowRight size={16} />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            loading={submitting}
          >
            <Check size={16} />
            Enviar solicitud
          </Button>
        )}
      </div>
    </div>
  );
}
