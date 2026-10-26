import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import app from './config';

const db = getFirestore(app);
const AUDIT_COLLECTION = 'audit_logs';

// El audit trail lo escribe la Cloud Function `auditCaseChanges` con Admin SDK.
// El cliente solo lee; si intentara escribir, `firestore.rules` lo bloquea.
const obtenerLogsDelCaso = async (caseId) => {
  const user = getAuth(app).currentUser;
  if (!user) return [];

  // El filtro por userId es obligatorio para que las reglas permitan el list.
  const q = query(
    collection(db, AUDIT_COLLECTION),
    where('caseId', '==', caseId),
    where('userId', '==', user.uid)
  );
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map(doc => {
      const data = doc.data();
      const fecha = data.timestamp?.toDate?.()
        || (data.timestampIso ? new Date(data.timestampIso) : new Date());
      return {
        id: doc.id,
        ...data,
        // Los logs son del usuario autenticado (la consulta filtra por uid),
        // así que su email es el autor de la acción registrada.
        userEmail: data.userEmail || user.email || null,
        timestamp: fecha.toISOString()
      };
    })
    // Orden en memoria para no exigir un índice compuesto (caseId + timestamp).
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
};

/**
 * Obtiene el historial de cambios de un caso
 */
export const getCaseAuditHistory = async (caseId) => {
  try {
    return await obtenerLogsDelCaso(caseId);
  } catch (err) {
    console.error('Error obteniendo audit history:', err);
    return [];
  }
};


