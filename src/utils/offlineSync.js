import { openDB } from 'idb';

const DB_NAME = 'app-riesgo-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pendingCases';

// Abrir/conectar a IndexedDB
const getDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
};

// Verificar si hay conexión a internet
export const isOnline = () => navigator.onLine;

// Guardar operación pendiente
export const savePendingCase = async (caseData) => {
  try {
    const db = await getDB();
    await db.add(STORE_NAME, {
      ...caseData,
      timestamp: new Date().toISOString(),
      synced: false,
    });
    // Registrar sync para cuando haya conexión
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-cases');
    }
    return true;
  } catch (err) {
    console.error('Error guardando caso pendiente:', err);
    return false;
  }
};

// Obtener casos pendientes
export const getPendingCases = async () => {
  try {
    const db = await getDB();
    return await db.getAll(STORE_NAME);
  } catch (err) {
    console.error('Error obteniendo casos pendientes:', err);
    return [];
  }
};

// Marcar caso como sincronizado
export const markCaseSynced = async (id) => {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
    return true;
  } catch (err) {
    console.error('Error marcando caso como sincronizado:', err);
    return false;
  }
};

// Escuchar cambios de conectividad
export const onConnectivityChange = (callback) => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};
