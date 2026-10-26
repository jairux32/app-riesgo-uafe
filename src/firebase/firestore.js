import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, writeBatch, query, where, orderBy } from 'firebase/firestore';
import app from './config';

const db = getFirestore(app);
const CASES_COLLECTION = 'cases';

export const saveCaseToFirestore = async (caseData, userId) => {
  const docRef = await addDoc(collection(db, CASES_COLLECTION), {
    ...caseData,
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return { id: docRef.id };
};

export const getUserCases = async (userId) => {
  const q = query(
    collection(db, CASES_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updateCaseInFirestore = async (caseId, updates) => {
  const docRef = doc(db, CASES_COLLECTION, caseId);
  await updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
};

export const deleteCaseFromFirestore = async (caseId) => {
  const docRef = doc(db, CASES_COLLECTION, caseId);
  await deleteDoc(docRef);
};

export const saveCasesBatch = async (cases, userId) => {
  const batch = writeBatch(db);
  const colRef = collection(db, CASES_COLLECTION);
  const now = new Date().toISOString();
  
  cases.forEach(caseData => {
    const docRef = doc(colRef);
    batch.set(docRef, {
      ...caseData,
      userId,
      createdAt: now,
      updatedAt: now
    });
  });
  
  await batch.commit();
};

export { db };
