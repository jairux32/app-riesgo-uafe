import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyC36cgKZEJAHIz8xZpg00wiKCLnABv3Y9M',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'app-riesgo-uafe.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'app-riesgo-uafe',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'app-riesgo-uafe.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '211673854937',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:211673854937:web:f1fd2ee6f86f8ce18edfc8',
};

const app = initializeApp(firebaseConfig);

// App Check con reCAPTCHA v3. Solo se inicializa si hay site key configurada:
// sin ella la app sigue funcionando, pero la Function rechazará las llamadas
// cuando ENFORCE_APP_CHECK=true.
const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;

if (appCheckSiteKey) {
  const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  if (import.meta.env.DEV && debugToken) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === 'true' ? true : debugToken;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);

// Caché persistente de Firestore: sin ella, cualquier lectura o escritura sin
// conexión falla y se pierde el trabajo del usuario (por ejemplo, el análisis
// de IA de un caso ya guardado). Con la caché persistente, las escrituras se
// encolan y se envían solas al recuperar la red, y las lecturas usan la última
// copia local. Si el navegador no la soporta, se sigue con la caché en memoria.
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch (err) {
    console.warn('No se pudo habilitar la caché persistente de Firestore:', err);
    return getFirestore(app);
  }
})();

export default app;
