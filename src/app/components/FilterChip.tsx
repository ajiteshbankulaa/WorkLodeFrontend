import { X } from "lucide-react";
import type { ReactNode } from "react";

export function FilterChip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-bold text-text-secondary transition hover:border-primary/30 hover:text-primary"
    >
      {children}
      <X size={13} />
    </button>
  );
}

export function MetricPill({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-text-secondary">
      <span>{label}</span>
      <span className="font-black text-text">{value}</span>
    </span>
  );
}
