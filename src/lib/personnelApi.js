import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

function subCol(providerName, type) {
  return collection(db, 'providers', providerName, type);
}

export async function fetchPersonnelRecords(providerName, type) {
  const snap = await getDocs(subCol(providerName, type));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addPersonnelRecord(providerName, type, data) {
  const ref = await addDoc(subCol(providerName, type), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePersonnelRecord(providerName, type, id, data) {
  const ref = doc(db, 'providers', providerName, type, id);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deletePersonnelRecord(providerName, type, id) {
  const ref = doc(db, 'providers', providerName, type, id);
  await deleteDoc(ref);
}
