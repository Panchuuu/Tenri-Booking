import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import useApi from "../hooks/useApi";
import ServiceCard from "../components/ServiceCard";
import BookingModal from "../components/BookingModal";
import { ArrowLeftIcon } from "../components/Icons";

// ============================================================
// 📄 BARBERIA DETALLE — Fase 3 visual
// ============================================================
// Header editorial con logo grande + nombre + breadcrumb.
// Grid de servicios usando ServiceCard rediseñado.
// ============================================================

function ServiceCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0B1221] border border-slate-200 dark:border-slate-800/60 rounded-3xl overflow-hidden">
      <div className="aspect-card bg-slate-100 dark:bg-slate-800/50 shimmer" />
      <div className="p-6">
        <div className="h-6 w-2/3 rounded bg-slate-100 dark:bg-slate-800/50 shimmer mb-3" />
        <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800/50 shimmer mb-2" />
        <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-slate-800/50 shimmer" />
      </div>
    </div>
  );
}

export default function BarberiaDetallePage() {
  const { slug } = useParams();
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);

  // Fetch directo por slug: antes se buscaba en la página 1 del listado,
  // así que las barberías 11+ salían como "no encontrada".
  const { data: barberia, error: errorBarberia } = useApi(`/barberias/${slug}`, { skip: !slug });

  const { data: servicios, cargando } = useApi(`/servicios?barberia=${slug}`, { skip: !slug });

  if (!barberia && errorBarberia) {
    return (
      <div className="page-transition max-w-3xl mx-auto px-6 py-32 text-center">
        <h2 className="font-display text-4xl font-semibold text-slate-900 dark:text-white mb-4">
          Barbería no encontrada
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          "{slug}" no existe o fue eliminada.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white dark:text-[#03070e] font-bold rounded-full transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Volver al directorio
        </Link>
      </div>
    );
  }

  return (
    <div className="page-transition flex flex-col flex-1">

      {/* ============= HEADER de la barbería ============= */}
      <header className="relative overflow-hidden mesh-bg">
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-20 lg:pt-16 lg:pb-24">

          {/* Breadcrumb */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium transition-colors mb-12 group"
          >
            <ArrowLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Volver al directorio
          </Link>

          {barberia ? (
            <div className="flex flex-col lg:flex-row items-center lg:items-end gap-8 lg:gap-12 animate-fade-in-up">
              {/* Logo */}
              <div
                className="relative w-32 h-32 lg:w-40 lg:h-40 rounded-3xl flex items-center justify-center shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700/50 shrink-0"
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
                  Barbería · {barberia.slug}
                </span>
                <h1 className="font-display text-5xl lg:text-7xl font-bold text-slate-900 dark:text-white tracking-tight leading-[1.05] mb-4">
                  {barberia.nombre}
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  Selecciona un servicio para agendar tu cita.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row items-center lg:items-end gap-8 lg:gap-12">
              <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-3xl bg-slate-100 dark:bg-slate-800/50 shimmer" />
              <div className="flex-1 w-full">
                <div className="h-4 w-32 rounded-full bg-slate-100 dark:bg-slate-800/50 shimmer mb-4" />
                <div className="h-16 w-3/4 rounded-lg bg-slate-100 dark:bg-slate-800/50 shimmer" />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ============= GRID DE SERVICIOS ============= */}
      <section className="max-w-7xl mx-auto px-6 pb-24 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Catálogo
          </h2>
          {!cargando && servicios && (
            <p className="text-sm text-slate-500 font-medium">
              {servicios.length} {servicios.length === 1 ? "servicio disponible" : "servicios disponibles"}
            </p>
          )}
        </div>

        {cargando ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {[1,2,3].map((n) => <ServiceCardSkeleton key={n} />)}
          </div>
        ) : (servicios || []).length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#0B1221] border border-slate-200 dark:border-slate-800/60 rounded-3xl">
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              Esta barbería aún no tiene servicios publicados.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {servicios.map((s, idx) => (
              <div key={s.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 80}ms` }}>
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
