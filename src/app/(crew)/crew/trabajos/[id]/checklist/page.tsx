"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, ClipboardCheck, Loader2, WifiOff } from "lucide-react";
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
  dirty: boolean;        // has unsaved local changes
  pending_sync: boolean; // failed to sync to server
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

  const storageKey = `checklist_${assignmentId}`;

  const [checklistId, setChecklistId] = useState<string | null>(null);
  const [items, setItems] = useState<LocalChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noChecklist, setNoChecklist] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [confirmCompleteAll, setConfirmCompleteAll] = useState(false);

  // Keep a ref to items so callbacks always see the latest version
  const itemsRef = useRef<LocalChecklistItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // ── localStorage helpers ──────────────────────────────────────────────────

  const saveToLocalStorage = useCallback(
    (updatedItems: LocalChecklistItem[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedItems));
      } catch {
        // storage quota exceeded — ignore silently
      }
    },
    [storageKey]
  );

  const loadFromLocalStorage = useCallback((): LocalChecklistItem[] | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as LocalChecklistItem[];
    } catch {
      return null;
    }
  }, [storageKey]);

  // ── Supabase sync ─────────────────────────────────────────────────────────

  const syncPendingItems = useCallback(async () => {
    const pending = itemsRef.current.filter((i) => i.pending_sync);
    if (pending.length === 0) return;

    setIsSyncing(true);
    try {
      const supabase = createClient();
      const results = await Promise.all(
        pending.map((item) =>
          supabase
            .from("checklist_items")
            .update({
              is_completed: item.is_completed,
              completed_at: item.completed_at,
              completed_by: item.completed_by,
              notes: item.notes,
            })
            .eq("id", item.id)
        )
      );

      // Clear pending_sync flag for items that succeeded
      setItems((prev) => {
        const updated = prev.map((item, idx) => {
          const result = results.find((_, ri) => pending[ri]?.id === item.id);
          if (result && !result.error) {
            return { ...item, pending_sync: false, dirty: false };
          }
          return item;
        });
        saveToLocalStorage(updated);
        return updated;
      });
    } catch {
      // Will retry on next interval or online event
    } finally {
      setIsSyncing(false);
    }
  }, [saveToLocalStorage]);

  // ── Online / offline listeners ────────────────────────────────────────────

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingItems();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncPendingItems]);

  // ── Periodic retry every 30 s ─────────────────────────────────────────────

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        syncPendingItems();
      }
    }, 30_000);
    return () => clearInterval(intervalId);
  }, [syncPendingItems]);

  // ── Initial fetch ─────────────────────────────────────────────────────────

  const fetchChecklist = useCallback(async () => {
    // 1. Load from localStorage first for an instant render
    const cached = loadFromLocalStorage();
    if (cached && cached.length > 0) {
      setItems(cached);
      setLoading(false);
    }

    // 2. Try Supabase
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cached) setError("No se pudo obtener el usuario");
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data: checklist, error: clError } = await supabase
        .from("checklists")
        .select("id")
        .eq("assignment_id", assignmentId)
        .maybeSingle();

      if (clError) {
        if (!cached) setError("Error al cargar checklist: " + clError.message);
        setLoading(false);
        return;
      }

      if (!checklist) {
        setNoChecklist(true);
        setLoading(false);
        return;
      }

      setChecklistId(checklist.id);

      const { data: checklistItems, error: itemsError } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("checklist_id", checklist.id)
        .order("sort_order", { ascending: true });

      if (itemsError) {
        if (!cached) setError("Error al cargar items: " + itemsError.message);
        setLoading(false);
        return;
      }

      // Merge server data with any local pending changes so we don't overwrite
      // unsynchronised offline edits
      const serverItems: LocalChecklistItem[] = (checklistItems || []).map(
        (item: any) => ({ ...item, dirty: false, pending_sync: false })
      );

      setItems((prev) => {
        const merged = serverItems.map((serverItem) => {
          const local = prev.find((p) => p.id === serverItem.id);
          // Keep local version if it has unsynced changes
          if (local && local.pending_sync) return local;
          return serverItem;
        });
        saveToLocalStorage(merged);
        return merged;
      });
    } catch {
      // Offline or network error — cached data already shown
    } finally {
      setLoading(false);
    }
  }, [assignmentId, loadFromLocalStorage, saveToLocalStorage]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  // ── Toggle / note helpers ─────────────────────────────────────────────────

  const toggleItem = useCallback(
    (id: string) => {
      setItems((prev) => {
        const updated = prev.map((item) =>
          item.id === id
            ? {
                ...item,
                is_completed: !item.is_completed,
                completed_at: !item.is_completed
                  ? new Date().toISOString()
                  : null,
                completed_by: !item.is_completed ? userId : null,
                dirty: true,
                pending_sync: false, // will be set after failed sync attempt
              }
            : item
        );
        saveToLocalStorage(updated);

        // Fire-and-forget background sync
        const changed = updated.find((i) => i.id === id);
        if (changed) {
          const supabase = createClient();
          supabase
            .from("checklist_items")
            .update({
              is_completed: changed.is_completed,
              completed_at: changed.completed_at,
              completed_by: changed.completed_by,
              notes: changed.notes,
            })
            .eq("id", changed.id)
            .then(({ error }) => {
              if (error) {
                // Mark as pending so the retry loop picks it up
                setItems((p) => {
                  const withPending = p.map((i) =>
                    i.id === id ? { ...i, pending_sync: true } : i
                  );
                  saveToLocalStorage(withPending);
                  return withPending;
                });
              } else {
                // Sync succeeded — clear dirty flag
                setItems((p) => {
                  const clean = p.map((i) =>
                    i.id === id ? { ...i, dirty: false, pending_sync: false } : i
                  );
                  saveToLocalStorage(clean);
                  return clean;
                });
              }
            });
        }

        return updated;
      });
    },
    [userId, saveToLocalStorage]
  );

  const updateNote = useCallback(
    (id: string, notes: string) => {
      setItems((prev) => {
        const updated = prev.map((item) =>
          item.id === id ? { ...item, notes, dirty: true } : item
        );
        saveToLocalStorage(updated);
        return updated;
      });
    },
    [saveToLocalStorage]
  );

  // ── Complete all ──────────────────────────────────────────────────────────

  const completeAll = useCallback(() => {
    setConfirmCompleteAll(false);
    const now = new Date().toISOString();
    setItems((prev) => {
      const updated = prev.map((item) =>
        item.is_completed
          ? item
          : {
              ...item,
              is_completed: true,
              completed_at: now,
              completed_by: userId,
              dirty: true,
              pending_sync: false,
            }
      );
      saveToLocalStorage(updated);

      // Background sync for all newly completed items
      const toSync = updated.filter((i) => i.dirty);
      if (toSync.length > 0) {
        const supabase = createClient();
        Promise.all(
          toSync.map((item) =>
            supabase
              .from("checklist_items")
              .update({
                is_completed: item.is_completed,
                completed_at: item.completed_at,
                completed_by: item.completed_by,
                notes: item.notes,
              })
              .eq("id", item.id)
          )
        ).then((results) => {
          setItems((p) => {
            const reconciled = p.map((item) => {
              const res = results.find(
                (_, ri) => toSync[ri]?.id === item.id
              );
              if (!res) return item;
              return res.error
                ? { ...item, pending_sync: true }
                : { ...item, dirty: false, pending_sync: false };
            });
            saveToLocalStorage(reconciled);
            return reconciled;
          });
        });
      }

      return updated;
    });
  }, [userId, saveToLocalStorage]);

  // ── Manual save (existing flow) ───────────────────────────────────────────

  const handleSave = async () => {
    const dirtyItems = items.filter((i) => i.dirty && !i.pending_sync);
    if (dirtyItems.length === 0 && !items.some((i) => i.pending_sync)) {
      router.back();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();

      const toUpdate = items.filter((i) => i.dirty || i.pending_sync);
      const results = await Promise.all(
        toUpdate.map((item) =>
          supabase
            .from("checklist_items")
            .update({
              is_completed: item.is_completed,
              completed_at: item.completed_at,
              completed_by: item.completed_by,
              notes: item.notes,
            })
            .eq("id", item.id)
        )
      );

      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;

      setItems((prev) => {
        const clean = prev.map((i) => ({
          ...i,
          dirty: false,
          pending_sync: false,
        }));
        saveToLocalStorage(clean);
        return clean;
      });
      router.back();
    } catch (err: any) {
      setError("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  if (loading && items.length === 0) return <SkeletonChecklist />;

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
  const pendingCount = items.filter((i) => i.pending_sync).length;
  const allCompleted = items.length > 0 && completedCount === items.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Checklist</h1>
          <p className="text-sm text-gray-500">
            {completedCount}/{items.length} completados
          </p>
        </div>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-lg">
          <WifiOff size={16} className="flex-shrink-0" />
          <span>Sin conexion — cambios guardados localmente</span>
        </div>
      )}

      {/* Pending sync indicator */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 text-sm p-3 rounded-lg">
          <Loader2 size={16} className={`flex-shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
          <span>
            {pendingCount} {pendingCount === 1 ? "cambio pendiente" : "cambios pendientes"} de sincronizar
          </span>
        </div>
      )}

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

      {/* Complete all button */}
      {!allCompleted && (
        <div>
          {confirmCompleteAll ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="flex-1 text-sm text-green-800">
                Marcar todos como completados?
              </p>
              <button
                onClick={completeAll}
                className="text-sm font-medium text-green-700 hover:text-green-900 px-2 py-1 rounded"
              >
                Si
              </button>
              <button
                onClick={() => setConfirmCompleteAll(false)}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmCompleteAll(true)}
              className="w-full text-sm text-green-700 font-medium border border-green-300 bg-green-50 hover:bg-green-100 rounded-lg py-2 transition-colors"
            >
              Completar todas
            </button>
          )}
        </div>
      )}

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
                <div className="flex items-center gap-2">
                  <p
                    className={`text-sm font-medium ${
                      item.is_completed
                        ? "text-gray-400 line-through"
                        : "text-gray-900"
                    }`}
                  >
                    {item.description}
                  </p>
                  {item.pending_sync && (
                    <span
                      title="Pendiente de sincronizacion"
                      className="inline-block w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
                    />
                  )}
                </div>
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
        {hasDirty || pendingCount > 0 ? "Guardar cambios" : "Volver"}
      </Button>
    </div>
  );
}
