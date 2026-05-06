import {
  saveCaseToFirestore,
  getUserCases,
  deleteCaseFromFirestore,
  updateCaseInFirestore
} from '../firebase/firestore';
import { isOnline, savePendingCase, getPendingCases, markCaseSynced } from './offlineSync';
import toast from 'react-hot-toast';

let currentUserId = null;

export const setUserId = (userId) => {
  currentUserId = userId;
};

export const saveCase = async (caseData) => {
  if (!isOnline()) {
    const saved = await savePendingCase({ ...caseData, userId: currentUserId });
    if (saved) {
      toast('Caso guardado localmente. Se sincronizará cuando haya conexión.', { icon: '💾' });
    }
    return { id: 'pending_' + Date.now(), ...caseData };
  }
  return saveCaseToFirestore(caseData, currentUserId);
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
