import {
  saveCaseToFirestore,
  getUserCases,
  deleteCaseFromFirestore,
  updateCaseInFirestore
} from '../firebase/firestore';
import { isOnline, savePendingCase, getPendingCases, markCaseSynced } from './offlineSync';
import { logAuditChange, AUDIT_ACTIONS } from '../firebase/auditStore';
import toast from 'react-hot-toast';

let currentUserId = null;
let currentUserEmail = null;

export const setUserId = (userId, email = '') => {
  currentUserId = userId;
  currentUserEmail = email;
};

export const checkDuplicateCase = async (datos) => {
  try {
    const allCases = await getAllCases();
    const cedula = datos.cedula?.trim();
    const acto = datos.acto?.trim();
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const duplicate = allCases.find(c => {
      const caseMonth = c.createdAt ? c.createdAt.slice(0, 7) : currentMonth;
      return c.datos?.cedula?.trim() === cedula && 
             c.datos?.acto?.trim() === acto && 
             caseMonth === currentMonth;
    });
    
    return duplicate || null;
  } catch (err) {
    console.error('Error verificando duplicados:', err);
    return null;
  }
};

export const saveCase = async (caseData) => {
  try {
    if (caseData.datos?.cedula && caseData.datos?.acto) {
      const duplicate = await checkDuplicateCase(caseData.datos);
      if (duplicate) {
        const confirm = window.confirm(
          `⚠️ Caso duplicado detectado\n\n` +
          `El cliente ${duplicate.datos.cliente} ya tiene un caso de "${duplicate.datos.acto}" registrado este mes (${new Date(duplicate.createdAt).toLocaleDateString('es-EC')}).\n\n` +
          `¿Desea guardar de todos modos?`
        );
        if (!confirm) return null;
      }
    }
    
    if (!isOnline()) {
      const pendingId = await savePendingCase({ ...caseData, userId: currentUserId });
      if (pendingId != null) {
        toast('Caso guardado localmente. Se sincronizará cuando haya conexión.', { icon: '💾' });
        return { id: `pending_${pendingId}`, ...caseData };
      }
      return null;
    }
    const result = await saveCaseToFirestore(caseData, currentUserId);
    
    if (result?.id) {
      await logAuditChange(result.id, currentUserId, currentUserEmail, AUDIT_ACTIONS.CASE_CREATED, {
        cliente: caseData.datos?.cliente,
        cedula: caseData.datos?.cedula,
        acto: caseData.datos?.acto,
        score: caseData.evaluaciones ? 'con evaluación' : 'sin evaluación'
      });
    }
    
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
    const pendientes = await getPendingCases();
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
  try {
    const pending = await getPendingCases();
    if (pending.length === 0) return;
    
    let synced = 0;
    for (const pendingCase of pending) {
      try {
        // Se quitan los metadatos de IndexedDB antes de escribir en Firestore.
        const caseData = { ...pendingCase };
        delete caseData.id;
        delete caseData.synced;
        delete caseData.timestamp;
        await saveCaseToFirestore(caseData, pendingCase.userId || currentUserId);
        await markCaseSynced(pendingCase.id);
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
