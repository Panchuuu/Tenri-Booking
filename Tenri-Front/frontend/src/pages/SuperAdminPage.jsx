import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import useApi from "../hooks/useApi";
import useApiMutation from "../hooks/useApiMutation";
import apiFetch from "../utils/api";
import PageHeader from "../components/PageHeader";
import CharacterCounter from "../components/CharacterCounter";
import ConfirmModal from "../components/ConfirmModal";
import { parseApiErrorSync } from "../utils/parseApiError";
import UsuariosTab from "../components/UsuariosTab";
import EditarBarberiaModal from "../components/EditarBarberiaModal";
import { BanIcon, BuildingIcon, PencilIcon, PlayIcon, TrashIcon, UsersIcon } from "../components/Icons";

// ============================================================
// 👑 SUPERADMIN — Rediseño Master (Facelift Light + acento ámbar)
// ============================================================
// La lógica (carga acumulativa de barberías, CRUD, tabs) es la
// misma de siempre; cambió solo la capa de presentación:
// stats, tabs segmentadas, preview de marca y tabla refinada.
// ============================================================

const FORM_VACIO = {
  nombre_barberia: "",
  color_principal: "#10b981",
  logo_archivo: null,
  admin_nombre: "",
  admin_email: "",
  admin_password: "",
};

// ── Piezas visuales pequeñas ─────────────────────────────────

function StatCard({ etiqueta, valor, cargando, delay = 0 }) {
  return (
    <div
      className="animate-fade-in-up bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl px-5 py-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted dark:text-slate-500 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {etiqueta}
      </p>
      {cargando ? (
        <div className="h-8 w-16 rounded-lg bg-paper dark:bg-slate-800/50 shimmer" />
      ) : (
        <p className="font-mono text-3xl font-semibold text-ink dark:text-white tabular leading-none">
          {valor}
        </p>
      )}
    </div>
  );
}

function EtiquetaCampo({ children }) {
  return (
    <label className="text-xs font-semibold text-muted mb-1 block">{children}</label>
  );
}

const INPUT_BASE =
  "w-full bg-white dark:bg-abyss border border-line dark:border-slate-800 rounded-lg p-2.5 text-sm text-ink dark:text-slate-200 outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15 transition-all";

function FilaSkeleton() {
  return (
    <div className="px-5 py-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-paper dark:bg-slate-800/50 shimmer shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-40 max-w-full rounded bg-paper dark:bg-slate-800/50 shimmer" />
        <div className="h-3 w-24 rounded bg-paper dark:bg-slate-800/50 shimmer" />
      </div>
      <div className="h-6 w-20 rounded-full bg-paper dark:bg-slate-800/50 shimmer hidden sm:block" />
    </div>
  );
}

// Estado de la barbería: suspendida no se borra, se pausa.
function EstadoBadge({ activa }) {
  return activa !== false ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Activa
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
      <BanIcon className="w-3 h-3" />
      Suspendida
    </span>
  );
}

