import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc,
  serverTimestamp, deleteField,
} from 'firebase/firestore';
import { db } from './firebase';
import { toDateOnly, dateToStr, todayDateStr } from './hourEntriesApi';

/**
 * Recurring tasks.
 *
 * A task is a definition (title, cadence, who it's assigned to). Each assignee
 * has their own completion record, so "done" is tracked per person. Whether a
 * task is currently due is DERIVED on read from the cadence + last completion —
 * there is no scheduler. That keeps the whole feature client-side.
 *
 * Two recurrence modes, chosen per task:
 *   fixed   — occurs on a set calendar cadence from an anchor date, regardless
 *             of when it was last done (e.g. "the 1st of every month").
 *   rolling — next due = last completed + cadence (e.g. "every 30 days from
 *             whenever you last did it"). Matches the requirements tracker.
 *
 * All date reasoning is UTC-midnight date-only, matching hourEntriesApi, so a
 * due date never lands a day off due to the viewer's timezone.
 */

export const CADENCES = [
  { key: 'daily',       label: 'Daily',        unit: 'day',   interval: 1 },
  // Recurs on chosen weekdays (e.g. Tue + Thu). Uses task.weekdays; always fixed.
  { key: 'weekdays',    label: 'Specific days of week', unit: 'weekdays' },
  { key: 'weekly',      label: 'Weekly',       unit: 'week',  interval: 1 },
  { key: 'biweekly',    label: 'Every 2 weeks', unit: 'week',  interval: 2 },
  { key: 'monthly',     label: 'Monthly',      unit: 'month', interval: 1 },
  { key: 'quarterly',   label: 'Quarterly',    unit: 'month', interval: 3 },
  { key: 'semiannual',  label: 'Every 6 months', unit: 'month', interval: 6 },
  { key: 'annual',      label: 'Annually',     unit: 'year',  interval: 1 },
  // Custom interval — the actual number of days lives in task.intervalDays.
  { key: 'custom_days', label: 'Every N days…', unit: 'day' },
];

/** Weekday indices match JS getUTCDay(): 0 = Sunday … 6 = Saturday. */
export const WEEKDAYS = [
  { idx: 0, short: 'Sun', letter: 'S' },
  { idx: 1, short: 'Mon', letter: 'M' },
  { idx: 2, short: 'Tue', letter: 'T' },
  { idx: 3, short: 'Wed', letter: 'W' },
  { idx: 4, short: 'Thu', letter: 'T' },
  { idx: 5, short: 'Fri', letter: 'F' },
  { idx: 6, short: 'Sat', letter: 'S' },
];

/** A weekday task is inherently anchored to the calendar, so rolling is meaningless. */
export function isWeekdayCadence(task) {
  return task?.cadence === 'weekdays';
}

export const RECURRENCE_MODES = [
  { key: 'fixed',   label: 'Fixed schedule', hint: 'Recurs on a set calendar cadence, no matter when it was last done.' },
  { key: 'rolling', label: 'Rolling',        hint: 'Next due is one cadence after it was last completed.' },
];

export const COMPLETION_MODES = [
  { key: 'each',   label: 'Each person completes their own', hint: 'Every assigned person has their own copy to complete.' },
  { key: 'shared', label: 'Shared — anyone can complete it',  hint: 'One person completing it marks it done for everyone assigned.' },
];

export function isSharedTask(task) {
  return task?.completionMode === 'shared';
}

/**
 * The completion that decides status for `providerName`.
 * - 'each'   → that person's own completion.
 * - 'shared' → the most recent completion by ANYONE, so one person finishing it
 *              satisfies the whole group. `providerName` is ignored.
 * Completion dates are 'YYYY-MM-DD' strings, so lexical compare = date order.
 */
export function effectiveCompletion(task, completionsForTask, providerName) {
  const comps = completionsForTask || {};
  if (!isSharedTask(task)) return comps[providerName] || null;
  let best = null;
  Object.values(comps).forEach((c) => {
    if (!c?.lastCompletedDate) return;
    if (!best || c.lastCompletedDate > best.lastCompletedDate) best = c;
  });
  return best;
}

