import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyC36cgKZEJAHIz8xZpg00wiKCLnABv3Y9M",
  authDomain: "app-riesgo-uafe.firebaseapp.com",
  projectId: "app-riesgo-uafe",
  storageBucket: "app-riesgo-uafe.firebasestorage.app",
  messagingSenderId: "211673854937",
  appId: "1:211673854937:web:f1fd2ee6f86f8ce18edfc8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
