// ==========================================================
// 🌐 CAPA DE COMUNICACIÓN CON LA API DE TENRI
// ==========================================================
// 🔧 FIX FASE 1:
// La URL ahora se lee desde una variable de entorno de Vite,
// con fallback al servidor local de desarrollo.
//
// En la raíz de /frontend crea un archivo `.env.local` con:
//   VITE_API_URL=http://127.0.0.1:8000/api
// ==========================================================

export const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

/**
 * Wrapper de fetch que:
 *  - Inyecta el token Bearer automáticamente
 *  - Detecta FormData para no romper el Content-Type
 *  - Maneja 401 (sesión expirada) limpiando y recargando
 */
const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem("token");

  const headers = {
    Accept: "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Si mandamos JSON, lo seteamos. Si es FormData, fetch pone el boundary solo.
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const config = { ...options, headers };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);

    // 🛡️ Sesión expirada o token inválido
    if (response.status === 401) {
      console.warn("Sesión inválida o expirada. Cerrando sesión...");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.reload();
      return Promise.reject(new Error("Sesión expirada"));
    }

    /**
     * Avisa que algo del local cambió.
     *
     * Lo escucha el panel de puesta en marcha, que muestra cuánto lleva
     * configurada la tienda: sin esto, agregar un servicio o subir el logo no
     * movía la barra hasta cambiar de módulo, porque solo se recalculaba al
     * navegar. Se emite acá, en el único lugar por donde pasan todas las
     * escrituras, en vez de en cada pantalla que guarda algo.
     *
     * Solo para escrituras que salieron bien: un GET no cambia nada y un
     * error tampoco.
     */
    const metodo = (options.method || "GET").toUpperCase();

    if (response.ok && metodo !== "GET") {
      window.dispatchEvent(new CustomEvent("tenri:datos-cambiaron", { detail: { endpoint, metodo } }));
    }

    return response;
  } catch (error) {
    console.error("Error de conexión al servidor:", error);
    throw error;
  }
};

/**
 * 🆕 FIX FASE 1:
 * Logout "de verdad": invalida el token en el servidor también,
 * no solo en localStorage.
 */
export const apiLogout = async () => {
  try {
    await apiFetch("/logout", { method: "POST" });
  } catch {
    // Si falla la red, igual limpiamos local
  } finally {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
};

export default apiFetch;
