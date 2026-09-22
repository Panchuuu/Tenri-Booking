import React, { useEffect, useState } from "react";
import apiFetch from "../utils/api";

/**
 * Quiénes están esperando una hora en este local.
 *
 * Dos cosas distintas en una sola lista. Cuando se cae una cita, acá está a
 * quién llamar, aunque el aviso automático ya haya salido. Y cuando no se cae
 * ninguna, estos nombres son demanda que el local no está pudiendo atender:
 * los días que se repiten son los días en que conviene abrir más cupo.
 *
 * No se muestra si no hay nadie esperando. Una tarjeta vacía todos los días
 * enseña a ignorar la tarjeta.
 */

const formatearFecha = (fecha) =>
  new Date(`${String(fecha).substring(0, 10)}T12:00:00`).toLocaleDateString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export default function ListaDeEspera() {
  const [esperas, setEsperas] = useState([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const resp = await apiFetch("/mi-barberia/lista-espera");
        if (resp.ok && vivo) setEsperas(await resp.json());
      } catch {
        // Es información de apoyo: si no llega, la agenda sigue funcionando.
      } finally {
        if (vivo) setCargado(true);
      }
    })();

    return () => { vivo = false; };
  }, []);

  if (!cargado || esperas.length === 0) return null;

  // Los días que más se repiten son los que el local debería mirar.
  const porDia = esperas.reduce((acc, e) => {
    const dia = String(e.fecha).substring(0, 10);
    acc[dia] = (acc[dia] || 0) + 1;
    return acc;
  }, {});
  const diaMasPedido = Object.entries(porDia).sort((a, b) => b[1] - a[1])[0];

  return (
    <section className="rounded-xl border border-line dark:border-slate-800/60 bg-white dark:bg-card p-5 mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h3 className="text-base font-bold text-ink dark:text-white">
          Esperando una hora <span className="text-muted font-normal">({esperas.length})</span>
        </h3>
        {diaMasPedido && diaMasPedido[1] > 1 && (
          <p className="text-xs text-muted dark:text-slate-400">
            El {formatearFecha(diaMasPedido[0])} es el más pedido, con {diaMasPedido[1]} personas.
          </p>
        )}
      </div>

      <ul className="divide-y divide-line dark:divide-slate-800/60">
        {esperas.map((espera) => (
          <li key={espera.id} className="py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-sm font-bold text-ink dark:text-white min-w-0 truncate">
              {espera.cliente?.name || "Cliente"}
            </span>

            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular capitalize">
              {formatearFecha(espera.fecha)}
            </span>

            {espera.barbero && (
              <span className="text-xs text-muted dark:text-slate-400">con {espera.barbero.name}</span>
            )}

            {espera.servicio && (
              <span className="text-xs text-muted dark:text-slate-400">{espera.servicio.nombre}</span>
            )}

            <span className="ml-auto text-xs text-faint dark:text-slate-500">
              {espera.cliente?.telefono || espera.cliente?.email}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-faint dark:text-slate-500 mt-4 leading-relaxed">
        Cuando se cancela una cita les avisamos solos a los primeros de la fila. Esta lista es para cuando quieras
        llamar tú.
      </p>
    </section>
  );
}
