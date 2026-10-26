import {
  saveCaseToFirestore,
  getUserCases,
  deleteCaseFromFirestore,
  updateCaseInFirestore
} from '../firebase/firestore';
import { isOnline, savePendingCase, getPendingCases, markCaseSynced, updatePendingCase } from './offlineSync';
import { claveDuplicado, conIdCliente, planDeSincronizacion } from './sincronizacion';
import toast from 'react-hot-toast';

let currentUserId = null;

export const setUserId = (userId) => {
  currentUserId = userId || null;
};

export const checkDuplicateCase = async (datos) => {
  try {
    if (!datos?.cedula || !datos?.acto) return null;

    const allCases = await getAllCases();
    const clave = claveDuplicado({ datos, createdAt: new Date().toISOString() });
    if (!clave) return null;

    const duplicate = allCases.find(c => claveDuplicado(c) === clave);

    return duplicate || null;
  } catch (err) {
    console.error('Error verificando duplicados:', err);
    return null;
  }
};

export const saveCase = async (caseData) => {
  try {
    // Sin usuario no hay a quién atribuir el caso: las reglas de Firestore lo
    // rechazarían y el borrador local quedaría inaccesible.
    if (!currentUserId) {
      toast.error('La sesión aún no está lista. Espere un momento e intente guardar de nuevo.');
      return null;
    }

    if (caseData.datos?.cedula && caseData.datos?.acto) {
      const duplicate = await checkDuplicateCase(caseData.datos);
      if (duplicate) {
        const fecha = duplicate.createdAt
          ? new Date(duplicate.createdAt).toLocaleDateString('es-EC')
          : 'este mes';
        const confirm = window.confirm(
          `⚠️ Caso duplicado detectado\n\n` +
          `El cliente ${duplicate.datos?.cliente || 'sin nombre'} ya tiene un caso de ` +
          `"${duplicate.datos?.acto}" registrado este mes (${fecha}).\n\n` +
          `¿Desea guardar de todos modos?`
        );
        if (!confirm) return null;
      }
    }

    if (!isOnline()) {
      const pendiente = conIdCliente({ ...caseData, userId: currentUserId });
      const pendingId = await savePendingCase(pendiente);
      if (pendingId != null) {
        toast('Caso guardado localmente. Se sincronizará cuando haya conexión.', { icon: '💾' });
        return { id: `pending_${pendingId}`, ...caseData };
      }
      return null;
    }
    const result = await saveCaseToFirestore(caseData, currentUserId);

    // El audit trail se escribe server-side con onDocumentWritten: el cliente
    // no puede crear ni alterar `audit_logs` (ver firestore.rules).
    return result;
  } catch (err) {
    console.error('Error guardando caso:', err);
    toast.error('Error al guardar el caso: ' + err.message);
    return null;
  }
};

export const getAllCases = async () => {
  let cloudCases = [];
  let pendingCases = [];

  try {
    cloudCases = await getUserCases(currentUserId);
  } catch (err) {
    console.error('Error obteniendo casos:', err);
  }

  // Los pendientes se muestran siempre, no solo sin conexión: de lo contrario
  // desaparecen al recuperar la red y el usuario cree que se perdieron.
  try {
    const pendientes = await getPendingCases(currentUserId);
    pendingCases = pendientes.map(c => ({ ...c, id: `pending_${c.id}` }));
  } catch (err) {
    console.error('Error obteniendo casos pendientes:', err);
  }

  return [...pendingCases, ...cloudCases];
};

export const deleteCase = async (id) => {
  try {
    if (String(id).startsWith('pending_')) {
      const key = Number.parseInt(String(id).replace('pending_', ''), 10);
      if (!Number.isFinite(key)) return false;
      return markCaseSynced(key);
    }
    return deleteCaseFromFirestore(id);
  } catch (err) {
    console.error('Error eliminando caso:', err);
    toast.error('Error al eliminar el caso: ' + err.message);
    return false;
  }
};

export const updateCase = async (id, caseData) => {
  try {
    await updateCaseInFirestore(id, caseData);
    return true;
  } catch (err) {
    console.error('Error actualizando caso:', err);
    toast.error('Error al actualizar el caso: ' + err.message);
    return false;
  }
};

export const updateCaseAnalysis = async (id, analysis) => {
  try {
    await updateCaseInFirestore(id, { analysis });
    return true;
  } catch (err) {
    console.error('Error actualizando análisis:', err);
    toast.error('Error al actualizar el análisis: ' + err.message);
    return false;
  }
};

export const syncPendingCases = async () => {
  if (!currentUserId) return;

  try {
    const pendientes = await getPendingCases(currentUserId);
    if (pendientes.length === 0) return;

    // Sin la lista de la nube no se puede saber qué ya se subió: se reintenta
    // en la próxima conexión en lugar de arriesgar duplicados.
    let casosEnNube;
    try {
      casosEnNube = await getUserCases(currentUserId);
    } catch (err) {
      console.error('No se pudo consultar la nube; se reintentará la sincronización:', err);
      return;
    }

    const { nuevos, yaEnNube } = planDeSincronizacion(pendientes, casosEnNube);

    // Los que ya llegaron a la nube solo necesitan limpiarse en local.
    for (const pendiente of yaEnNube) {
      await markCaseSynced(pendiente.id);
    }

    let synced = 0;
    for (const pendiente of nuevos) {
      try {
        const conId = conIdCliente(pendiente);
        if (!pendiente.clientCaseId) {
          // Se persiste antes de subir: si la escritura funciona y el borrado
          // local falla, el próximo intento reconocerá el caso.
          await updatePendingCase(pendiente.id, { clientCaseId: conId.clientCaseId });
        }

        // Se quitan los metadatos de IndexedDB antes de escribir en Firestore.
        const caseData = { ...conId };
        delete caseData.id;
        delete caseData.synced;
        delete caseData.timestamp;

        await saveCaseToFirestore(caseData, currentUserId);
        await markCaseSynced(pendiente.id);
        synced++;
      } catch (err) {
        console.error('Error sincronizando caso:', err);
      }
    }

    if (synced > 0) {
      toast.success(`${synced} caso(s) sincronizado(s) con la nube`);
    }
  } catch (err) {
    console.error('Error en sincronización:', err);
  }
};
