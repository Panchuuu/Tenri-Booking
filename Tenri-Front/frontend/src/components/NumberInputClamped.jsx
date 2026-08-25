import React, { useState, useEffect } from "react";

/**
 * Input numérico con clamp automático respetando min/max.
 *
 * Resuelve FIX #6 del PDF de errores: "Al pasar el limite de minutos u
 * horas se suma al siguiente valor, haciendo que si por error un usuario
 * pone 24 el valor quede como 00 pero se sume 1 en el dia."
 *
 * Diferencias clave con <input type="number">:
 *  - Cuando el usuario escribe un número > max, se clampa visual y
 *    semánticamente a max (no hace overflow al siguiente field).
 *  - Cuando escribe < min, se clampa a min.
 *  - Acepta valores intermedios vacíos sin romper (estado "" se permite
 *    para que el usuario pueda borrar y retipear).
 *  - Soporta paso decimal opcional con prop "step".
 *  - Estilo idéntico a los inputs del proyecto (tokens del index.css).
 *
 * Props:
 *   value:    number | "" (controlled)
 *   onChange: (newValue: number | "") => void
 *   min:      number (default 0)
 *   max:      number (default Infinity)
 *   step:     number (default 1)
 *   label:    string (opcional, label del input)
 *   id:       string (opcional)
 *   suffix:   string (opcional, texto pequeño después del input ej "min")
 *   placeholder, disabled, required, className: passthrough
 *
 * Ejemplo:
 *   <NumberInputClamped
 *     label="Horas"
 *     value={horas}
 *     onChange={setHoras}
 *     min={0}
 *     max={23}
 *     suffix="h"
 *   />
 */
export default function NumberInputClamped({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  label,
  id,
  suffix,
  placeholder,
  disabled,
  required,
  className = "",
  ...rest
}) {
  // Estado interno solo para permitir "" mientras el usuario escribe
  const [internal, setInternal] = useState(value === "" || value == null ? "" : String(value));

  // Sincronizar con prop value si cambia desde afuera
  useEffect(() => {
    if (value === "" || value == null) {
      setInternal("");
    } else if (String(value) !== internal) {
      setInternal(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const clamp = (n) => Math.min(max, Math.max(min, n));

  const handleChange = (e) => {
    const raw = e.target.value;

    // Permitir vacío temporal (para que el usuario pueda borrar)
    if (raw === "" || raw === "-") {
      setInternal(raw);
      onChange("");
      return;
    }

    // Solo aceptar números (con punto/coma decimal según step)
    const normalized = raw.replace(",", ".");
    const parsed = Number(normalized);

    if (Number.isNaN(parsed)) {
      // Ignorar input no numérico
      return;
    }

    const clamped = clamp(parsed);

    // Si el usuario intentó pasarse del max/min, mostramos el valor clampeado
    setInternal(String(clamped));
    onChange(clamped);
  };

  const handleBlur = () => {
    // Al perder foco, si quedó vacío, restaurar al min
    if (internal === "" || internal === "-") {
      const fallback = clamp(0);
      setInternal(String(fallback));
      onChange(fallback);
    }
  };

  const baseClasses =
    "w-full bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 " +
    "rounded-xl p-3 text-sm text-[#111111] dark:text-slate-200 outline-none " +
    "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all tabular";

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-bold text-[#787774] uppercase tracking-wider mb-2 block"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={internal}
          onChange={handleChange}
          onBlur={handleBlur}
          min={min}
          max={max === Infinity ? undefined : max}
          step={step}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`${baseClasses} ${suffix ? "pr-12" : ""}`}
          {...rest}
        />
        {suffix && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#A8A29E] font-mono pointer-events-none"
            aria-hidden="true"
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
