import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { fetchProviderProfiles } from '../lib/providersProfileApi';
import { fetchAllInternProfiles, upsertInternProfile, EMPTY_INTERN_REQUIREMENTS } from '../lib/internProfilesApi';
import {
  HOUR_TYPES, fetchAllHourEntries, fetchAllChangeRequests, resolveChangeRequest,
  addHourEntry, getMondayOf, formatWeekLabel, entriesInWeek, sumByType,
} from '../lib/hourEntriesApi';
import { createNotification } from '../lib/notificationsApi';
import HourEntryModal from '../components/HourEntryModal';
import NotificationBell from '../components/NotificationBell';

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

function RequirementsForm({ draft, onChange, onSave, saving, supervisorOptions, canEdit, showEndDate }) {
  const fields = [
    { key: 'totalHoursRequired', label: 'Total Hours' },
    { key: 'directContactHoursRequired', label: 'Direct Contact' },
    { key: 'supervisionHoursRequired', label: 'Supervision' },
    { key: 'groupTherapyHoursRequired', label: 'Group Therapy' },
    { key: 'relationalTherapyHoursRequired', label: 'Relational Therapy (0 = N/A)' },
    { key: 'adminHoursRequired', label: 'Administrative' },
  ];
  const dateFieldStyle = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' };
  const dateInputStyle = { padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, color: '#111827', background: canEdit ? '#fff' : '#f9fafb' };
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
              disabled={!canEdit}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, fontWeight: 500, color: '#111827', width: '100%', background: canEdit ? '#fff' : '#f9fafb' }}
            />
          </label>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: showEndDate ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <label style={dateFieldStyle}>
          Supervisor
          <select
            value={draft.supervisorName || ''}
            onChange={(e) => onChange('supervisorName', e.target.value)}
            disabled={!canEdit}
            style={dateInputStyle}
          >
            <option value="">— Unassigned —</option>
            {supervisorOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            {draft.supervisorName && !supervisorOptions.includes(draft.supervisorName) && (
              <option value={draft.supervisorName}>{draft.supervisorName} (legacy)</option>
            )}
          </select>
        </label>
        <label style={dateFieldStyle}>
          Start Date
          <input
            type="date"
            value={draft.startDate || ''}
            onChange={(e) => onChange('startDate', e.target.value)}
            disabled={!canEdit}
            style={dateInputStyle}
          />
        </label>
        {showEndDate && (
          <label style={dateFieldStyle}>
            End Date
            <input
              type="date"
              value={draft.endDate || ''}
              onChange={(e) => onChange('endDate', e.target.value)}
              disabled={!canEdit}
              style={dateInputStyle}
            />
          </label>
        )}
      </div>
      {canEdit && (
        <button
          onClick={onSave}
          disabled={saving}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 600, fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Save Requirements'}
        </button>
      )}
    </div>
  );
}