export function customDays(task) {
  return Math.max(1, Math.round(Number(task?.intervalDays) || 1));
}

export function cadenceOf(task) {
  const base = CADENCES.find((c) => c.key === task?.cadence) || CADENCES[0];
  // Resolve the custom interval from the task itself so the shared date math works.
  if (base.key === 'custom_days') return { ...base, unit: 'day', interval: customDays(task) };
  return base;
}

export function cadenceLabel(task) {
  if (isWeekdayCadence(task)) {
    const days = (task.weekdays || []).slice().sort((a, b) => a - b)
      .map((i) => WEEKDAYS[i]?.short).filter(Boolean);
    return days.length ? `Weekly on ${days.join(', ')}` : 'Weekly (no days set)';
  }
  if (task?.cadence === 'custom_days') return `Every ${customDays(task)} days`;
  return cadenceOf(task).label;
}

// ── Date math (UTC date-only) ─────────────────────────────────────────────────

const daysInUTCMonth = (year, monthIdx) =>
  new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();

/** Add one cadence step to a UTC-midnight Date. Month steps clamp to month end. */
function addCadence(date, { unit, interval }) {
  const d = new Date(date);
  if (unit === 'week') d.setUTCDate(d.getUTCDate() + 7 * interval);
  else if (unit === 'year') d.setUTCFullYear(d.getUTCFullYear() + interval);
  else if (unit === 'month') {
    const day = d.getUTCDate();
    const targetMonth = d.getUTCMonth() + interval;
    const y = d.getUTCFullYear() + Math.floor(targetMonth / 12);
    const m = ((targetMonth % 12) + 12) % 12;
    d.setUTCFullYear(y, m, Math.min(day, daysInUTCMonth(y, m)));
  } else d.setUTCDate(d.getUTCDate() + interval); // 'day'
  return d;
}

function anchorDate(task) {
  return toDateOnly(task.startDate || todayDateStr());
}

