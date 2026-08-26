import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import apiFetch from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { distanciaKm, formatearDistancia, obtenerUbicacion } from "../utils/geo";
import SkeletonCard from "../components/SkeletonCard";
import { SearchIcon } from "../components/Icons";
import useReveal from "../hooks/useReveal";

// ============================================================
// 📄 LANDING — Rediseño minimal editorial (Facelift Light)
// ============================================================
// Sin hero de imagen ni decoración: titular grande, buscador
// prominente, chips de rubro + "Cerca de mí" y el directorio.
// La lógica (paginación acumulativa, favoritos, rubros,
// cercanía, estados de error) es la misma de siempre.
// ============================================================

function BarberiaCard({ barberia, index, esFavorita, onToggleFavorito }) {
  const revealRef = useReveal();
  const promedio = barberia.calificacion_promedio != null
    ? Math.round(Number(barberia.calificacion_promedio) * 10) / 10
    : null;

  return (
    <Link
      ref={revealRef}
      to={`/barberia/${barberia.slug}`}
      className="reveal group relative block bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl p-5 transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-line-strong dark:hover:border-slate-700"
      style={{ "--reveal-delay": `${(index % 3) * 90}ms` }}
    >
      {/* Corazón de favorito */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorito(barberia.id);
        }}
        aria-label={esFavorita ? "Quitar de favoritas" : "Guardar en favoritas"}
        title={esFavorita ? "Quitar de favoritas" : "Guardar en favoritas"}
        className={`absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
          esFavorita
            ? "bg-[#FDEBEC] border-[#F7D4D6] text-[#9F2F2D] dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400"
            : "bg-white border-line text-faint hover:text-[#9F2F2D] hover:border-[#F7D4D6] dark:bg-slate-800/60 dark:border-slate-700 dark:hover:text-rose-400"
        }`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill={esFavorita ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      </button>

      {/* Identidad: logo + rubro + nombre */}
      <div className="flex items-start gap-3.5 mb-4 pr-10">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden border border-black/5 shrink-0"
          style={{ backgroundColor: barberia.logo_url ? "#ffffff" : (barberia.color_principal || "#10b981") }}
        >
          {barberia.logo_url ? (
            <img src={barberia.logo_url} alt={barberia.nombre} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-bold text-xl">
              {barberia.nombre.substring(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-[0.05em] text-muted dark:text-slate-500 mb-0.5">
            {barberia.rubro_nombre || "Barbería"}
          </span>
          <h3 className="text-[17px] font-semibold text-ink dark:text-white leading-snug truncate">
            {barberia.nombre}
          </h3>
        </div>
      </div>

      {/* Rating + distancia */}
      {(promedio != null && barberia.total_resenas > 0) || barberia._distancia != null ? (
        <div className="flex items-center gap-3 mb-2 text-sm">
          {promedio != null && barberia.total_resenas > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.48 3.5c.16-.38.88-.38 1.04 0l2.12 5.11 5.51.44c.44.04.62.59.28.88l-4.2 3.6 1.28 5.38c.1.43-.36.77-.74.54L12 16.56l-4.77 2.9c-.38.23-.84-.11-.74-.54l1.28-5.39-4.2-3.59a.47.47 0 0 1 .28-.88l5.51-.44 2.12-5.1z" />
              </svg>
              <span className="font-semibold text-ink dark:text-white tabular">{promedio.toLocaleString("es-CL")}</span>
              <span className="text-faint">({barberia.total_resenas})</span>
            </span>
          )}
          {barberia._distancia != null && (
            <span className="font-mono text-[11px] font-semibold text-[#346538] bg-[#EDF3EC] border border-[#D3E5D2] dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/30 px-2 py-0.5 rounded-full tabular">
              {formatearDistancia(barberia._distancia)}
            </span>
          )}
        </div>
      ) : null}

      {barberia.direccion && (
        <p className="text-xs text-faint dark:text-slate-500 truncate mb-3">
          {barberia.direccion}
        </p>
      )}

      {/* Acción */}
      <p className="flex items-center gap-1.5 pt-3 border-t border-black/5 dark:border-slate-800/60 text-sm font-medium text-muted dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
        Ver servicios
        <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M5 12h13" />
        </svg>
      </p>
    </Link>
  );
}

export default function LandingPage() {
  const { estaLogueado } = useAuth();
  const [busqueda, setBusqueda] = useState("");

  // ❤️ Favoritos del usuario (solo IDs; los corazones se pintan sobre
  // las barberías ya cargadas).
  const [favoritos, setFavoritos] = useState(() => new Set());

  // 📍 "Cerca de mí"
  const [ubicacion, setUbicacion] = useState(null);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);

  // 🏪 Rubros (Barbería, Salón de belleza, Perfumería…)
  const [rubros, setRubros] = useState([]);
  const [filtroRubro, setFiltroRubro] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/rubros");
        if (r.ok) setRubros(await r.json());
      } catch {
        // Silencioso: sin catálogo simplemente no se muestran los chips.
      }
    })();
  }, []);

  // Paginación acumulativa: antes solo se pedía la página 1 y las
  // barberías 11+ nunca aparecían en el directorio.
  const [barberias, setBarberias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [paginacion, setPaginacion] = useState({ pagina: 1, ultima: 1, total: 0 });

  const cargarPagina = useCallback(async (pagina) => {
    try {
      const r = await apiFetch(`/barberias?per_page=12&page=${pagina}`);
      if (!r.ok) throw new Error(`Error HTTP ${r.status}`);
      const json = await r.json();
      setBarberias((prev) => {
        const vistos = new Set(prev.map((b) => b.id));
        return [...prev, ...(json.data || []).filter((b) => !vistos.has(b.id))];
      });
      setPaginacion({
        // Math.max: si la API repitiera current_page (respuesta inconsistente),
        // avanzamos igual para que la autocarga no entre en bucle infinito.
        // El tope de 200 páginas es un corta-circuito ante last_page corrupto.
        pagina: Math.max(json.current_page, pagina),
        ultima: Math.min(json.last_page, 200),
        total: json.total,
      });
      setErrorCarga(false);
    } catch (e) {
      // Sin esto, un 500 o un corte de red se veía idéntico a
      // "no hay barberías registradas": estado de error explícito.
      console.error(e);
      setErrorCarga(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await cargarPagina(1);
      setCargando(false);
    })();
  }, [cargarPagina]);

  const cargarMas = async () => {
    setCargandoMas(true);
    await cargarPagina(paginacion.pagina + 1);
    setCargandoMas(false);
  };

  const hayMas = paginacion.pagina < paginacion.ultima;

  // Búsqueda, filtro de rubro u orden por cercanía: todos son
  // client-side, así que necesitan el catálogo completo cargado.
  const filtrosActivos = !!(busqueda.trim() || filtroRubro || ubicacion);

  // Mientras hay un filtro activo, cargamos el resto de las páginas:
  // sin esto una barbería en una página aún no cargada era invisible
  // para el filtro (y el botón "Mostrar más" se oculta al filtrar).
  useEffect(() => {
    if (filtrosActivos && hayMas && !cargandoMas && !errorCarga) {
      cargarMas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosActivos, hayMas, cargandoMas, errorCarga]);

  // ❤️ Cargar favoritos al iniciar sesión (y limpiarlos al salir).
  useEffect(() => {
    if (!estaLogueado) {
      setFavoritos(new Set());
      return;
    }
    (async () => {
      try {
        const r = await apiFetch("/mis-favoritos");
        if (r.ok) {
          const json = await r.json();
          setFavoritos(new Set(json.barberia_ids || []));
        }
      } catch {
        // Silencioso: sin favoritos cargados los corazones parten vacíos.
      }
    })();
  }, [estaLogueado]);

  const toggleFavorito = async (barberiaId) => {
    if (!estaLogueado) {
      toast("Inicia sesión para guardar tus tiendas favoritas.", { icon: "❤️" });
      return;
    }

    // Optimista: el corazón responde al instante y se revierte si falla.
    const alternar = (prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(barberiaId)) nuevo.delete(barberiaId);
      else nuevo.add(barberiaId);
      return nuevo;
    };
    setFavoritos(alternar);

    try {
      const r = await apiFetch(`/barberias/${barberiaId}/favorito`, { method: "POST" });
      if (!r.ok) throw new Error(`Error HTTP ${r.status}`);
      const json = await r.json();
      // Sincronizar con la verdad del backend (por si hubo doble click).
      setFavoritos((prev) => {
        const nuevo = new Set(prev);
        if (json.es_favorita) nuevo.add(barberiaId);
        else nuevo.delete(barberiaId);
        return nuevo;
      });
    } catch {
      setFavoritos(alternar); // revertir
      toast.error("No se pudo actualizar el favorito.");
    }
  };

  // 📍 Activar/desactivar orden por cercanía
  const toggleCercaDeMi = async () => {
    if (ubicacion) {
      setUbicacion(null);
      return;
    }
    setBuscandoUbicacion(true);
    try {
      setUbicacion(await obtenerUbicacion());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBuscandoUbicacion(false);
    }
  };

  const barberiasFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    let lista = barberias;

    // La búsqueda ahora también matchea nombres de servicio.
    if (q) {
      lista = lista.filter(
        (b) =>
          b?.nombre?.toLowerCase().includes(q) ||
          (b?.servicios || []).some((s) => s?.nombre?.toLowerCase().includes(q))
      );
    }
    if (filtroRubro) {
      lista = lista.filter((b) => b?.rubro === filtroRubro);
    }

    const conDistancia = lista.map((b) => ({
      ...b,
      _distancia:
        ubicacion && b.latitud != null && b.longitud != null
          ? distanciaKm(ubicacion.latitud, ubicacion.longitud, b.latitud, b.longitud)
          : null,
    }));

    // Orden: favoritas primero; con "cerca de mí" activo, por distancia
    // (las sin coordenadas van al final); si no, el alfabético del backend.
    return conDistancia.sort((a, b) => {
      const favDiff = (favoritos.has(a.id) ? 0 : 1) - (favoritos.has(b.id) ? 0 : 1);
      if (favDiff !== 0) return favDiff;
      if (ubicacion) {
        return (a._distancia ?? Infinity) - (b._distancia ?? Infinity);
      }
      return 0;
    });
  }, [barberias, busqueda, filtroRubro, favoritos, ubicacion]);

  const tabClase = (activa) =>
    `whitespace-nowrap px-1 pb-3 text-sm transition-colors border-b-2 -mb-px ${
      activa
        ? "font-semibold text-ink dark:text-white border-ink dark:border-white"
        : "font-medium text-muted dark:text-slate-400 border-transparent hover:text-ink-2 dark:hover:text-slate-200"
    }`;

  return (
    <div className="page-transition flex flex-col flex-1">

      {/* ============= HERO EDITORIAL ============= */}
      <section className="w-full">
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 lg:pt-28 lg:pb-20 grid lg:grid-cols-[1fr_380px] gap-12 lg:gap-16 items-center">
          <div className="max-w-2xl">
            <h1
              className="text-5xl sm:text-6xl font-bold text-ink dark:text-white tracking-tight leading-[1.08] mb-5 animate-fade-in-up"
              style={{ textWrap: "balance" }}
            >
              Reserva tu próxima cita en{" "}
              <span className="underline-wavy whitespace-nowrap">30 segundos</span>.
            </h1>
            <p className="text-lg text-muted dark:text-slate-400 leading-relaxed mb-10 animate-fade-in-up delay-100">
              Barberías, salones y centros de estética con agenda online.
              Elige, reserva y recibe la confirmación por correo.
            </p>

            {/* Buscador */}
            <div className="relative animate-fade-in-up delay-200">
              <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-faint pointer-events-none" />
              <input
                type="text"
                placeholder="Busca por nombre o servicio…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-14 pr-6 py-4 rounded-xl bg-white dark:bg-card border border-line dark:border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none transition-all text-base text-ink dark:text-white placeholder:text-faint"
              />
            </div>

            {/* Cómo funciona — una línea silenciosa */}
            <p className="mt-8 text-[13px] text-faint dark:text-slate-500 animate-fade-in-up delay-400">
              Elige barbero, día y hora · Confirmación por correo · Reagenda o cancela online
            </p>
          </div>

          {/* ── Viñeta animada: el flujo de reserva en 6 segundos ──
              Representación fija en modo claro (como captura de la app),
              decorativa: oculta a lectores de pantalla. En mobile se
              muestra compacta bajo el texto; en lg vuelve a su columna. */}
          <div
            className="relative animate-fade-in-up delay-300 select-none pointer-events-none w-full max-w-sm mx-auto lg:max-w-none"
            aria-hidden="true"
          >
            {/* Resplandor ambiental detrás de la viñeta */}
            <div className="absolute -inset-10 -z-10 rounded-full bg-emerald-400/15 dark:bg-emerald-500/10 blur-3xl animate-glow-pulse" />
            <div className="animate-float relative">
            <div className="bg-white border border-line rounded-xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
              {/* Tienda */}
              <div className="flex items-center gap-3 mb-5 pb-5 border-b border-black/5">
                <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  T
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-muted">Barbería</p>
                  <p className="text-[15px] font-semibold text-ink leading-tight">Tenri Barber</p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1 text-[13px]">
                  <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.48 3.5c.16-.38.88-.38 1.04 0l2.12 5.11 5.51.44c.44.04.62.59.28.88l-4.2 3.6 1.28 5.38c.1.43-.36.77-.74.54L12 16.56l-4.77 2.9c-.38.23-.84-.11-.74-.54l1.28-5.39-4.2-3.59a.47.47 0 0 1 .28-.88l5.51-.44 2.12-5.1z" />
                  </svg>
                  <span className="font-semibold text-ink tabular">4,8</span>
                </span>
              </div>

              {/* Servicio */}
              <div className="flex items-baseline justify-between mb-4">
                <p className="text-sm font-semibold text-ink">Corte de Pelo Senior</p>
                <p className="text-xs text-muted tabular">45 min · $12.000</p>
              </div>

              {/* Horarios */}
              <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-muted mb-2">
                Horarios disponibles
              </p>
              <div className="grid grid-cols-3 gap-2">
                <span className="py-2.5 rounded-lg border border-line bg-white text-ink-2 text-center text-sm font-medium font-mono tabular">
                  10:00
                </span>
                <span className="anim-slot-pick py-2.5 rounded-lg border text-center text-sm font-semibold font-mono tabular">
                  10:30
                </span>
                <span className="py-2.5 rounded-lg border border-line bg-white text-ink-2 text-center text-sm font-medium font-mono tabular">
                  11:15
                </span>
              </div>
            </div>

            {/* Toast de confirmación */}
            <div className="anim-confirm-pop absolute -bottom-7 -left-4 bg-white border border-line rounded-xl px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#EDF3EC] border border-[#D3E5D2] flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-[#346538]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span>
                <p className="text-[13px] font-semibold text-ink leading-tight">Cita confirmada</p>
                <p className="text-[11px] text-muted tabular">mié 26 · 10:30 — Corte Senior</p>
              </span>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============= DIRECTORIO ============= */}
      <section className="max-w-6xl mx-auto px-6 pb-24 w-full">
        <div className="pt-8 border-t border-line dark:border-slate-800/60">
          <div className="flex items-baseline justify-between gap-4 mb-6">
            <h2 className="text-xl font-semibold text-ink dark:text-white tracking-tight">
              {busqueda
                ? `Resultados para "${busqueda}"`
                : ubicacion
                ? "Cerca de ti"
                : "Explora las tiendas"}
            </h2>
            {!cargando && (
              <p className="text-sm text-faint font-medium tabular shrink-0">
                {busqueda || filtroRubro || ubicacion
                  ? `${barberiasFiltradas.length} ${barberiasFiltradas.length === 1 ? "resultado" : "resultados"}`
                  : `${paginacion.total} ${paginacion.total === 1 ? "tienda" : "tiendas"}`}
              </p>
            )}
          </div>

          {/* Barra de filtros: tabs de rubro + "Cerca de mí" */}
          <div className="flex items-end justify-between gap-4 border-b border-line dark:border-slate-800/60 mb-8">
            <nav className="flex items-center gap-5 overflow-x-auto no-scrollbar" aria-label="Filtrar por tipo de local">
              <button onClick={() => setFiltroRubro("")} className={tabClase(!filtroRubro)}>
                Todas
              </button>
              {rubros.map((r) => (
                <button
                  key={r.clave}
                  onClick={() => setFiltroRubro(filtroRubro === r.clave ? "" : r.clave)}
                  className={tabClase(filtroRubro === r.clave)}
                >
                  {r.etiqueta}
                </button>
              ))}
            </nav>

            <button
              onClick={toggleCercaDeMi}
              disabled={buscandoUbicacion}
              className={`shrink-0 mb-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[13px] font-semibold transition-all active:scale-[0.97] disabled:opacity-60 ${
                ubicacion
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400"
                  : "bg-white dark:bg-card border-line dark:border-slate-800 text-muted dark:text-slate-400 hover:text-emerald-700 hover:border-emerald-200 dark:hover:text-emerald-400"
              }`}
            >
              {buscandoUbicacion ? (
                <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              )}
              Cerca de mí
            </button>
          </div>
        </div>

        {cargando ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((n) => <SkeletonCard key={n} />)}
          </div>
        ) : errorCarga && barberias.length === 0 ? (
          <div className="text-center py-24 animate-fade-in-up">
            <h3 className="text-2xl font-semibold text-ink dark:text-white mb-2">
              No pudimos cargar el directorio
            </h3>
            <p className="text-muted dark:text-slate-400 max-w-md mx-auto mb-6">
              Hubo un problema de conexión. Inténtalo de nuevo en unos segundos.
            </p>
            <button
              onClick={() => cargarPagina(1)}
              className="px-7 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white dark:text-abyss font-bold text-sm transition-colors active:scale-[0.98]"
            >
              Reintentar
            </button>
          </div>
        ) : barberiasFiltradas.length === 0 && filtrosActivos && hayMas ? (
          <div className="text-center py-24 animate-fade-in-up">
            {errorCarga ? (
              // Si falla la carga automática de páginas durante la búsqueda,
              // el auto-load se detiene: sin este retry el "Buscando…" quedaba
              // pegado para siempre.
              <>
                <p className="text-muted dark:text-slate-400 mb-6">
                  No pudimos revisar todas las tiendas por un problema de conexión.
                </p>
                <button
                  onClick={cargarMas}
                  className="px-7 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white dark:text-abyss font-bold text-sm transition-colors active:scale-[0.98]"
                >
                  Reintentar
                </button>
              </>
            ) : (
              <p className="text-muted dark:text-slate-400">
                Buscando en todas las tiendas…
              </p>
            )}
          </div>
        ) : barberiasFiltradas.length === 0 ? (
          <div className="text-center py-24 animate-fade-in-up">
            <div className="w-14 h-14 mx-auto bg-paper dark:bg-card rounded-xl flex items-center justify-center mb-5 border border-line dark:border-slate-800">
              <SearchIcon className="w-6 h-6 text-faint" />
            </div>
            <h3 className="text-2xl font-semibold text-ink dark:text-white mb-2">
              No encontramos tiendas
            </h3>
            <p className="text-muted dark:text-slate-400 max-w-md mx-auto">
              {busqueda
                ? `No hay resultados para "${busqueda}". Prueba con otro término.`
                : filtroRubro
                ? `Aún no hay tiendas de este rubro en la plataforma.`
                : "Aún no hay tiendas registradas en la plataforma."}
            </p>
            {(busqueda || filtroRubro) && (
              <button
                onClick={() => { setBusqueda(""); setFiltroRubro(""); }}
                className="mt-6 px-5 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {barberiasFiltradas.map((barberia, idx) => (
                <BarberiaCard
                  key={barberia.id}
                  barberia={barberia}
                  index={idx}
                  esFavorita={favoritos.has(barberia.id)}
                  onToggleFavorito={toggleFavorito}
                />
              ))}
            </div>

            {hayMas && !filtrosActivos && (
              <div className="text-center mt-10">
                <button
                  onClick={cargarMas}
                  disabled={cargandoMas}
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-lg border border-line dark:border-slate-700 bg-white dark:bg-card text-ink-2 dark:text-slate-300 font-semibold text-sm hover:border-[#C9C7C1] dark:hover:border-slate-600 active:scale-[0.98] transition-all"
                >
                  {cargandoMas && (
                    <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  )}
                  Mostrar más tiendas
                  <span className="text-faint font-normal tabular">
                    ({barberias.length} de {paginacion.total})
                  </span>
                </button>
              </div>
            )}

            {errorCarga && barberias.length > 0 && (
              <p className="text-center mt-4 text-sm text-[#9F2F2D] dark:text-rose-400">
                No se pudieron cargar más tiendas.
                <button onClick={cargarMas} className="underline font-semibold ml-1">
                  Reintentar
                </button>
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
