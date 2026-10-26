// Gestión documental del expediente.
//
// Cada evidencia se identifica por el hash SHA-256 de su contenido. El hash se
// guarda en el caso (y en el audit trail), mientras que el archivo permanece
// solo en el dispositivo (IndexedDB). Así se puede demostrar que el documento
// presentado es el mismo que se revisó sin subir PII a la nube.
//
// La app no puede certificar la autenticidad del documento: solo prueba que el
// archivo no cambió desde que se cargó.

export const TIPOS_EVIDENCIA = [
  { valor: 'identificacion', etiqueta: 'Identificación del cliente' },
  { valor: 'ruc', etiqueta: 'RUC / constitución de la sociedad' },
  { valor: 'representante', etiqueta: 'Nombramiento del representante legal' },
  { valor: 'cadenaPropiedad', etiqueta: 'Cadena de propiedad / accionistas' },
  { valor: 'origenFondos', etiqueta: 'Origen y licitud de fondos' },
  { valor: 'poder', etiqueta: 'Poder o autorización del apoderado' },
  { valor: 'escritura', etiqueta: 'Escritura o contrato del acto' },
  { valor: 'avaluo', etiqueta: 'Avalúo o soporte del valor' },
  { valor: 'otro', etiqueta: 'Otro documento' }
];

// Evidencias mínimas que un expediente debería contener. Es una guía, no un
// bloqueo: el notario decide qué soporte corresponde a cada acto.
export const EVIDENCIAS_MINIMAS = {
  natural: ['identificacion'],
  juridica: ['identificacion', 'ruc', 'representante', 'cadenaPropiedad']
};

export const esTipoEvidenciaValido = (tipo) =>
  TIPOS_EVIDENCIA.some(t => t.valor === tipo);

export const etiquetaTipoEvidencia = (tipo) =>
  TIPOS_EVIDENCIA.find(t => t.valor === tipo)?.etiqueta || tipo || 'Otro documento';

const aHex = (buffer) =>
  [...new Uint8Array(buffer)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

/**
 * Calcula el SHA-256 de un arreglo de bytes y lo devuelve en hexadecimal.
 * @param {ArrayBuffer|Uint8Array} bytes
 * @returns {Promise<string>}
 */
export const hashBytes = async (bytes) => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('El navegador no soporta SHA-256 (Web Crypto). No se puede calcular el hash.');
  }
  const datos = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await subtle.digest('SHA-256', datos);
  return aHex(digest);
};

/**
 * Calcula el SHA-256 de un archivo (File o Blob).
 */
export const hashArchivo = async (archivo) => {
  if (!archivo || typeof archivo.arrayBuffer !== 'function') {
    throw new Error('El archivo no se puede leer para calcular su hash.');
  }
  return hashBytes(await archivo.arrayBuffer());
};

const idSeguro = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `ev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Crea el registro que se guarda en el caso. El archivo no se incluye.
 *
 * @param {File|Blob} archivo
 * @param {{tipo?: string, descripcion?: string, responsable?: string}} meta
 */
export const crearRegistroEvidencia = async (archivo, meta = {}) => {
  const hash = await hashArchivo(archivo);
  const tipo = esTipoEvidenciaValido(meta.tipo) ? meta.tipo : 'otro';

  return {
    id: idSeguro(),
    nombre: String(archivo.name || 'documento').trim(),
    tipo,
    descripcion: String(meta.descripcion || '').trim(),
    mime: archivo.type || 'application/octet-stream',
    tamano: Number(archivo.size) || 0,
    hash,
    algoritmo: 'SHA-256',
    cargadaEn: new Date().toISOString(),
    responsable: String(meta.responsable || '').trim()
  };
};

const HASH_HEX = /^[a-f0-9]{64}$/;

/**
 * Verifica que el registro tenga los datos mínimos y un hash bien formado.
 */
export const validarEvidencia = (registro = {}) => {
  const faltantes = [];

  if (!String(registro.nombre || '').trim()) faltantes.push('nombre del archivo');
  if (!esTipoEvidenciaValido(registro.tipo)) faltantes.push('tipo de evidencia');
  if (!HASH_HEX.test(String(registro.hash || ''))) faltantes.push('hash SHA-256 válido');
  if (!(Number(registro.tamano) > 0)) faltantes.push('tamaño del archivo');

  return { valida: faltantes.length === 0, faltantes };
};

/**
 * Comprueba que un archivo corresponda al hash registrado.
 */
export const verificarIntegridad = async (archivo, hashEsperado) => {
  const hashActual = await hashArchivo(archivo);
  return {
    integra: hashActual === String(hashEsperado || '').toLowerCase(),
    hashActual,
    hashEsperado
  };
};

/**
 * Resume el expediente documental y detecta las evidencias mínimas faltantes.
 *
 * @param {Array<object>} evidencias
 * @param {{tipoPersona?: 'natural'|'juridica'}} opciones
 */
export const resumenEvidencias = (evidencias = [], opciones = {}) => {
  const lista = Array.isArray(evidencias) ? evidencias : [];
  const tipoPersona = opciones.tipoPersona === 'juridica' ? 'juridica' : 'natural';
  const requeridas = EVIDENCIAS_MINIMAS[tipoPersona] || [];
  const tiposPresentes = [...new Set(lista.map(e => e?.tipo).filter(Boolean))];
  const faltantes = requeridas.filter(tipo => !tiposPresentes.includes(tipo));
  const invalidas = lista.filter(evidencia => !validarEvidencia(evidencia).valida);

  return {
    total: lista.length,
    tiposPresentes,
    requeridas,
    faltantes,
    invalidas,
    completa: faltantes.length === 0 && invalidas.length === 0
  };
};

export const formatearTamano = (bytes) => {
  const valor = Number(bytes) || 0;
  if (valor < 1024) return `${valor} B`;
  if (valor < 1024 * 1024) return `${(valor / 1024).toFixed(1)} KB`;
  return `${(valor / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Describe las evidencias para el prompt, PDF, Excel, ROS y audit trail.
 * Por defecto usa el hash completo: es lo que permite verificar el archivo.
 */
export const describirEvidencias = (evidencias = [], opciones = {}) => {
  const lista = Array.isArray(evidencias) ? evidencias : [];
  if (lista.length === 0) return 'Sin evidencias documentales cargadas.';
  const hashCompleto = opciones.hashCompleto !== false;

  return lista.map(evidencia => {
    const hash = String(evidencia?.hash || '');
    const hashMostrado = hashCompleto ? hash : `${hash.slice(0, 16)}…`;
    return `${etiquetaTipoEvidencia(evidencia?.tipo)}: ${evidencia?.nombre || 'sin nombre'} (${formatearTamano(evidencia?.tamano)}) — SHA-256 ${hashMostrado}`;
  }).join(' | ');
};

/**
 * Filas planas para exportaciones.
 */
export const filasEvidencias = (evidencias = []) =>
  (Array.isArray(evidencias) ? evidencias : []).map(evidencia => ({
    tipo: etiquetaTipoEvidencia(evidencia?.tipo),
    nombre: evidencia?.nombre || '—',
    tamano: formatearTamano(evidencia?.tamano),
    hash: evidencia?.hash || '—',
    cargadaEn: evidencia?.cargadaEn || '—'
  }));
