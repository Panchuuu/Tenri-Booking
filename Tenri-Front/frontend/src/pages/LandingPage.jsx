import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import apiFetch from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { distanciaKm, formatearDistancia, obtenerUbicacion } from "../utils/geo";
import useReveal from "../hooks/useReveal";
import {
  SearchIcon,
  MapPinIcon,
  XIcon,
  ArrowRightIcon,
  StarIcon,
  HeartIcon,
  ScissorsIcon,
  ClockIcon,
  CheckIcon,
} from "../components/Icons";
import heroBarberia640 from "../assets/barberia-hero-640.webp";
import heroBarberia1100 from "../assets/barberia-hero-1100.webp";
import bandaBarberia900 from "../assets/barberia-banda-900.webp";
import bandaBarberia1800 from "../assets/barberia-banda-1800.webp";

// ============================================================
// 📄 LANDING — directorio de tiendas
// ============================================================
// El valor de esta página es el directorio, no un folleto: la
// estructura va de lo concreto (buscar y ver tiendas) a lo
// explicativo (cómo se reserva, crear cuenta).
//
// Decisiones de diseño que conviene no deshacer sin pensarlo:
//  · Fotografía real en vez de una maqueta de la app dibujada con
//    divs. La captura falsa envejecía mal y no decía nada del rubro.
//  · Un solo acento (esmeralda) para estados y enlaces; los botones
//    primarios van en tinta, que además pasa AA sobre el hueso.
//  · Radios: contenedores 16px (rounded-2xl), interactivos pill.
//  · Movimiento solo con CSS (reveals + hover). Sin librerías nuevas
//    ni scroll listeners; useReveal usa IntersectionObserver.
//
// Los filtros (q, rubro, orden, cerca, fav) viven en el query string:
// el listado se comparte por link, el botón atrás funciona y recargar
// no pierde nada. Cualquier filtro fuerza la carga del catálogo
// completo, porque filtrar y ordenar es client-side y una tienda de la
// página 3 sería invisible.
//
// El resto de la lógica es la de siempre: paginación acumulativa,
// favoritos optimistas, búsqueda por nombre y por servicio, y estados
// explícitos de carga, error y vacío.
// ============================================================

const CLP = (valor) => `$${Number(valor).toLocaleString("es-CL")}`;

// Criterios de orden del directorio. "sugerido" es el de siempre:
// favoritas primero y, si hay ubicación, las más cercanas arriba.
const ORDENES = [
  { clave: "sugerido", etiqueta: "Orden sugerido" },
  { clave: "nota", etiqueta: "Mejor evaluadas" },
  { clave: "cercania", etiqueta: "Más cercanas" },
  { clave: "precio", etiqueta: "Precio más bajo" },
  { clave: "nombre", etiqueta: "Nombre (A-Z)" },
];

/** Precio más bajo del catálogo de la tienda, para orientar sin prometer. */
function precioDesde(barberia) {
  const precios = (barberia?.servicios || [])
    .map((s) => Number(s?.precio))
    .filter((p) => Number.isFinite(p) && p > 0);

  return precios.length ? Math.min(...precios) : null;
}

/** Nombres de servicios en una línea, con el resto contado. */
function resumenServicios(barberia, visibles = 2) {
  const nombres = (barberia?.servicios || []).map((s) => s?.nombre).filter(Boolean);
  if (!nombres.length) return null;

  const primeros = nombres.slice(0, visibles).join(", ");
  const resto = nombres.length - visibles;

  return resto > 0 ? `${primeros} y ${resto} más` : primeros;
}

function promedioDe(barberia) {
  if (barberia?.calificacion_promedio == null || !barberia?.total_resenas) return null;
  // Siempre con un decimal: "5" junto a "4,7" se leía como otra escala.
  return (Math.round(Number(barberia.calificacion_promedio) * 10) / 10).toFixed(1).replace(".", ",");
}

