import React, { useState } from "react";
import toast from "react-hot-toast";
import useApi from "../hooks/useApi";
import useApiMutation from "../hooks/useApiMutation";
import { parseApiErrorSync } from "../utils/parseApiError";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";

function getBadgeStyle(estado) {
  const estados = {
    pendiente:  "text-[#956400] bg-[#FBF3DB] dark:text-amber-400 dark:bg-amber-400/10 border-[#F2E3B3] dark:border-amber-400/20",
    confirmada: "text-[#1F6C9F] bg-[#E1F3FE] dark:text-cyan-400 dark:bg-cyan-400/10 border-[#C6E6FB] dark:border-cyan-400/20",
    finalizada: "text-[#346538] bg-[#EDF3EC] dark:text-emerald-400 dark:bg-emerald-400/10 border-[#D3E5D2] dark:border-emerald-400/20",
    cancelada:  "text-[#9F2F2D] bg-[#FDEBEC] dark:text-rose-400 dark:bg-rose-400/10 border-[#F7D4D6] dark:border-rose-400/20",
  };
  return estados[estado?.toLowerCase()] || "text-muted bg-paper dark:bg-slate-800 border-transparent";
}

export default function BarberoPage() {
  const { usuario } = useAuth();
  const [pagina, setPagina] = useState(1);

  // 🔧 FIX #14: confirmar antes de cancelar
  const [confirmarCancelar, setConfirmarCancelar] = useState(null);

  const { data, cargando, error, refetch } = useApi(`/barbero/citas?page=${pagina}`, { deps: [pagina] });
  const { ejecutar, cargando: mutando, getLastError } = useApiMutation();

  const citas = data?.data || [];
  const paginacion = { actual: data?.current_page || 1, total: data?.last_page || 1 };

  const hoy = new Date().toLocaleDateString("sv-SE");
  const hoyLegible = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const citasHoy   = citas.filter((c) => c.fecha === hoy && c.estado !== "cancelada" && c.estado !== "finalizada");
  const otrasCitas = citas.filter((c) => c.fecha !== hoy || c.estado === "cancelada" || c.estado === "finalizada");

  const handleFinalizar = async (id) => {
    const r = await ejecutar(`/citas/${id}/estado`, { method: "PATCH", body: { estado: "finalizada" } });
    if (r) { toast.success("Cita finalizada"); refetch(); }
    else toast.error(parseApiErrorSync(getLastError()?.body, "No se pudo finalizar"));
  };

  const handleConfirmarCancelar = async () => {
    if (!confirmarCancelar) return;
    const r = await ejecutar(`/citas/${confirmarCancelar.id}/estado`, {
      method: "PATCH",
      body: { estado: "cancelada" },
    });
    if (r) {
      toast.success("Cita cancelada. Se notificó al cliente.");
      refetch();
    } else {
      toast.error(parseApiErrorSync(getLastError()?.body, "No se pudo cancelar. Verifica que tengas permiso."));
    }
    setConfirmarCancelar(null);
  };

  return (
    <div>
      <PageHeader
        tag="Agenda"
        titulo="Mi agenda"
        subtitulo={`Hola ${usuario?.name}, organiza tu jornada.`}
      />

      {cargando ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-line border-t-emerald-500 dark:border-slate-800 rounded-full animate-spin mb-4" />
          <p className="text-muted font-medium">Sincronizando agenda...</p>
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl p-12 text-center shadow-none">
          <h3 className="text-xl font-bold text-ink dark:text-white mb-2">No pudimos cargar tu agenda</h3>
          <p className="text-muted dark:text-slate-400 mb-6">Revisa tu conexión e inténtalo de nuevo.</p>
          <button
            onClick={refetch}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="space-y-10">

          {/* ============ AGENDA DE HOY ============ */}
          <section>
            <h3 className="tag-pill text-emerald-600 dark:text-emerald-400 mb-6">
              Agenda para hoy · {hoyLegible}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {citasHoy.length === 0 ? (
                <div className="col-span-full py-10 text-center border-2 border-dashed border-line dark:border-slate-800 rounded-xl text-muted">
                  No hay citas programadas para hoy.
                </div>
              ) : (
                citasHoy.map((c) => (
                  <div key={c.id} className="bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl p-5 sm:p-6 shadow-none relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${c.estado === "confirmada" ? "bg-[#1F6C9F]" : "bg-[#956400]"}`} />
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-display text-2xl font-bold text-ink dark:text-white tabular">
                        {c.hora?.substring(0, 5)}
                      </span>
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${getBadgeStyle(c.estado)}`}>
                        {c.estado}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-ink dark:text-slate-200 mb-1 truncate">{c.cliente?.name}</h4>
                    <p className="text-xs text-muted mb-5 truncate">
                      {c.servicio?.nombre} • {c.servicio?.duracion || c.servicio?.duracion_minutos} min
                    </p>

                    <div className="flex gap-2 pt-4 border-t border-black/5 dark:border-slate-800/50">
                      <button
                        onClick={() => handleFinalizar(c.id)}
                        disabled={mutando}
                        className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white dark:bg-emerald-500/10 dark:hover:bg-emerald-500 dark:text-emerald-500 dark:hover:text-abyss disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold rounded-lg transition-all border border-emerald-200 dark:border-emerald-500/20"
                      >
                        Finalizar
                      </button>
                      <button
                        onClick={() => setConfirmarCancelar(c)}
                        disabled={mutando}
                        title="Cancelar cita (avisa al cliente)"
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white dark:bg-rose-500/10 dark:hover:bg-rose-500 dark:text-rose-500 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all border border-rose-200 dark:border-rose-500/20"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ============ RESTO DE LA AGENDA ============ */}
          <section>
            <h3 className="tag-pill text-muted mb-6">Resto de la agenda</h3>

            <div className="bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl overflow-hidden shadow-none">

              {/* DESKTOP */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-paper-2 dark:bg-night-2 border-b border-line dark:border-slate-800/60 text-muted font-semibold uppercase text-[10px] tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Fecha</th>
                      <th className="px-6 py-4">Hora</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Servicio</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                      <th className="px-6 py-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-slate-800/40">
                    {otrasCitas.map((c) => (
                      <tr key={c.id} className="hover:bg-paper dark:hover:bg-slate-800/20">
                        <td className="px-6 py-4 text-muted font-medium">{c.fecha}</td>
                        <td className="px-6 py-4 text-ink dark:text-slate-200 font-bold tabular">{c.hora?.substring(0, 5)}</td>
                        <td className="px-6 py-4 text-muted">{c.cliente?.name}</td>
                        <td className="px-6 py-4 text-muted text-xs">{c.servicio?.nombre}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${getBadgeStyle(c.estado)}`}>
                            {c.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {/* 🔧 FIX #14: barbero puede cancelar futuras confirmadas */}
                          {c.estado === "confirmada" && c.fecha >= hoy && (
                            <button
                              onClick={() => setConfirmarCancelar(c)}
                              className="text-rose-600 dark:text-rose-500 font-bold text-xs uppercase tracking-wider hover:underline"
                            >
                              Cancelar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE */}
              <div className="lg:hidden divide-y divide-black/5 dark:divide-slate-800/40">
                {otrasCitas.length === 0 ? (
                  <div className="p-8 text-center text-muted text-sm">
                    No hay otras citas en esta página.
                  </div>
                ) : (
                  otrasCitas.map((c) => (
                    <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-bold text-ink dark:text-white tabular">{c.hora?.substring(0,5)}</span>
                          <span className="text-xs text-muted">·</span>
                          <span className="text-xs text-muted">{c.fecha}</span>
                        </div>
                        <p className="text-sm font-medium text-ink-2 dark:text-slate-300 truncate">
                          {c.cliente?.name}
                        </p>
                        <p className="text-xs text-muted truncate">{c.servicio?.nombre}</p>
                        {/* FIX #14: botón cancelar también en mobile */}
                        {c.estado === "confirmada" && c.fecha >= hoy && (
                          <button
                            onClick={() => setConfirmarCancelar(c)}
                            className="mt-2 text-rose-600 dark:text-rose-500 font-bold text-[10px] uppercase tracking-wider"
                          >
                            Cancelar cita
                          </button>
                        )}
                      </div>
                      <span className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase border ${getBadgeStyle(c.estado)}`}>
                        {c.estado}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Paginación */}
              <div className="flex items-center justify-between bg-paper-2 dark:bg-night-2 px-4 sm:px-6 py-4 border-t border-line dark:border-slate-800/60">
                <p className="text-xs text-muted font-medium">
                  Página <span className="text-ink dark:text-white font-bold">{paginacion.actual}</span> de {paginacion.total}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={paginacion.actual === 1}
                    onClick={() => setPagina(paginacion.actual - 1)}
                    className="px-3 sm:px-4 py-2 bg-line dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-colors"
                  >
                    ← Anterior
                  </button>
                  <button
                    disabled={paginacion.actual === paginacion.total}
                    onClick={() => setPagina(paginacion.actual + 1)}
                    className="px-3 sm:px-4 py-2 bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white dark:text-abyss disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-colors"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* MODAL de confirmación de cancelación */}
      <ConfirmModal
        abierto={confirmarCancelar !== null}
        cargando={mutando}
        titulo="Cancelar cita"
        mensaje={
          confirmarCancelar
            ? `¿Seguro que quieres cancelar la cita de ${confirmarCancelar.cliente?.name} (${confirmarCancelar.fecha} ${confirmarCancelar.hora?.substring(0,5)})? Se le enviará un email al cliente avisándole.`
            : ""
        }
        textoConfirmar="Sí, cancelar"
        variante="danger"
        onConfirmar={handleConfirmarCancelar}
        onCancelar={() => setConfirmarCancelar(null)}
      />
    </div>
  );
}
