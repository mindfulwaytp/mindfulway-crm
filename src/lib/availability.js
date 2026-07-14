/**
 * Provider availability — a day × time-slot grid.
 *
 * Shape (source of truth on the profile):
 *   availability: { monday: ['afternoon', 'evening'], wednesday: ['morning'] }
 *
 * This replaces the old pair of independent lists (availableDays + availableTimes),
 * which could only express a cross-product: a provider available Monday evening and
 * Wednesday morning was indistinguishable from one available Monday morning AND
 * Wednesday evening. Legacy profiles are read through getAvailability(), which
 * expands them into exactly that cross-product — the old data's true meaning.
 *
 * Sunday is included. The intake form offers Sun–Fri and ~half of all inquiries
 * ask for Sunday, so a provider who could never declare it was unmatchable.
 */

export const DAYS = [
  { key: 'sunday',    label: 'Sunday',    short: 'Sun' },
  { key: 'monday',    label: 'Monday',    short: 'Mon' },
  { key: 'tuesday',   label: 'Tuesday',   short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday',  label: 'Thursday',  short: 'Thu' },
  { key: 'friday',    label: 'Friday',    short: 'Fri' },
  { key: 'saturday',  label: 'Saturday',  short: 'Sat' },
];

export const SLOTS = [
  { key: 'morning',   label: 'Morning',   short: 'M', hint: '8am–12pm' },
  { key: 'afternoon', label: 'Afternoon', short: 'A', hint: '12–5pm' },
  { key: 'evening',   label: 'Evening',   short: 'E', hint: '5–9pm' },
];

const DAY_KEYS = DAYS.map((d) => d.key);
const SLOT_KEYS = SLOTS.map((s) => s.key);

/** Drop unknown keys and dedupe, so a hand-edited doc can't poison the UI. */
function normalize(raw) {
  const grid = {};
  DAY_KEYS.forEach((day) => {
    const slots = Array.isArray(raw?.[day]) ? raw[day] : [];
    const clean = SLOT_KEYS.filter((s) => slots.map((x) => String(x).toLowerCase()).includes(s));
    if (clean.length > 0) grid[day] = clean;
  });
  return grid;
}

/**
 * Read a profile's availability grid, transparently upgrading legacy profiles.
 * @returns {{[dayKey: string]: string[]}}
 */
export function getAvailability(profile) {
  if (profile?.availability && typeof profile.availability === 'object') {
    return normalize(profile.availability);
  }
  // Legacy: two flat lists implied every day × every time.
  const days = (profile?.availableDays || []).map((d) => String(d).toLowerCase());
  const times = (profile?.availableTimes || []).map((t) => String(t).toLowerCase());
  if (days.length === 0) return {};
  const grid = {};
  DAY_KEYS.forEach((day) => {
    if (!days.includes(day)) return;
    // A legacy profile with days but no times means "these days, time unspecified".
    grid[day] = times.length > 0 ? SLOT_KEYS.filter((s) => times.includes(s)) : [...SLOT_KEYS];
  });
  return normalize(grid);
}

export function hasSlot(grid, day, slot) {
  return (grid?.[day] || []).includes(slot);
}

export function toggleSlot(grid, day, slot) {
  const current = grid?.[day] || [];
  const next = current.includes(slot)
    ? current.filter((s) => s !== slot)
    : SLOT_KEYS.filter((s) => s === slot || current.includes(s)); // keep canonical order
  const out = { ...grid };
  if (next.length > 0) out[day] = next; else delete out[day];
  return out;
}

/** Clicking a day name toggles that whole row on/off. */
export function toggleDay(grid, day) {
  const out = { ...grid };
  if ((grid?.[day] || []).length === SLOT_KEYS.length) delete out[day];
  else out[day] = [...SLOT_KEYS];
  return out;
}

/** Clicking a slot header toggles that column across every day. */
export function toggleSlotColumn(grid, slot) {
  const allOn = DAY_KEYS.every((d) => hasSlot(grid, d, slot));
  let out = { ...grid };
  DAY_KEYS.forEach((d) => {
    if (hasSlot(out, d, slot) === !allOn) return;
    out = toggleSlot(out, d, slot);
  });
  return out;
}

/** Days with at least one slot selected. */
export function availableDayKeys(grid) {
  return DAY_KEYS.filter((d) => (grid?.[d] || []).length > 0);
}

export function isEmpty(grid) {
  return availableDayKeys(grid).length === 0;
}

/** "Mon (Aft/Eve) · Wed (Morn)" — compact summary for list rows. */
export function summarize(grid) {
  const parts = availableDayKeys(grid).map((day) => {
    const d = DAYS.find((x) => x.key === day);
    const slots = grid[day];
    if (slots.length === SLOT_KEYS.length) return `${d.short} (all)`;
    const labels = slots.map((s) => SLOTS.find((x) => x.key === s).label.slice(0, 3));
    return `${d.short} (${labels.join('/')})`;
  });
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * What to persist. `availability` is the source of truth; the flat lists are
 * kept in sync as derived fields so any older reader still sees valid data.
 */
export function toProfileFields(grid) {
  const clean = normalize(grid);
  const dayKeys = availableDayKeys(clean);
  const slotSet = new Set();
  dayKeys.forEach((d) => clean[d].forEach((s) => slotSet.add(s)));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    availability: clean,
    availableDays: dayKeys.map((d) => DAYS.find((x) => x.key === d).label),
    availableTimes: SLOT_KEYS.filter((s) => slotSet.has(s)).map(cap),
  };
}
