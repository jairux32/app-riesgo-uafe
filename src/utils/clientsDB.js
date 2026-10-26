import { openDB } from 'idb';

const DB_NAME = 'app-riesgo-clientes';
const DB_VERSION = 1;
const STORE_NAME = 'clientes';
const META_STORE = 'meta';

let dbInstance = null;

const getDB = async () => {
  if (!dbInstance) {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('nombre', 'nombre');
          store.createIndex('identificacion', 'identificacion');
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE);
        }
      },
    });
  }
  return dbInstance;
};

export const isClientsDBReady = async () => {
  try {
    const db = await getDB();
    const count = await db.count(STORE_NAME);
    return count > 0;
  } catch {
    return false;
  }
};

export const getClientsCount = async () => {
  try {
    const db = await getDB();
    return await db.count(STORE_NAME);
  } catch {
    return 0;
  }
};

export const importClientsFromJSON = async (jsonData) => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');

  const { data } = jsonData;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    await tx.store.put({
      id: i,
      nombre: row[0],
      identificacion: row[1],
      email: row[2],
      telefono: row[3],
      direccion: row[4],
    });
  }
  await tx.done;

  const metaTx = db.transaction(META_STORE, 'readwrite');
  await metaTx.store.put(data.length, 'count');
  await metaTx.store.put(Date.now(), 'importedAt');
  await metaTx.done;

  return data.length;
};

export const searchClients = async (query, limit = 20) => {
  if (!query || query.trim().length < 2) return [];

  const db = await getDB();
  const q = query.toLowerCase().trim();
  const results = [];
  let cursor = await db.transaction(STORE_NAME).store.openCursor();

  while (cursor) {
    const cliente = cursor.value;
    const nombre = cliente.nombre.toLowerCase();
    const id = cliente.identificacion.toLowerCase();

    if (nombre.includes(q) || id.includes(q)) {
      results.push(cliente);
      if (results.length >= limit) break;
    }
    cursor = await cursor.continue();
  }

  return results;
};

export const searchClientsByExactId = async (identificacion) => {
  if (!identificacion) return null;
  const db = await getDB();
  const q = identificacion.toLowerCase().trim();
  let cursor = await db.transaction(STORE_NAME).store.openCursor();

  while (cursor) {
    if (cursor.value.identificacion.toLowerCase() === q) {
      return cursor.value;
    }
    cursor = await cursor.continue();
  }
  return null;
};

export const clearClientsDB = async () => {
  const db = await getDB();
  await db.clear(STORE_NAME);
  await db.clear(META_STORE);
};
