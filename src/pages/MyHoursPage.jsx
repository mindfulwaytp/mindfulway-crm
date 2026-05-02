import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { fetchInternProfile } from '../lib/internProfilesApi';
import {
  HOUR_TYPES, fetchHourEntries, addHourEntry, submitChangeRequest,
  getMondayOf, formatWeekLabel, entriesInWeek, sumByType,
} from '../lib/hourEntriesApi';
import HourEntryModal from '../components/HourEntryModal';
import NotificationBell from '../components/NotificationBell';
import HoursOverview from '../components/HoursOverview';

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ logged, required, color }) {
  const pct = required > 0 ? Math.min(100, Math.round((logged / required) * 100)) : 0;
  const over = required > 0 && logged >= required;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: over ? '#059669' : '#374151' }}>{logged} / {required} hrs</span>
        <span style={{ color: over ? '#059669' : '#6b7280' }}>{pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: over ? '#10b981' : (color || '#7c3aed'), transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function ChangeRequestModal({ entry, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const ht = HOUR_TYPES.find((t) => t.key === entry.type);
  const dateStr = new Date(entry.date.seconds * 1000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(entry.id, reason);
      onClose();
    } catch {
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Request a Change</h2>
      <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
        <div style={{ fontWeight: 600 }}>{dateStr}</div>
        <div style={{ color: '#6b7280', marginTop: 2 }}>{ht?.label} · {entry.hours} hrs{entry.notes ? ` · ${entry.notes}` : ''}</div>
      </div>
      <form onSubmit={handleSubmit}>
        <FormField label="What needs to be changed?">
          <textarea
            value={reason} onChange={(e) => setReason(e.target.value)}
            rows={4} required placeholder="Describe what's incorrect and what the correct information should be…"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </FormField>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button type="submit" disabled={saving || !reason.trim()} style={primaryBtnStyle}>{saving ? 'Submitting…' : 'Submit Request'}</button>
        </div>
      </form>
    </Overlay>
  );
}

function Overlay({ onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 460, maxWidth: '90vw', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyHoursPage({ onNav }) {
  const { providerName, user, isAdmin, isSupervisor, signOut } = useAuth();
  const [requirements, setRequirements] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monday, setMonday] = useState(() => getMondayOf(new Date()));
  const [showAddModal, setShowAddModal] = useState(false);
  const [changeEntry, setChangeEntry] = useState(null); // entry to request change on
  const [pendingCRs, setPendingCRs] = useState(new Set()); // entry IDs with pending CRs
  const [hoursTab, setHoursTab] = useState('week'); // 'week' | 'overview'
  const [overviewSort, setOverviewSort] = useState({ key: 'date', dir: 'desc' });
  const [overviewTypeFilter, setOverviewTypeFilter] = useState('all');

  const load = useCallback(async () => {
    if (!providerName) return;
    setLoading(true);
    try {
      const [profile, entryList] = await Promise.all([
        fetchInternProfile(providerName),
        fetchHourEntries(providerName),
      ]);
      setRequirements(profile);
      setEntries(entryList);
    } finally {
      setLoading(false);
    }
  }, [providerName]);

  useEffect(() => { load(); }, [load]);

  const totals = sumByType(entries);
  const totalLogged = Object.values(totals).reduce((s, v) => s + v, 0);
  const weekEntries = entriesInWeek(entries, monday);

  async function handleAddEntry(form) {
    await addHourEntry({ internName: providerName, ...form });
    await load();
  }

  async function handleChangeRequest(entryId, reason) {
    await submitChangeRequest({ entryId, internName: providerName, reason });
    setPendingCRs((s) => new Set([...s, entryId]));
  }

  const showNavTabs = !!onNav;

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Mindful Way</span>
          {showNavTabs && (
            <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
              <button onClick={() => onNav('availability')} style={tabStyle(false)}>My Availability</button>
              <button style={tabStyle(true)}>My Hours</button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NotificationBell providerName={providerName} />
          <span style={{ fontSize: 13, color: '#6b7280' }}>{user?.email}</span>
          <button onClick={signOut} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ padding: '40px 40px 32px', maxWidth: 900 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, letterSpacing: '0.01em' }}>
            {isAdmin || isSupervisor ? `${providerName} — Hours` : 'My Hours'}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
            Log your clinical hours and track progress toward your requirements.
          </p>
        </div>

        {loading ? (
          <div style={{ color: '#6b7280', fontSize: 14 }}>Loading…</div>
        ) : (
          <>
            {/* Progress tracker */}
            {requirements ? (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 28 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Progress Tracker</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Total Hours</div>
                    <ProgressBar logged={totalLogged} required={requirements.totalHoursRequired || 0} color="#7c3aed" />
                  </div>
                  {HOUR_TYPES.map(({ key, label, reqField, color }) => {
                    const req = requirements[reqField] || 0;
                    if (req === 0) return null;
                    return (
                      <div key={key}>
                        <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</div>
                        <ProgressBar logged={totals[key] || 0} required={req} color={color} />
                      </div>
                    );
                  })}
                </div>
                {requirements.supervisorName && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9', fontSize: 13, color: '#6b7280' }}>
                    Supervisor: <strong style={{ color: '#374151' }}>{requirements.supervisorName}</strong>
                    {requirements.startDate && <span style={{ marginLeft: 16 }}>Started: {requirements.startDate}</span>}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12, padding: '16px 20px', marginBottom: 28, fontSize: 13, color: '#92400e' }}>
                No requirements set yet. Ask your administrator to set up your intern profile.
              </div>
            )}

            {/* View tabs */}
            <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
              <button onClick={() => setHoursTab('week')} style={detailTabStyle(hoursTab === 'week')}>Week Log</button>
              <button onClick={() => setHoursTab('overview')} style={detailTabStyle(hoursTab === 'overview')}>Hours Overview</button>
            </div>

            {hoursTab === 'week' && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => setMonday((m) => { const d = new Date(m); d.setDate(d.getDate() - 7); return d; })} style={navBtnStyle}>←</button>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Week of {formatWeekLabel(monday)}</span>
                    <button onClick={() => setMonday((m) => { const d = new Date(m); d.setDate(d.getDate() + 7); return d; })} style={navBtnStyle}>→</button>
                  </div>
                  <button onClick={() => setShowAddModal(true)} style={primaryBtnStyle}>+ Add Entry</button>
                </div>

                {weekEntries.length === 0 ? (
                  <div style={{ color: '#9ca3af', fontSize: 13, padding: '16px 0' }}>No entries for this week.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                        {['Date', 'Type', 'Hours', 'Notes', ''].map((h) => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weekEntries.map((e) => {
                        const ht = HOUR_TYPES.find((t) => t.key === e.type);
                        const hasPendingCR = pendingCRs.has(e.id);
                        const dateStr = new Date(e.date.seconds * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                        return (
                          <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9', background: hasPendingCR ? '#fffbeb' : '#fff' }}>
                            <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>{dateStr}</td>
                            <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                              <span style={{ padding: '2px 10px', borderRadius: 20, background: ht?.bg || '#f9fafb', color: ht?.color || '#374151', fontWeight: 600, fontSize: 12 }}>
                                {ht?.label || e.type}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>{e.hours} hrs</td>
                            <td style={{ padding: '10px 12px', verticalAlign: 'middle', color: '#6b7280' }}>{e.notes || '—'}</td>
                            <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                              {hasPendingCR ? (
                                <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>Change requested</span>
                              ) : (
                                <button
                                  onClick={() => setChangeEntry(e)}
                                  style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280' }}
                                >
                                  Request change
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {hoursTab === 'overview' && (
              <HoursOverview
                entries={entries}
                onAddEntry={() => setShowAddModal(true)}
                sort={overviewSort}
                onSortChange={setOverviewSort}
                typeFilter={overviewTypeFilter}
                onTypeFilterChange={setOverviewTypeFilter}
                pendingCRIds={pendingCRs}
                onRequestChange={(e) => setChangeEntry(e)}
              />
            )}
          </>
        )}
      </div>

      {showAddModal && (
        <HourEntryModal onClose={() => setShowAddModal(false)} onSave={handleAddEntry} />
      )}
      {changeEntry && (
        <ChangeRequestModal entry={changeEntry} onClose={() => setChangeEntry(null)} onSubmit={handleChangeRequest} />
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db',
  fontSize: 14, color: '#111827', boxSizing: 'border-box',
};

const primaryBtnStyle = {
  padding: '8px 18px', borderRadius: 8, border: 'none', background: '#7c3aed',
  color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
};

const cancelBtnStyle = {
  padding: '8px 18px', borderRadius: 8, border: '1px solid #d1d5db',
  background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer',
};

const navBtnStyle = {
  padding: '5px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
  background: '#fff', cursor: 'pointer', fontSize: 14, color: '#374151',
};

function tabStyle(active) {
  return {
    padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', background: active ? '#fff' : 'transparent',
    color: active ? '#111827' : '#6b7280',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
  };
}

function detailTabStyle(active) {
  return {
    padding: '7px 18px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', background: active ? '#fff' : 'transparent',
    color: active ? '#111827' : '#6b7280',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
  };
}
