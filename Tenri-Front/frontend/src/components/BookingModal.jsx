import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import apiFetch from "../utils/api";
import CalendarPicker from "./CalendarPicker";
import BarberoCard from "./BarberoCard";
import { XIcon } from "./Icons";

// ============================================================
// 📅 BOOKING MODAL — Fase 4A
// ============================================================
// Cambios:
//  - Usa el nuevo BarberoCard con avatar + rating + especialidad
//  - Soporta modo "reagendar" (recibe citaExistente)
//  - Muestra mensaje si la fecha está bloqueada (vacaciones del barbero)
// ============================================================

export default function BookingModal({
  servicio,
  barberiaSlug,
  citaExistente = null, // si está presente, estamos reagendando
  onClose,
  onSuccess,            // callback opcional al completar
}) {
  const esReagendar = !!citaExistente;

  const [fecha, setFecha] = useState(citaExistente?.fecha || "");
  const [hora, setHora]   = useState(citaExistente?.hora?.substring(0, 5) || "");
  const [barberoId, setBarberoId] = useState(citaExistente?.barbero_id || "");

  const [barberos, setBarberos]           = useState([]);
  const [horariosBase, setHorariosBase]   = useState([]);
  const [horasOcupadas, setHorasOcupadas] = useState([]);
  const [horasPasadas, setHorasPasadas]   = useState([]);
  const [diaBloqueado, setDiaBloqueado]   = useState(null); // { motivo, descripcion } si está bloqueado

  const [cargandoBarberos, setCargandoBarberos] = useState(!esReagendar);
  const [cargandoHoras, setCargandoHoras]       = useState(false);
  const [cargandoReserva, setCargandoReserva]   = useState(false);
  const [cerrando, setCerrando]                 = useState(false);

  // Cierre con animación de salida: pinta fade/scale-out y desmonta
  // al terminar. `forzar` salta el candado de cargandoReserva (se usa
  // en el cierre post-éxito, donde la reserva sigue "en vuelo").
  const solicitarCierre = (forzar = false) => {
    if (cerrando || (cargandoReserva && !forzar)) return;
    setCerrando(true);
    setTimeout(onClose, 200);
  };

  const hoyLocal = new Date().toLocaleDateString("sv-SE");

  const duracionServicio =
    servicio?.duracion ?? servicio?.duracion_minutos ?? citaExistente?.servicio?.duracion_minutos ?? 30;

  // 🎯 UX: scroll instantáneo al top cuando el modal se abre.
  // Sin overflow lock — el modal usa fixed inset-0, cubre todo el viewport.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Cerrar con Escape — salvo con una reserva en vuelo, para no
  // descartar el modal (y su feedback) por un cierre accidental.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !cargandoReserva && !cerrando) {
        setCerrando(true);
        setTimeout(onClose, 200);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, cargandoReserva, cerrando]);

  // Cargar barberos al abrir (solo si no es reagendamiento)
  useEffect(() => {
    if (esReagendar) return;
    let activo = true;
    (async () => {
      try {
        const r = await apiFetch(`/barberos?barberia=${barberiaSlug}`);
        if (r.ok && activo) setBarberos(await r.json());
      } catch (e) { console.error(e); }
      finally { if (activo) setCargandoBarberos(false); }
    })();
    return () => { activo = false; };
  }, [barberiaSlug, esReagendar]);

  // Cargar disponibilidad cuando hay barbero+fecha
  useEffect(() => {
    if (!barberoId || !fecha) {
      setHorasOcupadas([]); setHorasPasadas([]); setHorariosBase([]); setDiaBloqueado(null);
      return;
    }
    let activo = true;
    setCargandoHoras(true);
    if (!esReagendar) setHora(""); // en reagendar mantenemos la hora hasta que cambien

    (async () => {
      try {
        const r = await apiFetch(`/barberos/${barberoId}/disponibilidad?fecha=${fecha}`);
        if (!r.ok || !activo) return;

        const datos = await r.json();

        if (datos.bloqueado) {
          setDiaBloqueado({ motivo: datos.motivo, descripcion: datos.descripcion });
          setHorariosBase([]);
          setHorasOcupadas([]); setHorasPasadas([]);
          return;
        }

        setDiaBloqueado(null);
        setHorasOcupadas(datos.ocupadas || []);
        setHorasPasadas(datos.pasadas || []);

        const [hi, mi] = datos.hora_inicio.split(":").map(Number);
        const [hf, mf] = datos.hora_fin.split(":").map(Number);
        let actual = hi * 60 + mi;
        const fin  = hf * 60 + mf;
        const malla = [];

        // El servicio debe caber COMPLETO antes del cierre — el backend
        // rechaza los slots que desbordan, así que no los ofrecemos.
        while (actual + duracionServicio <= fin) {
          if (actual >= 840 && actual < 900) { actual += 30; continue; }
          const h = Math.floor(actual / 60).toString().padStart(2, "0");
          const m = (actual % 60).toString().padStart(2, "0");
          malla.push(`${h}:${m}`);
          actual += 30;
        }
        if (activo) {
          setHorariosBase(malla);
          // En reagendar la hora prefijada se conserva, pero si dejó de ser
          // seleccionable — fuera de la malla, ocupada o ya pasada — la
          // limpiamos: si no, quedaba "seleccionada" pero pintada como
          // Ocupada/Pasó, y se podía enviar (422/409 del backend).
          const ocupadas = datos.ocupadas || [];
          const pasadas  = datos.pasadas  || [];
          setHora((h) =>
            h && (!malla.includes(h) || ocupadas.includes(h) || pasadas.includes(h)) ? "" : h
          );
        }
      } catch (e) { console.error(e); }
      finally { if (activo) setCargandoHoras(false); }
    })();
    return () => { activo = false; };
  }, [barberoId, fecha, esReagendar, duracionServicio]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!localStorage.getItem("token")) return toast.error("Inicia sesión para agendar.");
    if (!fecha || !hora || !barberoId)   return toast.error("Completa todos los campos.");

    setCargandoReserva(true);
    try {
      // 🔄 Reagendar usa endpoint distinto
      if (esReagendar) {
        const r = await apiFetch(`/citas/${citaExistente.id}/reagendar`, {
          method: "PATCH",
          body: JSON.stringify({ fecha, hora }),
        });
        if (r.ok) {
          toast.success("¡Cita reagendada con éxito!");
          onSuccess?.();
          solicitarCierre(true);
        } else {
          const err = await r.json();
          toast.error(err.error || err.message || "No se pudo reagendar.");
        }
      } else {
        const r = await apiFetch("/citas", {
          method: "POST",
          body: JSON.stringify({ servicio_id: servicio.id, barbero_id: barberoId, fecha, hora }),
        });
        if (r.ok) {
          toast.success("¡Cita agendada con éxito!");
          onSuccess?.();
          solicitarCierre(true);
        } else {
          const err = await r.json();
          toast.error(err.message || "Error al agendar.");
        }
      }
    } catch {
      toast.error("Error de conexión.");
    } finally {
      setCargandoReserva(false);
    }
  };

  const precioFmt = servicio?.precio
    ? new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(servicio.precio)
    : "";

  const pasoActivo = !barberoId ? 1 : !fecha ? 2 : !hora ? 3 : 4;

  const barberoSeleccionado = barberos.find((b) => b.id === barberoId);

  const StepHeader = ({ num, label, activo, completo }) => (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
        completo
          ? "bg-emerald-500 text-white dark:text-abyss"
          : activo
            ? "bg-slate-900 dark:bg-white text-white dark:text-abyss ring-2 ring-emerald-500/30 ring-offset-2 ring-offset-white dark:ring-offset-card"
            : "bg-paper dark:bg-slate-800 text-faint"
      }`}>
        {completo ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : num}
      </div>
      <h3 className={`text-sm font-semibold uppercase tracking-wider transition-colors ${
        activo || completo ? "text-ink dark:text-white" : "text-faint"
      }`}>
        {label}
      </h3>
    </div>
  );

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/40 dark:bg-abyss/80 backdrop-blur-md p-0 sm:p-4 sm:pt-8 pt-16 ${cerrando ? "animate-fade-out" : "animate-fade-in"}`}
      onClick={() => solicitarCierre()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={esReagendar ? "Reagendar cita" : `Reservar ${servicio?.nombre || "servicio"}`}
        className={`bg-white dark:bg-card border-t sm:border border-line dark:border-slate-800/60 sm:rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] ${cerrando ? "animate-scale-out" : "animate-scale-in"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="px-6 sm:px-8 py-6 border-b border-line dark:border-slate-800/60 flex justify-between items-start gap-4 bg-gradient-to-br from-slate-50 to-white dark:from-night-2 dark:to-card">
          <div className="flex gap-4 sm:gap-5 items-center min-w-0">
            {servicio?.imagen_url ? (
              <img src={servicio.imagen_url} alt={servicio.nombre}
                   className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-line dark:border-slate-700/50 shadow-none shrink-0" />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-500/10 dark:to-emerald-500/5 flex items-center justify-center border border-emerald-100 dark:border-emerald-500/20 shrink-0">
                <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                        d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                </svg>
              </div>
            )}
            <div className="min-w-0">
              <span className="text-emerald-600 dark:text-emerald-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-1 block">
                {esReagendar ? "Reagendar cita" : "Reservar servicio"}
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-ink dark:text-white leading-tight truncate">
                {servicio?.nombre}
              </h2>
              {!esReagendar && (
                <div className="flex items-center gap-3 mt-2 text-sm font-medium">
                  <span className="text-muted dark:text-slate-400 tabular">
                    {duracionServicio} min
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular">{precioFmt}</span>
                </div>
              )}
            </div>
          </div>
          <button onClick={() => solicitarCierre()} disabled={cargandoReserva} aria-label="Cerrar"
                  className="p-2 text-faint hover:text-ink-2 hover:bg-paper dark:hover:text-rose-400 dark:hover:bg-slate-800/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors shrink-0">
            <XIcon />
          </button>
        </div>

        {/* CONTENIDO */}
        <div className="overflow-y-auto custom-scrollbar flex-1 p-6 sm:p-8">
          <form id="form-reserva" onSubmit={handleSubmit} className="space-y-8">

            {/* PASO 1 — BARBERO (oculto en reagendar) */}
            {!esReagendar && (
              <section>
                <StepHeader num={1} label="Elige tu barbero" activo={pasoActivo === 1} completo={!!barberoId} />
                {cargandoBarberos ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[1,2,3,4].map((i) => <div key={i} className="h-20 rounded-xl bg-paper dark:bg-slate-800/50 shimmer" />)}
                  </div>
                ) : barberos.length === 0 ? (
                  <p className="text-sm text-muted py-4">Esta barbería aún no tiene barberos disponibles.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {barberos.map((b) => (
                      <BarberoCard
                        key={b.id}
                        barbero={b}
                        selected={barberoId === b.id}
                        onClick={() => setBarberoId(b.id)}
                        compact
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* PASO 2 — FECHA */}
            {/* 🎯 Bug fix: reveal progresivo — Paso 2 aparece solo cuando hay barbero */}
            {(barberoId || esReagendar) && (
              <section className="animate-fade-in-up">
                <StepHeader num={esReagendar ? 1 : 2} label="Selecciona la fecha" activo={pasoActivo === 2 || (esReagendar && pasoActivo <= 2)} completo={!!fecha} />
                <CalendarPicker valor={fecha} onChange={setFecha} minFecha={hoyLocal} />
              </section>
            )}

            {/* PASO 3 — HORA */}
            {/* 🎯 Bug fix: reveal progresivo — Paso 3 aparece solo cuando hay barbero Y fecha */}
            {((barberoId || esReagendar) && fecha) && (
              <section className="animate-fade-in-up">
                <StepHeader num={esReagendar ? 2 : 3} label="Selecciona la hora" activo={pasoActivo === 3} completo={!!hora} />

                {diaBloqueado ? (
                  // 🚫 Día bloqueado por vacaciones del barbero
                  <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-6 text-center">
                    <div className="text-3xl mb-2">🌴</div>
                    <h4 className="font-display text-base font-bold text-amber-700 dark:text-amber-400 mb-1">
                      Barbero no disponible
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-400/80 capitalize">
                      Motivo: {diaBloqueado.motivo?.replace('_', ' ')}
                      {diaBloqueado.descripcion && ` · ${diaBloqueado.descripcion}`}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-3">
                      Selecciona otra fecha
                    </p>
                  </div>
                ) : cargandoHoras ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {[...Array(8)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-paper dark:bg-slate-800/50 shimmer" />)}
                  </div>
                ) : horariosBase.length === 0 ? (
                  <p className="text-sm text-muted py-4">No hay horarios disponibles este día.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 animate-fade-in">
                    {horariosBase.map((h) => {
                      const estaOcupado = horasOcupadas.includes(h);
                      const yaPaso      = horasPasadas.includes(h);
                      const bloqueado   = estaOcupado || yaPaso;
                      const selected    = hora === h;
                      return (
                        <button
                          key={h}
                          type="button"
                          disabled={bloqueado}
                          onClick={() => !bloqueado && setHora(h)}
                          className={`py-3 rounded-lg text-sm font-medium tabular transition-all ease-[var(--ease-spring)] duration-300 relative ${
                            bloqueado
                              ? "bg-paper-2 dark:bg-slate-900/40 text-slate-300 dark:text-slate-700 cursor-not-allowed"
                              : selected
                                ? "bg-emerald-500 text-white dark:text-abyss shadow-[0_2px_8px_rgba(0,0,0,0.04)] shadow-emerald-500/30 scale-[1.04] font-bold"
                                : "bg-white dark:bg-abyss border border-line dark:border-slate-700/50 text-ink-2 dark:text-slate-300 hover:border-emerald-500/50 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 active:scale-95"
                          }`}
                        >
                          <span className={bloqueado ? "line-through decoration-rose-400/50" : ""}>{h}</span>
                          {bloqueado && (
                            <span className="absolute bottom-0.5 left-0 right-0 text-[8px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400/80">
                              {estaOcupado ? "Ocupada" : "Pasó"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </form>
        </div>

        {/* FOOTER */}
        {fecha && hora && (
          <p className="px-6 sm:px-8 py-2.5 border-t border-line dark:border-slate-800/60 bg-emerald-50/60 dark:bg-emerald-500/5 text-sm text-emerald-900 dark:text-emerald-100/80 text-center animate-fade-in">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 capitalize">
              {new Date(`${fecha}T12:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
            </span>
            {" a las "}
            <span className="font-semibold tabular">{hora}</span>
            {!esReagendar && barberoSeleccionado?.name && (
              <> con <span className="font-semibold">{barberoSeleccionado.name}</span></>
            )}
          </p>
        )}
        <div className="px-6 sm:px-8 py-4 border-t border-line dark:border-slate-800/60 bg-paper-2/50 dark:bg-night-2 flex gap-3">
          <button type="button" onClick={() => solicitarCierre()} disabled={cargandoReserva}
                  className="px-5 py-3 rounded-xl font-semibold text-ink-2 hover:text-ink hover:bg-paper dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Cancelar
          </button>
          <button form="form-reserva" type="submit" disabled={cargandoReserva || !hora}
                  className={`flex-1 py-3 rounded-xl font-bold text-white dark:text-abyss transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center gap-2 ${
                    cargandoReserva || !hora
                      ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed shadow-none"
                      : "bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:shadow-emerald-500/25 hover:-translate-y-0.5"
                  }`}>
            {cargandoReserva ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                {esReagendar ? "Confirmar reagendamiento" : "Confirmar reserva"}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
