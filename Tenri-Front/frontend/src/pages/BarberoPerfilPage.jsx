import React, { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import useApiMutation from "../hooks/useApiMutation";
import PageHeader from "../components/PageHeader";
import ImageUploader from "../components/ImageUploader";
import CharacterCounter from "../components/CharacterCounter";
import { parseApiErrorSync } from "../utils/parseApiError";

// ============================================================
// 👤 BARBERO PERFIL PAGE — Pack 2 / Bloque E
// ============================================================
// Permite al barbero editar su propia información profesional:
// nombre, correo, contraseña (opcional), especialidad, bio y foto.
//
// Consume: PUT /perfil → AuthController@updatePerfil
// Valida:  UpdatePerfilRequest (Bloque B.6) — bio/especialidad
//          solo aceptados si rol = 'barbero'.
// Refresca: actualizarUsuario(r.user) para mantener el contexto
//           y el header del DashboardLayout sincronizados.
// ============================================================

export default function BarberoPerfilPage() {
  const { usuario, actualizarUsuario } = useAuth();
  const { ejecutar, cargando: guardando, getLastError } = useApiMutation();

  // Carga inicial desde el contexto (sin GET extra al backend).
  const [form, setForm] = useState({
    name:                  usuario?.name          || "",
    email:                 usuario?.email         || "",
    password:              "",
    password_confirmation: "",
    especialidad:          usuario?.especialidad  || "",
    bio:                   usuario?.bio           || "",
    avatar_archivo:        null,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación de contraseña en frontend (espejo del Bloque B.6).
    if (form.password && form.password !== form.password_confirmation) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    if (form.password && form.password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    const fd = new FormData();
    fd.append("_method", "PUT");
    fd.append("name",  form.name);
    fd.append("email", form.email);

    // Password solo si se quiere cambiar.
    if (form.password) {
      fd.append("password",              form.password);
      fd.append("password_confirmation", form.password_confirmation);
    }

    fd.append("especialidad", form.especialidad);
    fd.append("bio",          form.bio);

    if (form.avatar_archivo) {
      fd.append("avatar", form.avatar_archivo);
    }

    const r = await ejecutar("/perfil", { method: "POST", body: fd });

    if (r) {
      // Sincronizar el contexto con los datos nuevos del backend.
      actualizarUsuario(r.user);
      toast.success("Perfil actualizado con éxito");
      // Limpiar contraseña tras guardar exitosamente.
      setForm(prev => ({ ...prev, password: "", password_confirmation: "" }));
    } else {
      toast.error(parseApiErrorSync(
        getLastError()?.body,
        "Error al guardar el perfil"
      ));
    }
  };

  // Clases compartidas para inputs del formulario.
  const inputClass = "w-full bg-paper-2 dark:bg-abyss border border-line dark:border-slate-800 rounded-xl p-3 text-sm text-ink dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all";
  const labelClass = "text-xs font-semibold text-muted uppercase tracking-wider";

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <PageHeader
        titulo="Mi perfil"
        subtitulo="Personaliza tu información profesional"
      />

      <form onSubmit={handleSubmit} className="space-y-6 mt-6">

        {/* ── Foto de perfil ── */}
        <div className="flex flex-col items-center">
          <ImageUploader
            label="Foto de perfil"
            shape="circle"
            previewActual={usuario?.avatar_url || null}
            onChange={(file) => setForm(prev => ({ ...prev, avatar_archivo: file }))}
          />
        </div>

        {/* ── Nombre ── */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className={labelClass}>Nombre</label>
            <CharacterCounter actual={form.name.length} max={80} />
          </div>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            className={inputClass}
            required
            minLength={2}
            maxLength={80}
            placeholder="Tu nombre completo"
          />
        </div>

        {/* ── Correo ── */}
        <div>
          <label className={`${labelClass} block mb-2`}>Correo</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
            className={inputClass}
            required
            maxLength={120}
            placeholder="tu@correo.com"
          />
        </div>

        {/* ── Contraseña (opcional) ── */}
        <div className="bg-paper-2 dark:bg-slate-800/30 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-faint uppercase tracking-wider">
            Cambiar contraseña <span className="normal-case font-normal">(opcional)</span>
          </p>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
            className={inputClass}
            minLength={8}
            maxLength={64}
            placeholder="Nueva contraseña (mín. 8 caracteres)"
            autoComplete="new-password"
          />
          <input
            type="password"
            value={form.password_confirmation}
            onChange={(e) => setForm(prev => ({ ...prev, password_confirmation: e.target.value }))}
            className={inputClass}
            placeholder="Confirmar nueva contraseña"
            autoComplete="new-password"
          />
        </div>

        {/* ── Especialidad ── */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className={labelClass}>Especialidad</label>
            <CharacterCounter actual={form.especialidad.length} max={100} />
          </div>
          <input
            type="text"
            value={form.especialidad}
            onChange={(e) => setForm(prev => ({ ...prev, especialidad: e.target.value }))}
            className={inputClass}
            maxLength={100}
            placeholder="Ej: Cortes modernos, degradados, barba"
          />
        </div>

        {/* ── Biografía ── */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className={labelClass}>Biografía</label>
            <CharacterCounter actual={form.bio.length} max={500} />
          </div>
          <textarea
            value={form.bio}
            onChange={(e) => setForm(prev => ({ ...prev, bio: e.target.value }))}
            className={`${inputClass} h-32 resize-none`}
            maxLength={500}
            placeholder="Cuéntale a tus clientes sobre ti, tu experiencia y estilo..."
          />
        </div>

        {/* ── Botón guardar ── */}
        <button
          type="submit"
          disabled={guardando}
          className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white dark:text-abyss font-bold rounded-xl transition-colors shadow-[0_4px_16px_rgba(0,0,0,0.05)] shadow-emerald-500/25 flex items-center justify-center gap-2"
        >
          {guardando ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Guardando...
            </>
          ) : "Guardar cambios"}
        </button>

      </form>
    </div>
  );
}
