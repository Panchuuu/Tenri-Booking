import React, { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import useApi from "../hooks/useApi";
import useApiMutation from "../hooks/useApiMutation";
import { parseApiErrorSync } from "../utils/parseApiError";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import ReviewModal from "../components/ReviewModal";
import BookingModal from "../components/BookingModal";
import { XIcon } from "../components/Icons";
import { urlGoogleCalendar, descargarIcs } from "../utils/calendario";

function getBadgeStyle(estado) {
  const estados = {
    pendiente:  "bg-[#FBF3DB] text-[#956400] border-[#F2E3B3] dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/20",
    confirmada: "bg-[#E1F3FE] text-[#1F6C9F] border-[#C6E6FB] dark:text-cyan-400 dark:bg-cyan-400/10 dark:border-cyan-400/20",
    finalizada: "bg-[#EDF3EC] text-[#346538] border-[#D3E5D2] dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20",
    cancelada:  "bg-[#FDEBEC] text-[#9F2F2D] border-[#F7D4D6] dark:text-rose-400 dark:bg-rose-400/10 dark:border-rose-400/20",
  };
  return estados[estado?.toLowerCase()] || "bg-[#F7F6F3] text-[#2F3437] border-[#EAEAEA] dark:text-slate-400 dark:bg-slate-800 dark:border-transparent";
}

// "2026-08-24" → "dom 24 de ago, 2026"; si el formato no es parseable, se muestra tal cual
function formatearFecha(fecha) {
  if (!fecha) return "";
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default function MisReservasPage() {
  const { usuario } = useAuth();
  const [citaACalificar, setCitaACalificar] = useState(null);
  const [citaAReagendar, setCitaAReagendar] = useState(null); // 🔄 Fase 4A
  const [confirmar, setConfirmar] = useState(null);

  const { data: citas, cargando, error, refetch } = useApi("/mis-reservas");
  const { ejecutar, cargando: cancelando, getLastError } = useApiMutation();

  const handleCancelar = async () => {
    if (!confirmar) return;
    const r = await ejecutar(`/mis-citas/${confirmar}/cancelar`, { method: "PATCH" });
    if (r) { toast.success("Cita cancelada"); refetch(); }
    else toast.error(parseApiErrorSync(getLastError()?.body, "No se pudo cancelar"));
    setConfirmar(null);
  };

  return (
    <div>
      <PageHeader titulo="Mis Reservas" subtitulo={`Historial de ${usuario?.name}`} />

      {cargando ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-[#EAEAEA] border-t-emerald-500 dark:border-slate-800 rounded-full animate-spin mb-4" />
          <p className="text-[#787774] font-medium">Cargando tu historial...</p>
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl p-12 text-center shadow-none">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-500/20">
            <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-[#111111] dark:text-white mb-2">No pudimos cargar tus reservas</h3>
          <p className="text-[#787774] dark:text-slate-400 mb-6">Revisa tu conexión e inténtalo de nuevo.</p>
          <button
            onClick={refetch}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : (citas || []).length === 0 ? (
        <div className="bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl p-12 text-center shadow-none">
          <div className="w-16 h-16 bg-[#F7F6F3] dark:bg-[#03070e] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#EAEAEA] dark:border-slate-800">
            <svg className="w-8 h-8 text-[#A8A29E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-[#111111] dark:text-white mb-2">Aún no tienes citas</h3>
          <p className="text-[#787774] dark:text-slate-400 mb-6">Explora el catálogo y reserva tu primer servicio.</p>
          <Link
            to="/"
            className="inline-block px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-lg transition-colors"
          >
            Explorar barberías
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {citas.map((cita) => {
            const puedeReagendar = cita.estado === "pendiente" || cita.estado === "confirmada";
            return (
              <div key={cita.id} className="bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl p-6 shadow-none hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-emerald-500/50 transition-all flex flex-col">
                <div className="flex justify-between items-start mb-4 gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                      {formatearFecha(cita.fecha)} • {cita.hora?.substring(0, 5)}
                    </span>
                    <h3 className="text-lg font-bold text-[#111111] dark:text-white truncate">
                      {cita.servicio?.nombre || "Servicio"}
                    </h3>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getBadgeStyle(cita.estado)}`}>
                    {cita.estado}
                  </span>
                </div>

                <div className="pt-4 border-t border-black/5 dark:border-slate-800/60 flex items-center justify-between mb-2 gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-[#F7F6F3] dark:bg-slate-800 text-[#2F3437] dark:text-slate-400 flex items-center justify-center text-[10px] font-bold border border-[#EAEAEA] dark:border-slate-700">
                      {cita.barbero?.name?.substring(0, 1).toUpperCase() || "?"}
                    </span>
                    <span className="text-sm text-[#2F3437] dark:text-slate-400 font-medium truncate">
                      {cita.barbero?.name || "Por asignar"}
                    </span>
                  </div>
                  <span className="font-bold text-[#111111] dark:text-white shrink-0">
                    ${Number(cita.servicio?.precio || 0).toLocaleString("es-CL")}
                  </span>
                </div>

                <div className="mt-auto pt-2 space-y-2">
                  {puedeReagendar && (
                    <>
                      {/* 📅 Agregar al calendario */}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <a
                          href={urlGoogleCalendar(cita) || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 text-center text-[#2F3437] bg-[#FBFBFA] hover:bg-[#F7F6F3] border border-[#EAEAEA] dark:text-slate-300 dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:border-slate-700 font-semibold text-xs rounded-lg transition-colors"
                        >
                          📅 Google Calendar
                        </a>
                        <button
                          onClick={() => descargarIcs(cita)}
                          className="px-3 py-2 text-[#2F3437] bg-[#FBFBFA] hover:bg-[#F7F6F3] border border-[#EAEAEA] dark:text-slate-300 dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:border-slate-700 font-semibold text-xs rounded-lg transition-colors"
                          title="Descargar archivo para Apple Calendar / Outlook"
                        >
                          ⬇️ Apple / Outlook
                        </button>
                      </div>

                      <button
                        onClick={() => setCitaAReagendar(cita)}
                        className="mt-2 px-4 py-2.5 w-full text-cyan-600 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 dark:text-cyan-400 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20 dark:border-cyan-500/20 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        🔄 Reagendar
                      </button>
                      <button
                        onClick={() => setConfirmar(cita.id)}
                        className="px-4 py-2.5 w-full text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:text-rose-400 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:border-rose-500/20 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <XIcon className="w-4 h-4" /> Cancelar reserva
                      </button>
                    </>
                  )}

                  {cita.estado === "finalizada" && cita.calificacion == null && (
                    <button
                      onClick={() => setCitaACalificar(cita)}
                      className="mt-2 px-4 py-2.5 w-full bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 font-bold text-sm rounded-lg hover:bg-amber-200 dark:hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2"
                    >
                      ⭐ Calificar servicio
                    </button>
                  )}

                  {cita.calificacion != null && (
                    <div className="mt-2 flex flex-col items-center justify-center gap-1 bg-[#FBFBFA] dark:bg-slate-800/50 p-2.5 rounded-lg border border-black/5 dark:border-slate-800/50">
                      <span className="text-xs font-bold text-[#787774] mb-1">Tu calificación:</span>
                      <div className="flex gap-1 text-amber-400 text-sm">
                        {[...Array(cita.calificacion)].map((_, i) => <span key={i}>⭐</span>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {citaACalificar && (
        <ReviewModal
          cita={citaACalificar}
          onClose={() => setCitaACalificar(null)}
          onReviewSuccess={refetch}
        />
      )}

      {/* 🔄 FASE 4A: modal de reagendar */}
      {citaAReagendar && (
        <BookingModal
          servicio={citaAReagendar.servicio}
          barberiaSlug={citaAReagendar.servicio?.barberia?.slug}
          citaExistente={citaAReagendar}
          onClose={() => setCitaAReagendar(null)}
          onSuccess={refetch}
        />
      )}

      <ConfirmModal
        abierto={confirmar !== null}
        cargando={cancelando}
        titulo="Cancelar reserva"
        mensaje="¿Estás seguro de que deseas cancelar esta cita? Esta acción no se puede deshacer."
        textoConfirmar="Sí, cancelar"
        textoCancelar="Mantener cita"
        variante="danger"
        onConfirmar={handleCancelar}
        onCancelar={() => setConfirmar(null)}
      />
    </div>
  );
}
