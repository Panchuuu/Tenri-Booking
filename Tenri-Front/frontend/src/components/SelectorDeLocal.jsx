import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

/**
 * Con cuál de tus locales estás trabajando.
 *
 * Una persona puede tener varios: compró uno, abrió otro, o atiende en el de
 * un socio. Todo el panel —la agenda, el equipo, los servicios— muestra el que
 * esté seleccionado acá, así que cambiarlo es cambiar de local, no de vista.
 *
 * Con un solo local no se muestra ningún control: no hay nada que elegir, y
 * poner un menú de una sola opción es ruido.
 */

const ChevronIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const CheckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export default function SelectorDeLocal() {
  const { locales, localActivo, tieneVariosLocales, cambiarLocal } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [cambiando, setCambiando] = useState(null);
  const contenedor = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;

    const alTocarFuera = (e) => {
      if (contenedor.current && !contenedor.current.contains(e.target)) setAbierto(false);
    };
    const alEscapar = (e) => e.key === "Escape" && setAbierto(false);

    document.addEventListener("mousedown", alTocarFuera);
    document.addEventListener("keydown", alEscapar);

    return () => {
      document.removeEventListener("mousedown", alTocarFuera);
      document.removeEventListener("keydown", alEscapar);
    };
  }, [abierto]);

  if (!localActivo && !tieneVariosLocales) return null;

  const elegir = async (id) => {
    if (id === localActivo?.id) {
      setAbierto(false);
      return;
    }

    setCambiando(id);
    try {
      await cambiarLocal(id);
      setAbierto(false);
      // Recarga a propósito: cada pantalla del panel trae los datos del local
      // al montarse, y media docena de pantallas escuchando un cambio global
      // es más frágil que volver a empezar limpio.
      window.location.reload();
    } catch (e) {
      toast.error(e.message || "No se pudo cambiar de local.");
    } finally {
      setCambiando(null);
    }
  };

  // Un solo local: se muestra cuál es, sin menú.
  if (!tieneVariosLocales) {
    return (
      <div className="px-3 py-2 rounded-xl bg-paper dark:bg-slate-800/50 border border-line/60 dark:border-slate-800">
        <p className="text-[10px] uppercase font-bold tracking-widest text-faint dark:text-slate-500">Tu local</p>
        <p className="text-sm font-bold text-ink dark:text-white truncate">{localActivo?.nombre}</p>
      </div>
    );
  }

  return (
    <div className="relative" ref={contenedor}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className="w-full px-3 py-2 rounded-xl bg-paper dark:bg-slate-800/50 border border-line/60 dark:border-slate-800 hover:border-emerald-400/60 transition-colors flex items-center gap-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase font-bold tracking-widest text-faint dark:text-slate-500">
            Trabajando en
          </p>
          <p className="text-sm font-bold text-ink dark:text-white truncate">
            {localActivo?.nombre || "Elige un local"}
          </p>
        </div>
        <ChevronIcon className={`w-4 h-4 text-faint shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>

      {abierto && (
        <ul
          role="listbox"
          /* Se abre hacia arriba: este control vive al pie de la barra lateral,
             y hacia abajo la lista queda fuera de la pantalla. */
          className="absolute bottom-full z-40 mb-2 w-full rounded-xl border border-line/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg overflow-hidden animate-fade-in"
        >
          {locales.map((local) => {
            const esActivo = local.id === localActivo?.id;

            return (
              <li key={local.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={esActivo}
                  disabled={cambiando !== null || !local.activa}
                  onClick={() => elegir(local.id)}
                  className={`w-full px-3 py-2.5 text-left flex items-center gap-2 transition-colors disabled:opacity-50 ${
                    esActivo
                      ? "bg-emerald-50 dark:bg-emerald-500/10"
                      : "hover:bg-paper dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink dark:text-white truncate">{local.nombre}</p>
                    <p className="text-[11px] text-faint dark:text-slate-500 truncate">
                      {local.activa ? (local.rol === "admin" ? "Administras este local" : "Atiendes acá") : "Suspendido"}
                    </p>
                  </div>
                  {esActivo && <CheckIcon className="w-4 h-4 text-emerald-500 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