// Botón de acción tipo "ghost" para filas de tabla
function BotonAccion({ onClick, titulo, variante = "neutral", children }) {
  const colores =
    variante === "danger"
      ? "text-faint hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-500/10"
      : "text-faint hover:text-ink hover:bg-paper dark:hover:text-white dark:hover:bg-slate-800/50";
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-all active:scale-90 ${colores}`}
    >
      {children}
    </button>
  );
}

export default function SuperAdminPage() {
  const [form, setForm] = useState(FORM_VACIO);

  const [barberiasData, setBarberiasData] = useState(null); // null = aún no cargado
  const [errorBarberias, setErrorBarberias] = useState(false);

  const refetch = useCallback(async () => {
    try {
      // El endpoint propio del superadmin y no el público: el público filtra
      // las suspendidas, y el superadmin es justo quien tiene que verlas
      // para poder reactivarlas. Además llega todo en una sola llamada.
      const r = await apiFetch("/superadmin/barberias");
      if (!r.ok) throw new Error(`Error HTTP ${r.status}`);
      const json = await r.json();
      setBarberiasData(json.barberias || []);
      setErrorBarberias(false);
    } catch (e) {
      console.error(e);
      setErrorBarberias(true);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const { ejecutar, cargando, getLastError } = useApiMutation();
  const barberias = barberiasData || [];

  // 🎯 Pack 3: tab activa + datos de usuarios
  const [tabActiva, setTabActiva] = useState("negocios");
  const [editandoBarberia,          setEditandoBarberia]          = useState(null);
  const [confirmarEliminarBarberia, setConfirmarEliminarBarberia] = useState(null);
  // Suspender pide confirmación (cierra sesiones y saca del público);
  // reactivar es directo porque solo devuelve las cosas a su lugar.
  const [confirmarSuspenderBarberia, setConfirmarSuspenderBarberia] = useState(null);
  const { ejecutar: ejecutarBarberia, cargando: eliminando } = useApiMutation();
  const { ejecutar: ejecutarSuspension, cargando: suspendiendo, getLastError: getErrorSuspension } = useApiMutation();
  const {
    data: usuariosData,
    cargando: cargandoUsuarios,
    refetch: refetchUsuarios,
  } = useApi("/superadmin/usuarios");

  const usuarios = usuariosData?.data || usuariosData || [];
  const suspendidos = usuarios.filter((u) => u.suspendido).length;
  const negociosActivos = barberias.filter((b) => b.activa !== false).length;

  const handleCrear = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("nombre_barberia", form.nombre_barberia);
    fd.append("color_principal", form.color_principal);
    if (form.logo_archivo) fd.append("logo", form.logo_archivo);
    fd.append("admin_nombre", form.admin_nombre);
    fd.append("admin_email", form.admin_email);
    fd.append("admin_password", form.admin_password);

    const r = await ejecutar("/barberias", { method: "POST", body: fd });

    if (r) {
      toast.success("¡Negocio creado con éxito!");
      setForm(FORM_VACIO);
      const inputLogo = document.getElementById("input-logo");
      if (inputLogo) inputLogo.value = "";
      refetch();
    } else {
      // 🎯 Pack 2/D: mostramos el mensaje real del backend
      // (ej: "Ya existe un usuario con este correo", "El nombre no puede
      // superar los 60 caracteres", etc.) en vez del toast genérico.
      toast.error(parseApiErrorSync(
        getLastError()?.body,
        "Error al crear el negocio. Revisa los datos."
      ));
    }
  };

  const alternarSuspension = async (barberia) => {
    if (suspendiendo) return;
    const r = await ejecutarSuspension(
      `/superadmin/barberias/${barberia.id}/suspender`,
      { method: "PATCH" }
    );
    if (r) {
      toast.success(r.mensaje || "Estado actualizado");
      setConfirmarSuspenderBarberia(null);
      refetch();
    } else {
      toast.error(parseApiErrorSync(getErrorSuspension()?.body, "No se pudo cambiar el estado de la barbería"));
      setConfirmarSuspenderBarberia(null);
    }
  };

  const handleToggleSuspension = (barberia) => {
    if (barberia.activa !== false) {
      setConfirmarSuspenderBarberia(barberia);
      return;
    }
    alternarSuspension(barberia);
  };

  const handleEliminarBarberia = async () => {
    if (!confirmarEliminarBarberia || eliminando) return;
    const r = await ejecutarBarberia(
      `/barberias/${confirmarEliminarBarberia.id}`,
      { method: "DELETE" }
    );
    if (r) {
      toast.success(r.mensaje || "Barbería eliminada");
      setConfirmarEliminarBarberia(null);
      refetch();
    } else {
      toast.error(parseApiErrorSync(getLastError()?.body, "No se pudo eliminar la barbería"));
      setConfirmarEliminarBarberia(null);
    }
  };

  const tabBoton = (activa) =>
    `inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ease-[var(--ease-spring)] active:scale-[0.97] ${
      activa
        ? "bg-white dark:bg-card text-ink dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-line dark:border-slate-700/60"
        : "text-muted dark:text-slate-400 hover:text-ink dark:hover:text-white border border-transparent"
    }`;

  const tabContador = (activa) =>
    `min-w-6 px-1.5 py-0.5 rounded-full text-[11px] font-bold font-mono tabular text-center ${
      activa
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-paper dark:bg-slate-800/60 text-faint"
    }`;

  return (
    <div>
      <PageHeader
        tag="Tenri Master"
        tono="amber"
        titulo={tabActiva === "negocios" ? "Red de negocios" : "Usuarios"}
        subtitulo={tabActiva === "negocios"
          ? "Administra los inquilinos (tenants) suscritos a TENRI SPA"
          : "Gestiona cuentas, roles y accesos del sistema"}
      />

      {/* ── Stats de la red ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard etiqueta="Negocios activos" valor={`${negociosActivos}/${barberias.length}`}
                  cargando={barberiasData === null} delay={0} />
        <StatCard etiqueta="Usuarios" valor={usuarios.length}
                  cargando={cargandoUsuarios} delay={80} />
        <StatCard etiqueta="Suspendidos" valor={suspendidos}
                  cargando={cargandoUsuarios} delay={160} />
      </div>

      {/* ── Tabs segmentadas ── */}
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-paper dark:bg-night-2 border border-line dark:border-slate-800/60 mb-8">
        <button onClick={() => setTabActiva("negocios")} className={tabBoton(tabActiva === "negocios")}>
          <BuildingIcon className="w-4 h-4" />
          Negocios
          <span className={tabContador(tabActiva === "negocios")}>
            {barberiasData === null ? "…" : barberias.length}
          </span>
        </button>
        <button onClick={() => setTabActiva("usuarios")} className={tabBoton(tabActiva === "usuarios")}>
          <UsersIcon className="w-4 h-4" />
          Usuarios
          <span className={tabContador(tabActiva === "usuarios")}>
            {cargandoUsuarios ? "…" : usuarios.length}
          </span>
        </button>
      </div>

      {tabActiva === "usuarios" && (
        <UsuariosTab
          usuarios={usuarios}
          cargando={cargandoUsuarios}
          onRefetch={refetchUsuarios}
        />
      )}

      {tabActiva === "negocios" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

          {/* ════ FORMULARIO DE CREACIÓN ════ */}
          <div className="lg:col-span-5 animate-fade-in-up bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl p-6 h-fit">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl font-bold text-ink dark:text-white">
                Nuevo negocio
              </h3>
              {/* Preview de marca en vivo */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-base border border-black/5 dark:border-white/10 transition-colors duration-300"
                style={{ backgroundColor: form.color_principal || "#10b981" }}
                title="Así se verá el avatar del negocio"
              >
                {(form.nombre_barberia || "T").substring(0, 1).toUpperCase()}
              </div>
            </div>

            <form onSubmit={handleCrear} className="space-y-6">
              <fieldset className="space-y-4">
                <legend className="flex items-center gap-2 text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-[0.15em] mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Datos de la empresa
                </legend>
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <EtiquetaCampo>Nombre comercial</EtiquetaCampo>
                    {/* 🔧 FIX #8 (PDF): contador visual del límite max:60 del backend.
                        También previene FIX #12 (nombre largo rompe navbar). */}
                    <CharacterCounter actual={form.nombre_barberia.length} max={60} />
                  </div>
                  <input
                    type="text" value={form.nombre_barberia}
                    onChange={(e) => setForm({ ...form, nombre_barberia: e.target.value })}
                    className={INPUT_BASE}
                    placeholder="Ej: Barbería VIP"
                    required
                    maxLength={60}
                    minLength={3}
                  />
                </div>

                <div>
                  <EtiquetaCampo>Color de marca</EtiquetaCampo>
                  <div className="flex gap-3 items-center">
                    <input
                      type="color" value={form.color_principal}
                      onChange={(e) => setForm({ ...form, color_principal: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-white dark:bg-abyss border border-line dark:border-slate-800 p-0.5 shrink-0"
                    />
                    <input
                      type="text" value={form.color_principal}
                      onChange={(e) => setForm({ ...form, color_principal: e.target.value })}
                      className={`${INPUT_BASE} flex-1 uppercase font-mono min-w-0`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <EtiquetaCampo>Logo (opcional)</EtiquetaCampo>
                  <input
                    id="input-logo" type="file" accept="image/*"
                    onChange={(e) => setForm({ ...form, logo_archivo: e.target.files[0] })}
                    className="w-full bg-white dark:bg-abyss border border-line dark:border-slate-800 rounded-lg p-2 text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-amber-500/10 file:text-amber-600 dark:file:text-amber-500 hover:file:bg-amber-500/20 file:transition-colors cursor-pointer"
                  />
                </div>
              </fieldset>

              <div className="border-t border-line dark:border-slate-800/60" />

              <fieldset className="space-y-4">
                <legend className="flex items-center gap-2 text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-[0.15em] mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Dueño / Administrador
                </legend>
                <div>
                  <EtiquetaCampo>Nombre completo</EtiquetaCampo>
                  <input
                    type="text" value={form.admin_nombre}
                    onChange={(e) => setForm({ ...form, admin_nombre: e.target.value })}
                    className={INPUT_BASE}
                    placeholder="Juan Pérez" required
                  />
                </div>
                <div>
                  <EtiquetaCampo>Correo (login)</EtiquetaCampo>
                  <input
                    type="email" value={form.admin_email}
                    onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                    className={INPUT_BASE}
                    placeholder="juan@negocio.com" required
                  />
                </div>
                <div>
                  <EtiquetaCampo>Contraseña temporal</EtiquetaCampo>
                  <input
                    type="text" value={form.admin_password}
                    onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                    className={INPUT_BASE}
                    placeholder="Mínimo 8 caracteres" required minLength={8}
                  />
                </div>
              </fieldset>

              <button
                type="submit" disabled={cargando}
                className={`group w-full py-3 pl-5 pr-2 rounded-full font-bold text-white dark:text-abyss transition-all flex items-center justify-between gap-3 ${
                  cargando
                    ? "bg-amber-400/70 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-400 hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:shadow-amber-500/25 active:scale-[0.98]"
                }`}
              >
                <span>{cargando ? "Creando…" : "Crear empresa"}</span>
                <span className="w-8 h-8 rounded-full bg-black/10 dark:bg-white/20 flex items-center justify-center transition-transform duration-300 ease-[var(--ease-spring)] group-hover:translate-x-0.5">
                  {cargando ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white dark:border-black/30 dark:border-t-black/70 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M5 12h13" />
                    </svg>
                  )}
                </span>
              </button>
            </form>
          </div>

          {/* ════ LISTA DE NEGOCIOS ════ */}
          <div className="lg:col-span-7 animate-fade-in-up delay-100 bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl overflow-hidden h-fit">

            {errorBarberias && barberias.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-muted mb-4">No pudimos cargar el listado de empresas.</p>
                <button
                  onClick={refetch}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-white dark:text-abyss font-bold text-sm rounded-full transition-all active:scale-[0.97]"
                >
                  Reintentar
                </button>
              </div>
            ) : barberiasData === null ? (
              <div className="divide-y divide-black/5 dark:divide-slate-800/40">
                {[...Array(5)].map((_, i) => <FilaSkeleton key={i} />)}
              </div>
            ) : barberias.length === 0 ? (
              <div className="p-14 text-center">
                <div className="w-14 h-14 mx-auto bg-paper dark:bg-night-2 rounded-xl flex items-center justify-center mb-5 border border-line dark:border-slate-800">
                  <BuildingIcon className="w-6 h-6 text-faint" />
                </div>
                <h4 className="font-display text-lg font-bold text-ink dark:text-white mb-1.5">
                  Aún no hay negocios en la red
                </h4>
                <p className="text-sm text-muted max-w-xs mx-auto">
                  Crea el primero con el formulario — el dueño recibirá su acceso de administrador.
                </p>
              </div>
            ) : (
              <>
                {/* 💻 DESKTOP: tabla */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-paper-2 dark:bg-night-2 border-b border-line dark:border-slate-800/60 text-muted font-semibold uppercase text-[10px] tracking-widest">
                      <tr>
                        <th className="px-5 py-4">Empresa</th>
                        <th className="px-5 py-4">Estado</th>
                        <th className="px-5 py-4">Slug</th>
                        <th className="px-5 py-4">Marca</th>
                        <th className="px-5 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-slate-800/40">
                      {barberias.map((b, idx) => (
                        <tr
                          key={b.id}
                          className="group animate-fade-in-up hover:bg-paper dark:hover:bg-slate-800/20 transition-colors"
                          style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              {b.logo_url ? (
                                <img src={b.logo_url} alt={b.nombre}
                                     className="w-10 h-10 rounded-lg object-cover border border-line dark:border-slate-700/50 bg-white" />
                              ) : (
                                <div
                                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs border border-black/5 dark:border-white/10 shrink-0"
                                  style={{ backgroundColor: b.color_principal || "#10b981" }}
                                >
                                  {b.nombre?.substring(0, 1).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className={`font-bold truncate ${b.activa === false ? "text-muted line-through decoration-1" : "text-ink dark:text-slate-200"}`}>{b.nombre}</p>
                                <p className="text-faint font-mono text-[11px] tabular">#{b.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5"><EstadoBadge activa={b.activa} /></td>
                          <td className="px-5 py-3.5 text-muted font-mono text-xs">/{b.slug}</td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-2 font-mono text-xs text-muted dark:text-slate-400">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/10 shrink-0"
                                style={{ backgroundColor: b.color_principal }}
                              />
                              {b.color_principal?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                              {b.activa === false ? (
                                <BotonAccion onClick={() => handleToggleSuspension(b)} titulo={`Reactivar ${b.nombre}`}>
                                  <PlayIcon className="w-4 h-4" />
                                </BotonAccion>
                              ) : (
                                <BotonAccion onClick={() => handleToggleSuspension(b)} titulo={`Suspender ${b.nombre}`} variante="danger">
                                  <BanIcon className="w-4 h-4" />
                                </BotonAccion>
                              )}
                              <BotonAccion onClick={() => setEditandoBarberia(b)} titulo={`Editar ${b.nombre}`}>
                                <PencilIcon className="w-4 h-4" />
                              </BotonAccion>
                              <BotonAccion onClick={() => setConfirmarEliminarBarberia(b)} titulo={`Eliminar ${b.nombre}`} variante="danger">
                                <TrashIcon className="w-4 h-4" />
                              </BotonAccion>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 📱 MOBILE: cards */}
                <div className="md:hidden divide-y divide-black/5 dark:divide-slate-800/40">
                  {barberias.map((b, idx) => (
                    <div
                      key={b.id}
                      className="p-4 flex items-center gap-4 animate-fade-in-up"
                      style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                    >
                      {b.logo_url ? (
                        <img src={b.logo_url} alt={b.nombre}
                             className="w-12 h-12 rounded-xl object-cover border border-line dark:border-slate-700/50 bg-white shrink-0" />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base border border-black/5 dark:border-white/10 shrink-0"
                          style={{ backgroundColor: b.color_principal || "#10b981" }}
                        >
                          {b.nombre?.substring(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <h4 className={`font-bold truncate ${b.activa === false ? "text-muted line-through decoration-1" : "text-ink dark:text-white"}`}>{b.nombre}</h4>
                          <span className="text-faint font-mono text-[10px] tabular shrink-0">#{b.id}</span>
                        </div>
                        <p className="text-xs text-muted font-mono mt-0.5 truncate">/{b.slug}</p>
                        <div className="mt-1.5">
                          <EstadoBadge activa={b.activa} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {b.activa === false ? (
                          <BotonAccion onClick={() => handleToggleSuspension(b)} titulo={`Reactivar ${b.nombre}`}>
                            <PlayIcon className="w-4 h-4" />
                          </BotonAccion>
                        ) : (
                          <BotonAccion onClick={() => handleToggleSuspension(b)} titulo={`Suspender ${b.nombre}`} variante="danger">
                            <BanIcon className="w-4 h-4" />
                          </BotonAccion>
                        )}
                        <BotonAccion onClick={() => setEditandoBarberia(b)} titulo={`Editar ${b.nombre}`}>
                          <PencilIcon className="w-4 h-4" />
                        </BotonAccion>
                        <BotonAccion onClick={() => setConfirmarEliminarBarberia(b)} titulo={`Eliminar ${b.nombre}`} variante="danger">
                          <TrashIcon className="w-4 h-4" />
                        </BotonAccion>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Refetch fallido con data previa: avisamos sin botar la lista */}
                {errorBarberias && (
                  <p className="p-4 text-center text-sm text-rose-500 border-t border-black/5 dark:border-slate-800/40">
                    No se pudo actualizar el listado.
                    <button onClick={refetch} className="underline font-semibold ml-1">
                      Reintentar
                    </button>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modales del CRUD de barberías ── */}
      <EditarBarberiaModal
        barberia={editandoBarberia}
        onClose={() => setEditandoBarberia(null)}
        onGuardado={refetch}
      />

      <ConfirmModal
        abierto={confirmarSuspenderBarberia !== null}
        cargando={suspendiendo}
        titulo="Suspender barbería"
        mensaje={confirmarSuspenderBarberia
          ? `¿Suspender "${confirmarSuspenderBarberia.nombre}"? Saldrá del listado público, no aceptará reservas nuevas y las sesiones de su equipo se cerrarán. No se borra nada: puedes reactivarla cuando quieras.`
          : ""}
        textoConfirmar="Sí, suspender"
        variante="danger"
        onConfirmar={() => confirmarSuspenderBarberia && alternarSuspension(confirmarSuspenderBarberia)}
        onCancelar={() => setConfirmarSuspenderBarberia(null)}
      />

      <ConfirmModal
        abierto={confirmarEliminarBarberia !== null}
        cargando={eliminando}
        titulo="Eliminar barbería"
        mensaje={confirmarEliminarBarberia
          ? `¿Seguro que deseas eliminar "${confirmarEliminarBarberia.nombre}"? Se eliminarán todos sus servicios, citas, barberos y datos asociados. Esta acción no se puede deshacer.`
          : ""}
        textoConfirmar="Sí, eliminar todo"
        variante="danger"
        onConfirmar={handleEliminarBarberia}
        onCancelar={() => setConfirmarEliminarBarberia(null)}
      />

    </div>
  );
}
