import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import useApi from "../../hooks/useApi";
import useApiMutation from "../../hooks/useApiMutation";
import PageHeader from "../../components/PageHeader";
import ImageUploader from "../../components/ImageUploader";
import CharacterCounter from "../../components/CharacterCounter";
import { parseApiErrorSync } from "../../utils/parseApiError";
import DireccionAutocomplete from "../../components/DireccionAutocomplete";

// ============================================================
// 🏪 ADMIN / MI TIENDA
// ============================================================
// Perfil público de la tienda: nombre, rubro, logo, color de
// marca y ubicación física (dirección + coordenadas para el
// "Cerca de mí" del directorio).
//
// Consume: PUT /mi-barberia (POST + _method=PUT si hay logo).
// El slug NO cambia al renombrar: es la URL pública.
// ============================================================

export default function MiTiendaPage() {
  const { data: barberia, refetch } = useApi("/mi-barberia");
  const { data: rubros } = useApi("/rubros");
  const { ejecutar, cargando: guardando, getLastError } = useApiMutation();

  const [form, setForm] = useState({
    nombre: "",
    rubro: "barberia",
    color_principal: "#10b981",
    direccion: "",
    latitud: "",
    longitud: "",
    logo_archivo: null,
  });
  useEffect(() => {
    if (barberia) {
      setForm((prev) => ({
        ...prev,
        nombre:          barberia.nombre || "",
        rubro:           barberia.rubro || "barberia",
        color_principal: barberia.color_principal || "#10b981",
        direccion:       barberia.direccion || "",
        latitud:         barberia.latitud != null ? String(barberia.latitud) : "",
        longitud:        barberia.longitud != null ? String(barberia.longitud) : "",
      }));
    }
  }, [barberia]);

  const setCampo = (campo) => (e) =>
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));

  const latNum = parseFloat(form.latitud);
  const lngNum = parseFloat(form.longitud);
  const tieneCoordenadas = Number.isFinite(latNum) && Number.isFinite(lngNum);

  const handleGuardar = async (e) => {
    e.preventDefault();

    // FormData siempre (con o sin logo): POST + _method=PUT, mismo
    // patrón multipart que barberos y servicios.
    const fd = new FormData();
    fd.append("_method", "PUT");
    fd.append("nombre", form.nombre);
    fd.append("rubro", form.rubro);
    fd.append("color_principal", form.color_principal);
    fd.append("direccion", form.direccion);
    fd.append("latitud", form.latitud);
    fd.append("longitud", form.longitud);
    if (form.logo_archivo) fd.append("logo", form.logo_archivo);

    const r = await ejecutar("/mi-barberia", { method: "POST", body: fd });

    if (r) {
      toast.success("Perfil de la tienda actualizado");
      refetch();
    } else {
      toast.error(parseApiErrorSync(getLastError()?.body, "Error al guardar el perfil de la tienda"));
    }
  };

  const inputClass = "w-full bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800 rounded-xl p-3 text-sm text-ink dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all";
  const labelClass = "text-[10px] font-bold text-muted uppercase tracking-widest block mb-2";

  return (
    <div>
      <PageHeader
        titulo="Mi Tienda"
        subtitulo="El perfil público que ven tus clientes en el directorio"
      />

      <form onSubmit={handleGuardar} className="bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl p-8 max-w-3xl shadow-none space-y-8">

        {/* ── Identidad ── */}
        <div>
          <h3 className="text-xl font-bold text-ink dark:text-white mb-6">Identidad</h3>

          <div className="flex flex-col sm:flex-row gap-8 items-start">
            <ImageUploader
              label="Logo"
              previewActual={barberia?.logo_url || null}
              onChange={(file) => setForm((prev) => ({ ...prev, logo_archivo: file }))}
            />

            <div className="flex-1 w-full space-y-4">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label className={`${labelClass} mb-0`}>Nombre de la tienda</label>
                  <CharacterCounter actual={form.nombre.length} max={60} />
                </div>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={setCampo("nombre")}
                  className={inputClass}
                  required
                  minLength={3}
                  maxLength={60}
                  placeholder="Ej: Tenri Barber"
                />
                <p className="text-[11px] text-faint mt-1.5">
                  La URL pública ({barberia?.slug ? `/barberia/${barberia.slug}` : "…"}) no cambia al renombrar.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Rubro</label>
                  <select
                    value={form.rubro}
                    onChange={setCampo("rubro")}
                    className={`${inputClass} cursor-pointer`}
                  >
                    {(rubros || [{ clave: "barberia", etiqueta: "Barbería" }]).map((r) => (
                      <option key={r.clave} value={r.clave}>{r.etiqueta}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Color de marca</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.color_principal}
                      onChange={setCampo("color_principal")}
                      className="w-12 h-11 rounded-lg border border-line dark:border-slate-800 bg-transparent cursor-pointer p-1"
                      aria-label="Color de marca"
                    />
                    <span className="text-sm font-mono text-muted">{form.color_principal}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Ubicación ── */}
        <div className="pt-8 border-t border-line dark:border-slate-800/60">
          <h3 className="text-xl font-bold text-ink dark:text-white mb-2">Ubicación del Local</h3>
          <p className="text-muted text-sm mb-6">
            Escribe la dirección y <strong>elige una de las sugerencias</strong>: eso fija
            las coordenadas exactas para el "Cerca de mí" del directorio. Verifica el
            punto en el mapa antes de guardar.
          </p>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>Dirección</label>
              <DireccionAutocomplete
                valor={form.direccion}
                onChange={(texto) => setForm((prev) => ({ ...prev, direccion: texto }))}
                onSeleccion={(s) =>
                  setForm((prev) => ({
                    ...prev,
                    direccion: s.direccion,
                    latitud:  String(s.latitud),
                    longitud: String(s.longitud),
                  }))
                }
                className={inputClass}
              />
            </div>

            {/* Mapa de verificación del punto exacto */}
            {tieneCoordenadas && (
              <div className="rounded-xl overflow-hidden border border-line dark:border-slate-800">
                <iframe
                  title="Ubicación de la tienda"
                  className="w-full h-56 block"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${latNum},${lngNum}&z=16&hl=es&output=embed`}
                />
                <div className="flex items-center justify-between px-3 py-2 bg-paper-2 dark:bg-night-2 text-[11px] text-faint">
                  <span>Verifica que el pin esté sobre tu local.</span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${latNum},${lngNum}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Abrir en Maps
                  </a>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <label className={labelClass}>Latitud</label>
                <input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  value={form.latitud}
                  onChange={setCampo("latitud")}
                  placeholder="-33.4489"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Longitud</label>
                <input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  value={form.longitud}
                  onChange={setCampo("longitud")}
                  placeholder="-70.6693"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Guardar ── */}
        <div className="pt-4 border-t border-line dark:border-slate-800/60">
          <button
            type="submit"
            disabled={guardando}
            className="w-full md:w-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white dark:text-abyss font-bold rounded-lg transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.04)] disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar Perfil"}
          </button>
        </div>
      </form>
    </div>
  );
}
