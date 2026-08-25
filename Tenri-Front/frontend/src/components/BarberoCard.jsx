import React from "react";

// ============================================================
// 👤 BARBERO CARD — Fase 4A
// ============================================================
// Card visual del barbero usado en:
//  - Modal de reserva (selección)
//  - Página de detalle de barbería (próximamente)
//
// Muestra: avatar/inicial + nombre + especialidad + rating
// ============================================================

function StarRating({ valor = 0, total = 0, size = "sm" }) {
  const v = Number(valor) || 0;

  const sizeCls = {
    xs: "text-[10px]",
    sm: "text-xs",
    md: "text-sm",
  }[size];

  if (total === 0) {
    return (
      <span className={`${sizeCls} text-[#A8A29E] italic`}>Sin reseñas</span>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${sizeCls}`}>
      <span className="text-amber-400">★</span>
      <span className="font-bold text-[#2F3437] dark:text-slate-300 tabular">
        {v.toFixed(1)}
      </span>
      <span className="text-[#A8A29E] tabular">({total})</span>
    </div>
  );
}

export default function BarberoCard({ barbero, selected, onClick, compact = false }) {
  if (compact) {
    // Versión compacta: para el modal de reserva
    return (
      <button
        type="button"
        onClick={onClick}
        className={`relative p-3 rounded-xl border text-left transition-all w-full ${
          selected
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
            : "border-[#EAEAEA] dark:border-slate-700/50 bg-white dark:bg-[#03070e] hover:border-[#EAEAEA] dark:hover:border-slate-600"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm shrink-0 transition-colors border-2 ${
            selected
              ? "border-emerald-500"
              : "border-[#EAEAEA] dark:border-slate-700"
          }`}>
            {barbero.avatar_url ? (
              <img src={barbero.avatar_url} alt={barbero.name} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${
                selected
                  ? "bg-emerald-500 text-white dark:text-[#03070e]"
                  : "bg-[#F7F6F3] dark:bg-slate-800 text-[#2F3437] dark:text-slate-300"
              }`}>
                {barbero.name?.substring(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold truncate ${
              selected
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-[#111111] dark:text-slate-200"
            }`}>
              {barbero.name}
            </p>

            {barbero.especialidad && (
              <p className="text-[11px] text-[#787774] truncate">{barbero.especialidad}</p>
            )}

            <div className="mt-1">
              <StarRating valor={barbero.promedio_calificacion} total={barbero.total_resenas} size="xs" />
            </div>
          </div>
        </div>
      </button>
    );
  }

  // Versión completa (vista detallada)
  return (
    <div className="bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl p-5 shadow-none">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-[#F7F6F3] dark:bg-slate-800 shrink-0 border-2 border-[#EAEAEA] dark:border-slate-700">
          {barbero.avatar_url ? (
            <img src={barbero.avatar_url} alt={barbero.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-[#2F3437] dark:text-slate-300">
              {barbero.name?.substring(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[#111111] dark:text-white">{barbero.name}</h3>
          {barbero.especialidad && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wider mt-0.5">
              {barbero.especialidad}
            </p>
          )}
          <div className="mt-2">
            <StarRating valor={barbero.promedio_calificacion} total={barbero.total_resenas} size="sm" />
          </div>
        </div>
      </div>

      {barbero.bio && (
        <p className="text-sm text-[#2F3437] dark:text-slate-400 leading-relaxed mt-4">
          {barbero.bio}
        </p>
      )}
    </div>
  );
}

// Exportamos también StarRating por si se quiere usar suelto
export { StarRating };