function addDaysUTC(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** First date on/after `date` whose weekday is in the set (searches one week). */
function weekdayOnOrAfter(date, set) {
  let d = new Date(date);
  for (let i = 0; i < 7; i += 1) {
    if (set.has(d.getUTCDay())) return d;
    d = addDaysUTC(d, 1);
  }
  return null;
}

/** Latest date on/before `date` whose weekday is in the set (searches one week). */
function weekdayOnOrBefore(date, set) {
  let d = new Date(date);
  for (let i = 0; i < 7; i += 1) {
    if (set.has(d.getUTCDay())) return d;
    d = addDaysUTC(d, -1);
  }
  return null;
}

/** Due date for a weekday-scheduled task (e.g. every Tue + Thu). Always fixed. */
function computeWeekdayDue(task, last, today) {
  const set = new Set(task.weekdays || []);
  const anchor = anchorDate(task);
  if (set.size === 0) return anchor; // guarded in the form; degrade gracefully

  // Before the schedule starts → first occurrence on/after the anchor.
  const firstOcc = weekdayOnOrAfter(anchor, set);
  if (today < firstOcc) return firstOcc;

  // The occurrence for the current period is the latest chosen weekday ≤ today.
  const currentOcc = weekdayOnOrBefore(today, set);
  const completedThisOcc = last && last >= currentOcc;
  if (completedThisOcc) return weekdayOnOrAfter(addDaysUTC(today, 1), set);
  return currentOcc;
}

/**
 * The date this task is currently due for one person, as a UTC-midnight Date.
 * A due date in the future means "done for now" (or not started yet); a due date
 * today or in the past means it needs doing.
 */
export function computeDueDate(task, completion, todayStr = todayDateStr()) {
  const today = toDateOnly(todayStr);
  const cadence = cadenceOf(task);
  const last = completion?.lastCompletedDate ? toDateOnly(completion.lastCompletedDate) : null;

  if (isWeekdayCadence(task)) {
    return computeWeekdayDue(task, last, today);
  }

  if (task.recurrenceMode === 'rolling') {
    // Never done: first due at the start date — so a task whose start has already
    // passed reads as overdue, not merely "due today".
    if (!last) return anchorDate(task);
    return addCadence(last, cadence);
  }

  // Fixed: walk occurrences from the anchor to the latest one that is <= today.
  const anchor = anchorDate(task);
  if (anchor > today) return anchor; // scheduled, not yet started
  let occ = anchor;
  for (let i = 0; i < 5000; i += 1) {
    const nextOcc = addCadence(occ, cadence);
    if (nextOcc > today) break;
    occ = nextOcc;
  }
  // Completed within the current period → the next occurrence is what's upcoming.
  if (last && last >= occ) return addCadence(occ, cadence);
  return occ;
}

/**
 * Status for one (task, person): { state, dueDate, lastCompletedDate, overdueDays }.
 * state ∈ 'overdue' | 'due' | 'upcoming'.
 */
export function taskStatus(task, completion, todayStr = todayDateStr()) {
  const today = toDateOnly(todayStr);
  const due = computeDueDate(task, completion, todayStr);
  const dueStr = dateToStr(due);
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((due.getTime() - today.getTime()) / msPerDay);

  let state;
  if (diffDays > 0) state = 'upcoming';
  else if (diffDays === 0) state = 'due';
  else state = 'overdue';

  return {
    state,
    dueDate: dueStr,
    overdueDays: state === 'overdue' ? -diffDays : 0,
    daysUntilDue: diffDays,
    lastCompletedDate: completion?.lastCompletedDate || null,
    lastCompletedBy: completion?.lastCompletedBy || null,
    doneForNow: state === 'upcoming',
  };
}

// ── Firestore: task definitions ───────────────────────────────────────────────

export async function fetchTasks() {
  const snap = await getDocs(collection(db, 'tasks'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
}

export async function addTask(data, createdBy) {
  const ref = await addDoc(collection(db, 'tasks'), {
    title: data.title,
    description: data.description || '',
    assignees: data.assignees || [],
    cadence: data.cadence || 'monthly',
    weekdays: data.weekdays || [],
    intervalDays: data.cadence === 'custom_days' ? customDays(data) : null,
    completionMode: data.completionMode === 'shared' ? 'shared' : 'each',
    recurrenceMode: data.recurrenceMode || 'fixed',
    startDate: data.startDate || todayDateStr(),
    active: data.active !== false,
    createdBy: createdBy || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTask(id, data) {
  await updateDoc(doc(db, 'tasks', id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteTask(id) {
  await deleteDoc(doc(db, 'tasks', id));
}

// ── Firestore: per-person completions ─────────────────────────────────────────

export async function fetchAllCompletions(taskId) {
  const snap = await getDocs(collection(db, 'tasks', taskId, 'completions'));
  const out = {};
  snap.docs.forEach((d) => { out[d.id] = { providerName: d.id, ...d.data() }; });
  return out;
}

/** Mark this task done for one person, as of `dateStr` (defaults to today). */
export async function markTaskDone(taskId, providerName, by, dateStr = todayDateStr()) {
  const ref = doc(db, 'tasks', taskId, 'completions', providerName);
  const payload = {
    lastCompletedDate: dateStr,
    lastCompletedBy: by || providerName,
    lastCompletedAt: serverTimestamp(),
  };
  await setDoc(ref, payload, { merge: true });
  return payload;
}

/**
 * Undo a completion — clears the last-completed marker so the task reverts to
 * due/overdue for the current cycle. Because only the most recent completion is
 * stored (no history), this removes that record entirely; it's meant for
 * correcting an accidental "Mark done", not for editing prior cycles.
 */
export async function unmarkTaskDone(taskId, providerName) {
  const ref = doc(db, 'tasks', taskId, 'completions', providerName);
  await setDoc(ref, {
    lastCompletedDate: deleteField(),
    lastCompletedBy: deleteField(),
    lastCompletedAt: deleteField(),
  }, { merge: true });
}
