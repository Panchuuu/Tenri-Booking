import React, { useState } from "react";
import toast from "react-hot-toast";
import useApi from "../../hooks/useApi";
import useApiMutation from "../../hooks/useApiMutation";
import PageHeader from "../../components/PageHeader";
import ConfirmModal from "../../components/ConfirmModal";
import CharacterCounter from "../../components/CharacterCounter";
import NumberInputClamped from "../../components/NumberInputClamped";
import ImageUploader from "../../components/ImageUploader";
import { parseApiErrorSync } from "../../utils/parseApiError";

const FORM_VACIO = {
  nombre: "", precio: "", duracion: "", descripcion: "",
  imagen_archivo: null,
  imagen_url: null, // 🔧 Deuda G: preview al editar servicio con imagen
};

export default function ServiciosPage() {
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [confirmar, setConfirmar] = useState(null);

  const { data: servicios, cargando, refetch } = useApi("/mis-servicios");
  const { ejecutar, cargando: guardando, getLastError } = useApiMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("nombre", form.nombre);
    fd.append("precio", form.precio);
    fd.append("duracion", form.duracion);
    fd.append("descripcion", form.descripcion || "");
    if (form.imagen_archivo) fd.append("imagen", form.imagen_archivo);
    if (editandoId) fd.append("_method", "PUT");

    const endpoint = editandoId ? `/servicios/${editandoId}` : "/servicios";
    const r = await ejecutar(endpoint, { method: "POST", body: fd });

    if (r) {
      toast.success(editandoId ? "Servicio actualizado" : "Servicio creado");
      setForm(FORM_VACIO);
      setEditandoId(null);
      refetch();
    } else {
      // 🎯 Pack 2/D: mensaje real del backend (ej: "La duración mínima
      // es de 5 minutos", "El nombre no puede superar los 80 caracteres").
      toast.error(parseApiErrorSync(
        getLastError()?.body,
        "Error al guardar el servicio"
      ));
    }
  };

  const handleEditar = (s) => {
    setEditandoId(s.id);
    setForm({
      nombre: s.nombre || "",
      // 🎯 Pack 2/D: normalizamos a number para NumberInputClamped.
      // Number("") = 0 (no deseado), por eso uso conditional explícito.
      precio:   s.precio   != null && s.precio   !== "" ? Number(s.precio)   : "",
      duracion: (s.duracion || s.duracion_minutos) != null && (s.duracion || s.duracion_minutos) !== ""
                  ? Number(s.duracion || s.duracion_minutos)
                  : "",
      descripcion: s.descripcion || "",
      imagen_archivo: null,
      imagen_url: s.imagen_url || null, // 🔧 Deuda G: hidrata preview
    });
    // Scroll suave hacia el form en mobile
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEliminar = async () => {
    if (!confirmar) return;
    const r = await ejecutar(`/servicios/${confirmar}`, { method: "DELETE" });
    if (r) {
      toast.success("Servicio eliminado");
      refetch();
    } else {
      toast.error(parseApiErrorSync(
        getLastError()?.body,
        "No se pudo eliminar el servicio"
      ));
    }
    setConfirmar(null);
  };

  return (
    <div>
      <PageHeader
        tag="Catálogo"
        titulo="Servicios"
        subtitulo="Gestiona los servicios que ofrece tu barbería"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* FORMULARIO */}
        <div className="lg:col-span-4 bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl p-6 h-fit shadow-none">
          <h3 className="font-display text-lg font-bold text-[#111111] dark:text-white mb-6">
            {editandoId ? "Editar servicio" : "Nuevo servicio"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 🔧 FIX #11 (PDF): maxLength + contador visual en nombre */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-xs font-semibold text-[#787774] uppercase tracking-wider block">Nombre</label>
                <CharacterCounter actual={form.nombre.length} max={80} />
              </div>
              <input
                type="text" value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-xl p-3 text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                required
                placeholder="Ej: Corte degradado"
                maxLength={80}
                minLength={2}
              />
            </div>

            {/* 🔧 FIX #6 (PDF): NumberInputClamped previene overflow.
                Backend B.2: precio integer min:1 max:9999999, duracion integer min:5 max:480. */}
            <div className="grid grid-cols-2 gap-3">
              <NumberInputClamped
                label="Precio"
                value={form.precio}
                onChange={(v) => setForm({ ...form, precio: v })}
                min={1}
                max={9999999}
                step={1}
                placeholder="15000"
                suffix="$"
                required
              />
              <NumberInputClamped
                label="Duración"
                value={form.duracion}
                onChange={(v) => setForm({ ...form, duracion: v })}
                min={5}
                max={480}
                step={5}
                placeholder="30"
                suffix="min"
                required
              />
            </div>

            {/* 🔧 FIX #11 (PDF): maxLength + contador en descripción */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-xs font-semibold text-[#787774] uppercase tracking-wider block">Descripción</label>
                <CharacterCounter actual={form.descripcion.length} max={300} />
              </div>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                className="w-full bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-xl p-3 text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all h-24 resize-none"
                placeholder="Corte de cabello a tijera o máquina..."
                maxLength={300}
              />
            </div>

            {/* 🔧 FIX #7 (Pack 1 patrón) + #11: ImageUploader con validación MIME/peso + preview */}
            <ImageUploader
              label="Foto (opcional)"
              shape="square"
              previewActual={form.imagen_url}
              onChange={(file) => setForm({ ...form, imagen_archivo: file })}
            />

            <button
              type="submit" disabled={guardando}
              className="w-full bg-slate-900 dark:bg-emerald-500 hover:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-[#03070e] font-bold py-3 rounded-xl transition-all shadow-none hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:shadow-emerald-500/20 disabled:opacity-50 disabled:hover:bg-slate-900 dark:disabled:hover:bg-emerald-500"
            >
              {guardando ? "Guardando..." : editandoId ? "Actualizar servicio" : "Crear servicio"}
            </button>
            {editandoId && (
              <button
                type="button"
                onClick={() => { setEditandoId(null); setForm(FORM_VACIO); }}
                className="w-full text-[#787774] text-xs hover:text-[#2F3437] dark:hover:text-slate-300"
              >
                Cancelar edición
              </button>
            )}
          </form>
        </div>

        {/* LISTA */}
        <div className="lg:col-span-8 bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl shadow-none overflow-hidden">
          {cargando ? (
            <div className="p-12 flex justify-center">
              <div className="w-8 h-8 border-4 border-[#EAEAEA] border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : (servicios || []).length === 0 ? (
            <div className="p-12 text-center text-[#787774]">
              Aún no tienes servicios. Crea el primero con el formulario.
            </div>
          ) : (
            <>
              {/* 💻 DESKTOP */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#FBFBFA] dark:bg-[#080d18] border-b border-[#EAEAEA] dark:border-slate-800/60 text-[#787774] font-semibold uppercase text-[10px] tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Servicio</th>
                      <th className="px-6 py-4">Duración</th>
                      <th className="px-6 py-4">Precio</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-slate-800/40">
                    {servicios.map((s) => (
                      <tr key={s.id} className="hover:bg-[#F7F6F3] dark:hover:bg-slate-800/20">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {s.imagen_url ? (
                              <img src={s.imagen_url} alt={s.nombre}
                                   className="w-10 h-10 rounded-lg object-cover border border-[#EAEAEA] dark:border-slate-700/50" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-[#F7F6F3] dark:bg-slate-800/50 flex items-center justify-center text-[#A8A29E]">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            <span className="text-[#111111] dark:text-slate-200 font-bold">{s.nombre}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[#787774] tabular">{s.duracion || s.duracion_minutos} min</td>
                        <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-mono font-bold tabular">
                          ${Number(s.precio).toLocaleString("es-CL")}
                        </td>
                        <td className="px-6 py-4 text-right space-x-4">
                          <button onClick={() => handleEditar(s)} className="text-cyan-600 dark:text-cyan-500 text-xs font-bold uppercase tracking-wider hover:underline">
                            Editar
                          </button>
                          <button onClick={() => setConfirmar(s.id)} className="text-rose-600 dark:text-rose-500 text-xs font-bold uppercase tracking-wider hover:underline">
                            Borrar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 📱 MOBILE */}
              <div className="md:hidden divide-y divide-black/5 dark:divide-slate-800/40">
                {servicios.map((s) => (
                  <div key={s.id} className="p-4 flex items-start gap-4">
                    {s.imagen_url ? (
                      <img src={s.imagen_url} alt={s.nombre}
                           className="w-16 h-16 rounded-xl object-cover border border-[#EAEAEA] dark:border-slate-700/50 shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-[#F7F6F3] dark:bg-slate-800/50 flex items-center justify-center text-[#A8A29E] shrink-0">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-[#111111] dark:text-slate-200 truncate">{s.nombre}</h4>
                      <div className="flex items-center gap-3 mt-1 mb-3 text-sm">
                        <span className="text-[#787774] tabular">{s.duracion || s.duracion_minutos} min</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold tabular">
                          ${Number(s.precio).toLocaleString("es-CL")}
                        </span>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={() => handleEditar(s)} className="text-cyan-600 dark:text-cyan-500 text-xs font-bold uppercase tracking-wider">
                          Editar
                        </button>
                        <button onClick={() => setConfirmar(s.id)} className="text-rose-600 dark:text-rose-500 text-xs font-bold uppercase tracking-wider">
                          Borrar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        abierto={confirmar !== null}
        titulo="Eliminar servicio"
        mensaje="¿Seguro que deseas eliminar este servicio del catálogo? Esta acción no se puede deshacer."
        textoConfirmar="Sí, eliminar"
        variante="danger"
        onConfirmar={handleEliminar}
        onCancelar={() => setConfirmar(null)}
      />
    </div>
  );
}
