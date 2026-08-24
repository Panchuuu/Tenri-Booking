import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "../components/Icons";

export default function NotFoundPage() {
  return (
    <div className="page-transition flex-1 flex items-center justify-center px-6 py-32">
      <div className="text-center max-w-md">
        <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400 mb-4 tabular">404</p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-slate-900 dark:text-white mb-4 leading-tight">
          Esta página no existe
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
          El enlace puede estar mal escrito o la página fue movida.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white dark:text-[#03070e] font-bold rounded-full transition-all active:scale-[0.98]"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Ir al directorio
        </Link>
      </div>
    </div>
  );
}
