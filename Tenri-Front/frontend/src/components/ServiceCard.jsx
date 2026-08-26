import React from "react";

// ============================================================
// 🎴 SERVICE CARD — Fase 3 visual
// ============================================================
// Card editorial premium con:
//  - Imagen como hero con gradient overlay
//  - Tipografía mixta (display + sans)
//  - Precio destacado con tabular nums
//  - Hover: lift + reveal del CTA
//  - Duración visible al primer vistazo
// ============================================================

export default function ServiceCard({ servicio, onAgendar }) {
  const precioFmt = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(servicio.precio);

  return (
    <article className="group relative bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl overflow-hidden card-lift flex flex-col">

      {/* MEDIA — Imagen o placeholder visual */}
      <div className="relative aspect-card overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/30 dark:to-abyss">
        {servicio.imagen_url ? (
          <img
            src={servicio.imagen_url}
            alt={servicio.nombre}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 mesh-bg flex items-center justify-center">
            <svg className="w-16 h-16 text-emerald-500/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
          </div>
        )}

        {/* Gradient overlay para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Tag duración (esquina) */}
        <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-white/90 dark:bg-card/90 backdrop-blur-sm border border-white/40 dark:border-slate-700/30 shadow-none">
          <span className="text-[10px] font-bold text-ink-2 dark:text-slate-300 uppercase tracking-widest tabular">
            {servicio.duracion || servicio.duracion_minutos} min
          </span>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-display text-xl font-semibold text-ink dark:text-white leading-tight mb-2">
          {servicio.nombre}
        </h3>

        {servicio.descripcion && (
          <p className="text-sm text-muted dark:text-slate-400 leading-relaxed line-clamp-2 mb-3">
            {servicio.descripcion}
          </p>
        )}

        {/* Precio + CTA */}
        <div className="mt-auto pt-5 border-t border-black/5 dark:border-slate-800/40 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-faint font-bold mb-0.5">Desde</p>
            <p className="font-display text-xl font-bold text-ink dark:text-white tabular">{precioFmt}</p>
          </div>

          <button
            onClick={() => onAgendar(servicio)}
            className="group/btn relative px-5 py-3 bg-slate-900 dark:bg-emerald-500 hover:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-abyss text-sm font-bold rounded-full transition-all duration-300 active:scale-95 shadow-none hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:shadow-emerald-500/20 flex items-center gap-2 overflow-hidden"
          >
            <span className="relative z-10">Agendar</span>
            <svg className="relative z-10 w-4 h-4 transition-transform group-hover/btn:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M5 12h13" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
