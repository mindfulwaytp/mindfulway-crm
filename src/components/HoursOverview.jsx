import { useState, useMemo } from 'react';
import { HOUR_TYPES, formatEntryDate, isApproved } from '../lib/hourEntriesApi';
import { downloadHoursCsv } from '../lib/exportHours';
import { SignOffBadge, EntryActions } from './HourEntryActions';

/**
 * Below 900px the table stops being a table: each row becomes a stacked card
 * with its column name as an inline label (via the data-label attribute), so
 * nothing gets squeezed into an unreadable column.
 */
const responsiveStyles = `
.ho-wrap { container-type: inline-size; }
.ho-table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: auto; }
.ho-table th, .ho-table td { padding: 10px 12px; text-align: left; vertical-align: top; }
.ho-table th { font-weight: 700; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; user-select: none; white-space: nowrap; }
.ho-table thead tr { background: #f9fafb; border-bottom: 2px solid #e5e7eb; }
.ho-table tbody tr { border-bottom: 1px solid #f1f5f9; }
.ho-nowrap { white-space: nowrap; }
.ho-notes { color: #6b7280; min-width: 160px; }
.ho-sortable { cursor: pointer; }
.ho-check { width: 34px; }

@media (max-width: 900px) {
  .ho-table, .ho-table tbody, .ho-table tr, .ho-table td, .ho-table tfoot { display: block; width: 100%; }
  .ho-table thead { display: none; }
  .ho-table tbody tr {
    border: 1px solid #e5e7eb; border-radius: 10px;
    margin-bottom: 10px; padding: 4px 2px; background: #fff;
  }
  .ho-table td {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 16px; padding: 7px 12px; border: none;
  }
  .ho-table td::before {
    content: attr(data-label);
    font-weight: 700; font-size: 10px; color: #9ca3af;
    text-transform: uppercase; letter-spacing: 0.05em;
    flex: 0 0 auto; padding-top: 2px;
  }
  .ho-table td > * { text-align: right; }
  .ho-notes { min-width: 0; }
  .ho-table tfoot tr { border-top: 2px solid #e5e7eb; display: flex; justify-content: space-between; padding: 10px 12px; }
  .ho-table tfoot td { padding: 0; }
}
`;

