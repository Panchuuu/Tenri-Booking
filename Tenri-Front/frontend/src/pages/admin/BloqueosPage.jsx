import React, { useState } from "react";
import toast from "react-hot-toast";
import useApi from "../../hooks/useApi";
import useApiMutation from "../../hooks/useApiMutation";
import { parseApiErrorSync } from "../../utils/parseApiError";
import PageHeader from "../../components/PageHeader";
import ConfirmModal from "../../components/ConfirmModal";

const FORM_VACIO = {
  barbero_id: "",
  fecha_inicio: "",
  fecha_fin: "",
  motivo: "vacaciones",
  descripcion: "",
};

const MOTIVO_EMOJI = {
  vacaciones: "🌴",
  dia_libre: "🏠",
  permiso: "📋",
  otro: "📌",
};

const MOTIVO_LABEL = {
  vacaciones: "Vacaciones",
  dia_libre: "Día libre",
  permiso: "Permiso",
  otro: "Otro",
};

export default function BloqueosPage() {
  const [form, setForm] = useState(FORM_VACIO);
  const [confirmar, setConfirmar] = useState(null);

  const { data: bloqueos, cargando, refetch } = useApi("/bloqueos");
  const { data: barberos } = useApi("/mi-equipo");
  const { ejecutar, cargando: guardando, getLastError } = useApiMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const r = await ejecutar("/bloqueos", {
      method: "POST",
      body: form,
    });

    if (r) {
      toast.success("Bloqueo creado con éxito");
      setForm(FORM_VACIO);
      refetch();
    } else {
      toast.error(parseApiErrorSync(getLastError()?.body, "Error al crear el bloqueo"));
    }
  };

  const handleEliminar = async () => {
    if (!confirmar) return;
    const r = await ejecutar(`/bloqueos/${confirmar}`, { method: "DELETE" });
    if (r) { toast.success("Bloqueo eliminado"); refetch(); }
    else toast.error(parseApiErrorSync(getLastError()?.body, "No se pudo eliminar el bloqueo"));
    setConfirmar(null);
  };

  // Separar en activos/futuros vs pasados
  const hoy = new Date().toLocaleDateString("sv-SE");
  const activos  = (bloqueos || []).filter(b => b.fecha_fin >= hoy);
  const pasados  = (bloqueos || []).filter(b => b.fecha_fin <  hoy);

  return (
    <div>
      <PageHeader
        tag="Disponibilidad"
        titulo="Bloqueos de horario"
        subtitulo="Define vacaciones, días libres y permisos para tus barberos"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* FORMULARIO */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl p-6 h-fit shadow-none">
          <h3 className="font-display text-lg font-bold text-[#111111] dark:text-white mb-6">
            Nuevo bloqueo
          </h3>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-[#787774] uppercase tracking-wider mb-2 block">Barbero</label>
              <select value={form.barbero_id}
                      onChange={(e) => setForm({ ...form, barbero_id: e.target.value })}
                      required
                      className="w-full bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-xl p-3 text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all">
                <option value="">Selecciona un barbero</option>
                {(barberos || []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#787774] uppercase tracking-wider mb-2 block">Motivo</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(MOTIVO_LABEL).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setForm({ ...form, motivo: id })}
                    className={`p-3 rounded-xl border text-sm font-semibold transition-all flex items-center gap-2 ${
                      form.motivo === id
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.1)]"
                        : "border-[#EAEAEA] dark:border-slate-700/50 bg-[#FBFBFA] dark:bg-[#03070e] text-[#2F3437] dark:text-slate-400 hover:border-[#EAEAEA]"
                    }`}
                  >
                    <span className="text-lg">{MOTIVO_EMOJI[id]}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#787774] uppercase tracking-wider mb-2 block">Desde</label>
                <input type="date" value={form.fecha_inicio}
                       onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value, fecha_fin: form.fecha_fin || e.target.value })}
                       required
                       className="w-full bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-xl p-3 text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all dark:[color-scheme:dark]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#787774] uppercase tracking-wider mb-2 block">Hasta</label>
                <input type="date" value={form.fecha_fin}
                       min={form.fecha_inicio}
                       onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
                       required
                       className="w-full bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-xl p-3 text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all dark:[color-scheme:dark]" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#787774] uppercase tracking-wider mb-2 block">
                Descripción <span className="text-[#A8A29E] normal-case">(opcional)</span>
              </label>
              <input type="text" value={form.descripcion}
                     onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                     placeholder="Ej: Viaje a la playa"
                     maxLength={200}
                     className="w-full bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-xl p-3 text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" />
            </div>

            <button type="submit" disabled={guardando}
                    className="w-full bg-slate-900 dark:bg-emerald-500 hover:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-[#03070e] font-bold py-3 rounded-xl transition-all shadow-none hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:shadow-emerald-500/20 disabled:opacity-50">
              {guardando ? "Creando..." : "Crear bloqueo"}
            </button>
          </form>
        </div>

        {/* LISTA */}
        <div className="lg:col-span-7 space-y-6">

          {/* ACTIVOS / FUTUROS */}
          <div className="bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl shadow-none overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EAEAEA] dark:border-slate-800/60">
              <h3 className="font-display text-base font-bold text-[#111111] dark:text-white">
                Activos y futuros ({activos.length})
              </h3>
            </div>

            {cargando ? (
              <div className="p-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-[#EAEAEA] border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : activos.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#787774]">
                No hay bloqueos activos. Tu equipo está 100% disponible.
              </div>
            ) : (
              <div className="divide-y divide-black/5 dark:divide-slate-800/40">
                {activos.map((b) => (
                  <div key={b.id} className="p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-2xl">{MOTIVO_EMOJI[b.motivo] || "📌"}</span>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap mb-1">
                          <p className="font-bold text-[#111111] dark:text-white">{b.barbero?.name}</p>
                          <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
                            {MOTIVO_LABEL[b.motivo]}
                          </span>
                        </div>
                        <p className="text-sm text-[#2F3437] dark:text-slate-400 tabular">
                          {b.fecha_inicio === b.fecha_fin
                            ? <>📅 {b.fecha_inicio}</>
                            : <>📅 {b.fecha_inicio} → {b.fecha_fin}</>}
                        </p>
                        {b.descripcion && (
                          <p className="text-xs text-[#787774] mt-1 italic">"{b.descripcion}"</p>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setConfirmar(b.id)}
                            className="text-rose-600 dark:text-rose-500 text-[10px] font-bold uppercase tracking-wider hover:underline shrink-0">
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PASADOS — colapsable */}
          {pasados.length > 0 && (
            <details className="bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl shadow-none overflow-hidden">
              <summary className="px-5 py-4 cursor-pointer hover:bg-[#F7F6F3] dark:hover:bg-slate-800/20 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-bold text-[#111111] dark:text-white">
                    Historial ({pasados.length})
                  </h3>
                  <p className="text-xs text-[#787774]">Bloqueos pasados</p>
                </div>
                <svg className="w-5 h-5 text-[#A8A29E]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="border-t border-[#EAEAEA] dark:border-slate-800/60 divide-y divide-black/5 dark:divide-slate-800/40">
                {pasados.map((b) => (
                  <div key={b.id} className="p-4 flex items-center justify-between gap-3 opacity-60">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg">{MOTIVO_EMOJI[b.motivo] || "📌"}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#2F3437] dark:text-slate-300 truncate">
                          {b.barbero?.name} — {MOTIVO_LABEL[b.motivo]}
                        </p>
                        <p className="text-xs text-[#787774] tabular">{b.fecha_inicio} → {b.fecha_fin}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      <ConfirmModal
        abierto={confirmar !== null}
        cargando={guardando}
        titulo="Eliminar bloqueo"
        mensaje="¿Seguro que deseas eliminar este bloqueo? El barbero volverá a estar disponible en esas fechas."
        textoConfirmar="Sí, eliminar"
        variante="danger"
        onConfirmar={handleEliminar}
        onCancelar={() => setConfirmar(null)}
      />
    </div>
  );
}
