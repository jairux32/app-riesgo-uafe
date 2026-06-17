import { getFirestore, collection, addDoc, query, where, orderBy, getDocs, serverTimestamp } from 'firebase/firestore';

const db = getFirestore();
const AUDIT_COLLECTION = 'audit_logs';

/**
 * Registra un cambio en el audit trail
 */
export const logAuditChange = async (caseId, userId, userEmail, action, details = {}) => {
  try {
    const auditData = details.structuredResponse || null;

    await addDoc(collection(db, AUDIT_COLLECTION), {
      caseId,
      userId,
      userEmail,
      action,
      details: {
        ...details,
        structuredResponse: auditData,
        riskLevel: auditData?.dictamen?.nivel_riesgo_residual || null,
        recommendation: auditData?.recomendacion_final?.decision || null,
        alertCount: auditData?.senales_alerta_identificadas?.length || 0,
      },
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Error guardando audit log:', err);
  }
};

/**
 * Obtiene el historial de cambios de un caso
 */
export const getCaseAuditHistory = async (caseId) => {
  try {
    const q = query(
      collection(db, AUDIT_COLLECTION),
      where('caseId', '==', caseId),
      orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate().toISOString() || new Date().toISOString()
    }));
  } catch (err) {
    console.error('Error obteniendo audit history:', err);
    return [];
  }
};

/**
 * Obtiene la auditoría estructurada más reciente de un caso
 */
export const getStructuredAuditByCase = async (caseId) => {
  try {
    const q = query(
      collection(db, AUDIT_COLLECTION),
      where('caseId', '==', caseId),
      where('action', '==', AUDIT_ACTIONS.ANALYSIS_GENERATED),
      orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate().toISOString() || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Error obteniendo auditoría estructurada:', err);
    return null;
  }
};

/**
 * Acciones de auditoría predefinidas
 */
export const AUDIT_ACTIONS = {
  CASE_CREATED: 'CASO_CREADO',
  CASE_UPDATED: 'CASO_ACTUALIZADO',
  CASE_DELETED: 'CASO_ELIMINADO',
  ANALYSIS_GENERATED: 'ANALISIS_GENERADO',
  EXPORTED_PDF: 'EXPORTADO_PDF',
  EXPORTED_EXCEL: 'EXPORTADO_EXCEL',
  SIGNED: 'FIRMADO',
  VERIFICATION_CHECKED: 'VERIFICACION_MARCADA',
};
