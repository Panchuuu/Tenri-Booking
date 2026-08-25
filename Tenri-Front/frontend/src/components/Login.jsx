import React, { useState } from "react";
import toast from "react-hot-toast";
import { BASE_URL } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { XIcon } from "./Icons";

// ============================================================
// 🔑 LOGIN MODAL — Pack 1 (con validación email frontend)
// ============================================================
// FIX #1: validar formato email en cliente antes de mandar al backend.
//
// El backend ya valida con email:rfc,dns,filter, pero damos feedback
// visual instantáneo para que el usuario sepa por qué no se aceptó.
// ============================================================

// Regex RFC 5322 simplificada — exige dominio con punto + TLD de 2+ letras.
// Esto bloquea "fgaete@tenricl" porque "tenricl" no tiene "."
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function Login({ onClose, onLoginSuccess }) {
  const { login } = useAuth();

  const [esRegistro, setEsRegistro] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [emailTocado, setEmailTocado] = useState(false);

  // ✨ Validación en vivo del email
  const emailValido = !email || EMAIL_REGEX.test(email);
  const mostrarErrorEmail = emailTocado && !emailValido && email.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 🔧 FIX #1: validar antes de enviar
    if (!EMAIL_REGEX.test(email)) {
      toast.error("El correo no es válido. Verifica que tenga un dominio completo (ej: gmail.com).");
      setEmailTocado(true);
      return;
    }

    if (esRegistro && password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setCargando(true);

    const endpoint = esRegistro ? "/register" : "/login";
    const cuerpo = esRegistro
      ? { name: nombre, email, password, password_confirmation: password }
      : { email, password };

    try {
      const r = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await r.json();

      if (r.ok) {
        login(datos.access_token, datos.user);
        toast.success(esRegistro ? "¡Cuenta creada!" : "¡Bienvenido!");
        onLoginSuccess?.(datos.user);
      } else {
        let mensaje = datos.message || "Error al procesar la solicitud.";
        if (datos.errors) {
          const primer = Object.values(datos.errors)[0];
          if (Array.isArray(primer) && primer[0]) mensaje = primer[0];
        }
        toast.error(mensaje);
      }
    } catch {
      toast.error("Error de conexión con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 dark:bg-[#03070e]/80 backdrop-blur-md p-4 animate-fade-in">
      <div
        className="bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-emerald-400/20 dark:bg-emerald-600/15 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-cyan-400/10 dark:bg-cyan-600/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10">
          <div className="px-8 pt-8 pb-2 flex justify-between items-start">
            <div>
              <h2 className="font-display text-3xl font-bold text-[#111111] dark:text-white leading-tight">
                {esRegistro ? "Crear cuenta" : "Bienvenido"}
              </h2>
              <p className="text-sm text-[#787774] dark:text-slate-400 mt-2">
                {esRegistro ? "Únete a la red Tenri" : "Ingresa para continuar"}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="p-2 text-[#A8A29E] hover:text-[#2F3437] dark:hover:text-rose-400 hover:bg-[#F7F6F3] dark:hover:bg-slate-800/50 rounded-full transition-colors -mt-1 -mr-1"
            >
              <XIcon />
            </button>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {esRegistro && (
                <div className="animate-fade-in-down">
                  <label className="text-xs font-bold text-[#787774] uppercase tracking-widest mb-2 block">
                    Nombre completo
                  </label>
                  <input
                    type="text" required value={nombre}
                    maxLength={80}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Nicolás Cisternas"
                    className="w-full bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-xl p-3.5 text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-[#787774] uppercase tracking-widest mb-2 block">
                  Correo electrónico
                </label>
                <input
                  type="email" required value={email}
                  maxLength={120}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTocado(true)}
                  placeholder="tu@correo.com"
                  className={`w-full bg-[#FBFBFA] dark:bg-[#03070e] border rounded-xl p-3.5 text-sm text-[#111111] dark:text-slate-200 outline-none transition-all ${
                    mostrarErrorEmail
                      ? "border-rose-400 dark:border-rose-500/60 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                      : "border-[#EAEAEA] dark:border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  }`}
                />
                {mostrarErrorEmail && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1.5 font-medium">
                    El correo debe tener un dominio completo (ej: gmail.com).
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-[#787774] uppercase tracking-widest mb-2 block">
                  Contraseña
                </label>
                <input
                  type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={esRegistro ? 8 : 1}
                  className="w-full bg-[#FBFBFA] dark:bg-[#03070e] border border-[#EAEAEA] dark:border-slate-800 rounded-xl p-3.5 text-sm text-[#111111] dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                {esRegistro && <p className="text-[11px] text-[#787774] mt-1.5">Mínimo 8 caracteres, con letras y números.</p>}
              </div>

              <button
                type="submit"
                disabled={cargando || mostrarErrorEmail}
                className={`w-full py-3.5 rounded-xl font-bold text-white dark:text-[#03070e] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center gap-2 ${
                  cargando || mostrarErrorEmail
                    ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
                    : "bg-slate-900 dark:bg-emerald-500 hover:bg-emerald-500 dark:hover:bg-emerald-400 hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:shadow-emerald-500/25 hover:-translate-y-0.5"
                }`}
              >
                {cargando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Cargando...
                  </>
                ) : (
                  esRegistro ? "Crear cuenta" : "Iniciar sesión"
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-[#787774] dark:text-slate-400">
              {esRegistro ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
              <button
                type="button"
                onClick={() => { setEsRegistro(!esRegistro); setNombre(""); setPassword(""); setEmailTocado(false); }}
                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
              >
                {esRegistro ? "Inicia sesión" : "Regístrate"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
