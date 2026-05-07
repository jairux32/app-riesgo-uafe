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
};

export const saveCase = async (caseData) => {
  // Verificar duplicados antes de guardar
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
    const saved = await savePendingCase({ ...caseData, userId: currentUserId });
    if (saved) {
      toast('Caso guardado localmente. Se sincronizará cuando haya conexión.', { icon: '💾' });
    }
    return { id: 'pending_' + Date.now(), ...caseData };
  }
  const result = await saveCaseToFirestore(caseData, currentUserId);
  
  // Registrar en audit trail
  if (result?.id) {
    await logAuditChange(result.id, currentUserId, currentUserEmail, AUDIT_ACTIONS.CASE_CREATED, {
      cliente: caseData.datos?.cliente,
      cedula: caseData.datos?.cedula,
      acto: caseData.datos?.acto,
      score: caseData.evaluaciones ? 'con evaluación' : 'sin evaluación'
    });
  }
  
  return result;
};

export const getAllCases = async () => {
  const cloudCases = await getUserCases(currentUserId);
  if (!isOnline()) {
    const pendingCases = await getPendingCases();
    return [...pendingCases.map(c => ({ ...c, id: c.id, datos: c.datos })), ...cloudCases];
  }
  return cloudCases;
};

export const deleteCase = async (id) => {
  if (String(id).startsWith('pending_')) {
    await markCaseSynced(parseInt(id.replace('pending_', '')));
    return true;
  }
  return deleteCaseFromFirestore(id);
};

export const updateCaseAnalysis = async (id, analysis) => {
  return updateCaseInFirestore(id, { analysis });
};

// Sincronizar casos pendientes
export const syncPendingCases = async () => {
  const pending = await getPendingCases();
  if (pending.length === 0) return;
  
  let synced = 0;
  for (const caseData of pending) {
    try {
      await saveCaseToFirestore(caseData, caseData.userId);
      await markCaseSynced(caseData.id);
      synced++;
    } catch (err) {
      console.error('Error sincronizando caso:', err);
    }
  }
  
  if (synced > 0) {
    toast.success(`${synced} caso(s) sincronizado(s) con la nube`);
  }
};
