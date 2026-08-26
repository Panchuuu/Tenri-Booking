import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import useApiMutation from "../hooks/useApiMutation";
import ImageUploader from "./ImageUploader";
import CharacterCounter from "./CharacterCounter";
import { parseApiErrorSync } from "../utils/parseApiError";
import { XIcon } from "./Icons";

// ============================================================
// ✏️ EDITAR BARBERÍA MODAL — Rediseño Master
// ============================================================
// Modal para que el superadmin edite nombre, color y logo
// de una barbería existente.
// Consume: POST /barberias/{id} con _method=PUT (multipart).
// Entrada/salida animadas: sigue montado 200ms tras cerrar
// (snapshot de la barbería) para pintar el scale-out.
// ============================================================

export default function EditarBarberiaModal({ barberia, onClose, onGuardado }) {
  const { ejecutar, cargando: guardando, getLastError } = useApiMutation();

  const [form, setForm] = useState({
    nombre:          "",
    color_principal: "#10b981",
    logo_archivo:    null,
  });

  // Montaje diferido para la animación de salida
  const [montado, setMontado] = useState(false);
  const [snap, setSnap] = useState(null); // última barbería no-nula

  useEffect(() => {
    if (barberia) {
      setSnap(barberia);
      setMontado(true);
      // Hidratar el form con los datos actuales de la barbería.
      setForm({
        nombre:          barberia.nombre          || "",
        color_principal: barberia.color_principal || "#10b981",
        logo_archivo:    null,
      });
      return;
    }
    if (!montado) return;
    const t = setTimeout(() => { setMontado(false); setSnap(null); }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barberia]);

  if (!montado || !snap) return null;

  const cerrandose = !barberia;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const fd = new FormData();
    fd.append("_method",          "PUT");
    fd.append("nombre",           form.nombre);
    fd.append("color_principal",  form.color_principal);
    if (form.logo_archivo) {
      fd.append("logo", form.logo_archivo);
    }

    const r = await ejecutar(`/barberias/${snap.id}`, {
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

  const cerrar = () => { if (!guardando && !cerrandose) onClose(); };

  const inputClass = "w-full bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800 rounded-xl p-3 text-sm text-ink dark:text-slate-200 outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15 transition-all";

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 dark:bg-abyss/80 backdrop-blur-sm p-4 ${cerrandose ? "animate-fade-out" : "animate-fade-in"}`}
      onClick={cerrar}
    >
      <div
        className={`bg-white dark:bg-card border border-line dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl ${cerrandose ? "animate-scale-out" : "animate-scale-in"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con preview de marca en vivo */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-base border border-black/5 dark:border-white/10 transition-colors duration-300 shrink-0"
              style={{ backgroundColor: form.color_principal || "#10b981" }}
            >
              {(form.nombre || "T").substring(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-amber-600 dark:text-amber-500">
                Editar negocio
              </span>
              <h3 className="text-lg font-bold text-ink dark:text-white leading-tight truncate">
                {snap.nombre}
              </h3>
            </div>
          </div>
          <button
            onClick={cerrar}
            disabled={guardando}
            aria-label="Cerrar"
            className="p-2 rounded-full text-faint hover:text-ink-2 hover:bg-paper dark:hover:text-rose-400 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Logo */}
          <ImageUploader
            label="Logo (opcional)"
            shape="square"
            previewActual={snap.logo_url || null}
            onChange={(file) => setForm(prev => ({ ...prev, logo_archivo: file }))}
          />

          {/* Nombre */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">
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
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">
              Color de marca
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color_principal}
                onChange={(e) => setForm(prev => ({ ...prev, color_principal: e.target.value }))}
                className="w-10 h-10 rounded-lg border border-line dark:border-slate-700 cursor-pointer bg-transparent shrink-0"
              />
              <input
                type="text"
                value={form.color_principal}
                onChange={(e) => setForm(prev => ({ ...prev, color_principal: e.target.value }))}
                className={`${inputClass} font-mono uppercase`}
                placeholder="#10b981"
                maxLength={20}
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={cerrar}
              disabled={guardando}
              className="px-5 py-2.5 text-sm font-semibold text-ink-2 dark:text-slate-400 hover:bg-paper dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2.5 font-bold rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-white dark:text-abyss transition-all active:scale-[0.97] flex items-center gap-2"
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
