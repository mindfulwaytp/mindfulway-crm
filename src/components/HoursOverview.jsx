import { HOUR_TYPES } from '../lib/hourEntriesApi';

const tdStyle = { padding: '10px 12px', verticalAlign: 'top' };

const primaryBtnStyle = {
  padding: '8px 18px', borderRadius: 8, border: 'none', background: '#7c3aed',
  color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
};

export default function HoursOverview({
  entries,
  onAddEntry,
  sort,
  onSortChange,
  typeFilter,
  onTypeFilterChange,
  // Supervisor mode (one or both):
  changeRequests,
  onResolve,
  // Intern/associate mode (one or both):
  pendingCRIds,
  onRequestChange,
}) {
  const filtered = typeFilter === 'all'
    ? entries
    : entries.filter((e) => e.type === typeFilter);

  const sorted = [...filtered].sort((a, b) => {
    let av, bv;
    if (sort.key === 'date') { av = a.date.seconds; bv = b.date.seconds; }
    else if (sort.key === 'type') { av = a.type; bv = b.type; }
    else if (sort.key === 'hours') { av = a.hours; bv = b.hours; }
    else if (sort.key === 'loggedBy') {
      av = a.createdBy?.name || (a.createdBy?.role && a.createdBy.role !== 'intern' ? a.createdBy.role : 'Intern');
      bv = b.createdBy?.name || (b.createdBy?.role && b.createdBy.role !== 'intern' ? b.createdBy.role : 'Intern');
    }
    if (av < bv) return sort.dir === 'asc' ? -1 : 1;
    if (av > bv) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  function toggleSort(key) {
    if (sort.key === key) {
      onSortChange({ key, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ key, dir: key === 'date' ? 'desc' : 'asc' });
    }
  }

  const sortIndicator = (key) => sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';

  const filteredTotal = filtered.reduce((s, e) => s + (e.hours || 0), 0);
  const totalsByType = {};
  HOUR_TYPES.forEach(({ key }) => { totalsByType[key] = 0; });
  entries.forEach((e) => { if (totalsByType[e.type] !== undefined) totalsByType[e.type] += (e.hours || 0); });
  const grandTotal = Object.values(totalsByType).reduce((s, v) => s + v, 0);

  const headerStyle = { padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
      {/* Filter chips + add button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <FilterChip label={`All (${entries.length})`} active={typeFilter === 'all'} onClick={() => onTypeFilterChange('all')} />
          {HOUR_TYPES.map((ht) => {
            const count = entries.filter((e) => e.type === ht.key).length;
            if (count === 0) return null;
            return (
              <FilterChip
                key={ht.key}
                label={`${ht.label} (${count})`}
                active={typeFilter === ht.key}
                onClick={() => onTypeFilterChange(ht.key)}
                bg={ht.bg}
                color={ht.color}
              />
            );
          })}
        </div>
        {onAddEntry && (
          <button onClick={onAddEntry} style={primaryBtnStyle}>+ Add Entry</button>
        )}
      </div>

      {/* Type-totals strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, padding: '12px 14px', background: '#f9fafb', borderRadius: 8, fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: '#111827' }}>
          Grand Total: <span style={{ color: '#7c3aed' }}>{grandTotal} hrs</span>
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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={headerStyle} onClick={() => toggleSort('date')}>Date{sortIndicator('date')}</th>
                <th style={headerStyle} onClick={() => toggleSort('type')}>Type{sortIndicator('type')}</th>
                <th style={headerStyle} onClick={() => toggleSort('hours')}>Hours{sortIndicator('hours')}</th>
                <th style={{ ...headerStyle, cursor: 'default' }}>Notes</th>
                <th style={headerStyle} onClick={() => toggleSort('loggedBy')}>Logged by{sortIndicator('loggedBy')}</th>
                <th style={{ ...headerStyle, cursor: 'default' }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => {
                const cr = changeRequests
                  ? changeRequests.find((r) => r.entryId === e.id && r.status === 'pending')
                  : null;
                const hasPendingCR = !!cr || (pendingCRIds && pendingCRIds.has(e.id));
                const ht = HOUR_TYPES.find((t) => t.key === e.type);
                const dateStr = new Date(e.date.seconds * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                const loggedBy = e.createdBy?.role && e.createdBy.role !== 'intern'
                  ? `${e.createdBy.name || e.createdBy.role} (${e.createdBy.role})`
                  : 'Intern';
                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9', background: hasPendingCR ? '#fffbeb' : '#fff' }}>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{dateStr}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '2px 10px', borderRadius: 20, background: ht?.bg || '#f9fafb', color: ht?.color || '#374151', fontWeight: 600, fontSize: 12 }}>
                        {ht?.label || e.type}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{e.hours} hrs</td>
                    <td style={{ ...tdStyle, color: '#6b7280', maxWidth: 280 }}>{e.notes || '—'}</td>
                    <td style={{ ...tdStyle, color: '#6b7280', fontSize: 12 }}>{loggedBy}</td>
                    <td style={tdStyle}>
                      {cr && onResolve && (
                        <div style={{ fontSize: 12 }}>
                          <div style={{ color: '#d97706', fontWeight: 600, marginBottom: 2 }}>Change requested</div>
                          <div style={{ color: '#6b7280', marginBottom: 4 }}>{cr.reason}</div>
                          <button
                            onClick={() => onResolve(cr.id)}
                            style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, cursor: 'pointer' }}
                          >
                            Mark resolved
                          </button>
                        </div>
                      )}
                      {!onResolve && onRequestChange && (
                        hasPendingCR ? (
                          <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>Change requested</span>
                        ) : (
                          <button
                            onClick={() => onRequestChange(e)}
                            style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280' }}
                          >
                            Request change
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#111827' }} colSpan={2}>
                  {typeFilter === 'all' ? 'Filtered total' : `${HOUR_TYPES.find(t => t.key === typeFilter)?.label} total`}
                </td>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#7c3aed' }}>{filteredTotal} hrs</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
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
