import React from "react";

// ============================================================
// 🛡️ ERROR BOUNDARY
// ============================================================
// Captura errores de renderizado de React y muestra una pantalla
// amigable en vez de pantalla blanca.
// React no soporta error boundaries como hooks → debe ser clase.
// ============================================================

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hayError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hayError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("🔥 ErrorBoundary capturó:", error, info);
    // Si tienes Sentry/LogRocket, aquí va el reporte
  }

  recargar = () => {
    this.setState({ hayError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hayError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-2 dark:bg-[#060b14] p-6">
        <div className="max-w-md w-full bg-white dark:bg-card border border-line dark:border-slate-800/60 rounded-xl p-8 text-center shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
          <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-ink dark:text-white mb-2">
            Algo salió mal
          </h1>
          <p className="text-ink-2 dark:text-slate-400 mb-6">
            Ocurrió un error inesperado. Por favor, recarga la página.
          </p>

          {import.meta.env.DEV && this.state.error && (
            <pre className="text-left text-xs bg-paper dark:bg-abyss p-4 rounded-lg mb-6 overflow-auto max-h-40 text-rose-600 dark:text-rose-400">
              {this.state.error.message}
            </pre>
          )}

          <button
            onClick={this.recargar}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white dark:text-abyss font-bold rounded-lg transition-colors"
          >
            Recargar página
          </button>
        </div>
      </div>
    );
  }
}
