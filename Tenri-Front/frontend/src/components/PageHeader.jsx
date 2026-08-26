import React from "react";

// ============================================================
// 🧱 PAGE HEADER — Fase 3 visual
// ============================================================

// tono: color del tag-pill — "emerald" (default) | "amber" (panel master)
export default function PageHeader({ titulo, subtitulo, accion, tag, tono = "emerald" }) {
  const tonoTag = tono === "amber"
    ? "text-amber-600 dark:text-amber-400"
    : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 pb-6 border-b border-line dark:border-slate-800/60">
      <div>
        {tag && (
          <span className={`tag-pill ${tonoTag} mb-3`}>{tag}</span>
        )}
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink dark:text-white tracking-tight leading-tight">
          {titulo}
        </h1>
        {subtitulo && (
          <p className="text-sm text-muted dark:text-slate-400 mt-2 max-w-2xl">{subtitulo}</p>
        )}
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  );
}
