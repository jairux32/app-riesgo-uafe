import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyC36cgKZEJAHIz8xZpg00wiKCLnABv3Y9M',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'app-riesgo-uafe.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'app-riesgo-uafe',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'app-riesgo-uafe.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '211673854937',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:211673854937:web:f1fd2ee6f86f8ce18edfc8',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
