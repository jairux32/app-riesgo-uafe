import { openDB } from 'idb';

// Los archivos de evidencia se guardan solo en el dispositivo. En Firestore
// queda únicamente el registro con el nombre, tipo, tamaño y hash SHA-256.
const DB_NAME = 'uafe-evidencias';
const STORE = 'archivos';

const getDB = () => openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE)) {
      db.createObjectStore(STORE, { keyPath: 'id' });
    }
  }
});

export const guardarArchivoEvidencia = async (id, blob) => {
  if (!id || !blob) throw new Error('Se requiere el id y el archivo de la evidencia.');
  const db = await getDB();
  await db.put(STORE, { id, blob, guardadoEn: new Date().toISOString() });
};

export const obtenerArchivoEvidencia = async (id) => {
  if (!id) return null;
  const db = await getDB();
  const registro = await db.get(STORE, id);
  return registro?.blob || null;
};

export const existeArchivoEvidencia = async (id) => {
  if (!id) return false;
  const db = await getDB();
  const clave = await db.getKey(STORE, id);
  return Boolean(clave);
};

export const eliminarArchivoEvidencia = async (id) => {
  if (!id) return;
  const db = await getDB();
  await db.delete(STORE, id);
};

export const listarArchivosEvidencia = async () => {
  const db = await getDB();
  return db.getAllKeys(STORE);
};

/**
 * Lista los metadatos de los archivos guardados (id, fecha y tamaño) sin
 * devolver el contenido. Se usa para auditar el almacenamiento y detectar
 * archivos que ya no están referenciados por ningún caso.
 */
export const listarEvidenciasLocales = async () => {
  const db = await getDB();
  const registros = [];
  let cursor = await db.transaction(STORE).store.openCursor();

  while (cursor) {
    const valor = cursor.value || {};
    registros.push({
      id: String(cursor.key),
      guardadoEn: valor.guardadoEn || null,
      tamano: Number(valor.blob?.size) || 0
    });
    cursor = await cursor.continue();
  }

  return registros;
};
