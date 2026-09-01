import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import apiFetch, { apiLogout } from "../utils/api";

// ============================================================
// 🔐 AUTH CONTEXT
// ============================================================
// Centraliza TODO lo relacionado a sesión:
//  - quién está logueado
//  - login/logout
//  - helpers de rol (isAdmin, isBarbero, etc)
//  - hidratación inicial desde localStorage
//  - revalidación del usuario contra el backend (por si su rol cambió)
// ============================================================

const AuthContext = createContext(null);

const STORAGE_KEYS = {
  TOKEN: "token",
  USER:  "user",
};

export function AuthProvider({ children }) {
  // Hidratamos desde localStorage para no parpadear al cargar la página
  const [usuario, setUsuario] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [cargandoSesion, setCargandoSesion] = useState(true);

  // 🔄 Al montar, revalidamos contra el backend (por si el rol cambió o el token expiró)
  useEffect(() => {
    const revalidar = async () => {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

      if (!token) {
        setCargandoSesion(false);
        return;
      }

      try {
        const resp = await apiFetch("/user");
        if (resp.ok) {
          const data = await resp.json();
          // Si el backend devolvió un usuario diferente, sincronizamos
          setUsuario(data);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data));
        } else {
          // Token inválido → limpiamos
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
          localStorage.removeItem(STORAGE_KEYS.USER);
          setUsuario(null);
        }
      } catch {
        // Si falla la red, dejamos el usuario hidratado del localStorage
      } finally {
        setCargandoSesion(false);
      }
    };

    revalidar();
  }, []);

  // ===== Acciones =====
  const login = useCallback((token, user) => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    setUsuario(user);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUsuario(null);
  }, []);

  const actualizarUsuario = useCallback((nuevoUsuario) => {
    setUsuario(nuevoUsuario);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(nuevoUsuario));
  }, []);

  // ===== Helpers de rol =====
  const tieneRol = useCallback(
    (...roles) => usuario && roles.includes(usuario.rol),
    [usuario]
  );

  const value = {
    usuario,
    cargandoSesion,
    estaLogueado: !!usuario,

    login,
    logout,
    actualizarUsuario,

    // Helpers semánticos
    tieneRol,
    esSuperadmin: usuario?.rol === "superadmin",
    esAdmin:      usuario?.rol === "admin",
    // 🧢 Rol dual: el dueño (admin) con es_barbero también cuenta como barbero
    esBarbero:    usuario?.rol === "barbero" || (usuario?.rol === "admin" && !!usuario?.es_barbero),
    esCliente:    usuario?.rol === "cliente",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook para consumir el contexto.
 *   const { usuario, login, esAdmin } = useAuth();
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de un <AuthProvider>");
  }
  return ctx;
}
