import React, { useState, useMemo } from "react";
import toast from "react-hot-toast";
import useApi from "../../hooks/useApi";
import useApiMutation from "../../hooks/useApiMutation";
import { parseApiErrorSync } from "../../utils/parseApiError";
import PageHeader from "../../components/PageHeader";
import { SearchIcon, CalendarIcon } from "../../components/Icons";

// ============================================================
// 📄 ADMIN / AGENDA — Fase 4A con filtros + búsqueda
// ============================================================

function getBadgeStyle(estado) {
  const estados = {
    pendiente:  "text-[#956400] bg-[#FBF3DB] dark:text-amber-400 dark:bg-amber-400/10",
    confirmada: "text-[#1F6C9F] bg-[#E1F3FE] dark:text-cyan-400 dark:bg-cyan-400/10",
    finalizada: "text-[#346538] bg-[#EDF3EC] dark:text-emerald-400 dark:bg-emerald-400/10",
    cancelada:  "text-[#9F2F2D] bg-[#FDEBEC] dark:text-rose-400 dark:bg-rose-400/10",
  };
  return estados[estado?.toLowerCase()] || "text-muted bg-paper dark:bg-slate-800";
}

function StatCard({ titulo, valor, children, delay = 0 }) {
  return (
    <div
      className="animate-fade-in-up bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl p-5 sm:p-6 shadow-none"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="flex items-center gap-2 text-muted text-[10px] font-bold uppercase tracking-wider mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {titulo}
      </p>
      {valor !== undefined ? (
        <h3 className="font-mono text-2xl sm:text-3xl font-semibold text-ink dark:text-white tabular">{valor}</h3>
      ) : children}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl p-5 sm:p-6">
      <div className="h-3 w-24 rounded bg-paper dark:bg-slate-800/50 shimmer mb-3" />
      <div className="h-8 w-28 rounded-lg bg-paper dark:bg-slate-800/50 shimmer" />
    </div>
  );
}

function FilaCitaSkeleton() {
  return (
    <div className="px-6 py-4 flex items-center gap-4">
      <div className="h-4 w-28 rounded bg-paper dark:bg-slate-800/50 shimmer shrink-0" />
      <div className="h-4 flex-1 max-w-48 rounded bg-paper dark:bg-slate-800/50 shimmer" />
      <div className="h-6 w-20 rounded-full bg-paper dark:bg-slate-800/50 shimmer hidden sm:block" />
    </div>
  );
}

// Chips de acción — mismo lenguaje que los botones de UsuariosTab
const CHIP_ACCION =
  "text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed";

function AccionesCita({ cita, onEstado, disabled = false }) {
  return (
    <div className="flex gap-2 flex-wrap justify-end">
      {cita.estado === "pendiente" && (
        <button onClick={() => onEstado(cita.id, "confirmada")}
                disabled={disabled}
                className={`${CHIP_ACCION} bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/20`}>
          Confirmar
        </button>
      )}
      {cita.estado === "confirmada" && (
        <button onClick={() => onEstado(cita.id, "finalizada")}
                disabled={disabled}
                className={`${CHIP_ACCION} bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-500/20`}>
          Finalizar
        </button>
      )}
      <button onClick={() => onEstado(cita.id, "cancelada")}
              disabled={disabled}
              className={`${CHIP_ACCION} bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/20`}>
        Cancelar
      </button>
    </div>
  );
}

