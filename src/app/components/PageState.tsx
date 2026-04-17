import type { ReactNode } from "react";

type PageStateProps = {
  title: string;
  description?: string;
  tone?: "neutral" | "error" | "success";
  action?: ReactNode;
};

export function PageState({ title, description, tone = "neutral", action }: PageStateProps) {
  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-border bg-surface text-text-secondary";

  return (
    <div className={`rounded-2xl border px-6 py-8 text-center shadow-sm ${toneClass}`}>
      <div className="text-lg font-black text-text">{title}</div>
      {description ? <p className="mx-auto mt-2 max-w-xl text-sm leading-6">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-6 py-8 text-center text-sm text-text-secondary shadow-sm">
      {label}
    </div>
  );
}
