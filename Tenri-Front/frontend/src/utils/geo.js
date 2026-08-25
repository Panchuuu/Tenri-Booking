// ============================================================
// 📍 Utilidades de geolocalización
// ============================================================

/**
 * Distancia haversine en kilómetros entre dos coordenadas.
 */
export function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * "0,8 km" · "12 km" — formato es-CL compacto.
 */
export function formatearDistancia(km) {
  if (km == null || Number.isNaN(km)) return "";
  const valor = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return `${valor.toLocaleString("es-CL")} km`;
}

/**
 * Dirección legible a partir de coordenadas (Nominatim/OpenStreetMap).
 * Devuelve null si no se pudo resolver — el caller decide el fallback.
 */
export async function direccionDesdeCoordenadas(latitud, longitud) {
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(latitud),
      lon: String(longitud),
      "accept-language": "es",
    });
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`);
    if (!r.ok) return null;
    const json = await r.json();
    return json?.display_name || null;
  } catch {
    return null;
  }
}

/**
 * Promesa que resuelve con {latitud, longitud} o rechaza con un
 * mensaje entendible para mostrar en un toast.
 */
export function obtenerUbicacion() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Tu navegador no soporta geolocalización."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitud: pos.coords.latitude, longitud: pos.coords.longitude }),
      (err) => {
        const mensajes = {
          1: "Permiso de ubicación denegado. Actívalo en tu navegador.",
          2: "No pudimos determinar tu ubicación.",
          3: "La ubicación tardó demasiado. Inténtalo de nuevo.",
        };
        reject(new Error(mensajes[err.code] || "No pudimos obtener tu ubicación."));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}