// 📅 Selector de periodo (Hoy / Semana / Mes)
function PeriodoSelector({ valor, onChange }) {
  const opciones = [
    { id: "hoy",    label: "Hoy" },
    { id: "semana", label: "Esta semana" },
    { id: "mes",    label: "Este mes" },
  ];
  return (
    <div className="inline-flex bg-paper dark:bg-slate-800/50 rounded-lg p-1">
      {opciones.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 sm:px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all duration-300 ease-[var(--ease-spring)] active:scale-[0.96] ${
            valor === o.id
              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
              : "text-muted hover:text-ink-2 dark:hover:text-slate-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function AgendaPage() {
  const [pagina, setPagina] = useState(1);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  // 🔍 Filtros
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [filtroBarbero, setFiltroBarbero] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // 📊 Periodo de stats
  const [periodoStats, setPeriodoStats] = useState("hoy");

  // Construir query string para citas con filtros
  const queryCitas = useMemo(() => {
    const params = new URLSearchParams({ page: pagina });
    if (filtroDesde)   params.append("desde", filtroDesde);
    if (filtroHasta)   params.append("hasta", filtroHasta);
    if (filtroBarbero) params.append("barbero_id", filtroBarbero);
    if (filtroEstado)  params.append("estado", filtroEstado);
    if (busqueda)      params.append("q", busqueda);
    return params.toString();
  }, [pagina, filtroDesde, filtroHasta, filtroBarbero, filtroEstado, busqueda]);

  const { data: citasData, cargando: cargandoCitas, refetch: refetchCitas } = useApi(
    `/citas?${queryCitas}`,
    { deps: [queryCitas] }
  );

  // 📊 Stats por periodo
  const { data: finanzas } = useApi(
    `/finanzas/resumen?periodo=${periodoStats}`,
    { deps: [periodoStats] }
  );

  // Lista de barberos para el filtro
  const { data: barberos } = useApi("/mi-equipo");

  const { ejecutar: cambiarEstado, cargando: cambiandoEstado, getLastError } = useApiMutation();

  const citas      = citasData?.data || [];
  const paginacion = { actual: citasData?.current_page || 1, total: citasData?.last_page || 1 };
  const operativas = citas.filter((c) => c.estado === "pendiente" || c.estado === "confirmada");
  const historial  = citas.filter((c) => c.estado === "finalizada" || c.estado === "cancelada");

  const handleEstado = async (id, nuevoEstado) => {
    if (cambiandoEstado) return;
    const r = await cambiarEstado(`/citas/${id}/estado`, { method: "PATCH", body: { estado: nuevoEstado } });
    if (r) { toast.success(`Cita ${nuevoEstado}`); refetchCitas(); }
    else toast.error(parseApiErrorSync(getLastError()?.body, "No se pudo actualizar"));
  };

  const limpiarFiltros = () => {
    setFiltroDesde(""); setFiltroHasta(""); setFiltroBarbero(""); setFiltroEstado(""); setBusqueda("");
    setPagina(1);
  };

  const filtrosActivosCount = [filtroDesde, filtroHasta, filtroBarbero, filtroEstado, busqueda].filter(Boolean).length;
  const hayFiltrosActivos = filtrosActivosCount > 0;

  return (
    <div>
      <PageHeader tag="Operaciones" titulo="Panel principal"
                  subtitulo="Resumen + citas activas con filtros y búsqueda" />

      {/* ===== STATS POR PERIODO ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="font-display text-xl font-bold text-ink dark:text-white">
          Resumen financiero
        </h2>
        <PeriodoSelector valor={periodoStats} onChange={setPeriodoStats} />
      </div>

      {!finanzas ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <StatCard titulo={`Ingresos · ${finanzas.periodo}`}
                    valor={`$${(finanzas.total_ingresos || 0).toLocaleString("es-CL")}`} />
          <StatCard titulo="Cortes finalizados" valor={finanzas.cantidad_cortes || 0} delay={80} />
          <StatCard titulo="Por barbero" delay={160}>
            <div className="max-h-24 overflow-y-auto custom-scrollbar mt-1">
              {Object.entries(finanzas.desglose_barberos || {}).length === 0 ? (
                <p className="text-xs text-faint italic">Sin movimientos en este periodo</p>
              ) : (
                Object.entries(finanzas.desglose_barberos || {}).map(([n, t]) => (
                  <div key={n} className="flex justify-between text-xs mb-1.5">
                    <span className="text-ink-2 dark:text-slate-300 truncate mr-2">{n}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular shrink-0">
                      ${t.toLocaleString("es-CL")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </StatCard>
        </div>
      )}

      {/* ===== FILTROS ===== */}
      <div className="bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-none mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-ink dark:text-white">
            Filtros
            {hayFiltrosActivos && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold font-mono tabular animate-scale-in">
                {filtrosActivosCount}
              </span>
            )}
          </h3>
          {hayFiltrosActivos && (
            <button onClick={limpiarFiltros}
                    className="text-xs font-bold text-rose-500 hover:underline uppercase tracking-wider">
              Limpiar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Búsqueda por nombre */}
          <div className="lg:col-span-2 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
              className="w-full pl-10 pr-3 py-2.5 bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800 rounded-lg text-sm text-ink dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          {/* Desde */}
          <input
            type="date"
            value={filtroDesde}
            onChange={(e) => { setFiltroDesde(e.target.value); setPagina(1); }}
            className="px-3 py-2.5 bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800 rounded-lg text-sm text-ink dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all dark:[color-scheme:dark]"
          />

          {/* Hasta */}
          <input
            type="date"
            value={filtroHasta}
            onChange={(e) => { setFiltroHasta(e.target.value); setPagina(1); }}
            className="px-3 py-2.5 bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800 rounded-lg text-sm text-ink dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all dark:[color-scheme:dark]"
          />

          {/* Barbero */}
          <select
            value={filtroBarbero}
            onChange={(e) => { setFiltroBarbero(e.target.value); setPagina(1); }}
            className="px-3 py-2.5 bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800 rounded-lg text-sm text-ink dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          >
            <option value="">Todos los barberos</option>
            {(barberos || []).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Estado */}
          <select
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1); }}
            className="lg:col-span-2 px-3 py-2.5 bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800 rounded-lg text-sm text-ink dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmada">Confirmada</option>
            <option value="finalizada">Finalizada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>

      {/* ===== CITAS ACTIVAS ===== */}
      <div className="bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl overflow-hidden shadow-none mb-8">
        <div className="px-6 py-4 border-b border-line dark:border-slate-800/60">
          <h2 className="font-display text-lg font-bold text-ink dark:text-white">
            {hayFiltrosActivos ? "Resultados filtrados" : "Citas activas"}
          </h2>
          <p className="text-xs text-muted">
            {hayFiltrosActivos ? `${operativas.length} cita(s) activas + ${historial.length} en historial` : "Pendientes y confirmadas"}
          </p>
        </div>

        {cargandoCitas ? (
          <div className="divide-y divide-black/5 dark:divide-slate-800/40">
            {[...Array(4)].map((_, i) => <FilaCitaSkeleton key={i} />)}
          </div>
        ) : operativas.length === 0 ? (
          <div className="p-12 text-center animate-fade-in-up">
            <div className="w-14 h-14 mx-auto bg-paper dark:bg-night-2 rounded-xl flex items-center justify-center mb-5 border border-line dark:border-slate-800">
              <CalendarIcon className="w-6 h-6 text-faint" />
            </div>
            <h4 className="font-display text-lg font-bold text-ink dark:text-white mb-1.5">
              {hayFiltrosActivos ? "Sin resultados" : "Agenda despejada"}
            </h4>
            <p className="text-sm text-muted max-w-xs mx-auto">
              {hayFiltrosActivos
                ? "No hay citas activas con esos filtros. Prueba ajustándolos o límpialos."
                : "No hay citas pendientes ni confirmadas en esta página."}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-paper-2 dark:bg-night-2 text-muted font-semibold uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Fecha / Hora</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Barbero</th>
                    <th className="px-6 py-4 text-center">Estado</th>
                    <th className="px-6 py-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-slate-800/40">
                  {operativas.map((c, idx) => (
                    <tr key={c.id} className="animate-fade-in-up hover:bg-paper dark:hover:bg-slate-800/20 transition-colors"
                        style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}>
                      <td className="px-6 py-4">
                        <span className="font-bold text-ink-2 dark:text-slate-200">{c.fecha}</span>{" "}
                        <span className="text-muted ml-2 font-mono text-xs">{c.hora?.substring(0,5)}</span>
                      </td>
                      <td className="px-6 py-4 text-ink-2 dark:text-slate-300">{c.cliente?.name}</td>
                      <td className="px-6 py-4 text-muted">{c.barbero?.name}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getBadgeStyle(c.estado)}`}>
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <AccionesCita cita={c} onEstado={handleEstado} disabled={cambiandoEstado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-black/5 dark:divide-slate-800/40">
              {operativas.map((c, idx) => (
                <div key={c.id} className="p-5 animate-fade-in-up"
                     style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-bold text-ink dark:text-white">{c.fecha}</span>
                        <span className="text-muted font-mono text-xs tabular">{c.hora?.substring(0,5)}</span>
                      </div>
                      <p className="text-sm text-ink-2 dark:text-slate-300 font-medium truncate">{c.cliente?.name}</p>
                      <p className="text-xs text-muted truncate">con {c.barbero?.name}</p>
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase ${getBadgeStyle(c.estado)}`}>
                      {c.estado}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-black/5 dark:border-slate-800/40">
                    <AccionesCita cita={c} onEstado={handleEstado} disabled={cambiandoEstado} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex items-center justify-between bg-paper-2 dark:bg-night-2 px-4 sm:px-6 py-4 border-t border-line dark:border-slate-800/60">
          <p className="text-xs text-muted font-medium">
            Página <span className="text-ink dark:text-white font-bold">{paginacion.actual}</span> de {paginacion.total}
          </p>
          <div className="flex gap-2">
            <button disabled={paginacion.actual === 1} onClick={() => setPagina(paginacion.actual - 1)}
                    className="px-4 py-2 bg-line dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all active:scale-[0.96]">
              ← Anterior
            </button>
            <button disabled={paginacion.actual === paginacion.total} onClick={() => setPagina(paginacion.actual + 1)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white dark:text-abyss disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all active:scale-[0.96]">
              Siguiente →
            </button>
          </div>
        </div>
      </div>

      {/* ===== HISTORIAL ===== */}
      <div className="bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl overflow-hidden shadow-none">
        <button onClick={() => setMostrarHistorial((v) => !v)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-paper dark:hover:bg-slate-800/20 transition-colors">
          <div>
            <h2 className="font-display text-lg font-bold text-ink dark:text-white">Historial</h2>
            <p className="text-xs text-muted">Finalizadas y canceladas ({historial.length})</p>
          </div>
          <svg className={`w-5 h-5 text-faint transition-transform ${mostrarHistorial ? "rotate-180" : ""}`}
               fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {mostrarHistorial && (
          <div className="border-t border-line dark:border-slate-800/60 animate-fade-in">
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-paper-2 dark:bg-night-2 text-muted font-semibold uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Fecha / Hora</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-slate-800/40">
                  {historial.map((c) => (
                    <tr key={c.id}>
                      <td className="px-6 py-3 text-faint font-mono text-xs">#{c.id}</td>
                      <td className="px-6 py-3 text-muted">{c.fecha} {c.hora?.substring(0,5)}</td>
                      <td className="px-6 py-3 text-muted">{c.cliente?.name}</td>
                      <td className="px-6 py-3 text-right">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getBadgeStyle(c.estado)}`}>
                          {c.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-black/5 dark:divide-slate-800/40">
              {historial.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-2 dark:text-slate-300 truncate">{c.cliente?.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      <span className="font-mono tabular">#{c.id}</span> · {c.fecha} {c.hora?.substring(0,5)}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase ${getBadgeStyle(c.estado)}`}>
                    {c.estado}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
