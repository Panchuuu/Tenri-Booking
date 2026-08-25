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

const FORM_VACIO = {
  nombre_barberia: "",
  color_principal: "#10b981",
  logo_archivo: null,
  admin_nombre: "",
  admin_email: "",
  admin_password: "",
};

export default function SuperAdminPage() {
  const [form, setForm] = useState(FORM_VACIO);

  // El listado /barberias está paginado (12 por defecto): el CRUD del
  // superadmin necesita TODAS las páginas o las barberías más allá de la
  // primera quedarían sin poder editarse/eliminarse.
  const [barberiasData, setBarberiasData] = useState(null); // null = aún no cargado
  const [errorBarberias, setErrorBarberias] = useState(false);

  const refetch = useCallback(async () => {
    try {
      const todas = [];
      let pagina = 1;
      let ultima = 1;
      do {
        const r = await apiFetch(`/barberias?per_page=50&page=${pagina}`);
        // Un fallo a mitad del loop no debe dejar una lista parcial
        // silenciosa: el superadmin creería que esas barberías no existen.
        if (!r.ok) throw new Error(`Error HTTP ${r.status}`);
        const json = await r.json();
        todas.push(...(json.data || []));
        ultima = json.last_page || 1;
        pagina += 1;
        // Tope duro: si la API devolviera un last_page inconsistente
        // (siempre mayor que la página actual), cortamos igual.
      } while (pagina <= ultima && pagina <= 200);
      setBarberiasData(todas);
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
  const { ejecutar: ejecutarBarberia, cargando: eliminando } = useApiMutation();
  const {
    data: usuariosData,
    cargando: cargandoUsuarios,
    refetch: refetchUsuarios,
  } = useApi("/superadmin/usuarios");

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

  return (
    <div>
      <PageHeader
        tag="Tenri Master"
        titulo={tabActiva === "negocios" ? "Red de negocios" : "Usuarios"}
        subtitulo={tabActiva === "negocios"
          ? "Administra los inquilinos (tenants) suscritos a TENRI SPA"
          : "Gestiona cuentas, roles y accesos del sistema"}
      />

      {/* 🎯 Pack 3: selector de tabs */}
      <div className="flex gap-2 mt-4 mb-6 border-b border-[#EAEAEA] dark:border-slate-800">
        <button
          onClick={() => setTabActiva("negocios")}
          className={`pb-3 px-1 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            tabActiva === "negocios"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-[#787774] hover:text-[#111111] dark:hover:text-white"
          }`}
        >
          🏢 Red de Negocios
        </button>
        <button
          onClick={() => setTabActiva("usuarios")}
          className={`pb-3 px-1 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            tabActiva === "usuarios"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-[#787774] hover:text-[#111111] dark:hover:text-white"
          }`}
        >
          👥 Usuarios
        </button>
      </div>

      {tabActiva === "usuarios" && (
      <UsuariosTab
        usuarios={usuariosData?.data || usuariosData || []}
        cargando={cargandoUsuarios}
        onRefetch={refetchUsuarios}
      />
    )}

    {tabActiva === "negocios" && (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

        {/* FORMULARIO DE CREACIÓN */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-amber-900/30 rounded-xl p-6 h-fit shadow-none relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-400" />

          <h3 className="font-display text-xl font-bold text-[#111111] dark:text-white mb-6">Nuevo negocio</h3>

          <form onSubmit={handleCrear} className="space-y-5">
            <div className="space-y-4 p-4 bg-[#FBFBFA] dark:bg-[#080d18] rounded-xl border border-[#EAEAEA] dark:border-slate-800/60">
              <h4 className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest">
                🏢 Datos de la empresa
              </h4>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-xs font-semibold text-[#787774] block">Nombre comercial</label>
                  {/* 🔧 FIX #8 (PDF): contador visual del límite max:60 del backend.
                      También previene FIX #12 (nombre largo rompe navbar): si el
                      input no permite >60, no llega a guardarse y romper el layout. */}
                  <CharacterCounter actual={form.nombre_barberia.length} max={60} />
                </div>
                <input
                  type="text" value={form.nombre_barberia}
                  onChange={(e) => setForm({ ...form, nombre_barberia: e.target.value })}
                  className="w-full bg-white dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-lg p-2.5 text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-amber-500/50"
                  placeholder="Ej: Barbería VIP"
                  required
                  maxLength={60}
                  minLength={3}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#787774] mb-1 block">Color de marca</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color" value={form.color_principal}
                    onChange={(e) => setForm({ ...form, color_principal: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer bg-white dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 p-0.5 shrink-0"
                  />
                  <input
                    type="text" value={form.color_principal}
                    onChange={(e) => setForm({ ...form, color_principal: e.target.value })}
                    className="flex-1 bg-white dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-lg p-2.5 text-sm text-[#111111] dark:text-slate-200 outline-none uppercase font-mono min-w-0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#787774] mb-1 block">Logo (opcional)</label>
                <input
                  id="input-logo" type="file" accept="image/*"
                  onChange={(e) => setForm({ ...form, logo_archivo: e.target.files[0] })}
                  className="w-full bg-white dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-lg p-2 text-sm text-[#787774] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-amber-500/10 file:text-amber-600 dark:file:text-amber-500 hover:file:bg-amber-500/20 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-4 p-4 bg-[#FBFBFA] dark:bg-[#080d18] rounded-xl border border-[#EAEAEA] dark:border-slate-800/60">
              <h4 className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest">
                👤 Dueño / Administrador
              </h4>
              <div>
                <label className="text-xs font-semibold text-[#787774] mb-1 block">Nombre completo</label>
                <input
                  type="text" value={form.admin_nombre}
                  onChange={(e) => setForm({ ...form, admin_nombre: e.target.value })}
                  className="w-full bg-white dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-lg p-2.5 text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-amber-500/50"
                  placeholder="Juan Pérez" required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#787774] mb-1 block">Correo (login)</label>
                <input
                  type="email" value={form.admin_email}
                  onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                  className="w-full bg-white dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-lg p-2.5 text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-amber-500/50"
                  placeholder="juan@negocio.com" required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#787774] mb-1 block">Contraseña temporal</label>
                <input
                  type="text" value={form.admin_password}
                  onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                  className="w-full bg-white dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-lg p-2.5 text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-amber-500/50"
                  placeholder="Mínimo 8 caracteres" required minLength={8}
                />
              </div>
            </div>

            <button
              type="submit" disabled={cargando}
              className={`w-full py-3.5 rounded-xl font-bold text-white dark:text-[#03070e] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
                cargando
                  ? "bg-amber-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 hover:-translate-y-0.5"
              }`}
            >
              {cargando ? "Creando..." : "Crear empresa"}
            </button>
          </form>
        </div>

        {/* LISTA DE BARBERÍAS */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl shadow-none overflow-hidden">

          {errorBarberias && barberias.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[#787774] mb-4">No pudimos cargar el listado de empresas.</p>
              <button
                onClick={refetch}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-white dark:text-[#03070e] font-bold text-sm rounded-lg transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : barberiasData === null ? (
            <div className="p-12 text-center text-[#787774]">
              Cargando empresas...
            </div>
          ) : barberias.length === 0 ? (
            <div className="p-12 text-center text-[#787774]">
              No hay empresas registradas aún.
            </div>
          ) : (
            <>
              {/* 💻 DESKTOP: tabla */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#FBFBFA] dark:bg-[#080d18] border-b border-[#EAEAEA] dark:border-slate-800/60 text-[#787774] font-semibold uppercase text-[10px] tracking-widest">
                    <tr>
                      <th className="px-5 py-4">ID</th>
                      <th className="px-5 py-4">Empresa</th>
                      <th className="px-5 py-4">Slug</th>
                      <th className="px-5 py-4 text-right">Color</th>
                      <th className="px-5 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-slate-800/40">
                    {barberias.map((b) => (
                      <tr key={b.id} className="hover:bg-[#F7F6F3] dark:hover:bg-slate-800/20">
                        <td className="px-5 py-4 text-[#787774] font-mono text-xs">#{b.id}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {b.logo_url ? (
                              <img src={b.logo_url} alt={b.nombre}
                                   className="w-10 h-10 rounded-lg object-cover border border-[#EAEAEA] dark:border-slate-700/50 bg-white" />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs border border-[#EAEAEA] dark:border-slate-700/50 shrink-0"
                                style={{ backgroundColor: b.color_principal || "#10b981" }}
                              >
                                {b.nombre?.substring(0, 1).toUpperCase()}
                              </div>
                            )}
                            <span className="text-[#111111] dark:text-slate-200 font-bold">{b.nombre}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[#787774] font-mono text-xs">/{b.slug}</td>
                        <td className="px-5 py-4 text-right">
                          <span
                            className="inline-block px-2 py-1 rounded text-xs font-mono"
                            style={{ backgroundColor: `${b.color_principal}20`, color: b.color_principal }}
                          >
                            {b.color_principal}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right space-x-4">
                          <button
                            onClick={() => setEditandoBarberia(b)}
                            className="text-cyan-600 dark:text-cyan-500 text-xs font-bold uppercase tracking-wider hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setConfirmarEliminarBarberia(b)}
                            className="text-rose-600 dark:text-rose-500 text-xs font-bold uppercase tracking-wider hover:underline"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 📱 MOBILE: cards */}
              <div className="md:hidden divide-y divide-black/5 dark:divide-slate-800/40">
                {barberias.map((b) => (
                  <div key={b.id} className="p-4 flex items-center gap-4">
                    {b.logo_url ? (
                      <img src={b.logo_url} alt={b.nombre}
                           className="w-12 h-12 rounded-xl object-cover border border-[#EAEAEA] dark:border-slate-700/50 bg-white shrink-0" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base border border-[#EAEAEA] dark:border-slate-700/50 shrink-0"
                        style={{ backgroundColor: b.color_principal || "#10b981" }}
                      >
                        {b.nombre?.substring(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <h4 className="font-bold text-[#111111] dark:text-white truncate">{b.nombre}</h4>
                        <span className="text-[#A8A29E] font-mono text-[10px] shrink-0">#{b.id}</span>
                      </div>
                      <p className="text-xs text-[#787774] font-mono mt-0.5 truncate">/{b.slug}</p>
                      <span
                        className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-mono"
                        style={{ backgroundColor: `${b.color_principal}20`, color: b.color_principal }}
                      >
                        {b.color_principal}
                      </span>
                      <div className="flex gap-4 mt-2">
                        <button
                          onClick={() => setEditandoBarberia(b)}
                          className="text-cyan-600 dark:text-cyan-500 text-xs font-bold uppercase tracking-wider hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmarEliminarBarberia(b)}
                          className="text-rose-600 dark:text-rose-500 text-xs font-bold uppercase tracking-wider hover:underline"
                        >
                          Eliminar
                        </button>
                      </div>
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
