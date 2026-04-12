import { useState, useEffect, useCallback } from 'react';
import { fetchProviderProfiles } from '../lib/providersProfileApi';
import { fetchAllInternProfiles, upsertInternProfile, EMPTY_INTERN_REQUIREMENTS } from '../lib/internProfilesApi';
import {
  HOUR_TYPES, fetchAllHourEntries, fetchAllChangeRequests, resolveChangeRequest,
  getMondayOf, formatWeekLabel, entriesInWeek, sumByType,
} from '../lib/hourEntriesApi';

function ProgressBar({ logged, required, color }) {
  const pct = required > 0 ? Math.min(100, Math.round((logged / required) * 100)) : 0;
  const over = required > 0 && logged >= required;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 7, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: over ? '#10b981' : color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, color: over ? '#10b981' : '#6b7280', fontWeight: 600, minWidth: 72, textAlign: 'right' }}>
        {logged} / {required} hrs
      </span>
    </div>
  );
}

function RequirementsForm({ draft, onChange, onSave, saving }) {
  const fields = [
    { key: 'totalHoursRequired', label: 'Total Hours' },
    { key: 'directContactHoursRequired', label: 'Direct Contact' },
    { key: 'supervisionHoursRequired', label: 'Supervision' },
    { key: 'groupTherapyHoursRequired', label: 'Group Therapy' },
    { key: 'relationalTherapyHoursRequired', label: 'Relational Therapy (0 = N/A)' },
    { key: 'adminHoursRequired', label: 'Administrative' },
  ];
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Requirements</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
        {fields.map(({ key, label }) => (
          <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label}
            <input
              type="number"
              min={0}
              step={0.5}
              value={draft[key] ?? 0}
              onChange={(e) => onChange(key, Number(e.target.value))}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, fontWeight: 500, color: '#111827', width: '100%' }}
            />
          </label>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Supervisor
          <input
            type="text"
            value={draft.supervisorName || ''}
            onChange={(e) => onChange('supervisorName', e.target.value)}
            placeholder="Supervisor name"
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, color: '#111827' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Start Date
          <input
            type="date"
            value={draft.startDate || ''}
            onChange={(e) => onChange('startDate', e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, color: '#111827' }}
          />
        </label>
      </div>
      <button
        onClick={onSave}
        disabled={saving}
        style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 600, fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
      >
        {saving ? 'Saving…' : 'Save Requirements'}
      </button>
    </div>
  );
}

function WeekNav({ monday, onPrev, onNext }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <button onClick={onPrev} style={navBtnStyle}>←</button>
      <span style={{ fontWeight: 600, fontSize: 14 }}>Week of {formatWeekLabel(monday)}</span>
      <button onClick={onNext} style={navBtnStyle}>→</button>
    </div>
  );
}

