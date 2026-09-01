import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ============================================================
// 🔒 PROTECTED ROUTE
// ============================================================
// Wrappea rutas privadas y redirige si:
//  - no hay sesión → "/"
//  - el rol no coincide → "/"
//
// Uso:
//   <ProtectedRoute roles={["admin", "superadmin"]}>
//     <AdminPage />
//   </ProtectedRoute>
// ============================================================

export default function ProtectedRoute({ children, roles }) {
  const { usuario, cargandoSesion } = useAuth();
  const location = useLocation();

  // Mientras revalidamos sesión, mostramos spinner para evitar parpadeo
  if (cargandoSesion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-2 dark:bg-[#060b14]">
        <div className="w-12 h-12 border-4 border-line border-t-emerald-500 dark:border-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Sin sesión → al inicio (guardamos la URL deseada en state para volver tras login)
  if (!usuario) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Sesión válida pero rol incorrecto → al inicio.
  // 🧢 Rol dual: un admin con es_barbero pasa las rutas que piden "barbero".
  const cumpleRol =
    !roles ||
    roles.length === 0 ||
    roles.includes(usuario.rol) ||
    (roles.includes("barbero") && usuario.rol === "admin" && usuario.es_barbero);

  if (!cumpleRol) {
    return <Navigate to="/" replace />;
  }

  return children;
}
