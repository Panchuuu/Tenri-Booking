import { useState, useEffect, useCallback, useRef } from "react";
import apiFetch from "../utils/api";

// ============================================================
// 🪝 useApi — Hook de data fetching con estado completo
// ============================================================
// Reemplaza el patrón repetitivo:
//
//   const [data, setData] = useState(null);
//   const [cargando, setCargando] = useState(true);
//   useEffect(() => { fetch... setData ... }, []);
//
// Por simplemente:
//
//   const { data, cargando, error, refetch } = useApi("/citas");
//
// Características:
//  - Cancelación automática si el componente se desmonta
//  - refetch() para recargar manualmente
//  - opciones.skip para fetch condicional
//  - Llama al backend solo cuando hay token (si requireAuth=true)
// ============================================================

export default function useApi(endpoint, opciones = {}) {
  const {
    method   = "GET",
    body     = null,
    deps     = [],
    skip     = false,         // si es true, no ejecuta el fetch
    transformar,              // función opcional para transformar la data
    onSuccess,                // callback opcional
    onError,                  // callback opcional
  } = opciones;

  const [data, setData]         = useState(null);
  const [cargando, setCargando] = useState(!skip);
  const [error, setError]       = useState(null);

  // Para cancelar setState si el componente se desmontó
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const ejecutar = useCallback(async () => {
    if (skip) {
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    try {
      const config = { method };
      if (body) {
        config.body = body instanceof FormData ? body : JSON.stringify(body);
      }

      const resp = await apiFetch(endpoint, config);

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        const err = new Error(errJson.message || errJson.error || `Error HTTP ${resp.status}`);
        // Los consumidores pueden distinguir 404 de errores transitorios
        err.status = resp.status;
        throw err;
      }

      const json = await resp.json();
      const datosFinales = transformar ? transformar(json) : json;

      if (montado.current) {
        setData(datosFinales);
        onSuccess?.(datosFinales);
      }
    } catch (err) {
      if (montado.current) {
        setError(err);
        onError?.(err);
      }
    } finally {
      if (montado.current) setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, method, skip, ...deps]);

  // Si cambia el endpoint (ej: navegar entre /barberia/:slug distintos con el
  // componente montado), limpiamos la data anterior: sin esto, un 404 del
  // nuevo endpoint dejaría renderizada la data del endpoint anterior.
  useEffect(() => {
    setData(null);
  }, [endpoint]);

  useEffect(() => {
    ejecutar();
  }, [ejecutar]);

  return {
    data,
    cargando,
    error,
    refetch: ejecutar,
    setData, // útil para mutaciones optimistas
  };
}
