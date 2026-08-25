import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import useApiMutation from "../hooks/useApiMutation";
import ImageUploader from "./ImageUploader";
import CharacterCounter from "./CharacterCounter";
import { parseApiErrorSync } from "../utils/parseApiError";

// ============================================================
// ✏️ EDITAR BARBERÍA MODAL — Pack 3
// ============================================================
// Modal para que el superadmin edite nombre, color y logo
// de una barbería existente.
// Consume: POST /barberias/{id} con _method=PUT (multipart).
// ============================================================

export default function EditarBarberiaModal({ barberia, onClose, onGuardado }) {
  const { ejecutar, cargando: guardando, getLastError } = useApiMutation();

  const [form, setForm] = useState({
    nombre:          "",
    color_principal: "#10b981",
    logo_archivo:    null,
  });

  // Hidratar el form con los datos actuales de la barbería.
  useEffect(() => {
    if (barberia) {
      setForm({
        nombre:          barberia.nombre          || "",
        color_principal: barberia.color_principal || "#10b981",
        logo_archivo:    null,
      });
    }
  }, [barberia]);

  if (!barberia) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const fd = new FormData();
    fd.append("_method",          "PUT");
    fd.append("nombre",           form.nombre);
    fd.append("color_principal",  form.color_principal);
    if (form.logo_archivo) {
      fd.append("logo", form.logo_archivo);
    }

    const r = await ejecutar(`/barberias/${barberia.id}`, {
      method: "POST",
      body:   fd,
    });

    if (r) {
      toast.success("Barbería actualizada correctamente");
      onGuardado(); // refetch en SuperAdminPage
      onClose();
    } else {
      toast.error(parseApiErrorSync(
        getLastError()?.body,
        "Error al guardar los cambios"
      ));
    }
  };

  const inputClass = "w-full bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-xl p-3 text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10 transition-all";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 dark:bg-[#03070e]/80 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#111111] dark:text-white">
            Editar barbería
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#A8A29E] hover:text-[#2F3437] hover:bg-[#F7F6F3] dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Logo */}
          <ImageUploader
            label="Logo (opcional)"
            shape="square"
            previewActual={barberia.logo_url || null}
            onChange={(file) => setForm(prev => ({ ...prev, logo_archivo: file }))}
          />

          {/* Nombre */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-xs font-semibold text-[#787774] uppercase tracking-wider">
                Nombre comercial
              </label>
              <CharacterCounter actual={form.nombre.length} max={60} />
            </div>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm(prev => ({ ...prev, nombre: e.target.value }))}
              className={inputClass}
              required
              minLength={3}
              maxLength={60}
              placeholder="Nombre de la barbería"
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-semibold text-[#787774] uppercase tracking-wider block mb-2">
              Color de marca
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color_principal}
                onChange={(e) => setForm(prev => ({ ...prev, color_principal: e.target.value }))}
                className="w-10 h-10 rounded-lg border border-[#EAEAEA] dark:border-slate-700 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={form.color_principal}
                onChange={(e) => setForm(prev => ({ ...prev, color_principal: e.target.value }))}
                className={`${inputClass} font-mono`}
                placeholder="#10b981"
                maxLength={20}
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-[#2F3437] dark:text-slate-400 hover:bg-[#F7F6F3] dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2.5 font-bold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-2"
            >
              {guardando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              ) : "Guardar cambios"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
