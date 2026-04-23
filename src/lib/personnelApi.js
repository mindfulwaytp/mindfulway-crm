import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
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

// ── CEU settings (providers/{name}/config/ceu) ────────────────────────────────

export async function fetchCeuSettings(providerName) {
  const snap = await getDoc(doc(db, 'providers', providerName, 'config', 'ceu'));
  return snap.exists() ? snap.data() : null;
}

export async function saveCeuSettings(providerName, settings) {
  await setDoc(doc(db, 'providers', providerName, 'config', 'ceu'), settings, { merge: true });
}
