import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import apiFetch from "../utils/api";
import { useAuth } from "../context/AuthContext";

/**
 * Los primeros pasos de una tienda recién creada.
 *
 * Quien compra Booking llega a un panel vacío: tiene nombre y nada más. Sin
 * dirección no aparece en las búsquedas, sin alguien que atienda no hay agenda
 * y sin servicios no hay qué reservar. Esto le dice cuánto lleva y qué le
 * falta, y cada pendiente lo lleva a la pantalla donde se resuelve.
 *
 * Dos piezas, con propósitos distintos:
 *
 * - **La barra de avance** vive arriba del panel mientras quede algo pendiente.
 *   Es un recordatorio, no un trámite: se puede ignorar y seguir trabajando.
 * - **El ofrecimiento del tutorial** aparece una sola vez, la primera. Se puede
 *   seguir o saltar, porque hay gente que prefiere mirar sola, y saltarlo no
 *   esconde la lista: sigue estando arriba hasta que esté todo listo.
 */

const RUTAS = {
  tienda: "/admin/tienda",
  equipo: "/admin/equipo",
  servicios: "/admin/servicios",
  configuracion: "/admin/configuracion",
};

const CheckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const ArrowIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export default function PuestaEnMarcha() {
  const { esAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [estado, setEstado] = useState(null);
  const [ofreciendo, setOfreciendo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const resp = await apiFetch("/mi-barberia/configuracion");
      if (!resp.ok) return;

      const datos = await resp.json();
      setEstado(datos);
      setOfreciendo(datos.tutorial_pendiente);
    } catch {
      // Sin conexión no se muestra nada: es una ayuda, no algo que deba
      // interrumpir el trabajo.
    }
  }, []);

  useEffect(() => {
    if (esAdmin) cargar();
  }, [esAdmin, location.pathname, cargar]);

  /**
   * Y se recalcula apenas se guarda algo, sin cambiar de pantalla.
   *
   * El aviso sale de `apiFetch` en cada escritura que responde bien, así que
   * subir el logo o crear un servicio mueve la barra en el momento, que es
   * cuando la persona está mirando si le sirvió de algo.
   */
  useEffect(() => {
    if (!esAdmin) return undefined;

    const alCambiar = (e) => {
      // El propio POST del tutorial no necesita recargar la lista.
      if (String(e.detail?.endpoint || "").includes("/configuracion/tutorial")) return;
      cargar();
    };

    window.addEventListener("tenri:datos-cambiaron", alCambiar);

    return () => window.removeEventListener("tenri:datos-cambiaron", alCambiar);
  }, [esAdmin, cargar]);

  const resolverTutorial = async () => {
    setOfreciendo(false);
    try {
      await apiFetch("/mi-barberia/configuracion/tutorial", { method: "POST" });
    } catch {
      // Si no se pudo registrar, volverá a ofrecerse. Es molesto, no grave.
    }
  };

  const empezar = async () => {
    await resolverTutorial();
    const primero = estado?.pasos?.find((p) => !p.completo);
    if (primero) navigate(RUTAS[primero.destino] || "/admin/tienda");
  };

  if (!esAdmin || !estado) return null;

  const pendientes = estado.pasos.filter((p) => !p.completo);
  const listo = pendientes.length === 0;

  return (
    <>
      {!listo && (
        <section
          aria-label="Puesta en marcha de tu tienda"
          className="mb-6 rounded-2xl border border-line/60 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-ink dark:text-white leading-tight">
                Tu tienda está al {estado.porcentaje}%
              </h2>
              <p className="text-sm text-muted dark:text-slate-400 mt-0.5">
                Te faltan {pendientes.length} {pendientes.length === 1 ? "cosa" : "cosas"} para poder recibir reservas.
              </p>
            </div>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {estado.porcentaje}%
            </span>
          </div>

          <div className="mt-4 h-2 w-full rounded-full bg-paper dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
              style={{ width: `${estado.porcentaje}%` }}
            />
          </div>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {estado.pasos.map((paso) => (
              <li key={paso.clave}>
                <button
                  type="button"
                  onClick={() => navigate(RUTAS[paso.destino] || "/admin/tienda")}
                  disabled={paso.completo}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors flex items-center gap-3 ${
                    paso.completo
                      ? "border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/5 cursor-default"
                      : "border-line/60 dark:border-slate-800 hover:border-emerald-400/60 hover:bg-paper dark:hover:bg-slate-800/40"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      paso.completo
                        ? "bg-emerald-500 text-white"
                        : "border-2 border-line dark:border-slate-700"
                    }`}
                  >
                    {paso.completo && <CheckIcon className="w-3 h-3" />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-bold truncate ${paso.completo ? "text-muted dark:text-slate-500 line-through" : "text-ink dark:text-white"}`}>
                      {paso.titulo}
                    </span>
                    {!paso.completo && (
                      <span className="block text-[11px] text-muted dark:text-slate-400 truncate">{paso.detalle}</span>
                    )}
                  </span>

                  {!paso.completo && <ArrowIcon className="w-4 h-4 text-faint shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ofreciendo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-line/60 dark:border-slate-800 shadow-xl p-7">
            <h2 className="font-display text-2xl font-bold text-ink dark:text-white leading-tight">
              Dejemos tu tienda lista
            </h2>
            <p className="mt-2 text-sm text-muted dark:text-slate-400 leading-relaxed">
              Son {estado.pasos.length} pasos y toma unos minutos. Te llevo uno por uno, o lo haces a tu ritmo: la
              lista queda arriba del panel igual.
            </p>

            <ul className="mt-5 space-y-2">
              {estado.pasos.map((paso) => (
                <li key={paso.clave} className="flex items-start gap-2.5 text-sm">
                  <span className={`mt-0.5 w-4 h-4 rounded-full shrink-0 flex items-center justify-center ${paso.completo ? "bg-emerald-500 text-white" : "border-2 border-line dark:border-slate-700"}`}>
                    {paso.completo && <CheckIcon className="w-2.5 h-2.5" />}
                  </span>
                  <span className="text-ink-2 dark:text-slate-300">{paso.titulo}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={empezar}
                className="flex-1 py-3 rounded-xl font-bold text-white dark:text-abyss bg-slate-900 dark:bg-emerald-500 hover:bg-emerald-500 dark:hover:bg-emerald-400 transition-colors"
              >
                Empezar
              </button>
              <button
                type="button"
                onClick={resolverTutorial}
                className="flex-1 py-3 rounded-xl font-bold text-ink-2 dark:text-slate-300 bg-paper dark:bg-slate-800/60 hover:bg-line dark:hover:bg-slate-800 transition-colors"
              >
                Lo hago por mi cuenta
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
