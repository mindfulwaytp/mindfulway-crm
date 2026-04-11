import {
  collection,
  getDocs,
  setDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const providersRef = collection(db, 'providers');

export async function fetchProviderProfiles() {
  const snap = await getDocs(providersRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function upsertProviderProfile(name, data) {
  const ref = doc(db, 'providers', name);
  await setDoc(ref, { ...data, name, updatedAt: serverTimestamp() }, { merge: true });
}
