import React, { useState } from "react";
import toast from "react-hot-toast";
import apiFetch from "../utils/api";

export default function ReviewModal({ cita, onClose, onReviewSuccess }) {
  const [calificacion, setCalificacion] = useState(0);
  const [hoverEstrella, setHoverEstrella] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (calificacion === 0) {
      toast.error("Por favor selecciona al menos una estrella");
      return;
    }

    setEnviando(true);

    try {
      // 👇 Uso de apiFetch: Inyecta el token, los headers y arma la URL automáticamente
      const respuesta = await apiFetch(`/mis-citas/${cita.id}/calificar`, {
        method: "POST",
        body: JSON.stringify({ calificacion, comentario })
      });

      const data = await respuesta.json();

      if (respuesta.ok) {
        toast.success("¡Gracias por tu valoración!");
        onReviewSuccess(); // Para recargar la lista de citas
        onClose();
      } else {
        toast.error(data.error || "Ocurrió un error al enviar tu reseña");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold text-[#111111] dark:text-white mb-2 text-center">
          Califica tu servicio
        </h2>
        <p className="text-[#787774] dark:text-slate-400 text-center text-sm mb-6">
          ¿Qué tal te pareció tu corte con <strong>{cita.barbero?.name || "tu barbero"}</strong>?
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* SELECTOR DE ESTRELLAS */}
          <div className="flex justify-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((estrella) => (
              <button
                key={estrella}
                type="button"
                className="focus:outline-none transition-transform hover:scale-110"
                onClick={() => setCalificacion(estrella)}
                onMouseEnter={() => setHoverEstrella(estrella)}
                onMouseLeave={() => setHoverEstrella(0)}
              >
                <svg
                  className={`w-10 h-10 transition-colors ${
                    estrella <= (hoverEstrella || calificacion)
                      ? "text-amber-400 fill-amber-400"
                      : "text-slate-300 dark:text-slate-700"
                  }`}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            ))}
          </div>

          {/* CAJA DE COMENTARIOS */}
          <div>
            <label className="block text-sm font-medium text-[#2F3437] dark:text-slate-300 mb-1">
              Comentario (Opcional)
            </label>
            <textarea
              rows="3"
              placeholder="Ej: Excelente servicio, muy puntual..."
              className="w-full px-4 py-3 rounded-xl bg-[#FBFBFA] dark:bg-slate-900 border border-[#EAEAEA] dark:border-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-[#111111] dark:text-white"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={500}
            ></textarea>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-[#F7F6F3] hover:bg-[#EAEAEA] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#2F3437] dark:text-slate-300 rounded-xl font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-bold transition-colors"
            >
              {enviando ? "Enviando..." : "Enviar Reseña"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}