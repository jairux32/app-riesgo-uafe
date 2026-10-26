import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { auth } from './firebase/config.js'
import { instalarObservabilidad } from './utils/observabilidad.js'

// Los errores del cliente se registran siempre en la consola. Si se define
// VITE_LOG_ENDPOINT (la Function `logClientError`), también se envían a Cloud
// Logging con el ID token de la sesión, sin datos del caso.
instalarObservabilidad({
  endpoint: import.meta.env.VITE_LOG_ENDPOINT || undefined,
  obtenerToken: () => auth.currentUser?.getIdToken() || null
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registrado:', registration.scope);
      })
      .catch((err) => {
        console.log('SW registro fallido:', err);
      });
  });
}

// La base de clientes ya NO se descarga automáticamente: el archivo contenía
// datos personales de 36.981 personas y se servía sin autenticación.
// La carga manual se hace desde useClientsDB.importFromFile (archivo local).

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