function WeekNav({ monday, onPrev, onNext }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
          {['Date', 'Type', 'Hours', 'Notes', 'Logged by', ''].map((h) => (
            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => {
          const cr = changeRequests.find((r) => r.entryId === e.id && r.status === 'pending');
          const ht = HOUR_TYPES.find((t) => t.key === e.type);
          const dateStr = new Date(e.date.seconds * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const loggedBy = e.createdBy?.role && e.createdBy.role !== 'intern'
            ? `${e.createdBy.name || e.createdBy.role} (${e.createdBy.role})`
            : 'Intern';
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
              <td style={{ ...tdStyle, color: '#6b7280', fontSize: 12 }}>{loggedBy}</td>
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

export default function InternHoursPage({ onNav }) {
  const { user, providerName, isAdmin, isSupervisor, signOut } = useAuth();
  const [interns, setInterns] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [internProfiles, setInternProfiles] = useState({});
  const [allEntries, setAllEntries] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailTab, setDetailTab] = useState('settings'); // 'settings' | 'week' | 'overview'
  const [monday, setMonday] = useState(() => getMondayOf(new Date()));
  const [reqDraft, setReqDraft] = useState({});
  const [savingReq, setSavingReq] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [overviewSort, setOverviewSort] = useState({ key: 'date', dir: 'desc' });
  const [overviewTypeFilter, setOverviewTypeFilter] = useState('all');

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
        .filter((p) => {
          if (Array.isArray(p.roles)) {
            return p.roles.includes('intern') || p.roles.includes('associate');
          }
          return p.isIntern;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      const supervisorList = providers
        .filter((p) => Array.isArray(p.roles) && p.roles.includes('supervisor'))
        .map((p) => p.name)
        .sort((a, b) => a.localeCompare(b));
      setInterns(internList);
      setSupervisors(supervisorList);
      setInternProfiles(profiles);
      setAllEntries(entries);
      setChangeRequests(crs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Scope interns by assignment for non-admin supervisors
  const visibleInterns = useMemo(() => {
    if (isAdmin) return interns;
    if (isSupervisor && providerName) {
      return interns.filter((i) => internProfiles[i.name]?.supervisorName === providerName);
    }
    return [];
  }, [interns, internProfiles, isAdmin, isSupervisor, providerName]);

  function selectIntern(name) {
    setSelected(name);
    setDetailTab('settings');
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

  async function handleAddEntry(form) {
    const role = isAdmin ? 'admin' : 'supervisor';
    await addHourEntry({
      internName: selected,
      ...form,
      createdBy: {
        uid: user?.uid || '',
        providerName: providerName || '',
        name: providerName || user?.email || '',
        role,
      },
    });
    try {
      const ht = HOUR_TYPES.find((t) => t.key === form.type);
      const dateLabel = new Date(form.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      await createNotification({
        recipientProviderName: selected,
        type: 'hours_logged',
        message: `${providerName || 'Your supervisor'} logged ${form.hours} hr${Number(form.hours) === 1 ? '' : 's'} of ${ht?.label || form.type} for you on ${dateLabel}.`,
        createdByName: providerName || '',
      });
    } catch (e) {
      console.error('Failed to create notification', e);
    }
    await load();
  }

  // Header for standalone (non-admin) view
  const standaloneHeader = onNav && (
    <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Mindful Way</span>
        <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
          <button onClick={() => onNav('availability')} style={tabStyle(false)}>My Availability</button>
          <button style={tabStyle(true)}>Hours Log</button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <NotificationBell providerName={providerName} />
        <span style={{ fontSize: 13, color: '#6b7280' }}>{user?.email}</span>
        <button onClick={signOut} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
          Sign out
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ minHeight: onNav ? '100vh' : 'auto', background: '#f9fafb' }}>
        {standaloneHeader}
        <div style={{ padding: 40, color: '#6b7280' }}>Loading…</div>
      </div>
    );
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selected) {
    const req = internProfiles[selected] || {};
    const selectedIntern = interns.find((i) => i.name === selected);
    const selectedRoles = Array.isArray(selectedIntern?.roles)
      ? selectedIntern.roles
      : (selectedIntern?.isIntern ? ['intern'] : []);
    const isInternRole = selectedRoles.includes('intern');
    const internEntries = allEntries.filter((e) => e.internName === selected);
    const weekEntries = entriesInWeek(internEntries, monday);
    const totals = sumByType(internEntries);
    const totalLogged = Object.values(totals).reduce((s, v) => s + v, 0);
    const pendingCRs = changeRequests.filter((r) => r.internName === selected && r.status === 'pending');

    return (
      <div style={{ minHeight: onNav ? '100vh' : 'auto', background: '#f9fafb' }}>
        {standaloneHeader}
        <div style={{ padding: '32px 40px', maxWidth: 960 }}>
          <button onClick={() => setSelected(null)} style={{ ...navBtnStyle, marginBottom: 20, padding: '6px 14px', fontSize: 13 }}>
            ← All Interns
          </button>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{selected}</h1>
            {req.supervisorName && (
              <span style={{ fontSize: 14, color: '#6b7280' }}>Supervisor: {req.supervisorName}</span>
            )}
            {req.startDate && (
              <span style={{ fontSize: 13, color: '#9ca3af' }}>Started {req.startDate}</span>
            )}
            {isInternRole && req.endDate && (
              <span style={{ fontSize: 13, color: '#9ca3af' }}>Ends {req.endDate}</span>
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

          {/* Detail tabs */}
          <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
            <button onClick={() => setDetailTab('settings')} style={detailTabStyle(detailTab === 'settings')}>Settings</button>
            <button onClick={() => setDetailTab('week')} style={detailTabStyle(detailTab === 'week')}>Week Log</button>
            <button onClick={() => setDetailTab('overview')} style={detailTabStyle(detailTab === 'overview')}>Hours Overview</button>
          </div>

          {detailTab === 'settings' && (
            <RequirementsForm
              draft={reqDraft}
              onChange={(k, v) => setReqDraft((d) => ({ ...d, [k]: v }))}
              onSave={saveRequirements}
              saving={savingReq}
              supervisorOptions={supervisors}
              canEdit={isAdmin}
              showEndDate={isInternRole}
            />
          )}

          {detailTab === 'week' && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <WeekNav
                  monday={monday}
                  onPrev={() => setMonday((m) => { const d = new Date(m); d.setDate(d.getDate() - 7); return d; })}
                  onNext={() => setMonday((m) => { const d = new Date(m); d.setDate(d.getDate() + 7); return d; })}
                />
                <button onClick={() => setShowAddModal(true)} style={primaryBtnStyle}>+ Add Entry</button>
              </div>
              <EntriesTable entries={weekEntries} changeRequests={changeRequests} onResolve={handleResolve} />
            </div>
          )}

          {detailTab === 'overview' && (
            <HoursOverview
              entries={internEntries}
              changeRequests={changeRequests}
              onResolve={handleResolve}
              onAddEntry={() => setShowAddModal(true)}
              sort={overviewSort}
              onSortChange={setOverviewSort}
              typeFilter={overviewTypeFilter}
              onTypeFilterChange={setOverviewTypeFilter}
            />
          )}

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

        {showAddModal && (
          <HourEntryModal
            internName={selected}
            title="Log Hours for Intern"
            onClose={() => setShowAddModal(false)}
            onSave={handleAddEntry}
          />
        )}
      </div>
    );
  }

  // ── All interns list ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: onNav ? '100vh' : 'auto', background: '#f9fafb' }}>
      {standaloneHeader}
      <div style={{ padding: '32px 40px' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>Hours Log</h1>
        <p style={{ margin: '0 0 28px', fontSize: 14, color: '#6b7280' }}>
          {isAdmin
            ? 'Track progress for all interns and associates against their hour requirements.'
            : 'Track progress for the interns and associates you supervise.'}
        </p>

        {visibleInterns.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 14 }}>
            {isAdmin
              ? <>No interns or associates found. Add the <strong>Intern</strong> or <strong>Associate</strong> role to a provider profile to get started.</>
              : <>No interns or associates are currently assigned to you. Ask an administrator to assign them to your supervision.</>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {visibleInterns.map((intern) => {
              const req = internProfiles[intern.name] || {};
              const entries = allEntries.filter((e) => e.internName === intern.name);
              const totals = sumByType(entries);
              const totalLogged = Object.values(totals).reduce((s, v) => s + v, 0);
              const total = req.totalHoursRequired || 0;
              const pct = total > 0 ? Math.min(100, Math.round((totalLogged / total) * 100)) : 0;
              const pendingCount = changeRequests.filter((r) => r.internName === intern.name && r.status === 'pending').length;

              const roles = Array.isArray(intern.roles) ? intern.roles : (intern.isIntern ? ['intern'] : []);
              const isAssoc = roles.includes('associate');
              const roleLabel = isAssoc && !roles.includes('intern') ? 'Associate' : 'Intern';
              const rolePillColors = isAssoc && !roles.includes('intern')
                ? { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' }
                : { bg: '#fef3c7', color: '#92400e', border: '#fde68a' };

              return (
                <div key={intern.name} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{intern.name}</div>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: rolePillColors.bg, color: rolePillColors.color, fontWeight: 700, border: `1px solid ${rolePillColors.border}`, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {roleLabel}
                      </span>
                    </div>
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

const primaryBtnStyle = {
  padding: '8px 18px', borderRadius: 8, border: 'none', background: '#7c3aed',
  color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
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

// ── Hours Overview (flat sortable spreadsheet) ────────────────────────────────

function HoursOverview({ entries, changeRequests, onResolve, onAddEntry, sort, onSortChange, typeFilter, onTypeFilterChange }) {
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

  // Totals (over the filtered set, plus a per-type breakdown over the full entries)
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
        <button onClick={onAddEntry} style={primaryBtnStyle}>+ Add Entry</button>
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
                const cr = changeRequests.find((r) => r.entryId === e.id && r.status === 'pending');
                const ht = HOUR_TYPES.find((t) => t.key === e.type);
                const dateStr = new Date(e.date.seconds * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                const loggedBy = e.createdBy?.role && e.createdBy.role !== 'intern'
                  ? `${e.createdBy.name || e.createdBy.role} (${e.createdBy.role})`
                  : 'Intern';
                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9', background: cr ? '#fffbeb' : '#fff' }}>
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
