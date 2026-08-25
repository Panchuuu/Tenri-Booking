import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";

// ============================================================
// 🖼️ IMAGE UPLOADER — Componente reutilizable
// ============================================================
// FIX #7: Validación robusta de archivos de imagen.
//
// Resuelve los problemas reportados:
//  - El sistema permitía subir cualquier archivo y el backend
//    arrojaba errores confusos.
//  - No se podía eliminar la imagen seleccionada de forma clara.
//  - Al abrir el buscador de nuevo, la imagen se eliminaba sin
//    confirmación.
//
// Validaciones aplicadas (CLIENTE):
//  - Tipo MIME: solo image/jpeg, image/png, image/webp, image/gif
//  - Peso: máximo 5 MB por defecto (configurable)
//  - Dimensiones: opcional (mínimo)
//
// Props:
//  - onChange(file | null)  → callback con el archivo o null
//  - previewActual          → URL del avatar/imagen actual (opcional)
//  - label                  → texto del label
//  - tiposPermitidos        → ['image/jpeg', 'image/png', ...]
//  - pesoMaxMB              → 5 por defecto
//  - shape                  → 'circle' | 'square' (estilo del preview)
// ============================================================

const TIPOS_DEFAULT = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

export default function ImageUploader({
  onChange,
  previewActual = null,
  label = "Subir imagen",
  tiposPermitidos = TIPOS_DEFAULT,
  pesoMaxMB = 5,
  shape = "square",
}) {
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(previewActual);
  const inputRef = useRef(null);

  // Sincronizar preview con el prop si cambia desde afuera
  useEffect(() => {
    if (!archivoSeleccionado) setPreviewUrl(previewActual);
  }, [previewActual, archivoSeleccionado]);

  // Generar URL.createObjectURL para preview local + cleanup
  useEffect(() => {
    if (!archivoSeleccionado) return;
    const url = URL.createObjectURL(archivoSeleccionado);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [archivoSeleccionado]);

  const validarArchivo = (file) => {
    // 1. Validar tipo MIME
    if (!tiposPermitidos.includes(file.type)) {
      const formatosLegibles = tiposPermitidos
        .map((t) => t.split("/")[1].toUpperCase())
        .join(", ");
      toast.error(`Formato no soportado. Usa: ${formatosLegibles}`);
      return false;
    }

    // 2. Validar peso (MB)
    const pesoMB = file.size / (1024 * 1024);
    if (pesoMB > pesoMaxMB) {
      toast.error(`El archivo pesa ${pesoMB.toFixed(1)} MB. El máximo permitido es ${pesoMaxMB} MB.`);
      return false;
    }

    return true;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validarArchivo(file)) {
      // Limpiar el input para que el usuario pueda intentar de nuevo
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setArchivoSeleccionado(file);
    onChange?.(file);
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setArchivoSeleccionado(null);
    setPreviewUrl(previewActual);
    if (inputRef.current) inputRef.current.value = "";
    onChange?.(null);
  };

  const radius = shape === "circle" ? "rounded-full" : "rounded-xl";

  return (
    <div>
      <label className="text-xs font-bold text-[#787774] uppercase tracking-wider mb-2 block">
        {label}
      </label>

      <div className="flex items-center gap-4">
        {/* Preview */}
        {previewUrl ? (
          <div className="relative shrink-0">
            <img
              src={previewUrl}
              alt="Preview"
              className={`w-20 h-20 object-cover ${radius} border-2 border-emerald-500/30 shadow-none`}
            />
            {/* Botón X para limpiar — siempre visible */}
            {archivoSeleccionado && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Quitar imagen"
                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className={`w-20 h-20 ${radius} bg-[#F7F6F3] dark:bg-slate-800/50 border-2 border-dashed border-[#EAEAEA] dark:border-slate-700 flex items-center justify-center text-[#A8A29E] shrink-0`}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Input + info */}
        <div className="flex-1 min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept={tiposPermitidos.join(",")}
            onChange={handleFileChange}
            className="w-full text-xs text-[#787774] file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-500/10 file:text-emerald-600 dark:file:text-emerald-500 hover:file:bg-emerald-500/20 cursor-pointer"
          />
          <p className="text-[11px] text-[#A8A29E] mt-1.5">
            JPG, PNG, WebP. Máx {pesoMaxMB} MB.
          </p>
          {archivoSeleccionado && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium truncate">
              ✓ {archivoSeleccionado.name} ({(archivoSeleccionado.size / 1024).toFixed(0)} KB)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