export default function HoursOverview({
  entries,
  onAddEntry,
  sort,
  onSortChange,
  typeFilter,
  onTypeFilterChange,
  scopeName,              // used to name the downloaded file
  // Supervisor mode:
  changeRequests,
  onResolve,
  canApprove,
  onApprove,
  onApproveMany,
  onUnapprove,
  // Intern/associate mode:
  pendingCRIds,
  onRequestChange,
  // Shared:
  onEdit,
  onDelete,
  busyId,
}) {
  const [selected, setSelected] = useState(() => new Set());
  const [signingOff, setSigningOff] = useState(false);
  const [pageSize, setPageSize] = useState(25);   // 10 | 25 | 50 | 100 | 'all'
  const [rawPage, setRawPage] = useState(1);

  const filtered = useMemo(() => (
    typeFilter === 'all' ? entries : entries.filter((e) => e.type === typeFilter)
  ), [entries, typeFilter]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let av, bv;
    if (sort.key === 'date') { av = a.date.seconds; bv = b.date.seconds; }
    else if (sort.key === 'type') { av = a.type; bv = b.type; }
    else if (sort.key === 'hours') { av = a.hours; bv = b.hours; }
    else if (sort.key === 'status') { av = isApproved(a) ? 1 : 0; bv = isApproved(b) ? 1 : 0; }
    else if (sort.key === 'loggedBy') {
      av = a.createdBy?.name || (a.createdBy?.role && a.createdBy.role !== 'intern' ? a.createdBy.role : 'Intern');
      bv = b.createdBy?.name || (b.createdBy?.role && b.createdBy.role !== 'intern' ? b.createdBy.role : 'Intern');
    }
    if (av < bv) return sort.dir === 'asc' ? -1 : 1;
    if (av > bv) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  }), [filtered, sort]);

  // ── Pagination ──────────────────────────────────────────────────────────────
  // `page` is clamped at render rather than corrected in an effect: deleting the
  // last row on the final page must not leave us stranded past the end.
  const showAll = pageSize === 'all';
  const totalPages = showAll ? 1 : Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(rawPage, totalPages);
  // Snap the stored page back in bounds, or deleting the last row on the final
  // page would leave a stale page number that resurfaces when rows are re-added.
  if (rawPage !== page) setRawPage(page);
  const pageStart = showAll ? 0 : (page - 1) * pageSize;
  const paged = showAll ? sorted : sorted.slice(pageStart, pageStart + pageSize);

  function goToPage(n) {
    setRawPage(Math.min(Math.max(1, n), totalPages));
  }

  function changePageSize(v) {
    setPageSize(v === 'all' ? 'all' : Number(v));
    setRawPage(1);
  }

  // Selection persists across pages, so a batch can span them. Sign-off therefore
  // resolves against the whole filtered set, not just the rows on screen.
  const showChecks = !!(canApprove && onApproveMany);
  const selectableAll = useMemo(() => sorted.filter((e) => !isApproved(e)), [sorted]);
  const selectableOnPage = paged.filter((e) => !isApproved(e));
  const selectedEntries = selectableAll.filter((e) => selected.has(e.id));
  const pageAllSelected = selectableOnPage.length > 0
    && selectableOnPage.every((e) => selected.has(e.id));
  const unselectedElsewhere = selectableAll.length - selectedEntries.length;

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /** Header checkbox acts on the current page only — the bulk bar offers the rest. */
  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      selectableOnPage.forEach((e) => {
        if (pageAllSelected) next.delete(e.id); else next.add(e.id);
      });
      return next;
    });
  }

  function selectEverySelectable() {
    setSelected(new Set(selectableAll.map((e) => e.id)));
  }

  async function signOffSelected() {
    setSigningOff(true);
    try {
      await onApproveMany(selectedEntries);
      setSelected(new Set());
    } finally {
      setSigningOff(false);
    }
  }

  function toggleSort(key) {
    if (sort.key === key) onSortChange({ key, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
    else onSortChange({ key, dir: key === 'date' ? 'desc' : 'asc' });
    setRawPage(1);
  }

  function changeTypeFilter(v) {
    onTypeFilterChange(v);
    setRawPage(1);
  }

  const sortIndicator = (key) => sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';

  const filteredTotal = filtered.reduce((s, e) => s + (e.hours || 0), 0);
  const totalsByType = {};
  HOUR_TYPES.forEach(({ key }) => { totalsByType[key] = 0; });
  entries.forEach((e) => { if (totalsByType[e.type] !== undefined) totalsByType[e.type] += (e.hours || 0); });
  const grandTotal = Object.values(totalsByType).reduce((s, v) => s + v, 0);
  const approvedTotal = entries.filter(isApproved).reduce((s, e) => s + (e.hours || 0), 0);

  const colCount = 7 + (showChecks ? 1 : 0);

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <style>{responsiveStyles}</style>

      {/* Filters + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <FilterChip label={`All (${entries.length})`} active={typeFilter === 'all'} onClick={() => changeTypeFilter('all')} />
          {HOUR_TYPES.map((ht) => {
            const count = entries.filter((e) => e.type === ht.key).length;
            if (count === 0) return null;
            return (
              <FilterChip
                key={ht.key}
                label={`${ht.label} (${count})`}
                active={typeFilter === ht.key}
                onClick={() => changeTypeFilter(ht.key)}
                bg={ht.bg}
                color={ht.color}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => downloadHoursCsv(sorted, scopeName)}
            disabled={sorted.length === 0}
            title={`Download all ${sorted.length} matching row${sorted.length === 1 ? '' : 's'} (not just this page) as a CSV that opens in Excel`}
            style={{ ...secondaryBtnStyle, opacity: sorted.length === 0 ? 0.5 : 1, cursor: sorted.length === 0 ? 'default' : 'pointer' }}
          >
            ↓ Export CSV ({sorted.length})
          </button>
          {onAddEntry && (
            <button onClick={onAddEntry} style={primaryBtnStyle}>+ Add Entry</button>
          )}
        </div>
      </div>

      {/* Bulk sign-off bar — only once something is selected */}
      {showChecks && selectedEntries.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          marginBottom: 14, padding: '10px 14px', borderRadius: 10,
          background: '#ecfdf5', border: '1px solid #a7f3d0',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#047857' }}>
            {selectedEntries.length} entr{selectedEntries.length === 1 ? 'y' : 'ies'} selected
            <span style={{ fontWeight: 500, color: '#059669' }}>
              {' · '}{selectedEntries.reduce((s, e) => s + (e.hours || 0), 0)} hrs
            </span>
            {unselectedElsewhere > 0 && (
              <button
                onClick={selectEverySelectable}
                disabled={signingOff}
                style={{ marginLeft: 10, padding: 0, border: 'none', background: 'none', color: '#047857', fontWeight: 700, fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}
              >
                Select all {selectableAll.length} awaiting sign-off
              </button>
            )}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelected(new Set())} style={secondaryBtnStyle} disabled={signingOff}>Clear</button>
            <button
              onClick={signOffSelected}
              disabled={signingOff}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 600, fontSize: 13, cursor: signingOff ? 'default' : 'pointer', opacity: signingOff ? 0.7 : 1 }}
            >
              {signingOff ? 'Signing off…' : `✓ Sign off ${selectedEntries.length} selected`}
            </button>
          </div>
        </div>
      )}

      {/* Type-totals strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, padding: '12px 14px', background: '#f9fafb', borderRadius: 8, fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: '#111827' }}>
          Grand Total: <span style={{ color: '#7c3aed' }}>{grandTotal} hrs</span>
        </div>
        <div style={{ fontWeight: 700, color: '#111827' }}>
          Signed off: <span style={{ color: '#047857' }}>{approvedTotal} hrs</span>
        </div>
        {HOUR_TYPES.map((ht) => (
          totalsByType[ht.key] > 0 && (
            <div key={ht.key} style={{ color: '#6b7280' }}>
              <span style={{ color: ht.color, fontWeight: 600 }}>{ht.label}:</span> {totalsByType[ht.key]} hrs
            </div>
          )
        ))}
      </div>

      {sorted.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 13, padding: '20px 0' }}>No entries to display.</div>
      ) : (
        <div className="ho-wrap" style={{ overflowX: 'auto' }}>
          <table className="ho-table">
            <thead>
              <tr>
                {showChecks && (
                  <th className="ho-check">
                    <input
                      type="checkbox"
                      checked={pageAllSelected}
                      onChange={togglePage}
                      disabled={selectableOnPage.length === 0}
                      title={pageAllSelected ? 'Deselect this page' : 'Select every entry on this page awaiting sign-off'}
                      style={{ cursor: selectableOnPage.length === 0 ? 'default' : 'pointer' }}
                    />
                  </th>
                )}
                <th className="ho-sortable" onClick={() => toggleSort('date')}>Date{sortIndicator('date')}</th>
                <th className="ho-sortable" onClick={() => toggleSort('type')}>Type{sortIndicator('type')}</th>
                <th className="ho-sortable" onClick={() => toggleSort('hours')}>Hours{sortIndicator('hours')}</th>
                <th>Notes</th>
                <th className="ho-sortable" onClick={() => toggleSort('loggedBy')}>Logged by{sortIndicator('loggedBy')}</th>
                <th className="ho-sortable" onClick={() => toggleSort('status')}>Status{sortIndicator('status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((e) => {
                const cr = changeRequests
                  ? changeRequests.find((r) => r.entryId === e.id && r.status === 'pending')
                  : null;
                const hasPendingCR = !!cr || (pendingCRIds && pendingCRIds.has(e.id));
                const ht = HOUR_TYPES.find((t) => t.key === e.type);
                const approved = isApproved(e);
                const isSelected = selected.has(e.id);
                const dateStr = formatEntryDate(e, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                const loggedBy = e.createdBy?.role && e.createdBy.role !== 'intern'
                  ? `${e.createdBy.name || e.createdBy.role} (${e.createdBy.role})`
                  : 'Intern';
                const rowBg = isSelected ? '#f0fdf4'
                  : hasPendingCR ? '#fffbeb'
                  : approved ? '#f6fefb' : '#fff';
                return (
                  <tr key={e.id} style={{ background: rowBg }}>
                    {showChecks && (
                      <td className="ho-check" data-label="">
                        {!approved && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(e.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        )}
                      </td>
                    )}
                    <td className="ho-nowrap" data-label="Date">{dateStr}</td>
                    <td data-label="Type">
                      <span style={{ padding: '2px 10px', borderRadius: 20, background: ht?.bg || '#f9fafb', color: ht?.color || '#374151', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', display: 'inline-block' }}>
                        {ht?.label || e.type}
                      </span>
                    </td>
                    <td className="ho-nowrap" data-label="Hours" style={{ fontWeight: 600 }}>{e.hours} hrs</td>
                    <td className="ho-notes" data-label="Notes">{e.notes || '—'}</td>
                    <td data-label="Logged by" style={{ color: '#6b7280', fontSize: 12 }}>{loggedBy}</td>
                    <td data-label="Status"><SignOffBadge entry={e} /></td>
                    <td data-label="">
                      <EntryActions
                        entry={e}
                        canApprove={canApprove}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onApprove={onApprove}
                        onUnapprove={onUnapprove}
                        onRequestChange={onRequestChange}
                        hasPendingCR={hasPendingCR}
                        changeRequest={cr}
                        onResolveCR={onResolve}
                        busy={busyId === e.id}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
                <td style={{ fontWeight: 700, color: '#111827' }} colSpan={showChecks ? 3 : 2}>
                  {typeFilter === 'all' ? 'Filtered total' : `${HOUR_TYPES.find(t => t.key === typeFilter)?.label} total`}
                </td>
                <td className="ho-nowrap" style={{ fontWeight: 700, color: '#7c3aed' }}>{filteredTotal} hrs</td>
                <td colSpan={colCount - (showChecks ? 4 : 3)}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {sorted.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => changePageSize(e.target.value)}
              style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, color: '#111827', background: '#fff', cursor: 'pointer' }}
            >
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              <option value="all">All</option>
            </select>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {showAll
                ? `Showing all ${sorted.length}`
                : `${pageStart + 1}–${Math.min(pageStart + pageSize, sorted.length)} of ${sorted.length}`}
            </span>
            {!showAll && totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => goToPage(1)} disabled={page === 1} style={pageBtnStyle(page === 1)} title="First page">«</button>
                <button onClick={() => goToPage(page - 1)} disabled={page === 1} style={pageBtnStyle(page === 1)}>←</button>
                <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, padding: '0 4px' }}>
                  Page {page} of {totalPages}
                </span>
                <button onClick={() => goToPage(page + 1)} disabled={page === totalPages} style={pageBtnStyle(page === totalPages)}>→</button>
                <button onClick={() => goToPage(totalPages)} disabled={page === totalPages} style={pageBtnStyle(page === totalPages)} title="Last page">»</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function pageBtnStyle(disabled) {
  return {
    padding: '4px 10px', borderRadius: 7, border: '1px solid #e5e7eb',
    background: '#fff', color: disabled ? '#d1d5db' : '#374151',
    fontSize: 13, cursor: disabled ? 'default' : 'pointer',
  };
}

function FilterChip({ label, active, onClick, bg, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 20,
        border: '1px solid',
        borderColor: active ? (color || '#7c3aed') : '#d1d5db',
        background: active ? (bg || '#ede9fe') : '#fff',
        color: active ? (color || '#6d28d9') : '#374151',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

const primaryBtnStyle = {
  padding: '8px 18px', borderRadius: 8, border: 'none', background: '#7c3aed',
  color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
};

const secondaryBtnStyle = {
  padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff',
  color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
