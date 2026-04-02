"use client";

import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import type { Toast as ToastData, ToastType } from "@/lib/hooks/useToast";

interface ToastProps {
  toasts: ToastData[];
  onRemove: (id: string) => void;
}

const typeConfig: Record<ToastType, { icon: typeof CheckCircle2; bg: string; border: string; text: string }> = {
  success: {
    icon: CheckCircle2,
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
  },
  error: {
    icon: AlertCircle,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
  },
};

export default function ToastContainer({ toasts, onRemove }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const config = typeConfig[toast.type];
        const Icon = config.icon;

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-2 px-4 py-3 rounded-lg border shadow-lg ${config.bg} ${config.border} animate-in slide-in-from-right`}
            role="alert"
          >
            <Icon size={18} className={`${config.text} shrink-0 mt-0.5`} />
            <p className={`text-sm flex-1 ${config.text}`}>{toast.message}</p>
            <button
              onClick={() => onRemove(toast.id)}
              className={`${config.text} hover:opacity-70 shrink-0`}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
