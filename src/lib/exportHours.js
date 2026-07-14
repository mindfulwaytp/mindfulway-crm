import { HOUR_TYPES, entryDateStr, isApproved } from './hourEntriesApi';

// ── CSV export ────────────────────────────────────────────────────────────────
// Plain CSV (UTF-8 with BOM) so Excel and Google Sheets both open it cleanly on
// a double-click. Dates are written as YYYY-MM-DD so they sort correctly as text
// and are unambiguous once Excel parses them.

const pad = (n) => String(n).padStart(2, '0');

/** Firestore Timestamp (a real moment) → local YYYY-MM-DD. */
function timestampDateStr(ts) {
  if (!ts) return '';
  const d = new Date(ts.seconds * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function loggedByLabel(e) {
  if (e.createdBy?.role && e.createdBy.role !== 'intern') {
    return `${e.createdBy.name || e.createdBy.role} (${e.createdBy.role})`;
  }
  return 'Intern';
}

const COLUMNS = [
  { header: 'Date',          value: (e) => entryDateStr(e) },
  { header: 'Intern',        value: (e) => e.internName || '' },
  { header: 'Type',          value: (e) => HOUR_TYPES.find((t) => t.key === e.type)?.label || e.type },
  { header: 'Hours',         value: (e) => e.hours ?? '' },
  { header: 'Notes',         value: (e) => e.notes || '' },
  { header: 'Logged By',     value: (e) => loggedByLabel(e) },
  { header: 'Status',        value: (e) => (isApproved(e) ? 'Signed off' : 'Pending') },
  { header: 'Signed Off By', value: (e) => e.approvedBy?.name || '' },
  { header: 'Signed Off On', value: (e) => timestampDateStr(e.approvedAt) },
];

/**
 * Escape one CSV cell.
 * Leading =, +, -, @ are prefixed with a quote: Excel would otherwise treat a
 * note like "=1+1" as a formula. Notes are free text, so this matters.
 */
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Entries → CSV text, with a trailing TOTAL row mirroring the table footer. */
export function buildHoursCsv(entries) {
  const rows = [COLUMNS.map((c) => csvCell(c.header)).join(',')];

  entries.forEach((e) => {
    rows.push(COLUMNS.map((c) => csvCell(c.value(e))).join(','));
  });

  const total = entries.reduce((s, e) => s + (e.hours || 0), 0);
  const totalRow = COLUMNS.map((c) => {
    if (c.header === 'Date') return csvCell('TOTAL');
    if (c.header === 'Hours') return csvCell(total);
    return '';
  });
  rows.push('');
  rows.push(totalRow.join(','));

  return rows.join('\r\n');
}

export function hoursCsvFilename(scopeName) {
  const who = (scopeName || 'all-interns').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const d = new Date();
  return `hours_${who}_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`;
}

/** Build the CSV and hand it to the browser as a download. */
export function downloadHoursCsv(entries, scopeName) {
  // The BOM is what makes Excel read it as UTF-8 rather than mangling accents.
  const blob = new Blob(['﻿', buildHoursCsv(entries)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = hoursCsvFilename(scopeName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
