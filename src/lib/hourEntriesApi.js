import {
  collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, deleteField, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export const HOUR_TYPES = [
  { key: 'direct_contact',    label: 'Direct Contact',     reqField: 'directContactHoursRequired',    color: '#3b82f6', bg: '#eff6ff' },
  { key: 'supervision',       label: 'Supervision',         reqField: 'supervisionHoursRequired',       color: '#8b5cf6', bg: '#f5f3ff' },
  { key: 'group_therapy',     label: 'Group Therapy',       reqField: 'groupTherapyHoursRequired',      color: '#10b981', bg: '#ecfdf5' },
  { key: 'relational_therapy',label: 'Relational Therapy',  reqField: 'relationalTherapyHoursRequired', color: '#f59e0b', bg: '#fffbeb' },
  { key: 'administrative',    label: 'Administrative',      reqField: 'adminHoursRequired',             color: '#6b7280', bg: '#f9fafb' },
];

// ── Dates ─────────────────────────────────────────────────────────────────────
// An entry's `date` is a calendar day, not a moment in time. We store it as UTC
// midnight and ALWAYS render it in UTC. Rendering it in local time is what made
// entries display a day early: `new Date('2026-07-14')` is midnight UTC, which
// is still July 13th anywhere west of Greenwich.

const pad = (n) => String(n).padStart(2, '0');

/** Today's *local* calendar day as 'YYYY-MM-DD' — for prefilling <input type="date">. */
export function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' (or a Date) → Date pinned to UTC midnight of that calendar day. */
export function toDateOnly(value) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  return new Date(`${value}T00:00:00Z`);
}

/** Entry → 'YYYY-MM-DD', for prefilling <input type="date"> when editing. */
export function entryDateStr(entry) {
  const d = new Date(entry.date.seconds * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Entry → human-readable date. Formats in UTC so the stored calendar day survives. */
export function formatEntryDate(entry, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Date(entry.date.seconds * 1000)
    .toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

/** 'YYYY-MM-DD' → human-readable date, without a round-trip through Firestore. */
export function formatDateStr(dateStr, opts = { month: 'short', day: 'numeric' }) {
  return toDateOnly(dateStr).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

/** Firestore Timestamp → human-readable date+time, in local time (a real moment, unlike `date`). */
export function formatTimestamp(ts, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!ts) return '';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-US', opts);
}

// ── Sign-off ──────────────────────────────────────────────────────────────────

/** A signed-off entry is locked: no edits, no deletes, until a supervisor reopens it. */
export function isApproved(entry) {
  return !!entry?.approvedAt;
}

// ── Entries ───────────────────────────────────────────────────────────────────

export async function addHourEntry({ internName, date, type, hours, notes, createdBy = null }) {
  return addDoc(collection(db, 'hourEntries'), {
    internName,
    date: Timestamp.fromDate(toDateOnly(date)),
    type,
    hours: Number(hours),
    notes: notes || '',
    createdAt: Timestamp.now(),
    ...(createdBy ? { createdBy } : {}),
  });
}

export async function updateHourEntry(entryId, { date, type, hours, notes }) {
  await updateDoc(doc(db, 'hourEntries', entryId), {
    date: Timestamp.fromDate(toDateOnly(date)),
    type,
    hours: Number(hours),
    notes: notes || '',
    updatedAt: Timestamp.now(),
  });
}

export async function deleteHourEntry(entryId) {
  await deleteDoc(doc(db, 'hourEntries', entryId));
}

/** Supervisor sign-off. Locks the entry against further edits. */
export async function approveHourEntry(entryId, approvedBy) {
  const approvedAt = Timestamp.now();
  await updateDoc(doc(db, 'hourEntries', entryId), { approvedAt, approvedBy });
  return { approvedAt, approvedBy };
}

/** Reopen a signed-off entry so it can be corrected. Supervisor/admin only. */
export async function unapproveHourEntry(entryId) {
  await updateDoc(doc(db, 'hourEntries', entryId), {
    approvedAt: deleteField(),
    approvedBy: deleteField(),
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

// ── Week helpers ──────────────────────────────────────────────────────────────
// Weeks are UTC-midnight-aligned to match how entry dates are stored, so an
// entry never lands in the wrong week bucket.

/**
 * Monday of the week containing `date`, as UTC midnight.
 * Accepts a Date (read as its LOCAL calendar day) or a 'YYYY-MM-DD' string.
 * toDateOnly() already distinguishes the two — routing a string through
 * `new Date(str)` first would read UTC-midnight back out in local time and
 * land on the previous day.
 */
export function getMondayOf(date) {
  const d = toDateOnly(date);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d;
}

/** A UTC-midnight Date → 'YYYY-MM-DD', for binding to <input type="date">. */
export function dateToStr(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Shift a Monday by whole weeks. UTC arithmetic, so DST can't knock it off midnight. */
export function shiftWeeks(monday, weeks) {
  const d = new Date(monday);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d;
}

export function formatWeekLabel(monday) {
  const end = new Date(monday);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(monday)} – ${fmt(end)}, ${monday.getUTCFullYear()}`;
}

export function entriesInWeek(entries, monday) {
  const start = monday.getTime();
  const end = shiftWeeks(monday, 1).getTime();
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

// ── Direct-contact credit ─────────────────────────────────────────────────────
// Some interns/associates may count their group and/or relational hours toward
// their Direct Contact requirement as well. The hours are logged ONCE, so they
// must never be added twice to the grand total — the credit applies only to the
// Direct Contact requirement bar. Which types are credited is per-profile.

/** The only hour types that can be credited toward Direct Contact. */
export const CREDITABLE_TO_DIRECT = ['group_therapy', 'relational_therapy'];

/** Types this intern's profile credits toward Direct Contact (defaults to none). */
export function directCreditTypes(profile) {
  const configured = profile?.directCreditTypes;
  if (!Array.isArray(configured)) return [];
  return CREDITABLE_TO_DIRECT.filter((t) => configured.includes(t));
}

/**
 * Hours counted against each REQUIREMENT — not a tally of hours worked.
 * Direct Contact absorbs the credited types on top of its own entries, so this
 * intentionally sums to more than the hours actually logged. Never derive the
 * grand total from this; use totalLoggedHours(), which counts each entry once.
 */
export function progressByType(entries, profile) {
  const raw = sumByType(entries);
  const credited = { ...raw };
  directCreditTypes(profile).forEach((t) => {
    credited.direct_contact += raw[t] || 0;
  });
  return credited;
}

/** Total hours actually logged — each entry counted exactly once. */
export function totalLoggedHours(entries) {
  return Object.values(sumByType(entries)).reduce((s, v) => s + v, 0);
}

/** ['group_therapy','relational_therapy'] → "Group Therapy & Relational Therapy" */
export function creditLabel(types) {
  const labels = types.map((t) => HOUR_TYPES.find((h) => h.key === t)?.label || t);
  if (labels.length <= 1) return labels[0] || '';
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`;
}
