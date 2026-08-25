import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  CalendarIcon, ScissorsIcon, UsersIcon, SettingsIcon,
  UserIcon, LogOutIcon, SunIcon, MoonIcon, HomeIcon
} from "../components/Icons";

// 🚫 Icono nuevo para bloqueos (inline porque no está en Icons.jsx)
const BlockIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

// 🏪 Icono de tienda (inline porque no está en Icons.jsx)
const StoreIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l1.5-5h15L21 9" />
    <path d="M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0" />
    <path d="M5 11.5V21h14v-9.5" />
    <path d="M9 21v-6h6v6" />
  </svg>
);

const NAV_ITEMS = [
  { to: "/admin/agenda",        label: "Operaciones",  icon: CalendarIcon },
  { to: "/admin/servicios",     label: "Catálogo",     icon: ScissorsIcon },
  { to: "/admin/equipo",        label: "Equipo",       icon: UsersIcon    },
  { to: "/admin/bloqueos",      label: "Bloqueos",     icon: BlockIcon    }, // 🆕 Fase 4A
  { to: "/admin/tienda",        label: "Mi Tienda",    icon: StoreIcon    }, // 🏪 Perfil público
  { to: "/admin/configuracion", label: "Ajustes",      icon: SettingsIcon },
  { to: "/admin/perfil",        label: "Mi perfil",    icon: UserIcon     },
];

export default function AdminLayout() {
  const { usuario, logout } = useAuth();
  const { esOscuro, toggleTema } = useTheme();
  const navigate = useNavigate();
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg)] dark:bg-[#050810] text-[#111111] dark:text-slate-300 transition-colors">

      {sidebarAbierto && (
        <div className="lg:hidden fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
             onClick={() => setSidebarAbierto(false)} />
      )}

      <aside className={`
        fixed lg:sticky top-0 left-0 z-40
        w-[280px] h-screen
        bg-white dark:bg-[#03070e]
        border-r border-[#EAEAEA] dark:border-slate-800/50
        flex flex-col justify-between
        transition-transform duration-300
        ${sidebarAbierto ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div>
          <div className="h-20 flex items-center justify-center border-b border-[#EAEAEA] dark:border-slate-800/30">
            <span className="font-display text-2xl font-bold text-[#111111] dark:text-white tracking-tight">
              Tenri<span className="italic font-normal text-emerald-500">·</span>
              <span className="text-emerald-500 dark:text-emerald-400 ml-1">Admin</span>
            </span>
          </div>

          <nav className="p-4 space-y-1 mt-2 text-sm font-medium">
            {/* eslint-disable-next-line no-unused-vars */}
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setSidebarAbierto(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                  ${isActive
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 shadow-none"
                    : "text-[#2F3437] dark:text-slate-400 hover:bg-[#F7F6F3] dark:hover:bg-slate-800/30"
                  }
                `}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-[#EAEAEA] dark:border-slate-800/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white dark:text-[#03070e] flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.04)] shadow-emerald-500/20">
              {usuario?.avatar_url ? (
                <img src={usuario.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                usuario?.name?.substring(0, 1).toUpperCase()
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-[#111111] dark:text-white leading-tight truncate">
                {usuario?.name}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wider truncate">
                Administrador
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button onClick={toggleTema} aria-label="Cambiar tema"
                    className="flex-1 px-3 py-2 bg-[#F7F6F3] dark:bg-slate-800/50 hover:bg-[#EAEAEA] dark:hover:bg-slate-800 rounded-lg flex items-center justify-center text-[#2F3437] dark:text-slate-400 transition-colors">
              {esOscuro ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            </button>
            <button onClick={() => navigate("/")} aria-label="Inicio"
                    className="flex-1 px-3 py-2 bg-[#F7F6F3] dark:bg-slate-800/50 hover:bg-[#EAEAEA] dark:hover:bg-slate-800 rounded-lg flex items-center justify-center text-[#2F3437] dark:text-slate-400 transition-colors">
              <HomeIcon className="w-4 h-4" />
            </button>
            <button onClick={handleLogout} aria-label="Cerrar sesión"
                    className="flex-1 px-3 py-2 bg-[#F7F6F3] dark:bg-slate-800/50 hover:bg-rose-100 dark:hover:bg-rose-500/10 rounded-lg flex items-center justify-center text-[#2F3437] dark:text-slate-400 hover:text-rose-500 transition-colors">
              <LogOutIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        <header className="lg:hidden sticky top-0 z-20 glass border-b border-[#EAEAEA]/60 dark:border-slate-800/50 h-16 px-4 flex items-center justify-between">
          <button onClick={() => setSidebarAbierto(true)} className="p-2 text-[#2F3437] dark:text-slate-300" aria-label="Abrir menú">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-display text-xl font-bold text-[#111111] dark:text-white tracking-tight">
            Tenri<span className="italic font-normal text-emerald-500">·</span>
            <span className="text-emerald-500 dark:text-emerald-400">Admin</span>
          </span>
          <div className="w-10" />
        </header>

        <div className="flex-1 p-6 md:p-10 page-transition">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
