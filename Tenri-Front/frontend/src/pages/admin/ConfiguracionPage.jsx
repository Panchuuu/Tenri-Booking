import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import useApi from "../../hooks/useApi";
import useApiMutation from "../../hooks/useApiMutation";
import PageHeader from "../../components/PageHeader";
import { parseApiErrorSync } from "../../utils/parseApiError";

// ============================================================
// 📄 ADMIN / CONFIGURACIÓN
// ============================================================
// Política de tiempo mínimo de cancelación.
// ============================================================

// 🔧 FIX #6 (PDF): min/max opcionales para clampar valor en botones y input.
function Counter({ titulo, valor, onChange, step = 1, min = 0, max = Infinity }) {
  return (
    <div className="bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800/80 rounded-xl p-4 flex flex-col items-center shadow-inner">
      <span className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">{titulo}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(Math.min(max, Math.max(min, valor - step)))}
          className="w-8 h-8 rounded-full bg-line dark:bg-slate-800 hover:bg-emerald-500 hover:text-abyss text-ink-2 dark:text-white flex items-center justify-center font-bold transition-colors"
        >
          −
        </button>
        <input
          type="number"
          value={valor}
          onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value) || min)))}
          className="w-14 text-center bg-transparent text-2xl font-bold text-ink dark:text-white outline-none appearance-none"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(max, Math.max(min, valor + step)))}
          className="w-8 h-8 rounded-full bg-line dark:bg-slate-800 hover:bg-emerald-500 hover:text-abyss text-ink-2 dark:text-white flex items-center justify-center font-bold transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function ConfiguracionPage() {
  const { data: barberia, refetch } = useApi("/mi-barberia");
  const { ejecutar, cargando: guardando, getLastError } = useApiMutation();

  const [tiempoTotal, setTiempoTotal] = useState(60); // minutos

  useEffect(() => {
    if (barberia?.tiempo_cancelacion !== undefined) {
      setTiempoTotal(barberia.tiempo_cancelacion);
    }
  }, [barberia]);

  const dias    = Math.floor(tiempoTotal / 1440);
  const horas   = Math.floor((tiempoTotal % 1440) / 60);
  const minutos = tiempoTotal % 60;

  const setComponentes = (d, h, m) => {
    setTiempoTotal(Math.max(0, d * 1440 + h * 60 + m));
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const r = await ejecutar("/mi-barberia", {
      method: "PUT",
      body: { tiempo_cancelacion: tiempoTotal },
    });
    if (r) {
      toast.success("Configuración actualizada");
      refetch();
    } else {
      // 🎯 Pack 2/D: el backend (UpdateConfigBarberiaRequest) devuelve
      // mensajes claros: "El tiempo máximo de cancelación es de 30 días
      // (43.200 minutos).", "El tiempo de cancelación debe ser un número
      // entero de minutos.", etc.
      toast.error(parseApiErrorSync(
        getLastError()?.body,
        "Error al guardar la configuración"
      ));
    }
  };

  return (
    <div>
      <PageHeader
        titulo="Ajustes de Negocio"
        subtitulo="Define las reglas bajo las cuales los clientes interactúan con tu barbería"
      />

      <div className="bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl p-8 max-w-3xl shadow-none">
        <h3 className="text-xl font-bold text-ink dark:text-white mb-2">
          Política de cancelación y reagendo
        </h3>
        <p className="text-muted text-sm mb-8">
          Anticipación mínima que exige tu negocio para que un cliente pueda cancelar
          <strong className="text-ink-2 dark:text-slate-300"> o reagendar</strong> su cita.
        </p>

        <form onSubmit={handleGuardar} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 🔧 FIX #6 (PDF): min/max previenen overflow por campo y evitan
                que tiempoTotal supere los 43200 min del backend (max:43200 B.5). */}
            <Counter titulo="Días"    valor={dias}    onChange={(v) => setComponentes(v, horas, minutos)} min={0} max={30} />
            <Counter titulo="Horas"   valor={horas}   onChange={(v) => setComponentes(dias, v, minutos)}  min={0} max={23} />
            <Counter titulo="Minutos" valor={minutos} onChange={(v) => setComponentes(dias, horas, v)}    min={0} max={59} step={15} />
          </div>

          <div className="text-center bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl text-sm font-medium">
            Total guardado: <span className="font-bold text-lg ml-1">{tiempoTotal}</span> minutos
            {tiempoTotal === 0 && (
              <p className="text-rose-500 mt-1 text-xs">
                ⚠️ Tus clientes podrán cancelar hasta el último minuto.
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-line dark:border-slate-800/60">
            <button
              type="submit"
              disabled={guardando}
              className="w-full md:w-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white dark:text-abyss font-bold rounded-lg transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.04)] disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar Configuración"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
