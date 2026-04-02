"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import Button from "@/components/ui/Button";

interface ExportButtonProps {
  data: Record<string, unknown>[];
  headers: { key: string; label: string }[];
  filename?: string;
  className?: string;
}

export default function ExportButton({
  data,
  headers,
  filename = "reporte",
  className = "",
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = () => {
    setLoading(true);

    try {
      // Header row
      const headerRow = headers.map((h) => `"${h.label}"`).join(",");

      // Data rows
      const rows = data.map((row) =>
        headers
          .map((h) => {
            const val = row[h.key];
            if (val === null || val === undefined) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
          })
          .join(",")
      );

      const csv = "\uFEFF" + [headerRow, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      loading={loading}
      disabled={data.length === 0}
      className={className}
    >
      <Download size={16} />
      Exportar CSV
    </Button>
  );
}
