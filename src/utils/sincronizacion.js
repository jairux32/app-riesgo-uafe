// Sincronización de borradores offline y control de duplicados.
//
// Los casos guardados sin conexión viven en IndexedDB hasta que vuelve la red.
// Dos problemas típicos de ese flujo:
//
// 1. Atribución: el dispositivo puede haber sido usado por más de una cuenta.
//    Un borrador solo debe verse y sincronizarse con el usuario que lo creó.
// 2. Reintentos: si la escritura en Firestore funcionó pero falló el borrado
//    local (o se cerró la app), el siguiente intento volvería a subir el mismo
//    caso. Para evitarlo, cada borrador lleva un `clientCaseId` estable y, si
//    ya existe en la nube, solo se marca como sincronizado.
//
// El módulo es puro a propósito: toda la interacción con IndexedDB y Firestore
// queda en `storage.js`, de modo que estas reglas se puedan probar aisladas.

const idSeguro = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `caso_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Identificador estable para reconocer un borrador ya subido. No sustituye al
 * id de Firestore: solo sirve para que el reintento sea idempotente.
 */
export const nuevoIdCliente = () => idSeguro();

/**
 * Un borrador pertenece a un usuario solo si declara ese dueño. Los registros
 * sin `userId` no se atribuyen a nadie: es preferible no mostrarlos antes que
 * exponer los datos de otra cuenta en un dispositivo compartido.
 */
export const perteneceAlUsuario = (registro, userId) => {
  if (!registro || !userId) return false;
  return String(registro.userId || '') === String(userId);
};

export const filtrarPendientesDeUsuario = (registros = [], userId) =>
  (Array.isArray(registros) ? registros : []).filter(registro => perteneceAlUsuario(registro, userId));

/**
 * Garantiza que el borrador tenga `clientCaseId`. La función no persiste: el
 * llamador decide cuándo guardar el cambio.
 */
export const conIdCliente = (registro = {}) => (
  registro.clientCaseId ? registro : { ...registro, clientCaseId: nuevoIdCliente() }
);

/**
 * Separa los borradores que ya están en la nube (por reintento) de los que
 * faltan subir.
 */
export const planDeSincronizacion = (pendientes = [], casosEnNube = []) => {
  const idsEnNube = new Set(
    (Array.isArray(casosEnNube) ? casosEnNube : [])
      .map(caso => caso?.clientCaseId)
      .filter(Boolean)
  );

  const nuevos = [];
  const yaEnNube = [];

  (Array.isArray(pendientes) ? pendientes : []).forEach(pendiente => {
    if (pendiente?.clientCaseId && idsEnNube.has(pendiente.clientCaseId)) yaEnNube.push(pendiente);
    else nuevos.push(pendiente);
  });

  return { nuevos, yaEnNube };
};

/**
 * Clave de duplicado: mismo cliente, mismo acto y mismo mes de registro. Es la
 * regla que ya usaba el aviso al guardar; se centraliza aquí para reutilizarla
 * en el portfolio.
 */
export const claveDuplicado = (caso, opciones = {}) => {
  const cedula = String(caso?.datos?.cedula || '').trim();
  const acto = String(caso?.datos?.acto || '').trim().toLowerCase();
  if (!cedula || !acto) return null;

  const fecha = caso?.createdAt || opciones.ahora;
  const mes = fecha ? String(fecha).slice(0, 7) : '';
  if (!mes) return null;

  return `${cedula}|${acto}|${mes}`;
};

/**
 * Agrupa los casos que comparten cliente, acto y mes. Los borradores pendientes
 * se excluyen: todavía no están consolidados y su gemelo en la nube aparecería
 * como falso duplicado.
 */
export const detectarDuplicados = (casos = []) => {
  const grupos = new Map();

  (Array.isArray(casos) ? casos : []).forEach(caso => {
    if (!caso?.id || String(caso.id).startsWith('pending_')) return;
    const clave = claveDuplicado(caso);
    if (!clave) return;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(caso);
  });

  return [...grupos.entries()]
    .filter(([, lista]) => lista.length > 1)
    .map(([clave, lista]) => ({
      clave,
      cedula: String(lista[0].datos?.cedula || '').trim(),
      acto: String(lista[0].datos?.acto || '').trim(),
      mes: clave.split('|')[2],
      total: lista.length,
      casos: lista.map(caso => ({
        id: caso.id,
        cliente: caso.datos?.cliente || 'Sin nombre',
        estado: caso.datos?.estado || 'borrador',
        createdAt: caso.createdAt || null
      }))
    }));
};
