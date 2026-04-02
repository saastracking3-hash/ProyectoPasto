"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, ClipboardCheck } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";

interface LocalChecklistItem {
  id: string;
  description: string;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  sort_order: number;
  dirty: boolean; // track local changes
}

function SkeletonChecklist() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-gray-200 rounded-lg" />
        <div>
          <div className="h-6 w-28 bg-gray-200 rounded mb-1" />
          <div className="h-4 w-36 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="h-2 bg-gray-200 rounded-full" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 bg-gray-200 rounded-md" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-44 bg-gray-200 rounded" />
              <div className="h-3 w-28 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChecklistPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id as string;

  const [checklistId, setChecklistId] = useState<string | null>(null);
  const [items, setItems] = useState<LocalChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noChecklist, setNoChecklist] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchChecklist = useCallback(async () => {
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("No se pudo obtener el usuario");
        return;
      }
      setUserId(user.id);

      // Fetch checklist for this assignment
      const { data: checklist, error: clError } = await supabase
        .from("checklists")
        .select("id")
        .eq("assignment_id", assignmentId)
        .maybeSingle();

      if (clError) {
        setError("Error al cargar checklist: " + clError.message);
        return;
      }

      if (!checklist) {
        setNoChecklist(true);
        return;
      }

      setChecklistId(checklist.id);

      // Fetch items
      const { data: checklistItems, error: itemsError } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("checklist_id", checklist.id)
        .order("sort_order", { ascending: true });

      if (itemsError) {
        setError("Error al cargar items: " + itemsError.message);
        return;
      }

      setItems(
        (checklistItems || []).map((item: any) => ({
          ...item,
          dirty: false,
        }))
      );
    } catch (err: any) {
      setError("Error inesperado: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              is_completed: !item.is_completed,
              completed_at: !item.is_completed
                ? new Date().toISOString()
                : null,
              completed_by: !item.is_completed ? userId : null,
              dirty: true,
            }
          : item
      )
    );
  };

  const updateNote = (id: string, notes: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, notes, dirty: true } : item
      )
    );
  };

  const handleSave = async () => {
    const dirtyItems = items.filter((i) => i.dirty);
    if (dirtyItems.length === 0) {
      router.back();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();

      // Update each dirty item
      const updates = dirtyItems.map((item) =>
        supabase
          .from("checklist_items")
          .update({
            is_completed: item.is_completed,
            completed_at: item.completed_at,
            completed_by: item.completed_by,
            notes: item.notes,
          })
          .eq("id", item.id)
      );

      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;

      // Mark all as clean
      setItems((prev) => prev.map((i) => ({ ...i, dirty: false })));
      router.back();
    } catch (err: any) {
      setError("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonChecklist />;

  if (noChecklist) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Checklist</h1>
        </div>
        <EmptyState
          icon={<ClipboardCheck size={28} />}
          title="No hay checklist asignado"
          description="Este trabajo no tiene un checklist asociado."
        />
      </div>
    );
  }

  const completedCount = items.filter((i) => i.is_completed).length;
  const hasDirty = items.some((i) => i.dirty);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Checklist</h1>
          <p className="text-sm text-gray-500">
            {completedCount}/{items.length} completados
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-600 rounded-full transition-all"
          style={{
            width: `${items.length > 0 ? (completedCount / items.length) * 100 : 0}%`,
          }}
        />
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.id} className="!p-4">
            <div className="flex items-start gap-3">
              <button
                onClick={() => toggleItem(item.id)}
                className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  item.is_completed
                    ? "bg-green-600 border-green-600"
                    : "border-gray-300 hover:border-green-400"
                }`}
              >
                {item.is_completed && (
                  <Check size={14} className="text-white" />
                )}
              </button>
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    item.is_completed
                      ? "text-gray-400 line-through"
                      : "text-gray-900"
                  }`}
                >
                  {item.description}
                </p>
                <input
                  type="text"
                  value={item.notes || ""}
                  onChange={(e) => updateNote(item.id, e.target.value)}
                  placeholder="Agregar nota..."
                  className="mt-1 w-full text-xs text-gray-500 border-0 border-b border-transparent focus:border-gray-300 px-0 py-1 focus:outline-none"
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Button
        className="w-full"
        size="lg"
        loading={saving}
        onClick={handleSave}
      >
        {hasDirty ? "Guardar cambios" : "Volver"}
      </Button>
    </div>
  );
}
