import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
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
  return docRef.id;
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

export const subscribeToUserCases = (userId, callback) => {
  const q = query(
    collection(db, CASES_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const cases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(cases);
  });
};

export const updateCaseInFirestore = async (caseId, updates) => {
  const docRef = doc(db, CASES_COLLECTION, caseId);
  await updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
};

export const deleteCaseFromFirestore = async (caseId) => {
  const docRef = doc(db, CASES_COLLECTION, caseId);
  await deleteDoc(docRef);
};

export { db };
