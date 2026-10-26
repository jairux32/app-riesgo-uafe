import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

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
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
