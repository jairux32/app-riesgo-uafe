import { openDB } from 'idb';
import { normalizarNombre } from './sanctionsCheck';

// Almacén local de snapshots de listas restrictivas (OFAC, ONU y lista
// interna de PEP). No se incluyen listas en el bundle: el usuario importa el
// archivo oficial, se guarda su versión, fecha y hash, y el screening usa
// exactamente ese snapshot. Todo queda en IndexedDB (sin PII de clientes).

const DB_NAME = 'app-riesgo-listas';
const DB_VERSION = 1;
const STORE_ENTRADAS = 'entradas';
const STORE_META = 'meta';

export const TIPOS_LISTA = ['ofac', 'onu', 'uafe'];

export const ETIQUETAS_LISTA = {
  ofac: 'OFAC (EE. UU.)',
  onu: 'Consejo de Seguridad ONU',
  uafe: 'PEP / UAFE (lista interna)'
};

const FUENTES_OFICIALES = {
  ofac: 'https://sanctionssearch.ofac.treas.gov/',
  onu: 'https://www.un.org/securitycouncil/content/un-sc-consolidated-list',
  uafe: 'https://www.uafe.gob.ec/'
};

export const getFuenteOficial = (tipo) => FUENTES_OFICIALES[tipo] || null;

let dbInstance = null;

const getDB = async () => {
  if (!dbInstance) {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_ENTRADAS)) {
          const store = db.createObjectStore(STORE_ENTRADAS, { keyPath: 'id' });
          store.createIndex('tipo', 'tipo');
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
      }
    });
  }
  return dbInstance;
};

const normalizarClave = (clave) => normalizarNombre(clave).toLowerCase().replace(/\s+/g, '');

const CLAVES_NOMBRE = [
  'sdnname',
  'name',
  'nombre',
  'nombrecompleto',
  'fullname',
  'entidad',
  'entity'
];

const extraerNombre = (fila) => {
  const porClave = new Map();
  for (const [clave, valor] of Object.entries(fila)) {
    porClave.set(normalizarClave(clave), valor);
  }

  for (const clave of CLAVES_NOMBRE) {
    const valor = porClave.get(clave);
    if (valor && String(valor).trim()) return String(valor).trim();
  }

  // Listas del Reino Unido separan el nombre en "Name 1" ... "Name 6".
  const partes = Object.keys(fila)
    .filter(clave => /^name\s*\d+$/i.test(String(clave).trim()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(clave => String(fila[clave]).trim())
    .filter(Boolean);

  return partes.join(' ').trim();
};

const parsearJSON = (texto) => {
  const data = JSON.parse(texto);
  const filas = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.nombres)
        ? data.nombres
        : [];

  return filas.map(fila => {
    if (typeof fila === 'string') return { nombre: fila.trim() };
    if (Array.isArray(fila)) return { nombre: String(fila[0] || '').trim() };
    return { nombre: extraerNombre(fila) };
  });
};

const parsearCSV = async (texto) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(texto, { type: 'string' });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  if (!hoja) return [];

  const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });
  return filas.map(fila => ({ nombre: extraerNombre(fila) }));
};

/**
 * Lee un archivo CSV o JSON exportado de una fuente oficial y devuelve la
 * lista de nombres normalizados, sin duplicados.
 */
