import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

import PublicLayout    from "./layouts/PublicLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import AdminLayout     from "./layouts/AdminLayout";

import ProtectedRoute from "./routes/ProtectedRoute";
import ErrorBoundary  from "./components/ErrorBoundary";

import LandingPage          from "./pages/LandingPage";
import BarberiaDetallePage  from "./pages/BarberiaDetallePage";
import NotFoundPage         from "./pages/NotFoundPage";

import MisReservasPage from "./pages/MisReservasPage";
import BarberoPage     from "./pages/BarberoPage";
import BarberoPerfilPage from "./pages/BarberoPerfilPage";
import SuperAdminPage  from "./pages/SuperAdminPage";

import AgendaPage        from "./pages/admin/AgendaPage";
import ServiciosPage     from "./pages/admin/ServiciosPage";
import EquipoPage        from "./pages/admin/EquipoPage";
import BloqueosPage      from "./pages/admin/BloqueosPage"; // 🆕 Fase 4A
import ConfiguracionPage from "./pages/admin/ConfiguracionPage";
import PerfilPage        from "./pages/admin/PerfilPage";

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: "#0B1221",
                  color: "#f8fafc",
                  border: "1px solid rgba(30, 41, 59, 0.5)",
                  fontSize: "14px",
                  fontWeight: "500",
                },
                success: { iconTheme: { primary: "#10b981", secondary: "#0B1221" } },
                error:   { iconTheme: { primary: "#f43f5e", secondary: "#0B1221" } },
              }}
            />

            <Routes>
              {/* PÚBLICAS */}
              <Route element={<PublicLayout />}>
                <Route path="/"               element={<LandingPage />} />
                <Route path="/barberia/:slug" element={<BarberiaDetallePage />} />
                <Route path="*"               element={<NotFoundPage />} />
              </Route>

              {/* ADMIN */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index                  element={<Navigate to="/admin/agenda" replace />} />
                <Route path="agenda"          element={<AgendaPage />} />
                <Route path="servicios"       element={<ServiciosPage />} />
                <Route path="equipo"          element={<EquipoPage />} />
                <Route path="bloqueos"        element={<BloqueosPage />} /> {/* 🆕 Fase 4A */}
                <Route path="configuracion"   element={<ConfiguracionPage />} />
                <Route path="perfil"          element={<PerfilPage />} />
              </Route>

              {/* BARBERO */}
              <Route
                path="/barbero"
                element={
                  <ProtectedRoute roles={["barbero"]}>
                    <DashboardLayout titulo="Mi Agenda" subtitulo="Panel del barbero" />
                  </ProtectedRoute>
                }
              >
                <Route index element={<BarberoPage />} />
                <Route path="perfil" element={<BarberoPerfilPage />} />
              </Route>

              {/* SUPERADMIN */}
              <Route
                path="/superadmin"
                element={
                  <ProtectedRoute roles={["superadmin"]}>
                    <DashboardLayout titulo="TENRI MASTER" subtitulo="Red de Negocios" />
                  </ProtectedRoute>
                }
              >
                <Route index element={<SuperAdminPage />} />
              </Route>

              {/* CLIENTE — MIS RESERVAS */}
              <Route
                path="/mis-reservas"
                element={
                  <ProtectedRoute roles={["cliente"]}>
                    <DashboardLayout titulo="Mis Reservas" subtitulo="Historial de tus citas" />
                  </ProtectedRoute>
                }
              >
                <Route index element={<MisReservasPage />} />
              </Route>

            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
