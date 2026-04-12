import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
} from '@hello-pangea/dnd';
import {
  fetchInquiries,
  updateInquiry as updateInquiryApi,
  createInquiry,
} from './lib/inquiriesApi';
import ProvidersPage from './pages/ProvidersPage';
import AvailabilityPage from './pages/AvailabilityPage';
import MyHoursPage from './pages/MyHoursPage';
import InternHoursPage from './pages/InternHoursPage';
import LoginPage from './pages/LoginPage';
import { parseChecklist } from './lib/specialtyMap';
import { matchProviders } from './lib/matchProviders';
import { fetchProviderProfiles } from './lib/providersProfileApi';
import { useAuth } from './lib/AuthContext';

const columns = [
  { id: 'new', title: 'New', color: '#8ec1fc', border: '#6caef8' },
  { id: 'contact1', title: 'Contact 1', color: '#f3e778', border: '#fcd34d' },
  { id: 'contact2', title: 'Contact 2', color: '#fe9c67', border: '#fbbf24' },
  { id: 'scheduled', title: 'Scheduled', color: '#58d46a', border: '#86efac' },
  { id: 'waitlist', title: 'Waitlist', color: '#c89afa', border: '#c4b5fd' },
];

function formatPhone(value) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 3)})-${digits.slice(3)}`;
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function normalizeInternValue(v) {
  const lower = (v || '').toLowerCase();
  if (lower === 'yes') return 'yes';
  if (lower.includes('discuss')) return 'would like to discuss';
  if (lower === 'no') return 'no';
  return '';
}

function formatDate(value) {
  if (!value) return '—';

  if (typeof value?.toDate === 'function') {
    return value.toDate().toLocaleDateString();
  }

  // YYYY-MM-DD strings are parsed as UTC midnight by new Date(), causing an
  // off-by-one day in local timezones. Parse as local time instead.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString();
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function ProviderSelect({ value, onChange, inputStyle, providers = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = value ? value.split(',').map(s => s.replace(/\s*\(.*?\)/g, '').trim()).filter(Boolean) : [];

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (p) => {
    const next = selected.includes(p) ? selected.filter(s => s !== p) : [...selected, p];
    onChange(next.join(', '));
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          ...inputStyle,
          cursor: 'pointer',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          textAlign: 'left',
          borderColor: selected.length ? '#7c3aed' : '#d1d5db',
          background: selected.length ? '#faf5ff' : '#fff',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected.length ? selected.join(', ') : '—'}
        </span>
        <span style={{ fontSize: 10, flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: '#fff', border: '1px solid #d1d5db', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '8px 0', minWidth: '100%', maxHeight: 220, overflowY: 'auto' }}
        >
          {providers.map(p => (
            <label
              key={p}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, userSelect: 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <input
                type="checkbox"
                checked={selected.includes(p)}
                onChange={() => toggle(p)}
              />
              {p}
            </label>
          ))}
          {selected.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid #e5e7eb', margin: '6px 0' }} />
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { onChange(''); setOpen(false); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', fontSize: 13, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const blankDraft = {
  source: 'manual',
  intake: {
    clientName: '',
    preferredName: '',
    phone: '',
    email: '',
    dob: '',
    parentFirstName: '',
    parentLastName: '',
    insurance: '',
    memberId: '',
    relationship: '',
    insuredName: '',
    insuredDob: '',
    preferredProvider: '',
    servicesRequested: '',
    openToIntern: '',
    days: '',
    times: '',
    ipTele: '',
    problemChecklist: '',
    promptedYou: '',
    previousTherapy: '',
    previousMeds: '',
    safety: '',
  },
  pipeline: {
    status: 'new',
    assignedProvider: '',
    possibleProviders: '',
    contactAttempts: 0,
    lastContactDate: '',
    comments: '',
  },
};

function NewEntryModal({ onClose, onCreated, providers = [] }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(blankDraft)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(path, value) {
    setDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      // Keep clientName in sync with first/last if set directly
      if (path === 'intake.clientName') {
        const parts = value.trim().split(' ');
        next.intake.firstName = parts[0] || '';
        next.intake.lastName = parts.slice(1).join(' ') || '';
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!draft.intake.clientName.trim()) {
      setError('Client name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const id = await createInquiry({
        ...draft,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      onCreated(id);
    } catch (err) {
      setError(err.message || 'Failed to create entry');
      setSaving(false);
    }
  }

  const inputStyle = {
    width: '100%',
    marginTop: 6,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 14,
    background: '#fff',
    boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block',
    fontWeight: 600,
    marginBottom: 4,
    fontSize: 13,
    color: '#374151',
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(1100px, 100%)', maxHeight: '90vh', background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 24, overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 28 }}>New Manual Entry</h2>
          <button onClick={onClose} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 600 }}>Close</button>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: '#fdecec', color: '#8a1c1c', border: '1px solid #f3c2c2' }}>{error}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
          {/* Pipeline column */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, background: '#fcfcfd' }}>
            <h3 style={{ marginTop: 0, marginBottom: 14, fontSize: 17, fontWeight: 700 }}>Pipeline</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, fontSize: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Status</label>
                <select value={draft.pipeline.status} onChange={(e) => update('pipeline.status', e.target.value)} style={inputStyle}>
                  <option value="new">New</option>
                  <option value="contact1">Contact 1</option>
                  <option value="contact2">Contact 2</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="waitlist">Waitlist</option>
                  <option value="found other">Found Other</option>
                  <option value="became client">Became Client</option>
                  <option value="declined">Declined</option>
                  <option value="no response">No Response</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Assigned Provider</label>
                <ProviderSelect value={draft.pipeline.assignedProvider} onChange={v => update('pipeline.assignedProvider', v)} inputStyle={inputStyle} providers={providers} />
              </div>
              <div>
                <label style={labelStyle}>Possible Providers</label>
                <ProviderSelect value={draft.pipeline.possibleProviders} onChange={v => update('pipeline.possibleProviders', v)} inputStyle={inputStyle} providers={providers} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Comments</label>
                <textarea value={draft.pipeline.comments} onChange={(e) => update('pipeline.comments', e.target.value)} placeholder="Add notes..." style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            </div>
          </div>

          {/* Intake column */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, background: '#fff' }}>
            <h3 style={{ marginTop: 0, marginBottom: 14, fontSize: 17, fontWeight: 700 }}>Intake Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 14, fontSize: 14 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Client Name *</label>
                <input type="text" value={draft.intake.clientName} onChange={(e) => update('intake.clientName', e.target.value)} placeholder="First Last" style={inputStyle} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Preferred Name</label>
                <input type="text" value={draft.intake.preferredName} onChange={(e) => update('intake.preferredName', e.target.value)} style={inputStyle} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>DOB</label>
                <input type="text" value={draft.intake.dob} onChange={(e) => update('intake.dob', e.target.value)} placeholder="YYYY-MM-DD" style={inputStyle} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Parent / Guardian Name</label>
                <input type="text" value={`${draft.intake.parentFirstName} ${draft.intake.parentLastName}`.trim()} onChange={(e) => { const parts = e.target.value.split(' '); update('intake.parentFirstName', parts[0] || ''); update('intake.parentLastName', parts.slice(1).join(' ') || ''); }} style={inputStyle} />
              </div>

              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Phone</label>
                <input type="text" value={draft.intake.phone} onChange={(e) => update('intake.phone', formatPhone(e.target.value))} placeholder="(xxx)-xxx-xxxx" style={inputStyle} />
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Email</label>
                <input type="email" value={draft.intake.email} onChange={(e) => update('intake.email', e.target.value)} style={inputStyle} />
              </div>

              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Preferred Provider</label>
                <ProviderSelect value={draft.intake.preferredProvider} onChange={v => update('intake.preferredProvider', v)} inputStyle={inputStyle} providers={providers} />
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Open to Intern</label>
                <select value={normalizeInternValue(draft.intake.openToIntern)} onChange={(e) => update('intake.openToIntern', e.target.value)} style={inputStyle}>
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  <option value="would like to discuss">Would like to discuss</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Insurance</label>
                <select value={draft.intake.insurance} onChange={(e) => update('intake.insurance', e.target.value)} style={inputStyle}>
                  <option value="">—</option>
                  <option>Premera</option>
                  <option>Regence</option>
                  <option>Other BCBS</option>
                  <option>Aetna</option>
                  <option>Cigna</option>
                  <option>UHC-Commercial</option>
                  <option>Molina-Commercial</option>
                  <option>Molina-Medicaid</option>
                  <option>UHC-Medicaid</option>
                  <option>Private Pay</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Member ID</label>
                <input type="text" value={draft.intake.memberId} onChange={(e) => update('intake.memberId', e.target.value)} style={inputStyle} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Services Requested</label>
                <input type="text" value={draft.intake.servicesRequested} onChange={(e) => update('intake.servicesRequested', e.target.value)} placeholder="e.g. Individual Therapy, Psychiatry" style={inputStyle} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Problem Checklist</label>
                <textarea value={draft.intake.problemChecklist} onChange={(e) => update('intake.problemChecklist', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>What Prompted You</label>
                <textarea value={draft.intake.promptedYou} onChange={(e) => update('intake.promptedYou', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Prev. Therapy</label>
                <select value={draft.intake.previousTherapy} onChange={(e) => update('intake.previousTherapy', e.target.value)} style={inputStyle}>
                  <option value="">—</option>
                  <option value="Yes, in the past">Yes, in the past</option>
                  <option value="Yes, currently">Yes, currently</option>
                  <option value="No history">No history</option>
                </select>

              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Meds</label>
                <select value={draft.intake.previousMeds} onChange={(e) => update('intake.previousMeds', e.target.value)} style={inputStyle}>
                  <option value="">—</option>
                  <option value="Yes, in the past">Yes, in the past</option>
                  <option value="Yes, currently">Yes, currently</option>
                  <option value="Yes currently and in the past">Yes, currently and in the past</option>
                  <option value="No history">No history</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Days</label>
                <input type="text" value={draft.intake.days} onChange={(e) => update('intake.days', e.target.value)} style={inputStyle} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Times</label>
                <input type="text" value={draft.intake.times} onChange={(e) => update('intake.times', e.target.value)} style={inputStyle} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>In-Person / Tele</label>
                <select value={draft.intake.ipTele} onChange={(e) => update('intake.ipTele', e.target.value)} style={inputStyle}>
                  <option value="">—</option>
                  <option value="In person only">In-Person Only</option>
                  <option value="In person preferred">In-Person Preferred</option>
                  <option value="Telehealth only">Telehealth</option>
                  <option value="Telehealth preferred">Telehealth Preferred</option>
                  <option value="No preference/first available">No preference/First Available</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Safety</label>
                <select value={draft.intake.safety} onChange={(e) => update('intake.safety', e.target.value)} style={inputStyle}>
                  <option value="">—</option>
                  <option value="Yes, less than 3 months ago">Yes, less than 3 months ago</option>
                  <option value="Yes, more than 3 months ago">Yes, more than 3 months ago</option>
                  <option value="No, never">No history</option>

                </select>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} disabled={saving} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ border: '1px solid #7c3aed', background: '#7c3aed', color: '#fff', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating...' : 'Create Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({
  inquiry,
  draft,
  isEditing,
  onClose,
  onEdit,
  onChange,
  onCancel,
  onSave,
  saving,
  providerProfiles,
  onQuickAssign,
}) {
  const record = isEditing ? draft : inquiry;
  const providerNames = (providerProfiles || []).map((p) => p.name).sort();
  const [showMatch, setShowMatch] = useState(false);
  const [matchResults, setMatchResults] = useState([]);
  const [assigning, setAssigning] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());

  function runMatch() {
    const results = matchProviders(inquiry, providerProfiles || []);
    setMatchResults(results);
    setShowMatch(true);
  }

  async function handleAssign(name) {
    setAssigning(name);
    await onQuickAssign(name);
    setAssigning('');
  }

  if (!record) return null;

  const inputStyle = {
    width: '100%',
    marginTop: 6,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 14,
    background: '#fff',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontWeight: 600,
    marginBottom: 4,
    fontSize: 13,
    color: '#374151',
  };

  const readValueStyle = {
    color: '#4b5563',
    lineHeight: 1.45,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1100px, 100%)',
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          padding: 24,
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 20,
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 36, lineHeight: 1.1 }}>
              {record.intake?.clientName || 'No name'}
            </h2>
            {record.intake?.preferredName ? (
              <p style={{ marginTop: 8, color: '#6b7280', fontSize: 18 }}>
                Preferred name: {record.intake.preferredName}
              </p>
            ) : null}
          </div>

          <button
            onClick={onClose}
            style={{
              border: '1px solid #e5e7eb',
              background: '#fff',
              borderRadius: 10,
              padding: '10px 14px',
              cursor: 'pointer',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {!isEditing ? (
            <>
              <button
                onClick={onEdit}
                style={{
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  borderRadius: 10,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Edit
              </button>
              <button
                onClick={showMatch ? () => setShowMatch(false) : runMatch}
                disabled={!providerProfiles || providerProfiles.length === 0}
                style={{
                  border: '1px solid #7c3aed',
                  background: showMatch ? '#7c3aed' : '#ede9fe',
                  color: showMatch ? '#fff' : '#6d28d9',
                  borderRadius: 10,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {showMatch ? 'Hide Match' : 'Find Match'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onSave}
                disabled={saving}
                style={{
                  border: '1px solid #7c3aed',
                  background: '#7c3aed',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>

              <button
                onClick={onCancel}
                disabled={saving}
                style={{
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  borderRadius: 10,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>

        {/* ── Find Match Results ───────────────────────────────────────── */}
        {showMatch && (() => {
          const preferredNames = (inquiry.intake?.preferredProvider || '')
            .split(',')
            .map(s => s.replace(/\s*\(.*?\)/g, '').trim())
            .filter(Boolean);
          const visible = matchResults.filter(r => r.pct > 50 || preferredNames.includes(r.name));
          return (
            <div style={{ marginBottom: 20, border: '1px solid #c4b5fd', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ background: '#f5f3ff', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#6d28d9' }}>
                  Provider Match — {inquiry.intake?.clientName}
                </span>
                <span style={{ fontSize: 12, color: '#7c3aed' }}>
                  {visible.length} above 50%{preferredNames.length > 0 ? ` + ${preferredNames.length} preferred` : ''}
                </span>
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {matchResults.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 13, color: '#6b7280' }}>No provider profiles found. Fill in profiles on the Providers page first.</div>
                ) : visible.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 13, color: '#6b7280' }}>No providers scored above 50%. Try filling in more profile data.</div>
                ) : visible.map((r) => {
                  const isPreferred = preferredNames.includes(r.name);
                  const belowThreshold = r.pct <= 50;
                  const pctColor = belowThreshold ? '#6b7280' : r.pct >= 70 ? '#059669' : '#d97706';
                  const pctBg    = belowThreshold ? '#f3f4f6' : r.pct >= 70 ? '#ecfdf5' : '#fffbeb';
                  const isAssigned = inquiry.pipeline?.assignedProvider === r.name;
                  const isExpanded = expandedRows.has(r.name);
                  const hasDetails = r.reasons.length > 0 || r.blockers.length > 0;

                  return (
                    <div key={r.name} style={{ borderTop: '1px solid #ede9fe', background: isAssigned ? '#f5f3ff' : '#fff' }}>
                      {/* Main row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px' }}>
                        {/* Score badge */}
                        <div style={{
                          minWidth: 46, textAlign: 'center',
                          padding: '3px 0', borderRadius: 8,
                          background: pctBg, color: pctColor,
                          fontWeight: 700, fontSize: 13,
                          border: `1px solid ${pctColor}44`,
                          flexShrink: 0,
                        }}>
                          {r.pct}%
                        </div>

                        {/* Name + badges */}
                        <div style={{ flex: 1, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          {r.name}
                          {isPreferred && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#fef9c3', color: '#854d0e', fontWeight: 600, border: '1px solid #fde047' }}>Preferred</span>}
                          {isAssigned && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#7c3aed', color: '#fff', fontWeight: 600 }}>Assigned</span>}
                          {r.profile?.isIntern && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>Intern</span>}
                          {r.profile?.openSpaces > 0 && <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>{r.profile.openSpaces} open</span>}
                        </div>

                        {/* Expand arrow */}
                        {hasDetails && (
                          <button
                            onClick={() => setExpandedRows(prev => {
                              const next = new Set(prev);
                              next.has(r.name) ? next.delete(r.name) : next.add(r.name);
                              return next;
                            })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: '2px 4px', flexShrink: 0, lineHeight: 1 }}
                            title="Show details"
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        )}

                        {/* Assign button */}
                        {!isAssigned && (
                          <button
                            onClick={() => handleAssign(r.name)}
                            disabled={assigning === r.name}
                            style={{
                              padding: '4px 12px', borderRadius: 8,
                              border: '1px solid #7c3aed', background: '#fff',
                              color: '#7c3aed', fontWeight: 600, fontSize: 12,
                              cursor: 'pointer', flexShrink: 0,
                            }}
                          >
                            {assigning === r.name ? '...' : 'Assign'}
                          </button>
                        )}
                      </div>

                      {/* Expandable details */}
                      {isExpanded && hasDetails && (
                        <div style={{ padding: '0 16px 10px 72px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {r.reasons.map((reason, i) => (
                            <div key={i} style={{ fontSize: 12, color: '#059669' }}>✓ {reason}</div>
                          ))}
                          {r.blockers.map((blocker, i) => (
                            <div key={i} style={{ fontSize: 12, color: '#dc2626' }}>✗ {blocker}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: 12,
              background: '#fafafa',
            }}
          >
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
              Status
            </div>
            <div style={{ fontWeight: 700 }}>
              {record.pipeline?.status || '—'}
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: 12,
              background: '#fafafa',
            }}
          >
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
              Insurance
            </div>
            <div style={{ fontWeight: 700 }}>
              {record.intake?.insurance || '—'}
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: 12,
              background: '#fafafa',
            }}
          >
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
              Assigned Provider
            </div>
            <div style={{ fontWeight: 700 }}>
              {record.pipeline?.assignedProvider || '—'}
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: 12,
              background: '#fafafa',
            }}
          >
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
              Inquiry Date
            </div>
            <div style={{ fontWeight: 700 }}>
              {formatDate(record.createdAt)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Pipeline — full width */}
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              padding: 16,
              background: '#fcfcfd',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 14, fontSize: 17, fontWeight: 700 }}>Pipeline</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, fontSize: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Status</label>
                {isEditing ? (
                  <select value={record.pipeline?.status || 'new'} onChange={(e) => onChange('pipeline.status', e.target.value)} style={inputStyle}>
                    <option value="new">New</option>
                    <option value="contact1">Contact 1</option>
                    <option value="contact2">Contact 2</option>
                    <option value="waitlist">Waitlist</option>
                    <option value="found other">Found Other</option>
                    <option value="became client">Became Client</option>
                    <option value="declined">Declined</option>
                    <option value="no response">No Response</option>
                    <option value="archived">Archived</option>
                  </select>
                ) : (
                  <div style={readValueStyle}>{record.pipeline?.status || '—'}</div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Contact Attempts</label>
                {isEditing ? (
                  <input type="number" min="0" value={record.pipeline?.contactAttempts ?? 0} onChange={(e) => onChange('pipeline.contactAttempts', Number(e.target.value) || 0)} style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{record.pipeline?.contactAttempts ?? 0}</div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Last Contact</label>
                {isEditing ? (
                  <input type="date" value={record.pipeline?.lastContactDate || ''} onChange={(e) => onChange('pipeline.lastContactDate', e.target.value)} style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{formatDate(record.pipeline?.lastContactDate)}</div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, fontSize: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Assigned Provider</label>
                {isEditing ? (
                  <ProviderSelect value={record.pipeline?.assignedProvider || ''} onChange={v => onChange('pipeline.assignedProvider', v)} inputStyle={inputStyle} providers={providerNames} />
                ) : (
                  <div style={readValueStyle}>{record.pipeline?.assignedProvider || '—'}</div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Possible Providers</label>
                {isEditing ? (
                  <ProviderSelect value={record.pipeline?.possibleProviders || ''} onChange={v => onChange('pipeline.possibleProviders', v)} inputStyle={inputStyle} providers={providerNames} />
                ) : (
                  <div style={readValueStyle}>{record.pipeline?.possibleProviders || '—'}</div>
                )}
              </div>
            </div>

            <div style={{ fontSize: 14 }}>
              <label style={labelStyle}>Comments</label>
              {isEditing ? (
                <textarea value={record.pipeline?.comments || ''} onChange={(e) => onChange('pipeline.comments', e.target.value)} placeholder="Add notes or comments..." style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }} />
              ) : (
                <div style={readValueStyle}>{record.pipeline?.comments || '—'}</div>
              )}
            </div>
          </div>

          {/* Intake Details — full width */}
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              padding: 16,
              background: '#fff',
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: 14,
                fontSize: 17,
                fontWeight: 700,
              }}
            >
              Intake Details
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                gap: 14,
                fontSize: 14,
              }}
            >
              {/* Row 1: Client Name | Preferred Name | DOB */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Client Name</label>
                {isEditing ? (
                  <input type="text" value={record.intake?.clientName || ''} onChange={(e) => onChange('intake.clientName', e.target.value)} style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{record.intake?.clientName || '—'}</div>
                )}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Preferred Name</label>
                {isEditing ? (
                  <input type="text" value={record.intake?.preferredName || ''} onChange={(e) => onChange('intake.preferredName', e.target.value)} style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{record.intake?.preferredName || '—'}</div>
                )}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>DOB</label>
                {isEditing ? (
                  <input type="text" value={record.intake?.dob || ''} onChange={(e) => onChange('intake.dob', e.target.value)} placeholder="MM/DD/YYYY" style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{formatDate(record.intake?.dob)}</div>
                )}
              </div>

              {/* Row 2: Parent Name */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Parent / Guardian Name</label>
                {isEditing ? (
                  <input type="text" value={`${record.intake?.parentFirstName || ''} ${record.intake?.parentLastName || ''}`.trim()} onChange={(e) => { const parts = e.target.value.split(' '); onChange('intake.parentFirstName', parts[0] || ''); onChange('intake.parentLastName', parts.slice(1).join(' ') || ''); }} style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{`${record.intake?.parentFirstName || ''} ${record.intake?.parentLastName || ''}`.trim() || '—'}</div>
                )}
              </div>

              {/* Row 3: Phone | Email */}
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Phone</label>
                {isEditing ? (
                  <input type="text" value={record.intake?.phone || ''} onChange={(e) => onChange('intake.phone', formatPhone(e.target.value))} placeholder="(xxx)-xxx-xxxx" style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{record.intake?.phone || '—'}</div>
                )}
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Email</label>
                {isEditing ? (
                  <input type="email" value={record.intake?.email || ''} onChange={(e) => onChange('intake.email', e.target.value)} style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{record.intake?.email || '—'}</div>
                )}
              </div>

              {/* Row 4: Preferred Provider | Open to Intern */}
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Preferred Provider</label>
                {isEditing ? (
                  <ProviderSelect value={record.intake?.preferredProvider || ''} onChange={v => onChange('intake.preferredProvider', v)} inputStyle={inputStyle} providers={providerNames} />
                ) : (
                  <div style={readValueStyle}>{record.intake?.preferredProvider || '—'}</div>
                )}
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Open to Intern</label>
                {isEditing ? (
                  <select value={normalizeInternValue(record.intake?.openToIntern)} onChange={(e) => onChange('intake.openToIntern', e.target.value)} style={inputStyle}>
                    <option value="">—</option>
                    <option value="yes">Yes</option>
                    <option value="would like to discuss">Would like to discuss</option>
                    <option value="no">No</option>
                  </select>
                ) : (
                  <div style={readValueStyle}>{record.intake?.openToIntern || '—'}</div>
                )}
              </div>

              {/* Row 5: Insurance | Member ID */}
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Insurance</label>
                {isEditing ? (
                  <select value={record.intake?.insurance || ''} onChange={(e) => onChange('intake.insurance', e.target.value)} style={inputStyle}>
                    <option value="">—</option>
                    <option>Premera</option>
                    <option>Regence</option>
                    <option>Other BCBS</option>
                    <option>Aetna</option>
                    <option>Cigna</option>
                    <option>UHC-Commercial</option>
                    <option>Molina-Commercial</option>
                    <option>Molina-Medicaid</option>
                    <option>UHC-Medicaid</option>
                    <option>Private Pay</option>
                  </select>
                ) : (
                  <div style={readValueStyle}>{record.intake?.insurance || '—'}</div>
                )}
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Member ID</label>
                {isEditing ? (
                  <input type="text" value={record.intake?.memberId || ''} onChange={(e) => onChange('intake.memberId', e.target.value)} style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{record.intake?.memberId || '—'}</div>
                )}
              </div>

              {/* Row 6: Services Requested */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Services Requested</label>
                {isEditing ? (
                  <input type="text" value={record.intake?.servicesRequested || ''} onChange={(e) => onChange('intake.servicesRequested', e.target.value)} style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{record.intake?.servicesRequested || '—'}</div>
                )}
              </div>

              {/* Row 7: Problem Checklist */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Problem Checklist</label>
                {isEditing ? (
                  <textarea value={record.intake?.problemChecklist || ''} onChange={(e) => onChange('intake.problemChecklist', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                ) : (
                  <>
                    <div style={{ ...readValueStyle, marginBottom: 8 }}>{record.intake?.problemChecklist || '—'}</div>
                    {(() => {
                      const { matched, unmatched } = parseChecklist(record.intake?.problemChecklist);
                      if (!matched.length && !unmatched.length) return null;
                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                          {matched.map((s) => (
                            <span key={s} style={{ padding: '2px 9px', borderRadius: 12, background: '#ede9fe', color: '#6d28d9', fontSize: 12, fontWeight: 600, border: '1px solid #c4b5fd' }}>
                              {s}
                            </span>
                          ))}
                          {unmatched.map((s) => (
                            <span key={s} style={{ padding: '2px 9px', borderRadius: 12, background: '#f3f4f6', color: '#6b7280', fontSize: 12, border: '1px solid #e5e7eb' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Row 7b: What Prompted You */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>What Prompted You</label>
                {isEditing ? (
                  <textarea value={record.intake?.promptedYou || ''} onChange={(e) => onChange('intake.promptedYou', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                ) : (
                  <div style={readValueStyle}>{record.intake?.promptedYou || '—'}</div>
                )}
              </div>

              {/* Row 8: Prev. Therapy | Meds | Safety */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Prev. Therapy</label>
                {isEditing ? (
                  <select value={record.intake?.previousTherapy || ''} onChange={(e) => onChange('intake.previousTherapy', e.target.value)} style={inputStyle}>
                    <option value="">—</option>
                    <option value="Yes, in the past">Yes, in the past</option>
                    <option value="Yes, currently">Yes, currently</option>
                    <option value="No history">No history</option>
                  </select>
                ) : (
                  <div style={readValueStyle}>{record.intake?.previousTherapy || '—'}</div>
                )}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Meds</label>
                {isEditing ? (
                  <select value={record.intake?.previousMeds || ''} onChange={(e) => onChange('intake.previousMeds', e.target.value)} style={inputStyle}>
                    <option value="">—</option>
                    <option value="Yes, in the past">Yes, in the past</option>
                    <option value="Yes, currently">Yes, currently</option>
                    <option value="Yes currently and in the past">Yes, currently and in the past</option>
                    <option value="No history">No history</option>
                  </select>
                ) : (
                  <div style={readValueStyle}>{record.intake?.previousMeds || '—'}</div>
                )}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Safety</label>
                {isEditing ? (
                  <select value={record.intake?.safety || ''} onChange={(e) => onChange('intake.safety', e.target.value)} style={inputStyle}>
                    <option value="">—</option>
                    <option value="Yes, less than 3 months ago">Yes, less than 3 months ago</option>
                    <option value="Yes, more than 3 months ago">Yes, more than 3 months ago</option>
                    <option value="No, never">No history</option>
                  </select>
                ) : (
                  <div style={readValueStyle}>{record.intake?.safety || '—'}</div>
                )}
              </div>

              {/* Row 9: Days | Times | IP/Tele */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Days</label>
                {isEditing ? (
                  <input type="text" value={record.intake?.days || ''} onChange={(e) => onChange('intake.days', e.target.value)} style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{record.intake?.days || '—'}</div>
                )}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Times</label>
                {isEditing ? (
                  <input type="text" value={record.intake?.times || ''} onChange={(e) => onChange('intake.times', e.target.value)} style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{record.intake?.times || '—'}</div>
                )}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>In-Person / Tele</label>
                {isEditing ? (
                  <select value={record.intake?.ipTele || ''} onChange={(e) => onChange('intake.ipTele', e.target.value)} style={inputStyle}>
                    <option value="">—</option>
                    <option value="In person only">In-Person Only</option>
                    <option value="In person preferred">In-Person Preferred</option>
                    <option value="Telehealth only">Telehealth Only</option>
                    <option value="Telehealth preferred">Telehealth Preferred</option>
                    <option value="No preference/first available">No preference/First Available</option>
                  </select>
                ) : (
                  <div style={readValueStyle}>{record.intake?.ipTele || '—'}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { user, isAdmin, isSupervisor, isIntern, isProvider, accessDenied, loading: authLoading, signOut } = useAuth();

  // Auth gate — must resolve before rendering anything
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <span style={{ fontSize: 14, color: '#6b7280' }}>Loading…</span>
      </div>
    );
  }

  if (!user || accessDenied) {
    return <LoginPage accessDenied={accessDenied} userEmail={user?.email} />;
  }

  // Admin gets full CRM
  if (isAdmin) return <AdminApp signOut={signOut} />;

  // Interns and supervisors get availability + hours with tab nav
  if (isIntern || isSupervisor) return <ProviderApp showHours />;

  // Regular providers get availability only
  if (isProvider) return <ProviderApp />;

  // Fallback — shouldn't reach here but show access denied if roles are empty
  return <LoginPage accessDenied userEmail={user?.email} />;
}

function ProviderApp({ showHours = false }) {
  const { isIntern, isSupervisor } = useAuth();
  const [page, setPage] = useState('availability');
  if (showHours && page === 'hours') {
    if (isIntern) return <MyHoursPage onNav={setPage} />;
    if (isSupervisor) return <InternHoursPage onNav={setPage} />;
  }
  return <AvailabilityPage onNav={showHours ? setPage : undefined} />;
}

function AdminApp({ signOut }) {
  const [intakes, setIntakes] = useState([]);
  const [providerProfiles, setProviderProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [view, setView] = useState('active');
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftInquiry, setDraftInquiry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState({});
  const [columnSort, setColumnSort] = useState({});
  const [pipelineFilters, setPipelineFilters] = useState({ name: '', phone: '', insurance: [], provider: '', internOk: false, modality: [] });
  const [insuranceDropdownOpen, setInsuranceDropdownOpen] = useState(false);
  const [search, setSearch] = useState({ name: '', phone: '', email: '', insurance: '', date: '' });
  const [activeView, setActiveView] = useState({ type: 'all', value: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const PAGE_SIZE = 25;

  useEffect(() => {
    async function loadIntakes() {
      try {
        const rows = await fetchInquiries();
        setIntakes(rows);
      } catch (err) {
        setError(err.message || 'Failed to load intakes');
      } finally {
        setLoading(false);
      }
    }

    async function loadProfiles() {
      try {
        const profiles = await fetchProviderProfiles();
        setProviderProfiles(profiles);
      } catch (err) {
        console.error('Failed to load provider profiles', err);
      }
    }

    loadIntakes();
    loadProfiles();

    const interval = setInterval(loadIntakes, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleQuickAssign(inquiryId, providerName) {
    try {
      await updateInquiryApi(inquiryId, { 'pipeline.assignedProvider': providerName });
      setIntakes((prev) =>
        prev.map((inq) =>
          inq.id === inquiryId
            ? { ...inq, pipeline: { ...inq.pipeline, assignedProvider: providerName } }
            : inq
        )
      );
      if (selectedInquiry?.id === inquiryId) {
        setSelectedInquiry((prev) => ({
          ...prev,
          pipeline: { ...prev.pipeline, assignedProvider: providerName },
        }));
      }
    } catch (err) {
      console.error('Quick assign failed', err);
    }
  }

  function openInquiry(inquiry) {
    setSelectedInquiry(inquiry);
    setDraftInquiry(cloneData(inquiry));
    setIsEditing(false);
  }

  function closeInquiry() {
    setSelectedInquiry(null);
    setDraftInquiry(null);
    setIsEditing(false);
  }

  function handleStartEdit() {
    if (!selectedInquiry) return;
    setDraftInquiry(cloneData(selectedInquiry));
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (!selectedInquiry) return;
    setDraftInquiry(cloneData(selectedInquiry));
    setIsEditing(false);
  }

  function toggleColumn(columnId) {
    setCollapsedColumns((prev) => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  }

  function updateDraft(path, value) {
    setDraftInquiry((prev) => {
      if (!prev) return prev;

      const next = cloneData(prev);
      const keys = path.split('.');
      let current = next;

      for (let i = 0; i < keys.length - 1; i += 1) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== 'object') {
          current[key] = {};
        }
        current = current[key];
      }

      current[keys[keys.length - 1]] = value;
      return next;
    });
  }

  async function handleSaveEdit() {
    if (!selectedInquiry || !draftInquiry) return;

    setSaving(true);
    setError('');

    try {
      const updatedRecord = cloneData(draftInquiry);

      const changes = {
        'intake.clientName': updatedRecord.intake?.clientName || '',
        'intake.preferredName': updatedRecord.intake?.preferredName || '',
        'intake.phone': updatedRecord.intake?.phone || '',
        'intake.email': updatedRecord.intake?.email || '',
        'intake.dob': updatedRecord.intake?.dob || '',
        'intake.parentFirstName': updatedRecord.intake?.parentFirstName || '',
        'intake.parentLastName': updatedRecord.intake?.parentLastName || '',
        'intake.insurance': updatedRecord.intake?.insurance || '',
        'intake.memberId': updatedRecord.intake?.memberId || '',
        'intake.preferredProvider': updatedRecord.intake?.preferredProvider || '',
        'intake.openToIntern': updatedRecord.intake?.openToIntern || '',
        'intake.servicesRequested': updatedRecord.intake?.servicesRequested || '',
        'intake.problemChecklist': updatedRecord.intake?.problemChecklist || '',
        'intake.promptedYou': updatedRecord.intake?.promptedYou || '',
        'intake.previousTherapy': updatedRecord.intake?.previousTherapy || '',
        'intake.previousMeds': updatedRecord.intake?.previousMeds || '',
        'intake.safety': updatedRecord.intake?.safety || '',
        'intake.days': updatedRecord.intake?.days || '',
        'intake.times': updatedRecord.intake?.times || '',
        'intake.ipTele': updatedRecord.intake?.ipTele || '',
        'pipeline.status': updatedRecord.pipeline?.status || 'new',
        'pipeline.assignedProvider': updatedRecord.pipeline?.assignedProvider || '',
        'pipeline.possibleProviders': updatedRecord.pipeline?.possibleProviders || '',
        'pipeline.contactAttempts': updatedRecord.pipeline?.contactAttempts ?? 0,
        'pipeline.lastContactDate': updatedRecord.pipeline?.lastContactDate || '',
        'pipeline.comments': updatedRecord.pipeline?.comments || '',
      };

      await updateInquiryApi(selectedInquiry.id, changes);

      setIntakes((prev) =>
        prev.map((item) => (item.id === selectedInquiry.id ? updatedRecord : item))
      );

      closeInquiry();
    } catch (err) {
      setError(err.message || 'Failed to save inquiry');
    } finally {
      setSaving(false);
    }
  }

  async function handleDragEnd(result) {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const previousIntakes = intakes;
    const newStatus = destination.droppableId;

    const updatedIntakes = intakes.map((item) =>
      item.id === draggableId
        ? { ...item, pipeline: { ...item.pipeline, status: newStatus } }
        : item
    );

    setIntakes(updatedIntakes);
    setUpdatingId(draggableId);

    if (selectedInquiry?.id === draggableId) {
      const updatedSelected = updatedIntakes.find((item) => item.id === draggableId);
      setSelectedInquiry(updatedSelected || null);

      if (isEditing && draftInquiry?.id === draggableId) {
        setDraftInquiry(cloneData(updatedSelected));
      }
    }

    try {
      await updateInquiryApi(draggableId, { 'pipeline.status': newStatus });
    } catch (err) {
      setIntakes(previousIntakes);
      setError(err.message || 'Failed to update status');

      if (selectedInquiry?.id === draggableId) {
        const previousSelected = previousIntakes.find((item) => item.id === draggableId);
        setSelectedInquiry(previousSelected || null);

        if (isEditing && previousSelected) {
          setDraftInquiry(cloneData(previousSelected));
        }
      }
    } finally {
      setUpdatingId('');
    }
  }

  const filteredInquiries = useMemo(() => {
    let rows = [...intakes].sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    if (search.name)
      rows = rows.filter(r => (r.intake?.clientName || '').toLowerCase().includes(search.name.toLowerCase()));
    if (search.phone)
      rows = rows.filter(r => (r.intake?.phone || '').includes(search.phone));
    if (search.email)
      rows = rows.filter(r => (r.intake?.email || '').toLowerCase().includes(search.email.toLowerCase()));
    if (search.insurance)
      rows = rows.filter(r => (r.intake?.insurance || '').toLowerCase().includes(search.insurance.toLowerCase()));
    if (search.date)
      rows = rows.filter(r => formatDate(r.createdAt).includes(search.date));

    if (activeView.value) {
      if (activeView.type === 'status')
        rows = rows.filter(r => (r.pipeline?.status || '') === activeView.value);
      else if (activeView.type === 'insurance')
        rows = rows.filter(r => (r.intake?.insurance || '') === activeView.value);
      else if (activeView.type === 'provider')
        rows = rows.filter(r => (r.pipeline?.assignedProvider || '') === activeView.value);
    }

    return rows;
  }, [intakes, search, activeView]);

  const allInquiries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredInquiries.slice(start, start + PAGE_SIZE);
  }, [filteredInquiries, currentPage, PAGE_SIZE]);

  const totalPages = Math.ceil(filteredInquiries.length / PAGE_SIZE);

  const viewOptions = useMemo(() => ({
    status: [...new Set(intakes.map(r => r.pipeline?.status).filter(Boolean))].sort(),
    insurance: [...new Set(intakes.map(r => r.intake?.insurance).filter(Boolean))].sort(),
    provider: [...new Set(intakes.map(r => r.pipeline?.assignedProvider).filter(Boolean))].sort(),
  }), [intakes]);

  if (loading) {
    return <main style={{ padding: 24 }}>Loading...</main>;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '240px 1fr',
        background: '#f7f7f8',
      }}
    >
      <aside
        style={{
          borderRight: '1px solid #e5e7eb',
          background: '#fff',
          padding: 24,
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Mindful Way CRM
          </h2>
          <p style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
            Intake pipeline
          </p>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => setView('active')}
            style={{
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid',
              borderColor: view === 'active' ? '#c4b5fd' : '#e5e7eb',
              background: view === 'active' ? '#f5f3ff' : '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Active
          </button>

          <button
            onClick={() => setView('all')}
            style={{
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid',
              borderColor: view === 'all' ? '#c4b5fd' : '#e5e7eb',
              background: view === 'all' ? '#f5f3ff' : '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            All Inquiries
          </button>

          <button
            onClick={() => setView('providers')}
            style={{
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid',
              borderColor: view === 'providers' ? '#c4b5fd' : '#e5e7eb',
              background: view === 'providers' ? '#f5f3ff' : '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Providers
          </button>

          <button
            onClick={() => setView('availability')}
            style={{
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid',
              borderColor: view === 'availability' ? '#c4b5fd' : '#e5e7eb',
              background: view === 'availability' ? '#f5f3ff' : '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Availability
          </button>

          <button
            onClick={() => setView('intern-hours')}
            style={{
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid',
              borderColor: view === 'intern-hours' ? '#c4b5fd' : '#e5e7eb',
              background: view === 'intern-hours' ? '#f5f3ff' : '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Intern Hours
          </button>

          <button
            onClick={() => setShowNewEntry(true)}
            style={{
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid #009029',
              background: '#009029',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 12,
            }}
          >
            + New Entry
          </button>

          <button
            onClick={signOut}
            style={{
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: '#6b7280',
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 'auto',
            }}
          >
            Sign out
          </button>
        </nav>
      </aside>

      <div style={{ minWidth: 0 }}>
        {view === 'providers' ? (
          <ProvidersPage />
        ) : view === 'availability' ? (
          <AvailabilityPage />
        ) : view === 'intern-hours' ? (
          <InternHoursPage />
        ) : (
        <main style={{ padding: 32, overflowX: 'clip', minWidth: 0 }}>
          {error ? (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 10,
                background: '#fdecec',
                color: '#8a1c1c',
                border: '1px solid #f3c2c2',
              }}
            >
              {error}
            </div>
          ) : null}

          {view === 'active' ? (
            <>
              <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f7f7f8', paddingBottom: 12, marginBottom: 8 }}>
                <div style={{ paddingBottom: 8 }}>
                  <h1 style={{ margin: 0, fontSize: 32 }}>Active Pipeline</h1>
                  <p style={{ marginTop: 4, marginBottom: 0, color: '#6b7280' }}>
                    Manage current outreach, scheduling, and waitlist activity.
                  </p>
                </div>

              {/* Pipeline filters */}
              {(() => {
                const insuranceOptions = ['Premera','Regence','Other BCBS','Aetna','Cigna','UHC-Commercial','Molina-Commercial','Molina-Medicaid','UHC-Medicaid','Private Pay'];
                const anyActive = !!(pipelineFilters.name || pipelineFilters.phone || pipelineFilters.insurance.length || pipelineFilters.provider || pipelineFilters.internOk || pipelineFilters.modality.length);
                const inputSm = { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff', boxSizing: 'border-box' };
                const pillStyle = (active) => ({
                  padding: '6px 12px', borderRadius: 20, border: '1px solid', fontSize: 13, cursor: 'pointer',
                  borderColor: active ? '#7c3aed' : '#d1d5db', background: active ? '#ede9fe' : '#fff',
                  color: active ? '#6d28d9' : '#374151', fontWeight: active ? 600 : 400,
                });
                return (
                  <div style={{ paddingTop: 8, paddingBottom: 12, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Name"
                      value={pipelineFilters.name}
                      onChange={e => setPipelineFilters(p => ({ ...p, name: e.target.value }))}
                      style={{ ...inputSm, width: 300 }}
                    />
                    <input
                      type="text"
                      placeholder="Phone"
                      value={pipelineFilters.phone}
                      onChange={e => setPipelineFilters(p => ({ ...p, phone: e.target.value }))}
                      style={{ ...inputSm, width: 250 }}
                    />

                    {/* Insurance multi-select */}
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setInsuranceDropdownOpen(o => !o)}
                        style={{
                          ...inputSm,
                          cursor: 'pointer',
                          minWidth: 200,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                          borderColor: pipelineFilters.insurance.length ? '#7c3aed' : '#d1d5db',
                          background: pipelineFilters.insurance.length ? '#ede9fe' : '#fff',
                          color: pipelineFilters.insurance.length ? '#6d28d9' : '#374151',
                          fontWeight: pipelineFilters.insurance.length ? 600 : 400,
                        }}
                      >
                        {pipelineFilters.insurance.length ? `Insurance (${pipelineFilters.insurance.length})` : 'Insurance'}
                        <span style={{ fontSize: 10 }}>▾</span>
                      </button>
                      {insuranceDropdownOpen && (
                        <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: '#fff', border: '1px solid #d1d5db', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '8px 0', minWidth: 200 }}>
                          {insuranceOptions.map(v => (
                            <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, userSelect: 'none' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <input
                                type="checkbox"
                                checked={pipelineFilters.insurance.includes(v)}
                                onChange={() => setPipelineFilters(p => ({
                                  ...p,
                                  insurance: p.insurance.includes(v) ? p.insurance.filter(x => x !== v) : [...p.insurance, v],
                                }))}
                              />
                              {v}
                            </label>
                          ))}
                          {pipelineFilters.insurance.length > 0 && (
                            <>
                              <div style={{ borderTop: '1px solid #e5e7eb', margin: '6px 0' }} />
                              <button
                                onClick={() => { setPipelineFilters(p => ({ ...p, insurance: [] })); setInsuranceDropdownOpen(false); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', fontSize: 13, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                Clear
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Preferred Provider"
                      value={pipelineFilters.provider}
                      onChange={e => setPipelineFilters(p => ({ ...p, provider: e.target.value }))}
                      style={{ ...inputSm, width: 180 }}
                    />

                    {[
                      { label: 'In Person', value: 'inperson' },
                      { label: 'Telehealth', value: 'telehealth' },
                      { label: 'No Preference', value: 'nopref' },
                    ].map(({ label, value }) => (
                      <button
                        key={value}
                        onClick={() => setPipelineFilters(p => ({
                          ...p,
                          modality: p.modality.includes(value) ? p.modality.filter(v => v !== value) : [...p.modality, value],
                        }))}
                        style={pillStyle(pipelineFilters.modality.includes(value))}
                      >
                        {label}
                      </button>
                    ))}

                    <button onClick={() => setPipelineFilters(p => ({ ...p, internOk: !p.internOk }))} style={pillStyle(pipelineFilters.internOk)}>Intern OK</button>

                    {anyActive && (
                      <button
                        onClick={() => { setPipelineFilters({ name: '', phone: '', insurance: [], provider: '', internOk: false, modality: [] }); setInsuranceDropdownOpen(false); }}
                        style={{ ...pillStyle(false), color: '#9ca3af' }}
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                );
              })()}
              </div>

              <DragDropContext onDragEnd={handleDragEnd}>
                <div style={{ width: '100%', overflowX: 'auto', paddingBottom: 8 }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 24,
                      alignItems: 'flex-start',
                      minWidth: 'max-content',
                    }}
                  >
                    {columns.map((column) => {
                      const sort = columnSort[column.id] || 'date';
                      const columnCards = intakes.filter((intake) => {
                        if (intake.pipeline?.status !== column.id) return false;
                        if (pipelineFilters.name && !(intake.intake?.clientName || '').toLowerCase().includes(pipelineFilters.name.toLowerCase())) return false;
                        if (pipelineFilters.phone && !(intake.intake?.phone || '').includes(pipelineFilters.phone)) return false;
                        if (pipelineFilters.insurance.length && !pipelineFilters.insurance.includes(intake.intake?.insurance)) return false;
                        if (pipelineFilters.provider && !(intake.intake?.preferredProvider || '').toLowerCase().includes(pipelineFilters.provider.toLowerCase())) return false;
                        if (pipelineFilters.internOk) {
                          const oi = (intake.intake?.openToIntern || '').toLowerCase();
                          if (!oi || oi === 'no') return false;
                        }
                        if (pipelineFilters.modality.length) {
                          const ip = (intake.intake?.ipTele || '').toLowerCase();
                          const matches = {
                            inperson: ip.includes('in person') || ip.includes('no preference'),
                            telehealth: ip.includes('telehealth') || ip.includes('no preference'),
                            nopref: ip.includes('no preference'),
                          };
                          if (!pipelineFilters.modality.some(m => matches[m])) return false;
                        }
                        return true;
                      }).sort((a, b) => {
                        if (sort === 'az') {
                          return (a.intake?.clientName || '').localeCompare(b.intake?.clientName || '');
                        }
                        const aTime = a.createdAt?.toMillis?.() ?? (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                        const bTime = b.createdAt?.toMillis?.() ?? (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                        return sort === 'date-asc' ? aTime - bTime : bTime - aTime;
                      });
                      const isCollapsed = collapsedColumns[column.id];

                      return (
                        <Droppable droppableId={column.id} key={column.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              style={{
                                width: 360,
                                flexShrink: 0,
                                background: snapshot.isDraggingOver ? '#ffffff' : '#fafafa',
                                borderRadius: 16,
                                border: `1px solid ${column.border}`,
                                minHeight: isCollapsed ? 'auto' : 240,
                                maxHeight: 'calc(100vh - 220px)',
                                overflowY: 'auto',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <div
                                style={{
                                  position: 'sticky',
                                  top: 0,
                                  zIndex: 5,
                                  background: column.color,
                                  padding: '12px 14px',
                                  borderBottom: `1px solid ${column.border}`,
                                  borderRadius: '16px 16px 0 0',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: 8,
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <h3
                                    style={{
                                      margin: 0,
                                      fontSize: 16,
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {column.title}
                                  </h3>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      background: '#fff',
                                      border: `1px solid ${column.border}`,
                                      borderRadius: 999,
                                      padding: '2px 8px',
                                    }}
                                  >
                                    {columnCards.length}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => setColumnSort(prev => ({
                                      ...prev,
                                      [column.id]: sort === 'date' ? 'date-asc' : 'date',
                                    }))}
                                    style={{
                                      border: `1px solid ${column.border}`,
                                      background: sort === 'date' || sort === 'date-asc' ? column.border : '#fff',
                                      color: sort === 'date' || sort === 'date-asc' ? '#fff' : '#374151',
                                      borderRadius: 8,
                                      padding: '3px 7px',
                                      cursor: 'pointer',
                                      fontSize: 11,
                                      fontWeight: 600,
                                    }}
                                  >
                                    Date {sort === 'date-asc' ? '↑' : '↓'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setColumnSort(prev => ({ ...prev, [column.id]: 'az' }))}
                                    style={{
                                      border: `1px solid ${column.border}`,
                                      background: sort === 'az' ? column.border : '#fff',
                                      color: sort === 'az' ? '#fff' : '#374151',
                                      borderRadius: 8,
                                      padding: '3px 7px',
                                      cursor: 'pointer',
                                      fontSize: 11,
                                      fontWeight: 600,
                                    }}
                                  >
                                    A–Z
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => toggleColumn(column.id)}
                                    style={{
                                      border: `1px solid ${column.border}`,
                                      background: '#fff',
                                      borderRadius: 8,
                                      padding: '3px 7px',
                                      cursor: 'pointer',
                                      fontSize: 11,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {isCollapsed ? 'Show' : 'Hide'}
                                  </button>
                                </div>
                              </div>

                              {!isCollapsed ? (
                                <div style={{ padding: 12 }}>
                                  {columnCards.map((card, index) => (
                                    <Draggable
                                      draggableId={card.id}
                                      index={index}
                                      key={card.id}
                                    >
                                      {(providedDraggable, snapshotDraggable) => {
                                        const createdDate = card.createdAt?.toDate
                                          ? card.createdAt.toDate()
                                          : card.createdAt ? new Date(card.createdAt) : null;
                                        const refDate = card.pipeline?.lastContactDate
                                          ? new Date(card.pipeline.lastContactDate)
                                          : createdDate;
                                        const daysSinceContact = refDate
                                          ? Math.floor((Date.now() - refDate.getTime()) / 86400000)
                                          : null;
                                        const isOverdue = daysSinceContact !== null && daysSinceContact >= 3;
                                        const isSelected = selectedInquiry?.id === card.id || updatingId === card.id;

                                        return (
                                          <div
                                            ref={providedDraggable.innerRef}
                                            {...providedDraggable.draggableProps}
                                            {...providedDraggable.dragHandleProps}
                                            onClick={() => openInquiry(card)}
                                            style={{
                                              background: '#fff',
                                              borderRadius: 12,
                                              padding: 12,
                                              marginBottom: 10,
                                              boxShadow: snapshotDraggable.isDragging
                                                ? '0 8px 20px rgba(0,0,0,0.12)'
                                                : '0 1px 3px rgba(0,0,0,0.1)',
                                              border: isSelected
                                                ? '1px solid #7c3aed'
                                                : isOverdue
                                                ? '1px solid #f87171'
                                                : '1px solid #ececec',
                                              cursor: 'pointer',
                                              ...providedDraggable.draggableProps.style,
                                            }}
                                          >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                                              <strong style={{ flex: 1 }}>
                                                {card.intake?.clientName || 'No name'}
                                              </strong>
                                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                {card.intake?.servicesRequested ? (
                                                  (Array.isArray(card.intake.servicesRequested)
                                                    ? card.intake.servicesRequested
                                                    : card.intake.servicesRequested.split(',').map(s => s.trim()).filter(Boolean)
                                                  ).map((svc, i) => (
                                                    <span key={i} style={{
                                                      fontSize: 11,
                                                      background: '#ede9fe',
                                                      color: '#6d28d9',
                                                      borderRadius: 6,
                                                      padding: '2px 7px',
                                                      whiteSpace: 'nowrap',
                                                      fontWeight: 500,
                                                    }}>
                                                      {svc}
                                                    </span>
                                                  ))
                                                ) : null}
                                                {(() => {
                                                  const oi = (card.intake?.openToIntern || '').toLowerCase();
                                                  if (!oi || oi === 'no') return null;
                                                  const isDiscuss = oi.includes('discuss');
                                                  return (
                                                    <span style={{
                                                      fontSize: 11,
                                                      background: isDiscuss ? '#fff7ed' : '#d1fae5',
                                                      color: isDiscuss ? '#c2410c' : '#065f46',
                                                      borderRadius: 6,
                                                      padding: '2px 7px',
                                                      whiteSpace: 'nowrap',
                                                      fontWeight: 500,
                                                    }}>
                                                      {isDiscuss ? 'Discuss Intern' : 'Intern OK'}
                                                    </span>
                                                  );
                                                })()}
                                                {card.intake?.ipTele ? (
                                                  <span style={{
                                                    fontSize: 11,
                                                    background: '#e0f2fe',
                                                    color: '#0369a1',
                                                    borderRadius: 6,
                                                    padding: '2px 7px',
                                                    whiteSpace: 'nowrap',
                                                    fontWeight: 500,
                                                  }}>
                                                    {card.intake.ipTele}
                                                  </span>
                                                ) : null}
                                              </div>
                                            </div>

                                            <div style={{ fontSize: 12, marginTop: 4, color: '#6b7280' }}>
                                              {formatDate(card.createdAt)}
                                              {daysSinceContact !== null && (
                                                <span style={{
                                                  marginLeft: 6,
                                                  color: isOverdue ? '#ef4444' : '#9ca3af',
                                                  fontWeight: isOverdue ? 600 : 400,
                                                }}>
                                                  · {daysSinceContact === 0 ? 'today' : `${daysSinceContact}d ago`}
                                                </span>
                                              )}
                                            </div>

                                            <div style={{ fontSize: 13, marginTop: 6, color: '#555' }}>
                                              Insurance: {card.intake?.insurance || '—'}
                                            </div>
                                            {card.intake?.preferredProvider ? (
                                              <div style={{ fontSize: 12, marginTop: 3, color: '#374151' }}>
                                                Preferred: {card.intake.preferredProvider}
                                              </div>
                                            ) : null}
                                            {card.pipeline?.possibleProviders ? (
                                              <div style={{ fontSize: 12, marginTop: 2, color: '#6b7280' }}>
                                                Possible Providers: {card.pipeline.possibleProviders}
                                              </div>
                                            ) : null}
                                          </div>
                                        );
                                      }}
                                    </Draggable>
                                  ))}

                                  {provided.placeholder}

                                  {columnCards.length === 0 ? (
                                    <p style={{ fontSize: 13, color: '#666', marginTop: 8 }}>
                                      No records
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <div style={{ height: 0, overflow: 'hidden' }}>
                                  {provided.placeholder}
                                </div>
                              )}
                            </div>
                          )}
                        </Droppable>
                      );
                    })}
                  </div>
                </div>
              </DragDropContext>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <h1 style={{ margin: 0, fontSize: 32 }}>All Inquiries</h1>
                <span style={{ fontSize: 14, color: '#6b7280' }}>{filteredInquiries.length} result{filteredInquiries.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Search filters */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { key: 'name', placeholder: 'Client name' },
                  { key: 'phone', placeholder: 'Phone' },
                  { key: 'email', placeholder: 'Email' },
                  { key: 'insurance', placeholder: 'Insurance' },
                  { key: 'date', placeholder: 'Date (M/D/YYYY)' },
                ].map(({ key, placeholder }) => (
                  <input
                    key={key}
                    type="text"
                    placeholder={placeholder}
                    value={search[key]}
                    onChange={(e) => { setSearch(s => ({ ...s, [key]: e.target.value })); setCurrentPage(1); }}
                    style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                ))}
              </div>

              {/* Views */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { label: 'All', type: 'all', value: '' },
                    ...viewOptions.status.map(v => ({ label: v, type: 'status', value: v })),
                  ].map(opt => (
                    <button
                      key={`status-${opt.value}`}
                      onClick={() => { setActiveView({ type: opt.type, value: opt.value }); setCurrentPage(1); }}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 20,
                        border: '1px solid',
                        fontSize: 13,
                        cursor: 'pointer',
                        borderColor: activeView.type === opt.type && activeView.value === opt.value ? '#7c3aed' : '#d1d5db',
                        background: activeView.type === opt.type && activeView.value === opt.value ? '#ede9fe' : '#fff',
                        color: activeView.type === opt.type && activeView.value === opt.value ? '#6d28d9' : '#374151',
                        fontWeight: activeView.type === opt.type && activeView.value === opt.value ? 600 : 400,
                      }}
                    >
                      {opt.label}
                      {opt.value && (
                        <span style={{ marginLeft: 5, fontSize: 11, color: '#9ca3af' }}>
                          {intakes.filter(r => r.pipeline?.status === opt.value).length}
                        </span>
                      )}
                    </button>
                  ))}

                  <span style={{ margin: '0 4px', color: '#d1d5db' }}>|</span>

                  <select
                    value={activeView.type === 'insurance' ? activeView.value : ''}
                    onChange={(e) => { setActiveView(e.target.value ? { type: 'insurance', value: e.target.value } : { type: 'all', value: '' }); setCurrentPage(1); }}
                    style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid', borderColor: activeView.type === 'insurance' ? '#7c3aed' : '#d1d5db', fontSize: 13, cursor: 'pointer', background: activeView.type === 'insurance' ? '#ede9fe' : '#fff', color: activeView.type === 'insurance' ? '#6d28d9' : '#374151' }}
                  >
                    <option value="">Insurance</option>
                    {viewOptions.insurance.map(v => <option key={v} value={v}>{v} ({intakes.filter(r => r.intake?.insurance === v).length})</option>)}
                  </select>

                  <select
                    value={activeView.type === 'provider' ? activeView.value : ''}
                    onChange={(e) => { setActiveView(e.target.value ? { type: 'provider', value: e.target.value } : { type: 'all', value: '' }); setCurrentPage(1); }}
                    style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid', borderColor: activeView.type === 'provider' ? '#7c3aed' : '#d1d5db', fontSize: 13, cursor: 'pointer', background: activeView.type === 'provider' ? '#ede9fe' : '#fff', color: activeView.type === 'provider' ? '#6d28d9' : '#374151' }}
                  >
                    <option value="">Assigned Provider</option>
                    {viewOptions.provider.map(v => <option key={v} value={v}>{v} ({intakes.filter(r => r.pipeline?.assignedProvider === v).length})</option>)}
                  </select>
                </div>
              </div>

              {/* Table */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr 2fr 1fr 1.2fr 1.4fr',
                    gap: 12,
                    padding: '14px 16px',
                    background: '#f9fafb',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#374151',
                  }}
                >
                  <div>Date of Inquiry</div>
                  <div>Status</div>
                  <div>Name</div>
                  <div>DOB</div>
                  <div>Insurance</div>
                  <div>Assigned Provider</div>
                </div>

                {allInquiries.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => openInquiry(item)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1fr 2fr 1fr 1.2fr 1.4fr',
                      gap: 12,
                      padding: '14px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: 14,
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: selectedInquiry?.id === item.id ? '#faf5ff' : '#fff',
                    }}
                  >
                    <div>{formatDate(item.createdAt)}</div>
                    <div>{item.pipeline?.status || '—'}</div>
                    <div>{item.intake?.clientName || '—'}</div>
                    <div>{formatDate(item.intake?.dob)}</div>
                    <div>{item.intake?.insurance || '—'}</div>
                    <div>{item.pipeline?.assignedProvider || '—'}</div>
                  </div>
                ))}

                {allInquiries.length === 0 && (
                  <div style={{ padding: 20, color: '#6b7280' }}>No inquiries found.</div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: currentPage === 1 ? 'default' : 'pointer', color: currentPage === 1 ? '#9ca3af' : '#374151' }}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Page {currentPage} of {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: currentPage === totalPages ? 'default' : 'pointer', color: currentPage === totalPages ? '#9ca3af' : '#374151' }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </main>
        )}

        {showNewEntry ? (
          <NewEntryModal
            onClose={() => setShowNewEntry(false)}
            onCreated={async () => {
              const rows = await fetchInquiries();
              setIntakes(rows);
              setShowNewEntry(false);
            }}
            providers={providerProfiles.map((p) => p.name).sort()}
          />
        ) : null}

        {selectedInquiry ? (
          <DetailPanel
            inquiry={selectedInquiry}
            draft={draftInquiry}
            isEditing={isEditing}
            onClose={closeInquiry}
            onEdit={handleStartEdit}
            onChange={updateDraft}
            onCancel={handleCancelEdit}
            onSave={handleSaveEdit}
            saving={saving}
            providerProfiles={providerProfiles}
            onQuickAssign={(name) => handleQuickAssign(selectedInquiry.id, name)}
          />
        ) : null}
      </div>
    </div>
  );
}
