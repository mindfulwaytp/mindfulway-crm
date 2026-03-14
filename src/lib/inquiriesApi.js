import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

const inquiriesRef = collection(db, 'inquiries');

export async function fetchInquiries() {
  const q = query(inquiriesRef, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

export async function createInquiry(data) {
  const docRef = await addDoc(inquiriesRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateInquiry(id, updates) {
  const ref = doc(db, 'inquiries', id);

  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToInquiries(callback) {
  const q = query(inquiriesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(data);
  });
}