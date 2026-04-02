"use client";

import { useEffect, useState } from "react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import type { Address } from "@/lib/types";
import {
  User,
  MapPin,
  Lock,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
} from "lucide-react";

const zones = ["CABA", "Zona Norte", "Zona Oeste"];

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
}

interface EditableAddress {
  id: string;
  label: string;
  street: string;
  number: string;
  zone: string;
  notes: string;
}

const emptyAddress: EditableAddress = {
  id: "",
  label: "",
  street: "",
  number: "",
  zone: "",
  notes: "",
};

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-5 w-72 bg-gray-200 animate-pulse rounded mt-2" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-48 bg-gray-200 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

export default function PerfilPage() {
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "",
    email: "",
    phone: "",
  });
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingAddress, setEditingAddress] = useState<EditableAddress | null>(
    null
  );
  const [isNewAddress, setIsNewAddress] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("No se pudo obtener el usuario");

        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", user.id)
          .single();

        setProfile({
          full_name: profileData?.full_name || "",
          email: user.email || "",
          phone: profileData?.phone || "",
        });

        // Fetch addresses
        const { data: addressData } = await supabase
          .from("addresses")
          .select("*")
          .eq("client_id", user.id)
          .order("created_at");

        setAddresses(addressData || []);
      } catch (err: any) {
        setError(err.message || "Error al cargar el perfil");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const handleProfileSave = async () => {
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          phone: profile.phone || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      setProfileMsg("Perfil actualizado correctamente");
    } catch (err: any) {
      setProfileMsg(null);
      alert(err.message || "Error al guardar el perfil");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contrasenas no coinciden");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("La contrasena debe tener al menos 6 caracteres");
      return;
    }
    setChangingPassword(true);
    setPasswordMsg(null);
    setPasswordError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setPasswordMsg("Contrasena actualizada correctamente");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Error al cambiar la contrasena");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAddressSave = async () => {
    if (!editingAddress) return;
    setSavingAddress(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      if (isNewAddress) {
        const { data: newAddr, error } = await supabase
          .from("addresses")
          .insert({
            client_id: user.id,
            label: editingAddress.label,
            street: editingAddress.street,
            number: editingAddress.number,
            city: "",
            zone: editingAddress.zone,
            notes: editingAddress.notes || null,
            is_default: false,
          })
          .select("*")
          .single();
        if (error) throw error;
        setAddresses((prev) => [...prev, newAddr as Address]);
      } else {
        const { error } = await supabase
          .from("addresses")
          .update({
            label: editingAddress.label,
            street: editingAddress.street,
            number: editingAddress.number,
            zone: editingAddress.zone,
            notes: editingAddress.notes || null,
          })
          .eq("id", editingAddress.id);
        if (error) throw error;
        setAddresses((prev) =>
          prev.map((a) =>
            a.id === editingAddress.id
              ? {
                  ...a,
                  label: editingAddress.label,
                  street: editingAddress.street,
                  number: editingAddress.number,
                  zone: editingAddress.zone,
                  notes: editingAddress.notes || null,
                }
              : a
          )
        );
      }
      setEditingAddress(null);
      setIsNewAddress(false);
    } catch (err: any) {
      alert(err.message || "Error al guardar la direccion");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleAddressDelete = async (id: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("addresses")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(err.message || "Error al eliminar la direccion");
    }
  };

  const startEditAddress = (address: Address) => {
    setEditingAddress({
      id: address.id,
      label: address.label,
      street: address.street,
      number: address.number,
      zone: address.zone,
      notes: address.notes || "",
    });
    setIsNewAddress(false);
  };

  const startNewAddress = () => {
    setEditingAddress({ ...emptyAddress });
    setIsNewAddress(true);
  };

  const cancelEditAddress = () => {
    setEditingAddress(null);
    setIsNewAddress(false);
  };

  if (loading) return <ProfileSkeleton />;

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-green-800 text-sm font-medium mt-2 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        <p className="text-gray-500 mt-1">
          Gestiona tu informacion personal y direcciones.
        </p>
      </div>

      {/* Personal info */}
      <Card>
        <CardHeader>
          <CardTitle>
            <User size={18} className="inline mr-2" />
            Informacion personal
          </CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <Input
            label="Nombre completo"
            value={profile.full_name}
            onChange={(e) =>
              setProfile((p) => ({ ...p, full_name: e.target.value }))
            }
          />
          <Input
            label="Email"
            type="email"
            value={profile.email}
            disabled
            className="bg-gray-50"
          />
          <Input
            label="Telefono"
            type="tel"
            value={profile.phone}
            onChange={(e) =>
              setProfile((p) => ({ ...p, phone: e.target.value }))
            }
            placeholder="11 1234-5678"
          />
          {profileMsg && (
            <p className="text-sm text-green-700">{profileMsg}</p>
          )}
          <div className="pt-2">
            <Button
              onClick={handleProfileSave}
              loading={savingProfile}
              disabled={savingProfile}
            >
              <Save size={16} />
              Guardar cambios
            </Button>
          </div>
        </div>
      </Card>

      {/* Saved addresses */}
      <Card>
        <CardHeader>
          <CardTitle>
            <MapPin size={18} className="inline mr-2" />
            Direcciones guardadas
          </CardTitle>
          {!editingAddress && (
            <Button variant="outline" size="sm" onClick={startNewAddress}>
              <Plus size={14} />
              Agregar
            </Button>
          )}
        </CardHeader>

        {/* Address form */}
        {editingAddress && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <p className="text-sm font-medium text-gray-900">
              {isNewAddress ? "Nueva direccion" : "Editar direccion"}
            </p>
            <Input
              label="Etiqueta"
              value={editingAddress.label}
              onChange={(e) =>
                setEditingAddress((a) =>
                  a ? { ...a, label: e.target.value } : a
                )
              }
              placeholder="Ej: Casa, Oficina"
            />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input
                  label="Calle"
                  value={editingAddress.street}
                  onChange={(e) =>
                    setEditingAddress((a) =>
                      a ? { ...a, street: e.target.value } : a
                    )
                  }
                />
              </div>
              <Input
                label="Numero"
                value={editingAddress.number}
                onChange={(e) =>
                  setEditingAddress((a) =>
                    a ? { ...a, number: e.target.value } : a
                  )
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Zona
              </label>
              <select
                value={editingAddress.zone}
                onChange={(e) =>
                  setEditingAddress((a) =>
                    a ? { ...a, zone: e.target.value } : a
                  )
                }
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
              label="Notas (opcional)"
              value={editingAddress.notes}
              onChange={(e) =>
                setEditingAddress((a) =>
                  a ? { ...a, notes: e.target.value } : a
                )
              }
              placeholder="Timbre, piso, indicaciones"
            />
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleAddressSave}
                loading={savingAddress}
                disabled={savingAddress}
              >
                <Save size={14} />
                Guardar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelEditAddress}
                disabled={savingAddress}
              >
                <X size={14} />
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Address list */}
        <div className="space-y-2">
          {addresses.length === 0 && !editingAddress && (
            <p className="text-sm text-gray-400 text-center py-4">
              No tenes direcciones guardadas.
            </p>
          )}
          {addresses.map((address) => (
            <div
              key={address.id}
              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {address.label}
                </p>
                <p className="text-xs text-gray-500">
                  {address.street} {address.number}, {address.zone}
                </p>
                {address.notes && (
                  <p className="text-xs text-gray-400">{address.notes}</p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => startEditAddress(address)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Pencil size={14} className="text-gray-500" />
                </button>
                <button
                  onClick={() => handleAddressDelete(address.id)}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={14} className="text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Lock size={18} className="inline mr-2" />
            Cambiar contrasena
          </CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <Input
            label="Contrasena actual"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            label="Nueva contrasena"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="Confirmar nueva contrasena"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={
              confirmPassword && newPassword !== confirmPassword
                ? "Las contrasenas no coinciden"
                : undefined
            }
          />
          {passwordMsg && (
            <p className="text-sm text-green-700">{passwordMsg}</p>
          )}
          {passwordError && (
            <p className="text-sm text-red-600">{passwordError}</p>
          )}
          <div className="pt-2">
            <Button
              onClick={handlePasswordChange}
              disabled={
                !currentPassword ||
                !newPassword ||
                !confirmPassword ||
                changingPassword
              }
              loading={changingPassword}
            >
              <Lock size={16} />
              Actualizar contrasena
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
