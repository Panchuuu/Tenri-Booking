import React from "react";

/**
 * Contador visual de caracteres reutilizable.
 *
 * Resuelve parcialmente FIX #8 ("Permite cadenas de valores infinitos sin
 * poner un limite claro en el nombre") y FIX #11 ("No existen validaciones
 * de caracteres máximos al crear un servicio").
 *
 * Diseño:
 *  - Texto pequeño tipográficamente tabular (font-mono) tipo "23/60"
 *  - Color gris por defecto (< 80% del máximo)
 *  - Color ámbar al 80% del máximo (advertencia)
 *  - Color rojo al 100% (límite alcanzado)
 *
 * Props:
 *   actual: number (longitud actual del texto)
 *   max:    number (límite máximo permitido)
 *   className: string (opcional, para overrides de posición)
 *
 * Uso:
 *   <input maxLength={60} value={nombre} onChange={e => setNombre(e.target.value)} />
 *   <CharacterCounter actual={nombre.length} max={60} />
 *
 * O dentro de un textarea con padding-right para que no se solape:
 *   <div className="relative">
 *     <textarea maxLength={500} ... />
 *     <CharacterCounter
 *       actual={bio.length} max={500}
 *       className="absolute bottom-2 right-3"
 *     />
 *   </div>
 */
export default function CharacterCounter({ actual = 0, max, className = "" }) {
  if (!max || max <= 0) return null;

  const ratio = actual / max;

  let colorClass = "text-[#A8A29E] dark:text-slate-500";
  if (ratio >= 1) {
    colorClass = "text-rose-500 font-bold";
  } else if (ratio >= 0.8) {
    colorClass = "text-amber-500";
  }

  return (
    <span
      className={`text-[11px] font-mono tabular ${colorClass} ${className}`}
      aria-live="polite"
      aria-label={`${actual} de ${max} caracteres`}
    >
      {actual}/{max}
    </span>
  );
}
