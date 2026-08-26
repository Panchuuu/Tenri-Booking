import React, { useState, useRef } from "react";

// ============================================================
// 📍 DIRECCIÓN AUTOCOMPLETE
// ============================================================
// Input de dirección con pre-resultados mientras se escribe
// (estilo Google Maps), usando Nominatim/OpenStreetMap:
// gratis, sin API key. Al elegir una sugerencia entrega
// dirección + coordenadas exactas vía onSeleccion.
//
// Respeto de la API pública: debounce de 600 ms, mínimo 3
// caracteres y máximo 5 resultados por consulta.
// ============================================================

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export default function DireccionAutocomplete({
  valor,
  onChange,          // (texto) => void — escribir libre
  onSeleccion,       // ({ direccion, latitud, longitud }) => void
  placeholder = "Escribe la dirección y elige una sugerencia…",
  className = "",
}) {
  const [sugerencias, setSugerencias] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const debounceRef = useRef(null);
  const ultimaBusquedaRef = useRef("");

  const buscar = async (texto) => {
    ultimaBusquedaRef.current = texto;
    setBuscando(true);
    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        limit: "5",
        countrycodes: "cl",           // priorizamos Chile (mercado de la app)
        "accept-language": "es",
        q: texto,
      });
      const r = await fetch(`${NOMINATIM_URL}?${params.toString()}`);
      if (!r.ok) throw new Error();
      const json = await r.json();

      // Si el usuario siguió escribiendo, descartamos esta respuesta vieja.
      if (ultimaBusquedaRef.current !== texto) return;

      setSugerencias(
        (json || []).map((item) => ({
          id: item.place_id,
          direccion: item.display_name,
          latitud: Number(item.lat),
          longitud: Number(item.lon),
        }))
      );
      setAbierto(true);
    } catch {
      setSugerencias([]);
    } finally {
      if (ultimaBusquedaRef.current === texto) setBuscando(false);
    }
  };

  const handleChange = (e) => {
    const texto = e.target.value;
    onChange(texto);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (texto.trim().length < 3) {
      setSugerencias([]);
      setAbierto(false);
      return;
    }
    debounceRef.current = setTimeout(() => buscar(texto.trim()), 600);
  };

  const elegir = (s) => {
    setAbierto(false);
    setSugerencias([]);
    onSeleccion(s);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={valor}
        onChange={handleChange}
        onFocus={() => sugerencias.length > 0 && setAbierto(true)}
        // Delay para que el click en una sugerencia alcance a registrarse.
        onBlur={() => setTimeout(() => setAbierto(false), 200)}
        maxLength={255}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />

      {buscando && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-line border-t-emerald-500 rounded-full animate-spin" />
      )}

      {abierto && sugerencias.length > 0 && (
        <ul className="absolute z-30 mt-2 w-full bg-white dark:bg-card border border-line dark:border-slate-700 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.05)] overflow-hidden max-h-72 overflow-y-auto">
          {sugerencias.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => elegir(s)}
                className="w-full text-left px-4 py-3 text-sm text-ink-2 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors flex items-start gap-2.5 border-b border-black/5 dark:border-slate-800/60 last:border-0"
              >
                <svg className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="leading-snug">{s.direccion}</span>
              </button>
            </li>
          ))}
          <li className="px-4 py-1.5 text-[10px] text-faint bg-paper-2 dark:bg-night-2">
            Datos de © OpenStreetMap
          </li>
        </ul>
      )}
    </div>
  );
}
