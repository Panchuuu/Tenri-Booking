import React, { useState, useMemo } from "react";

// ============================================================
// 📅 CALENDAR PICKER — Calendario tipo grid mensual
// ============================================================
// Reemplaza el `<input type="date">` nativo del navegador,
// que tiene UX horrible (especialmente en mobile y modo oscuro).
//
// Características:
//  - Navegación entre meses
//  - Bloquea fechas pasadas
//  - Resalta el día de hoy
//  - Muestra día seleccionado con destaque visual
//  - Accesible con teclado
//  - 100% responsive
// ============================================================

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

function toLocalDateString(date) {
  // Devuelve YYYY-MM-DD respetando timezone local (no UTC)
  return date.toLocaleDateString("sv-SE");
}

function esMismaFecha(d1, d2) {
  return d1.getFullYear() === d2.getFullYear()
      && d1.getMonth()    === d2.getMonth()
      && d1.getDate()     === d2.getDate();
}

export default function CalendarPicker({ valor, onChange, minFecha }) {
  // valor = string "YYYY-MM-DD" o null
  const fechaSeleccionada = valor ? new Date(valor + "T00:00:00") : null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const minDate = minFecha ? new Date(minFecha + "T00:00:00") : hoy;

  // Mes actualmente visible (inicia en mes del valor o mes actual)
  const [mesVisible, setMesVisible] = useState(() => {
    const base = fechaSeleccionada || hoy;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // Genera la grilla de 6 semanas × 7 días = 42 celdas
  const celdas = useMemo(() => {
    const year = mesVisible.getFullYear();
    const month = mesVisible.getMonth();

    // Primer día del mes
    const primero = new Date(year, month, 1);
    // En JS: 0=domingo, 1=lunes... Convertimos a 0=lunes
    const offsetInicio = (primero.getDay() + 6) % 7;

    // Días en el mes
    const diasEnMes = new Date(year, month + 1, 0).getDate();

    const arr = [];

    // Celdas vacías antes del día 1
    for (let i = 0; i < offsetInicio; i++) {
      arr.push(null);
    }

    // Días del mes
    for (let d = 1; d <= diasEnMes; d++) {
      arr.push(new Date(year, month, d));
    }

    return arr;
  }, [mesVisible]);

  const mesAnterior = () => {
    setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() - 1, 1));
  };

  const mesSiguiente = () => {
    setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 1));
  };

  // ¿El mes visible es anterior al mes mínimo? → no permitir retroceder más
  const puedeRetroceder = mesVisible.getFullYear() > minDate.getFullYear()
    || (mesVisible.getFullYear() === minDate.getFullYear()
        && mesVisible.getMonth() > minDate.getMonth());

  return (
    <div className="bg-white dark:bg-card-2 border border-line dark:border-slate-800/60 rounded-xl p-5 shadow-none">

      {/* Header: mes + navegación */}
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={mesAnterior}
          disabled={!puedeRetroceder}
          aria-label="Mes anterior"
          className="w-9 h-9 rounded-full flex items-center justify-center text-ink-2 dark:text-slate-400 hover:bg-paper dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <div className="font-display text-lg font-semibold text-ink dark:text-white">
            {MESES[mesVisible.getMonth()]}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted font-medium">
            {mesVisible.getFullYear()}
          </div>
        </div>

        <button
          type="button"
          onClick={mesSiguiente}
          aria-label="Mes siguiente"
          className="w-9 h-9 rounded-full flex items-center justify-center text-ink-2 dark:text-slate-400 hover:bg-paper dark:hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Encabezado de días de la semana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="text-[10px] font-bold text-faint uppercase text-center py-1 tracking-widest"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid de días */}
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((fecha, idx) => {
          if (!fecha) {
            return <div key={`empty-${idx}`} />;
          }

          const esHoy           = esMismaFecha(fecha, hoy);
          const esSeleccionado  = fechaSeleccionada && esMismaFecha(fecha, fechaSeleccionada);
          const esPasado        = fecha < minDate;

          let clases = "aspect-square flex items-center justify-center text-sm font-medium rounded-lg transition-all relative";

          if (esPasado) {
            clases += " text-slate-300 dark:text-slate-700 cursor-not-allowed";
          } else if (esSeleccionado) {
            clases += " bg-emerald-500 text-white dark:text-abyss font-bold shadow-[0_2px_8px_rgba(0,0,0,0.04)] shadow-emerald-500/30 scale-105";
          } else if (esHoy) {
            clases += " text-emerald-600 dark:text-emerald-400 font-bold ring-1 ring-emerald-500/40 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-500/10";
          } else {
            clases += " text-ink-2 dark:text-slate-300 cursor-pointer hover:bg-paper dark:hover:bg-slate-800";
          }

          return (
            <button
              key={fecha.toISOString()}
              type="button"
              disabled={esPasado}
              onClick={() => onChange(toLocalDateString(fecha))}
              className={clases}
              aria-label={fecha.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
              aria-selected={esSeleccionado}
            >
              {fecha.getDate()}
            </button>
          );
        })}
      </div>

      {/* Footer con info de selección */}
      {fechaSeleccionada && (
        <div className="mt-5 pt-4 border-t border-black/5 dark:border-slate-800/60 text-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-faint mb-1">
            Seleccionado
          </p>
          <p className="text-sm font-medium text-ink dark:text-white capitalize">
            {fechaSeleccionada.toLocaleDateString("es-CL", {
              weekday: "long",
              day: "numeric",
              month: "long"
            })}
          </p>
        </div>
      )}
    </div>
  );
}
