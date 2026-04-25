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
  arrayUnion,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Requirements CRUD ─────────────────────────────────────────────────────────

export async function fetchRequirements() {
  const snap = await getDocs(collection(db, 'requirements'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addRequirement(data) {
  const ref = await addDoc(collection(db, 'requirements'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRequirement(id, data) {
  await updateDoc(doc(db, 'requirements', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRequirement(id) {
  await deleteDoc(doc(db, 'requirements', id));
}

// ── Completions ───────────────────────────────────────────────────────────────

// All provider completions for one requirement (used by compliance board)
export async function fetchCompletionsForReq(reqId) {
  const snap = await getDocs(collection(db, 'requirements', reqId, 'completions'));
  return snap.docs.map((d) => ({ providerName: d.id, ...d.data() }));
}

// Single provider's completion for one requirement (used by personnel file tab)
export async function fetchCompletionForProvider(reqId, providerName) {
  const snap = await getDoc(doc(db, 'requirements', reqId, 'completions', providerName));
  return snap.exists() ? { providerName, ...snap.data() } : null;
}

export async function setCompletion(reqId, providerName, data) {
  const ref = doc(db, 'requirements', reqId, 'completions', providerName);
  const existing = await getDoc(ref);
  const existingDate = existing.exists() ? existing.data().lastCompletedDate : null;

  const updateData = { ...data, updatedAt: serverTimestamp() };
  if (existingDate && existingDate !== data.lastCompletedDate) {
    updateData.completionHistory = arrayUnion(existingDate);
  }

  await setDoc(ref, updateData, { merge: true });
}

export async function deleteCompletion(reqId, providerName) {
  await deleteDoc(doc(db, 'requirements', reqId, 'completions', providerName));
}

// ── Shared helper ─────────────────────────────────────────────────────────────

export function calcNextDue(completedDate, recurrenceMonths) {
  if (!recurrenceMonths || !completedDate) return null;
  const [y, m, d] = completedDate.split('-').map(Number);
  const next = new Date(y, m - 1 + recurrenceMonths, d);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}
