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
  LOCALES: "locales",
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

  /**
   * Los locales a los que esta persona tiene acceso.
   *
   * Un dueño puede tener varios, así que "su local" dejó de ser uno solo:
   * `usuario.barberia_id` dice cuál está usando ahora y esta lista dice entre
   * cuáles puede cambiar. Se hidrata igual que el usuario para que el selector
   * no parpadee al recargar.
   */
  const [locales, setLocales] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOCALES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [cargandoSesion, setCargandoSesion] = useState(true);

  const guardarLocales = useCallback((lista) => {
    const limpia = Array.isArray(lista) ? lista : [];
    setLocales(limpia);
    localStorage.setItem(STORAGE_KEYS.LOCALES, JSON.stringify(limpia));
  }, []);

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

          // Una recarga no vuelve a pasar por el login, así que los locales
          // se piden aparte: sin esto el selector desaparecería al refrescar.
          if (data?.rol === "admin" || data?.rol === "barbero") {
            try {
              const r = await apiFetch("/sesion/locales");
              if (r.ok) guardarLocales((await r.json()).locales);
            } catch {
              // Sin conexión se conserva la lista hidratada.
            }
          }
        } else {
          // Token inválido → limpiamos
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
          localStorage.removeItem(STORAGE_KEYS.USER);
          localStorage.removeItem(STORAGE_KEYS.LOCALES);
          setUsuario(null);
          setLocales([]);
        }
      } catch {
        // Si falla la red, dejamos el usuario hidratado del localStorage
      } finally {
        setCargandoSesion(false);
      }
    };

    revalidar();
  }, [guardarLocales]);

  // ===== Acciones =====
  const login = useCallback((token, user, listaDeLocales = []) => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    setUsuario(user);
    guardarLocales(listaDeLocales);
  }, [guardarLocales]);

  const logout = useCallback(async () => {
    await apiLogout();
    localStorage.removeItem(STORAGE_KEYS.LOCALES);
    setUsuario(null);
    setLocales([]);
  }, []);

  /**
   * Cambia el local con el que se está trabajando.
   *
   * Cambia también el rol, porque puede ser dueña de uno y barbera en otro. El
   * backend es el que decide: acá solo se refleja lo que respondió.
   */
  const cambiarLocal = useCallback(async (barberiaId) => {
    const resp = await apiFetch("/sesion/local", {
      method: "PUT",
      body: JSON.stringify({ barberia_id: barberiaId }),
    });

    if (!resp.ok) {
      const datos = await resp.json().catch(() => ({}));
      throw new Error(datos.message || "No se pudo cambiar de local.");
    }

    const datos = await resp.json();
    setUsuario(datos.user);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(datos.user));
    guardarLocales(datos.locales);

    return datos.user;
  }, [guardarLocales]);

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

    locales,
    localActivo: locales.find((l) => l.id === usuario?.barberia_id) || null,
    tieneVariosLocales: locales.length > 1,

    login,
    logout,
    actualizarUsuario,
    cambiarLocal,

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
