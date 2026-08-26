import { useCallback } from "react";

// ============================================================
// 👁 useReveal — scroll reveal con IntersectionObserver
// ============================================================
// Devuelve un callback-ref: el elemento parte oculto (clase
// `reveal` en el JSX) y recibe `is-visible` al entrar al
// viewport, una sola vez. El stagger se controla desde el JSX
// con style={{ "--reveal-delay": "90ms" }}.
// ============================================================

let observador = null;

function obtenerObservador() {
  if (!observador) {
    observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            entrada.target.classList.add("is-visible");
            observador.unobserve(entrada.target);
          }
        }
      },
      // Dispara un poco antes de que el elemento asome completo
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
  }
  return observador;
}

export default function useReveal() {
  return useCallback((nodo) => {
    if (!nodo) return;
    if (typeof IntersectionObserver === "undefined") {
      // Entorno sin IO: mostrar de inmediato, nunca dejar contenido oculto
      nodo.classList.add("is-visible");
      return;
    }
    obtenerObservador().observe(nodo);
  }, []);
}
