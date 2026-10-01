import React, { useState } from "react";
import toast from "react-hot-toast";
import apiFetch from "../utils/api";
import { useAuth } from "../context/AuthContext";

/**
 * "Avísame si se libera una hora".
 *
 * Aparece cuando el día elegido no tiene nada libre, que es justo el momento en
 * que la persona se iba a ir. Anotarse no reserva ni compromete a nada: es
 * pedir que le avisen, y el aviso sale solo en cuanto alguien cancela.
 *
 * Para el local, esta lista es lo que convierte una cancelación de último
 * minuto en una hora vendida, y de paso le muestra qué días tiene demanda que
 * no está pudiendo atender.
 */
const CampanaIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

const CheckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export default function AvisameSiSeLibera({ barberiaId, fecha, barberoId = null, servicioId = null }) {
  const { estaLogueado, usuario } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [anotado, setAnotado] = useState(false);

  if (!barberiaId || !fecha) return null;

  const anotarse = async () => {
    setEnviando(true);
    try {
      const resp = await apiFetch("/lista-espera", {
        method: "POST",
        body: JSON.stringify({
          barberia_id: barberiaId,
          fecha,
          // Quien viene por una persona en particular solo quiere saber de los
          // huecos de esa persona.
          barbero_id: barberoId || null,
          servicio_id: servicioId || null,
        }),
      });

      if (!resp.ok) {
        const datos = await resp.json().catch(() => ({}));
        toast.error(datos.error || datos.message || "No pudimos anotarte.");
        return;
      }

      setAnotado(true);
      toast.success("Listo, te avisamos apenas se libere una hora.");
    } catch {
      toast.error("No pudimos anotarte. Revisa tu conexión.");
    } finally {
      setEnviando(false);
    }
  };

  if (anotado) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4">
        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <CheckIcon className="w-4 h-4" /> Estás en la lista de espera
        </p>
        <p className="text-xs text-muted dark:text-slate-400 mt-1.5 leading-relaxed">
          Si alguien cancela ese día te avisamos
          {usuario?.telefono ? " por WhatsApp" : " por correo"}. La hora es de quien la tome primero.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-line dark:border-slate-800 bg-paper dark:bg-slate-800/40 p-4">
      <p className="text-sm font-bold text-ink dark:text-white">¿Te avisamos si se libera una hora?</p>
      <p className="text-xs text-muted dark:text-slate-400 mt-1 leading-relaxed">
        Las cancelaciones de último minuto pasan seguido. Te anotamos para ese día y te avisamos apenas aparezca
        algo, sin compromiso.
      </p>

      {estaLogueado ? (
        <button
          type="button"
          onClick={anotarse}
          disabled={enviando}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white dark:text-abyss transition-colors hover:bg-emerald-500 dark:hover:bg-emerald-400 disabled:opacity-60"
        >
          <CampanaIcon className="w-4 h-4" />
          {enviando ? "Anotándote…" : "Avísame si se libera"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("tenri:abrir-login"))}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white dark:text-abyss transition-colors hover:bg-emerald-500 dark:hover:bg-emerald-400"
        >
          <CampanaIcon className="w-4 h-4" /> Inicia sesión para que te avisemos
        </button>
      )}
    </div>
  );
}
