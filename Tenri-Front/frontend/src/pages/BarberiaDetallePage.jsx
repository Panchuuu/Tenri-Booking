import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import useApi from "../hooks/useApi";
import ServiceCard from "../components/ServiceCard";
import BookingModal from "../components/BookingModal";
import { ArrowLeftIcon } from "../components/Icons";
import useReveal from "../hooks/useReveal";

// ============================================================
// 📄 BARBERIA DETALLE — Fase 3 visual
// ============================================================
// Header editorial con logo grande + nombre + breadcrumb.
// Grid de servicios usando ServiceCard rediseñado.
// ============================================================

function ServiceCardSkeleton() {
  return (
    <div className="bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl overflow-hidden">
      <div className="aspect-card bg-paper dark:bg-slate-800/50 shimmer" />
      <div className="p-6">
        <div className="h-6 w-2/3 rounded bg-paper dark:bg-slate-800/50 shimmer mb-3" />
        <div className="h-4 w-full rounded bg-paper dark:bg-slate-800/50 shimmer mb-2" />
        <div className="h-4 w-1/2 rounded bg-paper dark:bg-slate-800/50 shimmer" />
      </div>
    </div>
  );
}

export default function BarberiaDetallePage() {
  const { slug } = useParams();
  const revealRef = useReveal();
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);

  // Fetch directo por slug: antes se buscaba en la página 1 del listado,
  // así que las barberías 11+ salían como "no encontrada".
  const { data: barberia, error: errorBarberia, refetch: refetchBarberia } =
    useApi(`/barberias/${slug}`, { skip: !slug });

  const { data: servicios, cargando } = useApi(`/servicios?barberia=${slug}`, { skip: !slug });

  if (!barberia && errorBarberia) {
    // Solo un 404 significa "no existe": un 500 o un corte de red
    // transitorio no debe mostrar un mensaje definitivo de eliminación.
    const noExiste = errorBarberia.status === 404;

    return (
      <div className="page-transition max-w-3xl mx-auto px-6 py-32 text-center">
        <h2 className="font-display text-4xl font-semibold text-ink dark:text-white mb-4">
          {noExiste ? "Barbería no encontrada" : "No pudimos cargar la barbería"}
        </h2>
        <p className="text-muted dark:text-slate-400 mb-8">
          {noExiste
            ? `"${slug}" no existe o fue eliminada.`
            : "Hubo un problema de conexión. Inténtalo de nuevo en unos segundos."}
        </p>
        {noExiste ? (
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white dark:text-abyss font-bold rounded-full transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Volver al directorio
          </Link>
        ) : (
          <button
            onClick={refetchBarberia}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white dark:text-abyss font-bold rounded-full transition-colors"
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="page-transition flex flex-col flex-1">

      {/* ============= HEADER de la barbería ============= */}
      <header className="relative overflow-hidden mesh-bg noise">
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-20 lg:pt-16 lg:pb-24">

          {/* Breadcrumb */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-emerald-600 dark:hover:text-emerald-400 font-medium transition-colors mb-12 group"
          >
            <ArrowLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Volver al directorio
          </Link>

          {barberia ? (
            <div className="flex flex-col lg:flex-row items-center lg:items-end gap-8 lg:gap-12 animate-fade-in-up">
              {/* Logo */}
              <div
                className="relative w-32 h-32 lg:w-40 lg:h-40 rounded-xl flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.05)] overflow-hidden border border-line dark:border-slate-700/50 shrink-0"
                style={{ backgroundColor: barberia.logo_url ? "#ffffff" : (barberia.color_principal || "#10b981") }}
              >
                {barberia.logo_url ? (
                  <img src={barberia.logo_url} alt={barberia.nombre} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-white font-bold text-6xl">
                    {barberia.nombre.substring(0, 1).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="text-center lg:text-left flex-1">
                <span className="tag-pill text-emerald-600 dark:text-emerald-400 mb-4">
                  {barberia.rubro_nombre || "Barbería"} · {barberia.slug}
                </span>
                <h1 className="font-display text-5xl lg:text-7xl font-bold text-ink dark:text-white tracking-tight leading-[1.05] mb-4">
                  {barberia.nombre}
                </h1>

                {/* Calificación pública + dirección */}
                {(barberia.total_resenas > 0 || barberia.direccion) && (
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 mb-4">
                    {barberia.total_resenas > 0 && barberia.calificacion_promedio != null && (
                      <span className="inline-flex items-center gap-1.5 text-base">
                        <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.48 3.5c.16-.38.88-.38 1.04 0l2.12 5.11 5.51.44c.44.04.62.59.28.88l-4.2 3.6 1.28 5.38c.1.43-.36.77-.74.54L12 16.56l-4.77 2.9c-.38.23-.84-.11-.74-.54l1.28-5.39-4.2-3.59a.47.47 0 0 1 .28-.88l5.51-.44 2.12-5.1z" />
                        </svg>
                        <span className="font-bold text-ink dark:text-white tabular">
                          {(Math.round(Number(barberia.calificacion_promedio) * 10) / 10).toLocaleString("es-CL")}
                        </span>
                        <span className="text-muted dark:text-slate-400 text-sm">
                          ({barberia.total_resenas} {barberia.total_resenas === 1 ? "reseña" : "reseñas"})
                        </span>
                      </span>
                    )}

                    {barberia.direccion && (
                      <a
                        href={
                          barberia.latitud != null && barberia.longitud != null
                            ? `https://www.google.com/maps/search/?api=1&query=${barberia.latitud},${barberia.longitud}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(barberia.direccion)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        title="Ver en Google Maps"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        {barberia.direccion}
                      </a>
                    )}
                  </div>
                )}

                <p className="text-lg text-ink-2 dark:text-slate-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  Selecciona un servicio para agendar tu cita.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row items-center lg:items-end gap-8 lg:gap-12">
              <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-xl bg-paper dark:bg-slate-800/50 shimmer" />
              <div className="flex-1 w-full">
                <div className="h-4 w-32 rounded-full bg-paper dark:bg-slate-800/50 shimmer mb-4" />
                <div className="h-16 w-3/4 rounded-lg bg-paper dark:bg-slate-800/50 shimmer" />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ============= GRID DE SERVICIOS ============= */}
      <section className="max-w-7xl mx-auto px-6 pb-24 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink dark:text-white">
            Catálogo
          </h2>
          {!cargando && servicios && (
            <p className="text-sm text-muted font-medium">
              {servicios.length} {servicios.length === 1 ? "servicio disponible" : "servicios disponibles"}
            </p>
          )}
        </div>

        {cargando ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {[1,2,3].map((n) => <ServiceCardSkeleton key={n} />)}
          </div>
        ) : (servicios || []).length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl">
            <p className="text-muted dark:text-slate-400 text-lg">
              Esta barbería aún no tiene servicios publicados.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {servicios.map((s, idx) => (
              <div
                key={s.id}
                ref={revealRef}
                className="reveal"
                style={{ "--reveal-delay": `${(idx % 3) * 90}ms` }}
              >
                <ServiceCard servicio={s} onAgendar={setServicioSeleccionado} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL */}
      {servicioSeleccionado && barberia && (
        <BookingModal
          servicio={servicioSeleccionado}
          barberiaSlug={barberia.slug}
          onClose={() => setServicioSeleccionado(null)}
        />
      )}
    </div>
  );
}
