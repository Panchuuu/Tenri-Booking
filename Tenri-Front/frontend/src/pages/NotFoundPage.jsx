import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "../components/Icons";

export default function NotFoundPage() {
  return (
    <div className="page-transition flex-1 flex items-center justify-center px-6 py-24">
      <div className="text-center max-w-md relative">
        {/* Numeral fantasma flotando detrás del contenido */}
        <p
          aria-hidden="true"
          className="text-stroke font-display font-bold text-[9rem] sm:text-[12rem] leading-none select-none animate-float absolute -top-24 sm:-top-32 left-1/2 -translate-x-1/2 pointer-events-none"
        >
          404
        </p>
        <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400 mb-4 tabular relative">Error 404</p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-ink dark:text-white mb-4 leading-tight relative">
          Esta página no existe
        </h1>
        <p className="text-muted dark:text-slate-400 mb-8 leading-relaxed">
          El enlace puede estar mal escrito o la página fue movida.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white dark:text-abyss font-bold rounded-full transition-all active:scale-[0.98]"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Ir al directorio
        </Link>
      </div>
    </div>
  );
}