function EntriesTable({ entries, changeRequests, onResolve }) {
  if (entries.length === 0) {
    return <div style={{ color: '#9ca3af', fontSize: 13, padding: '20px 0' }}>No entries for this week.</div>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
          {['Date', 'Type', 'Hours', 'Notes', ''].map((h) => (
            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => {
          const cr = changeRequests.find((r) => r.entryId === e.id && r.status === 'pending');
          const ht = HOUR_TYPES.find((t) => t.key === e.type);
          const dateStr = new Date(e.date.seconds * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          return (
            <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9', background: cr ? '#fffbeb' : '#fff' }}>
              <td style={tdStyle}>{dateStr}</td>
              <td style={tdStyle}>
                <span style={{ padding: '2px 10px', borderRadius: 20, background: ht?.bg || '#f9fafb', color: ht?.color || '#374151', fontWeight: 600, fontSize: 12 }}>
                  {ht?.label || e.type}
                </span>
              </td>
              <td style={tdStyle}>{e.hours} hrs</td>
              <td style={{ ...tdStyle, color: '#6b7280', maxWidth: 220 }}>{e.notes || '—'}</td>
              <td style={tdStyle}>
                {cr && (
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
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function InternHoursPage() {
  const [interns, setInterns] = useState([]);
  const [internProfiles, setInternProfiles] = useState({});
  const [allEntries, setAllEntries] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [monday, setMonday] = useState(() => getMondayOf(new Date()));
  const [reqDraft, setReqDraft] = useState({});
  const [savingReq, setSavingReq] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [providers, profiles, entries, crs] = await Promise.all([
        fetchProviderProfiles(),
        fetchAllInternProfiles(),
        fetchAllHourEntries(),
        fetchAllChangeRequests(),
      ]);
      const internList = providers
        .filter((p) => Array.isArray(p.roles) ? p.roles.includes('intern') : p.isIntern)
        .sort((a, b) => a.name.localeCompare(b.name));
      setInterns(internList);
      setInternProfiles(profiles);
      setAllEntries(entries);
      setChangeRequests(crs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function selectIntern(name) {
    setSelected(name);
    setReqDraft({ ...EMPTY_INTERN_REQUIREMENTS, ...(internProfiles[name] || {}) });
    setMonday(getMondayOf(new Date()));
  }

  async function saveRequirements() {
    setSavingReq(true);
    try {
      await upsertInternProfile(selected, reqDraft);
      setInternProfiles((prev) => ({ ...prev, [selected]: reqDraft }));
    } finally {
      setSavingReq(false);
    }
  }

  async function handleResolve(reqId) {
    await resolveChangeRequest(reqId);
    setChangeRequests((prev) => prev.map((r) => r.id === reqId ? { ...r, status: 'resolved' } : r));
  }

  if (loading) return <div style={{ padding: 40, color: '#6b7280' }}>Loading…</div>;

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selected) {
    const req = internProfiles[selected] || {};
    const internEntries = allEntries.filter((e) => e.internName === selected);
    const weekEntries = entriesInWeek(internEntries, monday);
    const totals = sumByType(internEntries);
    const totalLogged = Object.values(totals).reduce((s, v) => s + v, 0);
    const pendingCRs = changeRequests.filter((r) => r.internName === selected && r.status === 'pending');

    return (
      <div style={{ padding: '32px 40px', maxWidth: 960 }}>
        <button onClick={() => setSelected(null)} style={{ ...navBtnStyle, marginBottom: 20, padding: '6px 14px', fontSize: 13 }}>
          ← All Interns
        </button>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{selected}</h1>
          {req.supervisorName && (
            <span style={{ fontSize: 14, color: '#6b7280' }}>Supervisor: {req.supervisorName}</span>
          )}
          {req.startDate && (
            <span style={{ fontSize: 13, color: '#9ca3af' }}>Started {req.startDate}</span>
          )}
        </div>

        {/* Progress summary */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Progress</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', fontWeight: 600, marginBottom: 4 }}>
              <span>Total</span>
            </div>
            <ProgressBar logged={totalLogged} required={req.totalHoursRequired || 0} color="#7c3aed" />
          </div>
          {HOUR_TYPES.map(({ key, label, reqField, color }) => {
            const req_hours = req[reqField] || 0;
            if (req_hours === 0) return null;
            return (
              <div key={key} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 3 }}>{label}</div>
                <ProgressBar logged={totals[key] || 0} required={req_hours} color={color} />
              </div>
            );
          })}
        </div>

        <RequirementsForm
          draft={reqDraft}
          onChange={(k, v) => setReqDraft((d) => ({ ...d, [k]: v }))}
          onSave={saveRequirements}
          saving={savingReq}
        />

        {/* Week log */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <WeekNav monday={monday} onPrev={() => setMonday((m) => { const d = new Date(m); d.setDate(d.getDate() - 7); return d; })} onNext={() => setMonday((m) => { const d = new Date(m); d.setDate(d.getDate() + 7); return d; })} />
          <EntriesTable entries={weekEntries} changeRequests={changeRequests} onResolve={handleResolve} />
        </div>

        {/* Pending change requests */}
        {pendingCRs.length > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginBottom: 12 }}>
              Pending Change Requests ({pendingCRs.length})
            </div>
            {pendingCRs.map((cr) => {
              const entry = allEntries.find((e) => e.id === cr.entryId);
              return (
                <div key={cr.id} style={{ borderBottom: '1px solid #fde68a', paddingBottom: 12, marginBottom: 12 }}>
                  {entry && (
                    <div style={{ fontSize: 13, marginBottom: 4 }}>
                      {new Date(entry.date.seconds * 1000).toLocaleDateString()} · {HOUR_TYPES.find(t => t.key === entry.type)?.label} · {entry.hours} hrs
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>"{cr.reason}"</div>
                  <button onClick={() => handleResolve(cr.id)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, cursor: 'pointer' }}>
                    Mark resolved
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── All interns list ─────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '32px 40px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>Intern Hours</h1>
      <p style={{ margin: '0 0 28px', fontSize: 14, color: '#6b7280' }}>
        Track progress for all interns against their hour requirements.
      </p>

      {interns.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 14 }}>
          No interns found. Add the <strong>Intern</strong> role to a provider profile to get started.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {interns.map((intern) => {
            const req = internProfiles[intern.name] || {};
            const entries = allEntries.filter((e) => e.internName === intern.name);
            const totals = sumByType(entries);
            const totalLogged = Object.values(totals).reduce((s, v) => s + v, 0);
            const total = req.totalHoursRequired || 0;
            const pct = total > 0 ? Math.min(100, Math.round((totalLogged / total) * 100)) : 0;
            const pendingCount = changeRequests.filter((r) => r.internName === intern.name && r.status === 'pending').length;

            return (
              <div key={intern.name} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{intern.name}</div>
                  {pendingCount > 0 && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#92400e', fontWeight: 600, border: '1px solid #fde68a' }}>
                      {pendingCount} change request{pendingCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {req.supervisorName && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Supervisor: {req.supervisorName}</div>
                )}

                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', fontWeight: 600, marginBottom: 4 }}>
                    <span>Total Progress</span>
                    <span style={{ color: '#6b7280' }}>{pct}%</span>
                  </div>
                  <ProgressBar logged={totalLogged} required={total} color="#7c3aed" />
                </div>

                {HOUR_TYPES.map(({ key, label, reqField, color }) => {
                  const req_hrs = req[reqField] || 0;
                  if (req_hrs === 0) return null;
                  return (
                    <div key={key} style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
                      <ProgressBar logged={totals[key] || 0} required={req_hrs} color={color} />
                    </div>
                  );
                })}

                <button
                  onClick={() => selectIntern(intern.name)}
                  style={{ marginTop: 14, width: '100%', padding: '8px 0', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#374151' }}
                >
                  View Details →
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const navBtnStyle = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  color: '#374151',
};

const tdStyle = {
  padding: '10px 12px',
  verticalAlign: 'top',
};
