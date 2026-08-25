import React, { useState } from "react";
import toast from "react-hot-toast";
import apiFetch, { BASE_URL } from "../utils/api";

export default function PerfilUsuario({ usuario, setUsuario }) {
  const [formData, setFormData] = useState({
    name: usuario.name || "",
    email: usuario.email || "",
    password: "",
    password_confirmation: "",
    avatar_archivo: null,
  });

  const [cargando, setCargando] = useState(false);

  // 🔧 FIX FASE 1:
  // Antes la URL del storage estaba hardcodeada a 127.0.0.1:8000.
  // Ahora la derivamos del BASE_URL de la API (quitamos /api).
  const STORAGE_URL = BASE_URL.replace(/\/api\/?$/, "/storage");
  const avatarVisual =
    usuario.avatar_url || (usuario.avatar ? `${STORAGE_URL}/${usuario.avatar}` : null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleArchivoChange = (e) => {
    setFormData({ ...formData, avatar_archivo: e.target.files[0] });
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setCargando(true);

    const data = new FormData();
    data.append("name", formData.name);
    data.append("email", formData.email);

    if (formData.password) {
      data.append("password", formData.password);
      data.append("password_confirmation", formData.password_confirmation);
    }

    if (formData.avatar_archivo) {
      data.append("avatar", formData.avatar_archivo);
    }

    // Truco Laravel: POST + _method=PUT permite enviar FormData en un update
    data.append("_method", "PUT");

    try {
      const res = await apiFetch("/perfil", {
        method: "POST",
        body: data,
      });

      if (res.ok) {
        const respuesta = await res.json();
        toast.success("¡Perfil actualizado!");

        setUsuario(respuesta.user);
        localStorage.setItem("user", JSON.stringify(respuesta.user));

        setFormData({ ...formData, password: "", password_confirmation: "", avatar_archivo: null });
      } else {
        const errores = await res.json();
        toast.error(errores.message || "Error al actualizar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="max-w-2xl bg-[#0B1221] border border-slate-800/60 rounded-xl p-8 shadow-[0_4px_16px_rgba(0,0,0,0.05)] animate-fade-in">
      <div className="flex items-center gap-6 mb-8">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-[#03070e] text-2xl font-bold shadow-[0_4px_16px_rgba(0,0,0,0.05)] overflow-hidden border-2 border-emerald-500/20"
          style={{ backgroundColor: avatarVisual ? "transparent" : "#10b981" }}
        >
          {avatarVisual ? (
            <img src={avatarVisual} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            formData.name.substring(0, 2).toUpperCase()
          )}
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-1">Configuración de Cuenta</h3>
          <p className="text-[#787774] text-sm">Gestiona tu información personal, foto y seguridad.</p>
        </div>
      </div>

      <form onSubmit={handleGuardar} className="space-y-6">
        <div>
          <label className="text-xs font-semibold text-[#787774] uppercase mb-2 block">Foto de Perfil</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleArchivoChange}
            className="w-full bg-[#03070e] border border-slate-800 rounded-lg p-2 text-sm text-[#A8A29E] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-500/10 file:text-emerald-500 hover:file:bg-emerald-500/20 cursor-pointer transition-all"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-semibold text-[#787774] uppercase mb-2 block">Nombre Completo</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-[#03070e] border border-slate-800 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-emerald-500/50" required />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#787774] uppercase mb-2 block">Correo Electrónico</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-[#03070e] border border-slate-800 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-emerald-500/50" required />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800/50">
          <h4 className="text-sm font-bold text-emerald-500 mb-4">Cambiar Contraseña</h4>
          <p className="text-xs text-[#787774] mb-6">Deja estos campos vacíos si no deseas cambiar tu clave actual.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-[#787774] uppercase mb-2 block">Nueva Contraseña</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" minLength={8} className="w-full bg-[#03070e] border border-slate-800 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#787774] uppercase mb-2 block">Confirmar Contraseña</label>
              <input type="password" name="password_confirmation" value={formData.password_confirmation} onChange={handleChange} placeholder="••••••••" className="w-full bg-[#03070e] border border-slate-800 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-emerald-500/50" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={cargando} className="w-full md:w-auto px-10 py-3 bg-emerald-500 hover:bg-emerald-400 text-[#03070e] font-bold rounded-lg transition-all shadow-[0_4px_16px_rgba(0,0,0,0.05)] shadow-emerald-500/10 disabled:opacity-50">
          {cargando ? "Guardando..." : "Actualizar Perfil"}
        </button>
      </form>
    </div>
  );
}
