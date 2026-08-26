import React from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { SunIcon, MoonIcon, LogOutIcon, HomeIcon } from "../components/Icons";

// ============================================================
// 🏗️ DASHBOARD LAYOUT — Fase 3 visual
// ============================================================

export default function DashboardLayout({ titulo, subtitulo }) {
  const { usuario, logout, esBarbero } = useAuth();
  const location = useLocation();
  const { esOscuro, toggleTema } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-paper dark:bg-night text-ink dark:text-slate-300 transition-colors duration-300">

      <header className="sticky top-0 z-30 glass border-b border-line/60 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white dark:text-abyss flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.04)] shadow-emerald-500/20">
              {usuario?.avatar_url ? (
                <img src={usuario.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                usuario?.name?.substring(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-ink dark:text-white leading-tight truncate">
                {titulo || "Panel"}
              </h2>
              <p className="text-xs text-muted font-medium truncate">
                {subtitulo || `${usuario?.name || ""} · ${usuario?.rol || ""}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTema}
              aria-label="Cambiar tema"
              className="p-2.5 rounded-full text-ink-2 dark:text-slate-400 hover:bg-paper dark:hover:bg-slate-800/50 transition-all active:scale-90"
            >
              <span key={esOscuro ? "sol" : "luna"} className="animate-icon-pop inline-flex">
                {esOscuro ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
              </span>
            </button>

            {/* 🔧 FIX #15 / Bloque E: nav item Mi perfil ↔ Mi agenda (solo barbero) */}
            {esBarbero && (
              location.pathname === "/barbero/perfil" ? (
                <Link
                  to="/barbero"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-ink-2 dark:text-slate-400 hover:bg-paper dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span>📅</span>
                  <span className="hidden sm:inline">Mi agenda</span>
                </Link>
              ) : (
                <Link
                  to="/barbero/perfil"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-ink-2 dark:text-slate-400 hover:bg-paper dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span>👤</span>
                  <span className="hidden sm:inline">Mi perfil</span>
                </Link>
              )
            )}

            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 bg-white hover:bg-paper text-ink-2 dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:text-slate-300 rounded-full text-sm font-semibold transition-all border border-line dark:border-slate-700 flex items-center gap-2"
            >
              <HomeIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Inicio</span>
            </button>

            <button
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              className="p-2.5 text-muted hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full transition-colors"
            >
              <LogOutIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* key por ruta: re-monta el wrapper para que la transición de
          página corra en cada navegación, no solo al entrar al panel */}
      <main key={location.pathname} className="max-w-7xl mx-auto px-6 py-8 w-full page-transition">
        <Outlet />
      </main>
    </div>
  );
}
