import React, { useState } from "react";
import toast from "react-hot-toast";
import useApiMutation from "../hooks/useApiMutation";
import ConfirmModal from "./ConfirmModal";
import { parseApiErrorSync } from "../utils/parseApiError";
import { SearchIcon } from "./Icons";

// ============================================================
// 👥 USUARIOS TAB — Pack 3
// ============================================================
// Tabla de gestión de usuarios para el superadmin.
// Acciones: cambiar rol, suspender/activar, eliminar.
// ============================================================

const ROLES = ["superadmin", "admin", "barbero", "cliente"];

const BADGE_ROL = {
  superadmin: "bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400",
  admin:      "bg-amber-100  dark:bg-amber-500/10  text-amber-700  dark:text-amber-400",
  barbero:    "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  cliente:    "bg-paper  dark:bg-slate-500/10  text-ink-2  dark:text-slate-400",
};

export default function UsuariosTab({ usuarios = [], cargando, onRefetch }) {
  const { ejecutar, cargando: ejecutando, getLastError } = useApiMutation();

  const [buscar,    setBuscar]    = useState("");
  const [filtroRol, setFiltroRol] = useState("");
  const [confirmarEliminar, setConfirmarEliminar] = useState(null); // { id, name }

  // ── Filtro local (el backend ya pagina, filtramos visualmente) ──
  const usuariosFiltrados = usuarios.filter((u) => {
    const matchBuscar = !buscar ||
      u.name.toLowerCase().includes(buscar.toLowerCase()) ||
      u.email.toLowerCase().includes(buscar.toLowerCase());
    const matchRol = !filtroRol || u.rol === filtroRol;
    return matchBuscar && matchRol;
  });

  // ── Cambiar rol ──
  const handleCambiarRol = async (id, nuevoRol) => {
    const r = await ejecutar(`/superadmin/usuarios/${id}/rol`, {
      method: "PATCH",
      body: { rol: nuevoRol },
    });
    if (r) {
      toast.success("Rol actualizado");
      onRefetch();
    } else {
      toast.error(parseApiErrorSync(getLastError()?.body, "No se pudo cambiar el rol"));
    }
  };

  // ── Toggle suspender ──
  const handleToggleSuspendido = async (usuario) => {
    const r = await ejecutar(`/superadmin/usuarios/${usuario.id}/suspender`, {
      method: "PATCH",
    });
    if (r) {
      toast.success(r.mensaje || (usuario.suspendido ? "Usuario reactivado" : "Usuario suspendido"));
      onRefetch();
    } else {
      toast.error(parseApiErrorSync(getLastError()?.body, "No se pudo cambiar el estado"));
    }
  };

  // ── Eliminar ──
  const handleEliminar = async () => {
    if (!confirmarEliminar || ejecutando) return;
    const r = await ejecutar(`/superadmin/usuarios/${confirmarEliminar.id}`, {
      method: "DELETE",
    });
    if (r) {
      toast.success("Usuario eliminado");
      setConfirmarEliminar(null);
      onRefetch();
    } else {
      toast.error(parseApiErrorSync(getLastError()?.body, "No se pudo eliminar el usuario"));
      setConfirmarEliminar(null);
    }
  };

  if (cargando) {
    return (
      <div className="space-y-3 mt-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-paper dark:bg-slate-800/50 shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">

      {/* ── Filtros ── */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-faint pointer-events-none" />
          <input
            type="text"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full bg-white dark:bg-abyss border border-line dark:border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15 transition-all"
          />
        </div>
        <select
          value={filtroRol}
          onChange={(e) => setFiltroRol(e.target.value)}
          className="bg-white dark:bg-abyss border border-line dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15 transition-all"
        >
          <option value="">Todos los roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* ── Contador ── */}
      <p className="text-xs text-faint">
        {usuariosFiltrados.length} usuario{usuariosFiltrados.length !== 1 ? "s" : ""}
        {buscar || filtroRol ? " (filtrados)" : " en total"}
      </p>

      {/* ── Lista ── */}
      {usuariosFiltrados.length === 0 ? (
        <div className="text-center py-12 text-faint text-sm">
          No se encontraron usuarios con ese criterio.
        </div>
      ) : (
        <div className="space-y-2">
          {usuariosFiltrados.map((u, idx) => (
            <div
              key={u.id}
              className={`animate-fade-in-up bg-white dark:bg-card border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-all ${
                u.suspendido
                  ? "border-rose-200 dark:border-rose-500/20 opacity-60"
                  : "border-line dark:border-slate-800/60 hover:border-line-strong dark:hover:border-slate-700"
              }`}
              style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                {u.avatar
                  ? <img src={`${import.meta.env.VITE_API_URL?.replace('/api','')||'http://127.0.0.1:8000'}/storage/${u.avatar}`}
                         alt={u.name} className="w-full h-full object-cover" />
                  : u.name?.substring(0, 1).toUpperCase()
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink dark:text-white text-sm truncate">{u.name}</p>
                <p className="text-xs text-faint truncate">{u.email}</p>
                {u.barberia && (
                  <p className="text-xs text-faint truncate">📍 {u.barberia.nombre}</p>
                )}
              </div>

              {/* Badge rol */}
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${BADGE_ROL[u.rol] || BADGE_ROL.cliente}`}>
                {u.rol}
              </span>

              {/* Acciones */}
              <div className="flex flex-wrap gap-2 sm:gap-3 items-center shrink-0">

                {/* Cambiar rol */}
                <select
                  value={u.rol}
                  onChange={(e) => handleCambiarRol(u.id, e.target.value)}
                  disabled={ejecutando}
                  className="text-xs bg-paper-2 dark:bg-slate-800 border border-line dark:border-slate-700 rounded-lg px-2 py-1.5 outline-none disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                {/* Toggle suspender */}
                <button
                  onClick={() => handleToggleSuspendido(u)}
                  disabled={ejecutando}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                    u.suspendido
                      ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200"
                      : "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-200"
                  }`}
                >
                  {u.suspendido ? "Reactivar" : "Suspender"}
                </button>

                {/* Eliminar */}
                <button
                  onClick={() => setConfirmarEliminar(u)}
                  disabled={ejecutando}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal de confirmación de eliminación ── */}
      <ConfirmModal
        abierto={confirmarEliminar !== null}
        cargando={ejecutando}
        titulo="Eliminar usuario"
        mensaje={confirmarEliminar
          ? `¿Seguro que deseas eliminar a ${confirmarEliminar.name}? Esta acción no se puede deshacer. Si tiene citas históricas, considera suspenderlo en su lugar.`
          : ""}
        textoConfirmar="Sí, eliminar"
        variante="danger"
        onConfirmar={handleEliminar}
        onCancelar={() => setConfirmarEliminar(null)}
      />
    </div>
  );
}
