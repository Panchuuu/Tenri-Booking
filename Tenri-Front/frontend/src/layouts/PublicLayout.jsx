import React, { useState, useEffect } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { SunIcon, MoonIcon, LogOutIcon } from "../components/Icons";
import Login from "../components/Login";

// ============================================================
// 🌐 PUBLIC LAYOUT — Fase 3c (fix mobile)
// ============================================================
// Fix: los botones de rol ahora son visibles en mobile.
//   - Mobile (< sm): solo emoji/ícono compacto (44x44)
//   - sm+ : ícono + texto
// ============================================================

export default function PublicLayout() {
  const { usuario, logout, esAdmin, esBarbero, esCliente, esSuperadmin } = useAuth();
  const { esOscuro, toggleTema } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMostrarLogin(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  // ============================================================
  // 🎯 Botón de rol — ahora responsive
  // ============================================================
  // En mobile (< sm): cuadrado 40x40 con solo emoji/ícono
  // En sm+: pill horizontal con emoji + texto
  // ============================================================
  const RolButton = ({ to, icono, label, theme = "emerald" }) => {
    const colors = theme === "amber"
      ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 dark:hover:bg-amber-500/20"
      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20";

    return (
      <Link
        to={to}
        aria-label={label}
        className={`
          inline-flex items-center justify-center gap-1.5 border rounded-full transition-all text-sm font-bold
          w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2
          ${colors}
        `}
      >
        <span className="text-base sm:text-sm">{icono}</span>
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  };

  const renderRolButton = () => {
    if (esSuperadmin) return <RolButton to="/superadmin"   icono="👑" label="Master"       theme="amber" />;
    if (esAdmin)      return <RolButton to="/admin"        icono="⚙"  label="Admin" />;
    if (esBarbero)    return <RolButton to="/barbero"      icono="📅" label="Agenda" />;
    if (esCliente)    return <RolButton to="/mis-reservas" icono="📋" label="Mis reservas" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-paper dark:bg-night text-ink dark:text-slate-200 transition-colors duration-300 flex flex-col">

      {/* ============ NAVBAR ============ */}
      <nav className={`
        fixed top-0 w-full z-50 transition-all duration-300
        ${scrolled
          ? "glass border-b border-line/60 dark:border-slate-800/50 shadow-none"
          : "bg-transparent border-b border-transparent"}
      `}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">

          <Link
            to="/"
            className="font-display text-xl sm:text-2xl font-bold text-ink dark:text-white tracking-tight flex items-center gap-1 sm:gap-2 shrink-0"
          >
            Tenri<span className="italic font-normal text-emerald-500">·</span>
            <span className="text-emerald-500 dark:text-emerald-400">Booking</span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTema}
              aria-label={esOscuro ? "Activar modo claro" : "Activar modo oscuro"}
              className="w-10 h-10 sm:w-auto sm:h-auto sm:p-2.5 rounded-full flex items-center justify-center text-ink-2 hover:bg-paper dark:text-slate-400 dark:hover:bg-slate-800/50 transition-all active:scale-90"
            >
              {/* key: re-monta el ícono al cambiar de tema para que
                  el pop con rotación se dispare en cada toggle */}
              <span key={esOscuro ? "sol" : "luna"} className="animate-icon-pop inline-flex">
                {esOscuro ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
              </span>
            </button>

            {usuario ? (
              <>
                {/* Saludo solo desktop */}
                <div className="hidden md:flex items-center gap-2 text-sm">
                  <span className="text-muted dark:text-slate-400">Hola,</span>
                  {/* 🔧 FIX #12 (PDF): nombre largo no rompe navbar.
                      inline-block necesario para que max-w + truncate funcionen
                      (los <span> inline ignoran max-width). */}
                  <span className="font-semibold text-ink dark:text-white truncate max-w-[160px] inline-block">
                    {usuario.name?.split(" ")[0]}
                  </span>
                </div>

                {renderRolButton()}

                <button
                  onClick={handleLogout}
                  aria-label="Cerrar sesión"
                  className="w-10 h-10 sm:w-auto sm:h-auto sm:p-2.5 rounded-full flex items-center justify-center text-muted hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                >
                  <LogOutIcon className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setMostrarLogin(true)}
                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-abyss text-xs sm:text-sm font-bold rounded-full transition-all shadow-none hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:shadow-emerald-500/20 whitespace-nowrap"
              >
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ============ CONTENIDO ============ */}
      <div className="flex-1 flex flex-col pt-16 sm:pt-20">
        <Outlet />
      </div>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-line dark:border-slate-800/50 bg-white/50 dark:bg-abyss/50 backdrop-blur-sm transition-colors">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">

            <div>
              <Link to="/" className="font-display text-3xl font-bold text-ink dark:text-white tracking-tight inline-block mb-3">
                Tenri<span className="italic font-normal text-emerald-500">·</span>
                <span className="text-emerald-500 dark:text-emerald-400">Booking</span>
              </Link>
              <p className="text-sm text-muted dark:text-slate-500 max-w-md">
                Reservas premium para barberías y centros de estética. Encuentra tu próximo barbero ideal.
              </p>
            </div>

            <div className="text-sm text-muted dark:text-slate-500 text-left md:text-right">
              <p>© {new Date().getFullYear()} Tenri SPA</p>
              <p className="mt-1 text-xs">Hecho con cariño en Chile 🇨🇱</p>
            </div>
          </div>
        </div>
      </footer>

      {mostrarLogin && (
        <Login
          onClose={() => setMostrarLogin(false)}
          onLoginSuccess={() => setMostrarLogin(false)}
        />
      )}
    </div>
  );
}
