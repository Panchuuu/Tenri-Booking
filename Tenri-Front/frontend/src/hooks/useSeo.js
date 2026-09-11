import { useEffect } from "react";

// ============================================================
// 🔎 useSeo — título, meta y datos estructurados por ruta
// ============================================================
// La app es una SPA: el index.html trae unos valores por defecto y
// nadie los cambia al navegar, así que todas las páginas compartían
// título y descripción. Google renderiza JS, así que actualizar el
// head al montar cada página sí cuenta para la indexación.
//
// Lo que NO arregla esto: las tarjetas de WhatsApp, Facebook o
// LinkedIn leen el HTML crudo sin ejecutar JS, así que ven siempre
// las etiquetas del index.html. Para que cada tienda tenga su propia
// tarjeta haría falta prerender o SSR; queda anotado a propósito.
// ============================================================

const POR_DEFECTO = {
  titulo: "Tenri Booking · Reserva tu hora en barberías y salones",
  descripcion:
    "Directorio de barberías, salones de belleza y centros de estética con reserva online. Elige tienda, servicio y hora libre.",
};

/** Crea o actualiza una etiqueta del head, marcada para poder limpiarla. */
function ponerMeta(selector, crear, contenido) {
  if (!contenido) return;
  let etiqueta = document.head.querySelector(selector);
  if (!etiqueta) {
    etiqueta = crear();
    etiqueta.dataset.seo = "dinamico";
    document.head.appendChild(etiqueta);
  }
  if (etiqueta.tagName === "LINK") etiqueta.setAttribute("href", contenido);
  else etiqueta.setAttribute("content", contenido);
}

/**
 * @param {object} opciones
 * @param {string} [opciones.titulo]      Título de la pestaña y og:title.
 * @param {string} [opciones.descripcion] meta description y og:description.
 * @param {string} [opciones.ruta]        Ruta canónica ("/barberia/x"). Default: la actual.
 * @param {string} [opciones.imagen]      URL absoluta para og:image.
 * @param {object} [opciones.jsonLd]      Datos estructurados schema.org.
 * @param {boolean} [opciones.listo]      Si es false, no toca nada todavía
 *                                        (para esperar a que carguen los datos).
 */
export default function useSeo({
  titulo,
  descripcion,
  ruta,
  imagen,
  jsonLd,
  listo = true,
} = {}) {
  const jsonLdSerializado = jsonLd ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    if (!listo) return undefined;

    const origen = window.location.origin;
    const tituloFinal = titulo || POR_DEFECTO.titulo;
    const descripcionFinal = descripcion || POR_DEFECTO.descripcion;
    const url = origen + (ruta || window.location.pathname);
    const imagenFinal = imagen || `${origen}/og-tenri.jpg`;

    document.title = tituloFinal;

    ponerMeta('meta[name="description"]', () => {
      const el = document.createElement("meta");
      el.setAttribute("name", "description");
      return el;
    }, descripcionFinal);

    ponerMeta('link[rel="canonical"]', () => {
      const el = document.createElement("link");
      el.setAttribute("rel", "canonical");
      return el;
    }, url);

    const propiedades = {
      "og:title": tituloFinal,
      "og:description": descripcionFinal,
      "og:url": url,
      "og:image": imagenFinal,
      "og:type": "website",
    };
    for (const [propiedad, contenido] of Object.entries(propiedades)) {
      ponerMeta(`meta[property="${propiedad}"]`, () => {
        const el = document.createElement("meta");
        el.setAttribute("property", propiedad);
        return el;
      }, contenido);
    }

    const nombres = {
      "twitter:card": "summary_large_image",
      "twitter:title": tituloFinal,
      "twitter:description": descripcionFinal,
      "twitter:image": imagenFinal,
    };
    for (const [nombre, contenido] of Object.entries(nombres)) {
      ponerMeta(`meta[name="${nombre}"]`, () => {
        const el = document.createElement("meta");
        el.setAttribute("name", nombre);
        return el;
      }, contenido);
    }

    // Los datos estructurados sí se quitan al salir: si no, la ficha de
    // una tienda seguiría declarada mientras se mira otra página.
    let script = null;
    if (jsonLdSerializado) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.seo = "jsonld";
      script.textContent = jsonLdSerializado;
      document.head.appendChild(script);
    }

    return () => script?.remove();
  }, [titulo, descripcion, ruta, imagen, jsonLdSerializado, listo]);
}
