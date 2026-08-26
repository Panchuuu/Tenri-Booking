import React, { useState, useEffect } from "react";

// ============================================================
// 🪟 CONFIRM MODAL — Modal de confirmación reutilizable
// ============================================================

export default function ConfirmModal({
  abierto,
  titulo = "¿Estás seguro?",
  mensaje,
  textoConfirmar = "Confirmar",
  textoCancelar  = "Cancelar",
  variante = "danger", // "danger" | "primary"
  onConfirmar,
  onCancelar,
  // 🔧 Bug fix: previene doble-submit al hacer click rápido en confirmar.
  // Backwards-compatible: default false no afecta a consumidores existentes.
  cargando = false,
}) {
  // El modal sigue montado 200ms tras cerrarse para poder pintar la
  // animación de salida (abierto=false ⇒ fade/scale-out ⇒ desmontar).
  const [montado, setMontado] = useState(abierto);
  useEffect(() => {
    if (abierto) {
      setMontado(true);
      return;
    }
    const t = setTimeout(() => setMontado(false), 200);
    return () => clearTimeout(t);
  }, [abierto]);

  if (!montado) return null;

  const cerrandose = !abierto;

  const colorConfirmar =
    variante === "danger"
      ? "bg-rose-500 hover:bg-rose-600 dark:hover:bg-rose-400 text-white dark:text-[#03070e]"
      : "bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white dark:text-[#03070e]";

  const colorIcono =
    variante === "danger"
      ? "bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500"
      : "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500";

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 dark:bg-[#03070e]/80 backdrop-blur-sm p-4 ${cerrandose ? "animate-fade-out" : "animate-fade-in"}`}
      onClick={cargando || cerrandose ? undefined : onCancelar}
    >
      <div
        className={`bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl ${cerrandose ? "animate-scale-out" : "animate-scale-in"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorIcono}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[#111111] dark:text-white">{titulo}</h3>
        </div>

        <p className="text-sm text-[#2F3437] dark:text-slate-400 mb-8 pl-14">{mensaje}</p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancelar}
            disabled={cargando}
            className="px-5 py-2.5 text-sm font-semibold text-[#2F3437] dark:text-slate-400 hover:text-[#111111] dark:hover:text-white hover:bg-[#F7F6F3] dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent rounded-lg transition-colors"
          >
            {textoCancelar}
          </button>
          <button
            onClick={onConfirmar}
            disabled={cargando}
            className={`px-5 py-2.5 font-bold rounded-lg transition-all active:scale-[0.97] shadow-none disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 ${colorConfirmar}`}
          >
            {cargando ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