export const parsearArchivoLista = async (archivo) => {
  const texto = await archivo.text();
  const esJSON = /\.json$/i.test(archivo.name) || /^\s*[[{]/.test(texto);
  const filas = esJSON ? parsearJSON(texto) : await parsearCSV(texto);

  const vistos = new Set();
  const entradas = [];
  for (const fila of filas) {
    const nombre = String(fila.nombre || '').trim();
    if (!nombre) continue;
    const clave = normalizarNombre(nombre);
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);
    entradas.push({ nombre });
  }

  if (entradas.length === 0) {
    throw new Error('No se encontró una columna de nombres reconocible (Name, SDN_Name, Nombre...).');
  }

  return { entradas, texto };
};

const calcularHash = async (texto) => {
  if (!globalThis.crypto?.subtle) return null;
  const datos = new TextEncoder().encode(texto);
  const buffer = await globalThis.crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

const claveMeta = (tipo, campo) => `${tipo}:${campo}`;

/**
 * Importa (o reemplaza) el snapshot de una lista. Devuelve el resumen
 * guardado: tipo, versión, fecha, total y hash.
 */
export const importarListaDesdeArchivo = async (tipo, archivo, version = '') => {
  if (!TIPOS_LISTA.includes(tipo)) {
    throw new Error(`Tipo de lista no soportado: ${tipo}`);
  }

  const { entradas, texto } = await parsearArchivoLista(archivo);
  const db = await getDB();

  const tx = db.transaction([STORE_ENTRADAS, STORE_META], 'readwrite');
  const indice = tx.objectStore(STORE_ENTRADAS).index('tipo');
  let cursor = await indice.openCursor(IDBKeyRange.only(tipo));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  const store = tx.objectStore(STORE_ENTRADAS);
  for (let i = 0; i < entradas.length; i++) {
    await store.put({ id: `${tipo}-${i}`, tipo, nombre: entradas[i].nombre });
  }

  const hash = await calcularHash(texto);
  const meta = {
    tipo,
    version: String(version || archivo.name).trim(),
    fecha: new Date().toISOString(),
    total: entradas.length,
    hash,
    archivo: archivo.name
  };

  const metaStore = tx.objectStore(STORE_META);
  for (const [campo, valor] of Object.entries(meta)) {
    await metaStore.put(valor, claveMeta(tipo, campo));
  }

  await tx.done;
  return meta;
};

/**
 * Carga las listas guardadas en el formato que espera
 * `verificarListasRestrictivas`: arreglos por tipo más su versión.
 */
export const cargarListas = async () => {
  const db = await getDB();
  const fuentes = {};

  for (const tipo of TIPOS_LISTA) {
    const entradas = await db.getAllFromIndex(STORE_ENTRADAS, 'tipo', tipo);
    fuentes[tipo] = entradas.map(({ nombre }) => ({ nombre }));

    const meta = await getEstadoLista(tipo);
    fuentes[`${tipo}Version`] = meta
      ? `${meta.version} (${meta.fecha?.slice(0, 10) || 'sin fecha'}${meta.hash ? `, ${meta.hash.slice(0, 12)}` : ''})`
      : null;
  }

  return fuentes;
};

export const getEstadoLista = async (tipo) => {
  const db = await getDB();
  const metaStore = db.transaction(STORE_META).store;
  const [version, fecha, total, hash, archivo] = await Promise.all([
    metaStore.get(claveMeta(tipo, 'version')),
    metaStore.get(claveMeta(tipo, 'fecha')),
    metaStore.get(claveMeta(tipo, 'total')),
    metaStore.get(claveMeta(tipo, 'hash')),
    metaStore.get(claveMeta(tipo, 'archivo'))
  ]);

  if (!total) return null;
  return { tipo, version: version || '', fecha: fecha || null, total, hash: hash || null, archivo: archivo || '' };
};

export const getEstadoListas = async () => {
  const estado = {};
  for (const tipo of TIPOS_LISTA) {
    estado[tipo] = await getEstadoLista(tipo);
  }
  return estado;
};

export const eliminarLista = async (tipo) => {
  const db = await getDB();
  const tx = db.transaction([STORE_ENTRADAS, STORE_META], 'readwrite');
  const indice = tx.objectStore(STORE_ENTRADAS).index('tipo');
  let cursor = await indice.openCursor(IDBKeyRange.only(tipo));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  const metaStore = tx.objectStore(STORE_META);
  for (const campo of ['tipo', 'version', 'fecha', 'total', 'hash', 'archivo']) {
    await metaStore.delete(claveMeta(tipo, campo));
  }

  await tx.done;
};
