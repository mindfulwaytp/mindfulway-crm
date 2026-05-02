import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp,
  onSnapshot,
  Timestamp,
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

/** Fetch only inquiries updated after a given timestamp (ms since epoch). */
export async function fetchInquiriesSince(sinceMs) {
  const q = query(
    inquiriesRef,
    where('updatedAt', '>', Timestamp.fromMillis(sinceMs)),
    orderBy('updatedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createInquiry(data) {
  const { createdAt, ...rest } = data;
  let createdAtValue = serverTimestamp();
  if (createdAt instanceof Date && !Number.isNaN(createdAt.getTime())) {
    createdAtValue = Timestamp.fromDate(createdAt);
  } else if (createdAt && typeof createdAt.toMillis === 'function') {
    createdAtValue = createdAt;
  }
  const docRef = await addDoc(inquiriesRef, {
    ...rest,
    createdAt: createdAtValue,
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

export function subscribeToInquiries(callback, onError) {
  const q = query(inquiriesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      callback(data);
    },
    (error) => {
      console.error('subscribeToInquiries error:', error);
      if (onError) onError(error);
    }
  );
}