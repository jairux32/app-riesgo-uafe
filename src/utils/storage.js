import {
  saveCaseToFirestore,
  getUserCases,
  deleteCaseFromFirestore,
  updateCaseInFirestore
} from '../firebase/firestore';

let currentUserId = null;

export const setUserId = (userId) => {
  currentUserId = userId;
};

export const saveCase = async (caseData) => {
  return saveCaseToFirestore(caseData, currentUserId);
};

export const getAllCases = async () => {
  return getUserCases(currentUserId);
};

export const deleteCase = async (id) => {
  return deleteCaseFromFirestore(id);
};

export const updateCaseAnalysis = async (id, analysis) => {
  return updateCaseInFirestore(id, { analysis });
};
