import React, { useState, useMemo } from "react";
import toast from "react-hot-toast";
import useApi from "../../hooks/useApi";
import useApiMutation from "../../hooks/useApiMutation";
import { parseApiErrorSync } from "../../utils/parseApiError";
import PageHeader from "../../components/PageHeader";
import { SearchIcon } from "../../components/Icons";

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
  return estados[estado?.toLowerCase()] || "text-[#787774] bg-[#F7F6F3] dark:bg-slate-800";
}

function StatCard({ titulo, valor, children }) {
  return (
    <div className="bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl p-5 sm:p-6 shadow-none">
      <p className="text-[#787774] text-[10px] font-bold uppercase tracking-wider mb-1">{titulo}</p>
      {valor !== undefined ? (
        <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#111111] dark:text-white tabular">{valor}</h3>
      ) : children}
    </div>
  );
}

function AccionesCita({ cita, onEstado, disabled = false }) {
  return (
    <div className="flex gap-3 flex-wrap">
      {cita.estado === "pendiente" && (
        <button onClick={() => onEstado(cita.id, "confirmada")}
                disabled={disabled}
                className="text-emerald-600 dark:text-emerald-500 font-bold text-xs uppercase tracking-wider hover:underline disabled:opacity-40 disabled:cursor-not-allowed">
          Confirmar
        </button>
      )}
      {cita.estado === "confirmada" && (
        <button onClick={() => onEstado(cita.id, "finalizada")}
                disabled={disabled}
                className="text-cyan-600 dark:text-cyan-500 font-bold text-xs uppercase tracking-wider hover:underline disabled:opacity-40 disabled:cursor-not-allowed">
          Finalizar
        </button>
      )}
      <button onClick={() => onEstado(cita.id, "cancelada")}
              disabled={disabled}
              className="text-rose-600 dark:text-rose-500 font-bold text-xs uppercase tracking-wider hover:underline disabled:opacity-40 disabled:cursor-not-allowed">
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
    <div className="inline-flex bg-[#F7F6F3] dark:bg-slate-800/50 rounded-lg p-1">
      {opciones.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 sm:px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
            valor === o.id
              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-none"
              : "text-[#787774] hover:text-[#2F3437] dark:hover:text-slate-300"
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

  const hayFiltrosActivos = filtroDesde || filtroHasta || filtroBarbero || filtroEstado || busqueda;

  return (
    <div>
      <PageHeader tag="Operaciones" titulo="Panel principal"
                  subtitulo="Resumen + citas activas con filtros y búsqueda" />

      {/* ===== STATS POR PERIODO ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="font-display text-xl font-bold text-[#111111] dark:text-white">
          Resumen financiero
        </h2>
        <PeriodoSelector valor={periodoStats} onChange={setPeriodoStats} />
      </div>

      {finanzas && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <StatCard titulo={`Ingresos · ${finanzas.periodo}`}
                    valor={`$${(finanzas.total_ingresos || 0).toLocaleString("es-CL")}`} />
          <StatCard titulo="Cortes finalizados" valor={finanzas.cantidad_cortes || 0} />
          <StatCard titulo="Por barbero">
            <div className="max-h-24 overflow-y-auto custom-scrollbar mt-1">
              {Object.entries(finanzas.desglose_barberos || {}).length === 0 ? (
                <p className="text-xs text-[#A8A29E] italic">Sin movimientos en este periodo</p>
              ) : (
                Object.entries(finanzas.desglose_barberos || {}).map(([n, t]) => (
                  <div key={n} className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#2F3437] dark:text-slate-300 truncate mr-2">{n}</span>
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
      <div className="bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-none mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-[#111111] dark:text-white">
            Filtros
            {hayFiltrosActivos && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">!</span>
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
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E] pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
              className="w-full pl-10 pr-3 py-2.5 bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-lg text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          {/* Desde */}
          <input
            type="date"
            value={filtroDesde}
            onChange={(e) => { setFiltroDesde(e.target.value); setPagina(1); }}
            className="px-3 py-2.5 bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-lg text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all dark:[color-scheme:dark]"
          />

          {/* Hasta */}
          <input
            type="date"
            value={filtroHasta}
            onChange={(e) => { setFiltroHasta(e.target.value); setPagina(1); }}
            className="px-3 py-2.5 bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-lg text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all dark:[color-scheme:dark]"
          />

          {/* Barbero */}
          <select
            value={filtroBarbero}
            onChange={(e) => { setFiltroBarbero(e.target.value); setPagina(1); }}
            className="px-3 py-2.5 bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-lg text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
            className="lg:col-span-2 px-3 py-2.5 bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-lg text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
      <div className="bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl overflow-hidden shadow-none mb-8">
        <div className="px-6 py-4 border-b border-[#EAEAEA] dark:border-slate-800/60">
          <h2 className="font-display text-lg font-bold text-[#111111] dark:text-white">
            {hayFiltrosActivos ? "Resultados filtrados" : "Citas activas"}
          </h2>
          <p className="text-xs text-[#787774]">
            {hayFiltrosActivos ? `${operativas.length} cita(s) activas + ${historial.length} en historial` : "Pendientes y confirmadas"}
          </p>
        </div>

        {cargandoCitas ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-[#EAEAEA] border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : operativas.length === 0 ? (
          <div className="p-12 text-center text-[#787774]">
            {hayFiltrosActivos ? "No hay citas activas con esos filtros." : "No hay citas activas en esta página."}
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FBFBFA] dark:bg-[#080d18] text-[#787774] font-semibold uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Fecha / Hora</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Barbero</th>
                    <th className="px-6 py-4 text-center">Estado</th>
                    <th className="px-6 py-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-slate-800/40">
                  {operativas.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F7F6F3] dark:hover:bg-slate-800/20">
                      <td className="px-6 py-4">
                        <span className="font-bold text-[#2F3437] dark:text-slate-200">{c.fecha}</span>{" "}
                        <span className="text-[#787774] ml-2 font-mono text-xs">{c.hora?.substring(0,5)}</span>
                      </td>
                      <td className="px-6 py-4 text-[#2F3437] dark:text-slate-300">{c.cliente?.name}</td>
                      <td className="px-6 py-4 text-[#787774]">{c.barbero?.name}</td>
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
              {operativas.map((c) => (
                <div key={c.id} className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-bold text-[#111111] dark:text-white">{c.fecha}</span>
                        <span className="text-[#787774] font-mono text-xs tabular">{c.hora?.substring(0,5)}</span>
                      </div>
                      <p className="text-sm text-[#2F3437] dark:text-slate-300 font-medium truncate">{c.cliente?.name}</p>
                      <p className="text-xs text-[#787774] truncate">con {c.barbero?.name}</p>
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

        <div className="flex items-center justify-between bg-[#FBFBFA] dark:bg-[#080d18] px-4 sm:px-6 py-4 border-t border-[#EAEAEA] dark:border-slate-800/60">
          <p className="text-xs text-[#787774] font-medium">
            Página <span className="text-[#111111] dark:text-white font-bold">{paginacion.actual}</span> de {paginacion.total}
          </p>
          <div className="flex gap-2">
            <button disabled={paginacion.actual === 1} onClick={() => setPagina(paginacion.actual - 1)}
                    className="px-4 py-2 bg-[#EAEAEA] dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-colors">
              ← Anterior
            </button>
            <button disabled={paginacion.actual === paginacion.total} onClick={() => setPagina(paginacion.actual + 1)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white dark:text-[#03070e] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-colors">
              Siguiente →
            </button>
          </div>
        </div>
      </div>

      {/* ===== HISTORIAL ===== */}
      <div className="bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl overflow-hidden shadow-none">
        <button onClick={() => setMostrarHistorial((v) => !v)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[#F7F6F3] dark:hover:bg-slate-800/20 transition-colors">
          <div>
            <h2 className="font-display text-lg font-bold text-[#111111] dark:text-white">Historial</h2>
            <p className="text-xs text-[#787774]">Finalizadas y canceladas ({historial.length})</p>
          </div>
          <svg className={`w-5 h-5 text-[#A8A29E] transition-transform ${mostrarHistorial ? "rotate-180" : ""}`}
               fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {mostrarHistorial && (
          <div className="border-t border-[#EAEAEA] dark:border-slate-800/60">
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FBFBFA] dark:bg-[#080d18] text-[#787774] font-semibold uppercase text-[10px] tracking-widest">
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
                      <td className="px-6 py-3 text-[#A8A29E] font-mono text-xs">#{c.id}</td>
                      <td className="px-6 py-3 text-[#787774]">{c.fecha} {c.hora?.substring(0,5)}</td>
                      <td className="px-6 py-3 text-[#787774]">{c.cliente?.name}</td>
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
                    <p className="text-sm font-medium text-[#2F3437] dark:text-slate-300 truncate">{c.cliente?.name}</p>
                    <p className="text-xs text-[#787774] mt-0.5">
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
