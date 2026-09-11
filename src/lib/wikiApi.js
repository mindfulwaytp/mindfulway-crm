import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// Knowledge-base pages live in a single top-level collection. Each doc id is the
// page's slug/id; built-in seed pages are overlaid by any doc that shares their id.
const COL = 'wiki_pages';

export async function fetchWikiPages() {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveWikiPage(id, data) {
  await setDoc(
    doc(db, COL, id),
    { ...data, id, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function deleteWikiPage(id) {
  await deleteDoc(doc(db, COL, id));
}
