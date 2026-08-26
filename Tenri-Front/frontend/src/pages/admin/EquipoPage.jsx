import React, { useState } from "react";
import toast from "react-hot-toast";
import useApi from "../../hooks/useApi";
import useApiMutation from "../../hooks/useApiMutation";
import PageHeader from "../../components/PageHeader";
import ConfirmModal from "../../components/ConfirmModal";
import { StarRating } from "../../components/BarberoCard";
import ImageUploader from "../../components/ImageUploader";
import CharacterCounter from "../../components/CharacterCounter";
import { parseApiErrorSync } from "../../utils/parseApiError";
import { PencilIcon, TrashIcon, UsersIcon } from "../../components/Icons";

function FilaBarberoSkeleton() {
  return (
    <div className="p-5 flex items-start gap-4">
      <div className="w-14 h-14 rounded-full bg-paper dark:bg-slate-800/50 shimmer shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-4 w-36 max-w-full rounded bg-paper dark:bg-slate-800/50 shimmer" />
        <div className="h-3 w-48 max-w-full rounded bg-paper dark:bg-slate-800/50 shimmer" />
        <div className="h-5 w-24 rounded bg-paper dark:bg-slate-800/50 shimmer" />
      </div>
    </div>
  );
}

// Botón de acción "ghost" — mismo lenguaje que el resto del backoffice
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

const FORM_VACIO = {
  nombre: "",
  email: "",
  horaInicio: "10:00",
  horaFin: "19:00",
  bio: "",
  especialidad: "",
  avatar_archivo: null,
};

