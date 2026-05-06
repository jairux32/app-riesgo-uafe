import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import app from './config';

const db = getFirestore(app);
const PROFILE_COLLECTION = 'notary_profiles';

export const saveNotaryProfile = async (userId, profileData) => {
  const docRef = doc(db, PROFILE_COLLECTION, userId);
  await setDoc(docRef, {
    ...profileData,
    updatedAt: new Date().toISOString()
  });
};

export const getNotaryProfile = async (userId) => {
  const docRef = doc(db, PROFILE_COLLECTION, userId);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return snapshot.data();
  }
  return null;
};
