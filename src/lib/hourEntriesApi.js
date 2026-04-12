import {
  collection, addDoc, getDocs, query, where, doc, updateDoc, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export const HOUR_TYPES = [
  { key: 'direct_contact',    label: 'Direct Contact',     reqField: 'directContactHoursRequired',    color: '#3b82f6', bg: '#eff6ff' },
  { key: 'supervision',       label: 'Supervision',         reqField: 'supervisionHoursRequired',       color: '#8b5cf6', bg: '#f5f3ff' },
  { key: 'group_therapy',     label: 'Group Therapy',       reqField: 'groupTherapyHoursRequired',      color: '#10b981', bg: '#ecfdf5' },
  { key: 'relational_therapy',label: 'Relational Therapy',  reqField: 'relationalTherapyHoursRequired', color: '#f59e0b', bg: '#fffbeb' },
  { key: 'administrative',    label: 'Administrative',      reqField: 'adminHoursRequired',             color: '#6b7280', bg: '#f9fafb' },
];

// ── Entries ───────────────────────────────────────────────────────────────────

export async function addHourEntry({ internName, date, type, hours, notes, createdBy = null }) {
  return addDoc(collection(db, 'hourEntries'), {
    internName,
    date: Timestamp.fromDate(new Date(date)),
    type,
    hours: Number(hours),
    notes: notes || '',
    createdAt: Timestamp.now(),
    ...(createdBy ? { createdBy } : {}),
  });
}

/** Fetch all entries for one intern, sorted by date ascending (client-side sort avoids composite index). */
export async function fetchHourEntries(internName) {
  const snap = await getDocs(query(
    collection(db, 'hourEntries'),
    where('internName', '==', internName),
  ));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.date.seconds - b.date.seconds);
}

/** Fetch all entries across all interns (admin use). */
export async function fetchAllHourEntries() {
  const snap = await getDocs(collection(db, 'hourEntries'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.date.seconds - b.date.seconds);
}

// ── Change requests ───────────────────────────────────────────────────────────

export async function submitChangeRequest({ entryId, internName, reason }) {
  return addDoc(collection(db, 'changeRequests'), {
    entryId,
    internName,
    reason,
    status: 'pending',
    createdAt: Timestamp.now(),
  });
}

export async function fetchChangeRequests(internName) {
  const snap = await getDocs(query(
    collection(db, 'changeRequests'),
    where('internName', '==', internName),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchAllChangeRequests() {
  const snap = await getDocs(collection(db, 'changeRequests'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function resolveChangeRequest(reqId) {
  await updateDoc(doc(db, 'changeRequests', reqId), { status: 'resolved', resolvedAt: Timestamp.now() });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatWeekLabel(monday) {
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(end)}, ${monday.getFullYear()}`;
}

export function entriesInWeek(entries, monday) {
  const start = monday.getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;
  return entries.filter((e) => {
    const ms = e.date.seconds * 1000;
    return ms >= start && ms < end;
  });
}

export function sumByType(entries) {
  const totals = {};
  HOUR_TYPES.forEach(({ key }) => { totals[key] = 0; });
  entries.forEach((e) => {
    if (totals[e.type] !== undefined) totals[e.type] += e.hours;
  });
  return totals;
}