export default function EquipoPage() {
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [confirmar, setConfirmar] = useState(null);

  const { data: barberos, cargando, refetch } = useApi("/mi-equipo");
  const { ejecutar, cargando: guardando, getLastError } = useApiMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editandoId) {
      // Edición usa FormData para soportar avatar
      const fd = new FormData();
      fd.append("name", form.nombre);
      fd.append("hora_inicio", form.horaInicio);
      fd.append("hora_fin", form.horaFin);
      fd.append("bio", form.bio || "");
      fd.append("especialidad", form.especialidad || "");
      if (form.avatar_archivo) fd.append("avatar", form.avatar_archivo);
      fd.append("_method", "PUT");

      const r = await ejecutar(`/barberos/${editandoId}`, { method: "POST", body: fd });
      if (r) {
        toast.success("Barbero actualizado");
        setForm(FORM_VACIO);
        setEditandoId(null);
        refetch();
      } else {
        toast.error(parseApiErrorSync(
          getLastError()?.body,
          "Error al guardar el barbero"
        ));
      }
    } else {
      // Crear/asignar usa JSON
      const r = await ejecutar("/barberos/asignar", {
        method: "POST",
        body: {
          email: form.email,
          name: form.nombre,
          hora_inicio: form.horaInicio,
          hora_fin: form.horaFin,
        },
      });

      if (r) {
        toast.success("Barbero asignado. Edítalo para agregar bio y foto.");
        setForm(FORM_VACIO);
        refetch();
      } else {
        // 🎯 Pack 2/D: el backend (AsignarRolRequest) devuelve mensajes
        // específicos: "No existe ningún usuario con este correo", validación
        // cross-field de horarios, etc.
        toast.error(parseApiErrorSync(
          getLastError()?.body,
          "Error al asignar el barbero"
        ));
      }
    }
  };

  const handleEditar = (b) => {
    setEditandoId(b.id);
    setForm({
      nombre: b.name,
      email: b.email,
      horaInicio: b.hora_inicio ? b.hora_inicio.substring(0,5) : "10:00",
      horaFin:    b.hora_fin    ? b.hora_fin.substring(0,5)    : "19:00",
      bio: b.bio || "",
      especialidad: b.especialidad || "",
      avatar_archivo: null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEliminar = async () => {
    if (!confirmar || guardando) return;
    const r = await ejecutar(`/barberos/${confirmar}`, { method: "DELETE" });
    if (r) {
      // Pack 1 (FIX #17): destroy devuelve citas_canceladas + detalle.
      const detalle = r?.detalle || "Barbero removido del equipo";
      toast.success(detalle);
      refetch();
    } else {
      toast.error(parseApiErrorSync(
        getLastError()?.body,
        "No se pudo remover el barbero"
      ));
    }
    setConfirmar(null);
  };

  const barberoEditando = editandoId ? (barberos || []).find(b => b.id === editandoId) : null;

  return (
    <div>
      <PageHeader tag="Equipo" titulo="Gestión de equipo"
                  subtitulo="Asigna barberos, define horarios, agrega fotos y biografías" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* FORMULARIO */}
        <div className={`lg:col-span-5 animate-fade-in-up bg-white dark:bg-card border rounded-xl p-6 h-fit shadow-none transition-colors duration-300 ${
          editandoId
            ? "border-emerald-500/50 dark:border-emerald-500/40 ring-2 ring-emerald-500/10"
            : "border-line dark:border-slate-800/60"
        }`}>
          <h3 className="font-display text-lg font-bold text-ink dark:text-white mb-6 flex items-center gap-2">
            {editandoId && <PencilIcon className="w-4 h-4 text-emerald-500" />}
            {editandoId ? "Editar barbero" : "Nuevo barbero"}
          </h3>

          {/* Avatar preview cuando editas */}
          {editandoId && barberoEditando && (
            <div className="flex justify-center mb-5">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-emerald-100 dark:border-emerald-500/20 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                {barberoEditando.avatar_url ? (
                  <img src={barberoEditando.avatar_url} alt={barberoEditando.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-emerald-500 text-white font-bold text-2xl">
                    {barberoEditando.name?.substring(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {editandoId && (
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider block">Nombre</label>
                  <CharacterCounter actual={form.nombre.length} max={80} />
                </div>
                <input type="text" value={form.nombre}
                       onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                       className="w-full bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800 rounded-xl p-3 text-sm text-ink dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                       required
                       maxLength={80}
                       minLength={2} />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">Correo</label>
              <input type="email" value={form.email}
                     onChange={(e) => setForm({ ...form, email: e.target.value })}
                     disabled={editandoId !== null}
                     className={`w-full bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800 rounded-xl p-3 text-sm text-ink dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all ${editandoId ? "opacity-50 cursor-not-allowed" : ""}`}
                     required
                     maxLength={120} />
              {!editandoId && (
                <p className="text-[11px] text-muted mt-1.5">
                  El usuario debe estar registrado previamente.
                </p>
              )}
            </div>

            {/* 🎨 FASE 4A: campos avanzados solo al editar */}
            {editandoId && (
              <>
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <label className="text-xs font-semibold text-muted uppercase tracking-wider block">Especialidad</label>
                    <CharacterCounter actual={form.especialidad.length} max={100} />
                  </div>
                  <input type="text" value={form.especialidad}
                         onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
                         placeholder="Ej: Cortes clásicos · Fade · Barba"
                         maxLength={100}
                         className="w-full bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800 rounded-xl p-3 text-sm text-ink dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <label className="text-xs font-semibold text-muted uppercase tracking-wider block">Biografía</label>
                    {/* 🎯 Pack 2/D: reemplaza contador manual sin colores
                        por CharacterCounter (amarillo 80%, rojo 100%). */}
                    <CharacterCounter actual={form.bio.length} max={500} />
                  </div>
                  <textarea value={form.bio}
                            onChange={(e) => setForm({ ...form, bio: e.target.value })}
                            placeholder="Cuéntale a tus clientes sobre este barbero..."
                            maxLength={500}
                            className="w-full bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800 rounded-xl p-3 text-sm text-ink dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all h-24 resize-none" />
                </div>

                <ImageUploader
                  label="Foto del barbero"
                  shape="circle"
                  previewActual={barberoEditando?.avatar_url || null}
                  onChange={(file) => setForm({ ...form, avatar_archivo: file })}
                />
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">Entrada</label>
                <input type="time" value={form.horaInicio}
                       onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                       className="w-full bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800 rounded-xl p-3 text-sm text-ink dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                       required />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">Salida</label>
                <input type="time" value={form.horaFin}
                       onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
                       className="w-full bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800 rounded-xl p-3 text-sm text-ink dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                       required />
              </div>
            </div>

            <button type="submit" disabled={guardando}
                    className="w-full bg-slate-900 dark:bg-emerald-500 hover:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-abyss font-bold py-3 rounded-xl transition-all active:scale-[0.98] shadow-none hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:shadow-emerald-500/20 disabled:opacity-50">
              {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Asignar rol"}
            </button>

            {editandoId && (
              <button type="button"
                      onClick={() => { setEditandoId(null); setForm(FORM_VACIO); }}
                      className="w-full text-muted text-xs hover:text-ink-2 dark:hover:text-slate-300">
                Cancelar edición
              </button>
            )}
          </form>
        </div>

        {/* LISTA */}
        <div className="lg:col-span-7 animate-fade-in-up delay-100 bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl shadow-none overflow-hidden h-fit">
          {cargando ? (
            <div className="divide-y divide-black/5 dark:divide-slate-800/40">
              {[...Array(3)].map((_, i) => <FilaBarberoSkeleton key={i} />)}
            </div>
          ) : (barberos || []).length === 0 ? (
            <div className="p-14 text-center animate-fade-in-up">
              <div className="w-14 h-14 mx-auto bg-paper dark:bg-night-2 rounded-xl flex items-center justify-center mb-5 border border-line dark:border-slate-800">
                <UsersIcon className="w-6 h-6 text-faint" />
              </div>
              <h4 className="font-display text-lg font-bold text-ink dark:text-white mb-1.5">
                Aún no tienes equipo
              </h4>
              <p className="text-sm text-muted max-w-xs mx-auto">
                Asigna tu primer barbero con el formulario. El usuario debe estar registrado antes.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-slate-800/40">
              {barberos.map((b, idx) => (
                <div key={b.id} className="group p-5 animate-fade-in-up hover:bg-paper dark:hover:bg-slate-800/20 transition-colors"
                     style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}>
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-line dark:border-slate-700 shrink-0">
                      {b.avatar_url ? (
                        <img src={b.avatar_url} alt={b.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-emerald-500 text-white font-bold text-lg">
                          {b.name.substring(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-ink dark:text-slate-200 font-bold truncate">{b.name}</p>
                      </div>
                      <p className="text-xs text-muted truncate">{b.email}</p>

                      {b.especialidad && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wider mt-1">
                          {b.especialidad}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-3 flex-wrap">
                        <div className="inline-flex px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-bold tabular">
                          {b.hora_inicio ? b.hora_inicio.substring(0,5) : "10:00"} – {b.hora_fin ? b.hora_fin.substring(0,5) : "19:00"}
                        </div>
                        <StarRating valor={b.promedio_calificacion} total={b.total_resenas} size="xs" />
                      </div>

                      {b.bio && (
                        <p className="text-xs text-muted leading-relaxed mt-2 line-clamp-2">
                          {b.bio}
                        </p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex flex-col gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                      <BotonAccion onClick={() => handleEditar(b)} titulo={`Editar a ${b.name}`}>
                        <PencilIcon className="w-4 h-4" />
                      </BotonAccion>
                      <BotonAccion onClick={() => setConfirmar(b.id)} titulo={`Remover a ${b.name}`} variante="danger">
                        <TrashIcon className="w-4 h-4" />
                      </BotonAccion>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        abierto={confirmar !== null}
        cargando={guardando}
        titulo="Remover barbero"
        mensaje="¿Seguro que deseas remover a este barbero? Sus citas pasadas se mantienen pero ya no recibirá nuevas."
        textoConfirmar="Sí, remover"
        variante="danger"
        onConfirmar={handleEliminar}
        onCancelar={() => setConfirmar(null)}
      />
    </div>
  );
}