/** Marca de la tienda: su logo, o su color con la inicial. */
function SelloTienda({ barberia, className = "", tamañoTexto = "text-xl" }) {
  if (barberia.logo_url) {
    return (
      <img
        src={barberia.logo_url}
        alt={`Logo de ${barberia.nombre}`}
        loading="lazy"
        className={`object-cover bg-white ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center font-bold text-white ${tamañoTexto} ${className}`}
      style={{ backgroundColor: barberia.color_principal || "#1F6F5C" }}
    >
      {barberia.nombre?.substring(0, 1).toUpperCase()}
    </span>
  );
}

function BotonFavorito({ activo, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={activo ? "Quitar de favoritas" : "Guardar en favoritas"}
      title={activo ? "Quitar de favoritas" : "Guardar en favoritas"}
      className={`z-10 grid place-items-center w-9 h-9 rounded-full border transition-all active:scale-90 ${
        activo
          ? "bg-[#FDEBEC] border-[#F0CFD1] text-[#9F2F2D] dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400"
          : "bg-white/90 border-line text-faint backdrop-blur-sm hover:text-[#9F2F2D] hover:border-[#F0CFD1] dark:bg-card/80 dark:border-slate-700 dark:hover:text-rose-400"
      } ${className}`}
    >
      <HeartIcon className="w-[17px] h-[17px]" relleno={activo} />
    </button>
  );
}

/** Nota y distancia, la misma fila en todas las tarjetas. */
function MetaTienda({ barberia, className = "" }) {
  const promedio = promedioDe(barberia);
  if (promedio == null && barberia._distancia == null) return null;

  return (
    <div className={`flex items-center gap-2.5 text-sm ${className}`}>
      {promedio != null && (
        <span className="inline-flex items-center gap-1.5">
          <StarIcon className="w-[15px] h-[15px] text-amber-500" />
          <span className="font-mono font-semibold text-ink dark:text-white tabular">{promedio}</span>
          <span className="text-faint dark:text-slate-500">({barberia.total_resenas})</span>
        </span>
      )}
      {promedio != null && barberia._distancia != null && (
        <span aria-hidden="true" className="w-1 h-1 rounded-full bg-line-strong dark:bg-slate-700" />
      )}
      {barberia._distancia != null && (
        <span className="font-mono text-[13px] font-semibold text-[#1F6F5C] dark:text-emerald-400 tabular">
          a {formatearDistancia(barberia._distancia)}
        </span>
      )}
    </div>
  );
}

// ── Tarjeta destacada: la primera del listado, al ancho de dos ──
// Le da ritmo a la grilla y usa el color de la tienda como superficie
// real, en vez de otra tarjeta blanca más.
function TiendaDestacada({ barberia, esFavorita, onToggleFavorito }) {
  const revealRef = useReveal();
  const desde = precioDesde(barberia);
  const servicios = (barberia.servicios || []).slice(0, 3);

  return (
    <Link
      ref={revealRef}
      to={`/barberia/${barberia.slug}`}
      className="reveal group relative sm:col-span-2 flex flex-col sm:flex-row overflow-hidden rounded-2xl border border-line dark:border-slate-800/70 bg-white dark:bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong dark:hover:border-slate-700 hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)]"
    >
      <BotonFavorito
        activo={esFavorita}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorito(barberia.id);
        }}
        className="absolute top-4 right-4"
      />

      {/* Panel de marca: color propio de la tienda */}
      <div className="relative sm:w-44 lg:w-52 shrink-0 overflow-hidden">
        <SelloTienda
          barberia={barberia}
          className="w-full h-32 sm:h-full"
          tamañoTexto="text-5xl"
        />
      </div>

      <div className="flex-1 min-w-0 p-5 lg:p-6">
        <p className="text-[13px] text-muted dark:text-slate-400 mb-1">
          {barberia.rubro_nombre || "Barbería"}
        </p>
        <h3 className="text-[22px] lg:text-2xl font-bold text-ink dark:text-white tracking-tight leading-tight pr-12">
          {barberia.nombre}
        </h3>

        <MetaTienda barberia={barberia} className="mt-3" />

        {barberia.direccion && (
          <p className="mt-3 inline-flex items-start gap-1.5 text-sm text-muted dark:text-slate-400">
            <MapPinIcon className="w-4 h-4 mt-0.5 shrink-0 text-faint" />
            <span className="line-clamp-2">{barberia.direccion}</span>
          </p>
        )}

        {servicios.length > 0 && (
          <ul className="mt-5 space-y-1.5 border-t border-black/5 dark:border-slate-800/70 pt-4">
            {servicios.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink-2 dark:text-slate-300 truncate">{s.nombre}</span>
                <span className="font-mono text-[13px] text-muted dark:text-slate-400 tabular shrink-0">
                  {CLP(s.precio)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-ink dark:bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white dark:text-abyss transition-all group-hover:gap-3">
            Ver horas
            <ArrowRightIcon className="w-4 h-4" />
          </span>
          {desde != null && (
            <span className="font-mono text-[13px] text-muted dark:text-slate-400 tabular shrink-0">
              desde {CLP(desde)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function TarjetaTienda({ barberia, index, esFavorita, onToggleFavorito }) {
  const revealRef = useReveal();
  const desde = precioDesde(barberia);
  const servicios = resumenServicios(barberia);

  return (
    <Link
      ref={revealRef}
      to={`/barberia/${barberia.slug}`}
      className="reveal group relative flex flex-col rounded-2xl border border-line dark:border-slate-800/70 bg-white dark:bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong dark:hover:border-slate-700 hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)]"
      style={{ "--reveal-delay": `${(index % 3) * 80}ms` }}
    >
      <BotonFavorito
        activo={esFavorita}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorito(barberia.id);
        }}
        className="absolute top-4 right-4"
      />

      <div className="flex items-start gap-3.5 pr-12">
        <SelloTienda
          barberia={barberia}
          className="w-12 h-12 rounded-xl border border-black/5 shrink-0"
        />
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold text-ink dark:text-white leading-snug truncate">
            {barberia.nombre}
          </h3>
          <p className="text-[13px] text-muted dark:text-slate-400 truncate">
            {barberia.rubro_nombre || "Barbería"}
          </p>
        </div>
      </div>

      <MetaTienda barberia={barberia} className="mt-4" />

      {servicios && (
        <p className="mt-3 text-sm text-ink-2 dark:text-slate-300 line-clamp-2">{servicios}</p>
      )}

      {barberia.direccion && (
        <p className="mt-2 text-[13px] text-faint dark:text-slate-500 truncate">
          {barberia.direccion}
        </p>
      )}

      <div className="mt-auto pt-4 flex items-center justify-between gap-3 border-t border-black/5 dark:border-slate-800/70">
        <span className="font-mono text-[13px] text-muted dark:text-slate-400 tabular">
          {desde != null ? `desde ${CLP(desde)}` : ""}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink dark:text-white">
          Ver horas
          <ArrowRightIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

/** Un paso del bloque "Cómo se reserva" (componente aparte: el reveal usa un hook). */
function PasoReserva({ icono, titulo, texto, orden }) {
  const revealRef = useReveal();

  return (
    <li
      ref={revealRef}
      className={`reveal ${orden === 1 ? "lg:pt-6" : orden === 2 ? "lg:pt-12" : ""}`}
      style={{ "--reveal-delay": `${orden * 110}ms` }}
    >
      <span className="grid place-items-center w-11 h-11 rounded-2xl bg-[#EDF3EC] dark:bg-emerald-500/10 text-[#1F6F5C] dark:text-emerald-400">
        {icono}
      </span>
      <h3 className="mt-4 text-lg font-semibold text-ink dark:text-white">{titulo}</h3>
      <p className="mt-1.5 text-[15px] text-muted dark:text-slate-400 leading-relaxed max-w-xs">
        {texto}
      </p>
    </li>
  );
}

/** Esqueleto con la misma silueta que la tarjeta real. */
function TarjetaEsqueleto() {
  return (
    <div className="rounded-2xl border border-line dark:border-slate-800/70 bg-white dark:bg-card p-5 animate-pulse">
      <div className="flex items-start gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-paper dark:bg-card-2 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-2/3 rounded bg-paper dark:bg-card-2" />
          <div className="h-3 w-1/3 rounded bg-paper dark:bg-card-2" />
        </div>
      </div>
      <div className="mt-5 h-3 w-1/4 rounded bg-paper dark:bg-card-2" />
      <div className="mt-3 h-3 w-full rounded bg-paper dark:bg-card-2" />
      <div className="mt-2 h-3 w-4/5 rounded bg-paper dark:bg-card-2" />
      <div className="mt-5 pt-4 border-t border-black/5 dark:border-slate-800/70 flex justify-between">
        <div className="h-3 w-20 rounded bg-paper dark:bg-card-2" />
        <div className="h-3 w-16 rounded bg-paper dark:bg-card-2" />
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { estaLogueado } = useAuth();
  const directorioRef = useRef(null);
  const campoBusqueda = useRef(null);

  // ── Los filtros viven en la URL ──
  // Fuente de verdad en el query string: un listado filtrado se puede
  // compartir por link, el botón atrás del navegador funciona y recargar
  // no pierde lo que la persona eligió.
  const [params, setParams] = useSearchParams();
  const filtroRubro = params.get("rubro") || "";
  const orden = ORDENES.some((o) => o.clave === params.get("orden"))
    ? params.get("orden")
    : "sugerido";
  const soloFavoritas = params.get("fav") === "1";
  const quiereCercania = params.get("cerca") === "1" || orden === "cercania";

  // Un click en un filtro empuja historial (el atrás deshace ese click);
  // el tipeo reemplaza, porque si no cada tecla sería un paso atrás.
  const actualizarParams = useCallback(
    (cambios, { reemplazar = false } = {}) => {
      const siguiente = new URLSearchParams(params);
      for (const [clave, valor] of Object.entries(cambios)) {
        if (!valor) siguiente.delete(clave);
        else siguiente.set(clave, valor);
      }
      setParams(siguiente, { replace: reemplazar });
    },
    [params, setParams],
  );

  // El texto se escribe en local y baja a la URL con retardo: sin esto
  // cada tecla escribiría en la barra de direcciones.
  const [busqueda, setBusqueda] = useState(() => params.get("q") || "");
  const ultimoQEscrito = useRef(params.get("q") || "");

  useEffect(() => {
    const nuevo = busqueda.trim();
    if ((params.get("q") || "") === nuevo) return;
    const id = setTimeout(() => {
      ultimoQEscrito.current = nuevo;
      actualizarParams({ q: nuevo }, { reemplazar: true });
    }, 400);
    return () => clearTimeout(id);
  }, [busqueda, params, actualizarParams]);

  // Y al revés: si la URL cambió por fuera (atrás, adelante, link
  // pegado), el campo se pone al día. El ref distingue ese caso de
  // nuestra propia escritura, para no borrar lo que se está tipeando.
  useEffect(() => {
    const enUrl = params.get("q") || "";
    if (enUrl !== ultimoQEscrito.current) {
      ultimoQEscrito.current = enUrl;
      setBusqueda(enUrl);
    }
  }, [params]);

  // "/" enfoca el buscador, como en cualquier directorio.
  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const activo = document.activeElement;
      const tag = activo?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || activo?.isContentEditable) return;
      e.preventDefault();
      campoBusqueda.current?.focus();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  // ❤️ Favoritos del usuario (solo IDs; los corazones se pintan sobre
  // las barberías ya cargadas).
  const [favoritos, setFavoritos] = useState(() => new Set());

  // 📍 "Cerca de mí"
  const [ubicacion, setUbicacion] = useState(null);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);

  // Si el link traía cerca=1, recuperamos la ubicación sin abrir el
  // diálogo del navegador: pedir permiso al cargar es agresivo, así que
  // solo se reusa cuando ya estaba concedido.
  useEffect(() => {
    if (!quiereCercania || ubicacion || buscandoUbicacion) return;
    let cancelado = false;
    (async () => {
      try {
        const permiso = await navigator.permissions?.query({ name: "geolocation" });
        if (permiso && permiso.state !== "granted") return;
        const coords = await obtenerUbicacion();
        if (!cancelado) setUbicacion(coords);
      } catch {
        // Sin permiso el filtro queda apagado; el botón sigue disponible.
      }
    })();
    return () => { cancelado = true; };
  }, [quiereCercania, ubicacion, buscandoUbicacion]);

  // 🏪 Catálogo de rubros (Barbería, Salón de belleza, Perfumería…)
  const [rubros, setRubros] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/rubros");
        if (r.ok) setRubros(await r.json());
      } catch {
        // Silencioso: sin catálogo simplemente no se muestran los filtros.
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
  // Acotan el listado (cambian cuántas tiendas se ven).
  const filtrosQueAcotan = !!(busqueda.trim() || filtroRubro || soloFavoritas);
  // Además obligan a tener el catálogo completo: ordenar por nota con
  // media página cargada daría un "mejor evaluada" falso.
  const filtrosActivos = !!(filtrosQueAcotan || ubicacion || orden !== "sugerido");

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
      toast("Inicia sesión para guardar tus tiendas favoritas.");
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
      // Si el orden era por cercanía, deja de tener sentido sin ubicación.
      actualizarParams({ cerca: "", orden: orden === "cercania" ? "" : orden });
      return;
    }
    setBuscandoUbicacion(true);
    try {
      setUbicacion(await obtenerUbicacion());
      actualizarParams({ cerca: "1" });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBuscandoUbicacion(false);
    }
  };

  /** Cambia el criterio de orden. "Más cercanas" necesita ubicación. */
  const cambiarOrden = async (nuevo) => {
    if (nuevo === "cercania" && !ubicacion) {
      setBuscandoUbicacion(true);
      try {
        setUbicacion(await obtenerUbicacion());
      } catch (e) {
        toast.error(e.message);
        return;
      } finally {
        setBuscandoUbicacion(false);
      }
    }
    actualizarParams({ orden: nuevo === "sugerido" ? "" : nuevo });
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    ultimoQEscrito.current = "";
    setUbicacion(null);
    setParams(new URLSearchParams(), { replace: true });
  };

  const irAlDirectorio = (e) => {
    e.preventDefault();
    directorioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const barberiasFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    let lista = barberias;

    // La búsqueda también matchea nombres de servicio.
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
    if (soloFavoritas) {
      lista = lista.filter((b) => favoritos.has(b.id));
    }

    const conDistancia = lista.map((b) => ({
      ...b,
      _distancia:
        ubicacion && b.latitud != null && b.longitud != null
          ? distanciaKm(ubicacion.latitud, ubicacion.longitud, b.latitud, b.longitud)
          : null,
    }));

    // Lo que no se puede medir va al final en todos los criterios: una
    // tienda sin nota no es peor que una con 3,0, pero tampoco compite.
    const alFinal = (valor) => (valor == null ? Infinity : valor);
    const porNombre = (a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es");

    const criterios = {
      nota: (a, b) =>
        alFinal(a.total_resenas ? -Number(a.calificacion_promedio) : null) -
          alFinal(b.total_resenas ? -Number(b.calificacion_promedio) : null) ||
        (b.total_resenas || 0) - (a.total_resenas || 0) ||
        porNombre(a, b),
      cercania: (a, b) => alFinal(a._distancia) - alFinal(b._distancia) || porNombre(a, b),
      precio: (a, b) => alFinal(precioDesde(a)) - alFinal(precioDesde(b)) || porNombre(a, b),
      nombre: porNombre,
    };

    if (criterios[orden]) {
      // El criterio elegido manda: meter las favoritas arriba acá haría
      // que "mejor evaluadas" mostrara primero una de 4,0.
      return conDistancia.sort(criterios[orden]);
    }

    // Orden sugerido: favoritas primero; con ubicación, por distancia
    // (las sin coordenadas al final); si no, el alfabético del backend.
    return conDistancia.sort((a, b) => {
      const favDiff = (favoritos.has(a.id) ? 0 : 1) - (favoritos.has(b.id) ? 0 : 1);
      if (favDiff !== 0) return favDiff;
      if (ubicacion) {
        return alFinal(a._distancia) - alFinal(b._distancia);
      }
      return 0;
    });
  }, [barberias, busqueda, filtroRubro, favoritos, ubicacion, soloFavoritas, orden]);

  const [destacada, ...resto] = barberiasFiltradas;

  const pillFiltro = (activa) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all active:scale-[0.97] ${
      activa
        ? "bg-ink border-ink text-white dark:bg-emerald-500 dark:border-emerald-500 dark:text-abyss"
        : "bg-white border-line text-ink-2 hover:border-line-strong dark:bg-card dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700"
    }`;

  const tituloDirectorio = busqueda.trim()
    ? `Resultados para "${busqueda.trim()}"`
    : ubicacion
    ? "Tiendas cerca de ti"
    : "Todas las tiendas";

  return (
    <div className="page-transition flex flex-col flex-1">

      {/* ============ HERO ============ */}
      <section className="w-full">
        <div className="max-w-7xl mx-auto px-6 pt-20 lg:pt-24 pb-12 lg:pb-14 grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-10 lg:gap-14 items-center">

          <div className="max-w-xl">
            <h1
              className="text-[2.5rem] sm:text-5xl lg:text-[3.85rem] font-extrabold text-ink dark:text-white tracking-[-0.035em] leading-[1.04] animate-fade-in-up"
              style={{ textWrap: "balance" }}
            >
              Reserva tu hora sin llamar a nadie
            </h1>
            <p
              className="mt-5 text-lg text-ink-2 dark:text-slate-400 leading-relaxed animate-fade-in-up delay-100"
              style={{ textWrap: "balance" }}
            >
              Barberías, salones y centros de estética con sus horas libres a la vista.
            </p>

            <form onSubmit={irAlDirectorio} className="mt-8 animate-fade-in-up delay-200">
              <label
                htmlFor="buscar-tienda"
                className="block text-[13px] font-medium text-muted dark:text-slate-400 mb-2"
              >
                Busca por nombre o servicio
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-faint pointer-events-none" />
                  <input
                    id="buscar-tienda"
                    ref={campoBusqueda}
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Corte de barba, Los Leones, spa…"
                    className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-white dark:bg-card border border-line dark:border-slate-800 text-base text-ink dark:text-white placeholder:text-faint dark:placeholder:text-slate-500 outline-none transition-all focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                  />
                  {busqueda && (
                    <button
                      type="button"
                      onClick={() => { setBusqueda(""); campoBusqueda.current?.focus(); }}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-full text-faint transition-colors hover:bg-paper hover:text-ink-2 dark:hover:bg-card-2 dark:hover:text-slate-200"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-ink dark:bg-emerald-500 px-7 py-3.5 text-sm font-bold text-white dark:text-abyss transition-all hover:bg-ink-2 dark:hover:bg-emerald-400 active:scale-[0.98]"
                >
                  Buscar
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Foto real del rubro: reemplaza la maqueta de app dibujada
              con divs que había antes. srcSet para no bajar 300 kB en
              mobile; width/height evitan salto de layout. */}
          <div className="animate-fade-in-up delay-300 lg:h-[clamp(360px,52vh,520px)]">
            <img
              src={heroBarberia1100}
              srcSet={`${heroBarberia640} 640w, ${heroBarberia1100} 1100w`}
              sizes="(min-width: 1024px) 46vw, 100vw"
              width={1100}
              height={1450}
              fetchPriority="high"
              decoding="async"
              alt="Sillón de barbero frente al mesón de herramientas en una barbería de ladrillo"
              className="w-full h-full aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto object-cover object-[62%_center] rounded-2xl ring-1 ring-black/5 dark:ring-white/10"
            />
          </div>
        </div>
      </section>

      {/* ============ DIRECTORIO ============ */}
      <section ref={directorioRef} className="w-full scroll-mt-16 sm:scroll-mt-20">

        {/* Filtros pegados: quedan a mano mientras se recorre la grilla */}
        <div className="sticky top-16 sm:top-20 z-30 border-y border-line dark:border-slate-800/70 bg-paper/90 dark:bg-night/90 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
            <div
              className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto no-scrollbar"
              role="group"
              aria-label="Filtrar por tipo de local"
            >
              <button
                type="button"
                onClick={() => actualizarParams({ rubro: "" })}
                className={pillFiltro(!filtroRubro)}
              >
                Todas
              </button>
              {rubros.map((r) => (
                <button
                  key={r.clave}
                  type="button"
                  onClick={() => actualizarParams({ rubro: filtroRubro === r.clave ? "" : r.clave })}
                  className={pillFiltro(filtroRubro === r.clave)}
                >
                  {r.etiqueta}
                </button>
              ))}
            </div>

            {estaLogueado && (
              <button
                type="button"
                onClick={() => actualizarParams({ fav: soloFavoritas ? "" : "1" })}
                aria-pressed={soloFavoritas}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all active:scale-[0.97] ${
                  soloFavoritas
                    ? "bg-[#FDEBEC] border-[#F0CFD1] text-[#9F2F2D] dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400"
                    : "bg-white border-line text-ink-2 hover:border-line-strong dark:bg-card dark:border-slate-800 dark:text-slate-300"
                }`}
              >
                <HeartIcon className="w-4 h-4" relleno={soloFavoritas} />
                <span className="hidden sm:inline">Favoritas</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleCercaDeMi}
              disabled={buscandoUbicacion}
              aria-pressed={!!ubicacion}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all active:scale-[0.97] disabled:opacity-60 ${
                ubicacion
                  ? "bg-[#EDF3EC] border-[#CFE2CE] text-[#1F6F5C] dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400"
                  : "bg-white border-line text-ink-2 hover:border-line-strong dark:bg-card dark:border-slate-800 dark:text-slate-300"
              }`}
            >
              {buscandoUbicacion ? (
                <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <MapPinIcon className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Cerca de mí</span>
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 pt-10 pb-20 lg:pb-28">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-6">
            <div className="flex items-baseline gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink dark:text-white tracking-tight">
                {tituloDirectorio}
              </h2>
              {!cargando && (
                <p className="font-mono text-[13px] text-muted dark:text-slate-500 tabular">
                  {filtrosQueAcotan
                    ? `${barberiasFiltradas.length} ${barberiasFiltradas.length === 1 ? "resultado" : "resultados"}`
                    : `${paginacion.total} ${paginacion.total === 1 ? "tienda" : "tiendas"}`}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {filtrosActivos && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="text-[13px] font-semibold text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink dark:text-slate-400 dark:hover:text-white"
                >
                  Limpiar filtros
                </button>
              )}
              <label className="flex items-center gap-2 text-[13px] text-muted dark:text-slate-400">
                <span className="hidden sm:inline">Ordenar por</span>
                <select
                  value={orden}
                  onChange={(e) => cambiarOrden(e.target.value)}
                  disabled={buscandoUbicacion}
                  className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-semibold text-ink-2 outline-none transition-colors hover:border-line-strong focus:border-emerald-600 disabled:opacity-60 dark:border-slate-800 dark:bg-card dark:text-slate-300"
                >
                  {ORDENES.map((o) => (
                    <option key={o.clave} value={o.clave}>{o.etiqueta}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {cargando ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((n) => <TarjetaEsqueleto key={n} />)}
            </div>
          ) : errorCarga && barberias.length === 0 ? (
            <div className="rounded-2xl border border-line dark:border-slate-800/70 bg-white dark:bg-card px-6 py-16 text-center">
              <h3 className="text-xl font-semibold text-ink dark:text-white mb-2">
                No pudimos cargar el directorio
              </h3>
              <p className="text-muted dark:text-slate-400 max-w-md mx-auto mb-6">
                Hubo un problema de conexión. Inténtalo de nuevo en unos segundos.
              </p>
              <button
                type="button"
                onClick={() => cargarPagina(1)}
                className="rounded-full bg-ink dark:bg-emerald-500 px-6 py-3 text-sm font-bold text-white dark:text-abyss transition-all hover:bg-ink-2 dark:hover:bg-emerald-400 active:scale-[0.98]"
              >
                Reintentar
              </button>
            </div>
          ) : barberiasFiltradas.length === 0 && filtrosActivos && hayMas ? (
            <div className="px-6 py-16 text-center">
              {errorCarga ? (
                // Si falla la carga automática de páginas durante la búsqueda,
                // el auto-load se detiene: sin este retry el "Buscando…" quedaba
                // pegado para siempre.
                <>
                  <p className="text-muted dark:text-slate-400 mb-6">
                    No pudimos revisar todas las tiendas por un problema de conexión.
                  </p>
                  <button
                    type="button"
                    onClick={cargarMas}
                    className="rounded-full bg-ink dark:bg-emerald-500 px-6 py-3 text-sm font-bold text-white dark:text-abyss transition-all hover:bg-ink-2 dark:hover:bg-emerald-400 active:scale-[0.98]"
                  >
                    Reintentar
                  </button>
                </>
              ) : (
                <p className="inline-flex items-center gap-2.5 text-muted dark:text-slate-400">
                  <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  Buscando en todas las tiendas
                </p>
              )}
            </div>
          ) : barberiasFiltradas.length === 0 ? (
            <div className="rounded-2xl border border-line dark:border-slate-800/70 bg-white dark:bg-card px-6 py-16 text-center">
              <span className="grid place-items-center w-14 h-14 mx-auto mb-5 rounded-2xl bg-paper dark:bg-card-2 border border-line dark:border-slate-800">
                <SearchIcon className="w-6 h-6 text-faint" />
              </span>
              <h3 className="text-xl font-semibold text-ink dark:text-white mb-2">
                {soloFavoritas && !favoritos.size ? "Sin favoritas aún" : "No encontramos tiendas"}
              </h3>
              <p className="text-muted dark:text-slate-400 max-w-md mx-auto">
                {soloFavoritas && !favoritos.size
                  ? "Todavía no guardaste ninguna tienda. Toca el corazón de una para tenerla a mano."
                  : busqueda
                  ? `Nada coincide con "${busqueda}". Prueba con otro nombre o servicio.`
                  : soloFavoritas
                  ? "Ninguna de tus favoritas calza con los filtros."
                  : filtroRubro
                  ? "Todavía no hay tiendas de este rubro en la plataforma."
                  : "Todavía no hay tiendas registradas en la plataforma."}
              </p>
              {filtrosActivos && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="mt-6 rounded-full border border-line dark:border-slate-700 bg-white dark:bg-card-2 px-5 py-2.5 text-sm font-semibold text-ink-2 dark:text-slate-300 transition-all hover:border-line-strong active:scale-[0.98]"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {destacada && (
                  <TiendaDestacada
                    key={destacada.id}
                    barberia={destacada}
                    esFavorita={favoritos.has(destacada.id)}
                    onToggleFavorito={toggleFavorito}
                  />
                )}
                {resto.map((barberia, idx) => (
                  <TarjetaTienda
                    key={barberia.id}
                    barberia={barberia}
                    index={idx}
                    esFavorita={favoritos.has(barberia.id)}
                    onToggleFavorito={toggleFavorito}
                  />
                ))}
              </div>

              {hayMas && !filtrosActivos && (
                <div className="mt-10 text-center">
                  <button
                    type="button"
                    onClick={cargarMas}
                    disabled={cargandoMas}
                    className="inline-flex items-center gap-2 rounded-full border border-line dark:border-slate-700 bg-white dark:bg-card px-7 py-3 text-sm font-semibold text-ink-2 dark:text-slate-300 transition-all hover:border-line-strong dark:hover:border-slate-600 active:scale-[0.98]"
                  >
                    {cargandoMas && (
                      <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    )}
                    Mostrar más tiendas
                    <span className="font-mono text-[13px] font-normal text-faint tabular">
                      {barberias.length} de {paginacion.total}
                    </span>
                  </button>
                </div>
              )}

              {errorCarga && barberias.length > 0 && (
                <p className="mt-4 text-center text-sm text-[#9F2F2D] dark:text-rose-400">
                  No se pudieron cargar más tiendas.
                  <button type="button" onClick={cargarMas} className="ml-1 font-semibold underline">
                    Reintentar
                  </button>
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* ============ CÓMO SE RESERVA ============ */}
      {/* Tres pasos sobre un riel, con desfase vertical: no son tres
          tarjetas iguales, y el orden de lectura queda explícito. */}
      <section className="w-full border-t border-line dark:border-slate-800/70">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:pt-20 lg:pb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-ink dark:text-white tracking-tight max-w-lg leading-tight">
            Cómo se reserva
          </h2>

          <ol className="mt-10 grid gap-10 lg:gap-6 lg:grid-cols-3 border-t border-line dark:border-slate-800/70 pt-8">
            {[
              {
                icono: <ScissorsIcon className="w-5 h-5" />,
                titulo: "Elige la tienda",
                texto: "Cada local muestra su catálogo con precios y duración de cada servicio.",
              },
              {
                icono: <ClockIcon className="w-5 h-5" />,
                titulo: "Toma una hora libre",
                texto: "El calendario deja elegir solo los bloques que el barbero tiene disponibles.",
              },
              {
                icono: <CheckIcon className="w-5 h-5" />,
                titulo: "Recibe la confirmación",
                texto: "Te llega por correo y queda en Mis reservas, con opción de reagendar o cancelar.",
              },
            ].map((paso, i) => (
              <PasoReserva key={paso.titulo} {...paso} orden={i} />
            ))}
          </ol>
        </div>
      </section>

      {/* ============ BANDA DE CUENTA ============ */}
      {/* Único bloque oscuro de la página, con foto de fondo y velo:
          cierra con una sola acción, distinta a la del hero. */}
      <section className="w-full px-6 pb-16 lg:pb-24">
        <div className="max-w-7xl mx-auto relative isolate overflow-hidden rounded-2xl bg-[#10201B]">
          <img
            src={bandaBarberia1800}
            srcSet={`${bandaBarberia900} 900w, ${bandaBarberia1800} 1800w`}
            sizes="100vw"
            width={1800}
            height={1000}
            loading="lazy"
            decoding="async"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-10 w-full h-full object-cover opacity-30"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-r from-[#10201B] via-[#10201B]/90 to-[#10201B]/40"
          />

          <div className="px-8 py-14 sm:px-12 lg:px-16 lg:py-20 max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
              {estaLogueado
                ? "Tus reservas, en un solo lugar"
                : "Guarda tus favoritas y sigue tus reservas"}
            </h2>
            <p className="mt-3 text-[15px] text-white/70 leading-relaxed">
              {estaLogueado
                ? "Revisa las horas que tomaste, reagenda o cancela sin llamar al local."
                : "Con una cuenta guardas las tiendas que te gustan y revisas tus horas cuando quieras."}
            </p>

            {estaLogueado ? (
              <Link
                to="/mis-reservas"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#10201B] transition-all hover:bg-white/90 active:scale-[0.98]"
              >
                Ver mis reservas
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("tenri:abrir-login", { detail: { registro: true } }))}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#10201B] transition-all hover:bg-white/90 active:scale-[0.98]"
              >
                Crear cuenta
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
