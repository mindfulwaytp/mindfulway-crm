import { useState, useEffect } from 'react';
import { fetchProviderProfiles, upsertProviderProfile, deleteProviderProfile } from '../lib/providersProfileApi';
import { SPECIALTIES } from '../lib/specialtyMap';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIMES = ['Morning', 'Afternoon', 'Evening'];
const MODALITIES = ['Individual', 'Couples', 'Family', 'Group', 'Child/Play'];
const SESSION_FORMATS = ['In-Person', 'Telehealth'];
const CLIENT_AGES = ['Children (0-12)', 'Adolescents (13-17)', 'Adults (18+)', 'Seniors (65+)'];
const INSURANCES = [
  'Premera', 'Regence', 'Other BCBS', 'Aetna', 'Cigna',
  'UHC-Commercial', 'Molina-Commercial', 'Molina-Medicaid',
  'UHC-Medicaid', 'Private Pay',
];
const LICENSURE_OPTIONS = [
  'LMFT', 'LCSW', 'LPC', 'LMHC', 'PhD', 'PsyD',
  'Associate/Intern', 'Psychiatrist (MD)', 'ARNP',
];
const GENDER_OPTIONS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];

const ROLE_OPTIONS = ['provider', 'intern', 'supervisor', 'admin'];
const ROLE_LABELS = { provider: 'Provider', intern: 'Intern', supervisor: 'Supervisor', admin: 'Admin' };
const ROLE_COLORS = {
  provider: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  intern:   { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  supervisor: { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  admin:    { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
};

const EMPTY_PROFILE = {
  email: '',
  roles: ['provider'],
  gender: '',
  pronouns: '',
  licensure: '',
  openSpaces: 0,
  availableDays: [],
  availableTimes: [],
  modalities: [],
  sessionFormats: [],
  clientAges: [],
  specialties: [],
  insurances: [],
  notes: '',
};

function toggleItem(arr, item) {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function CheckboxGroup({ label, options, selected, onChange }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(toggleItem(selected, opt))}
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                border: '1px solid',
                borderColor: active ? '#7c3aed' : '#d1d5db',
                background: active ? '#ede9fe' : '#fff',
                color: active ? '#6d28d9' : '#374151',
                fontWeight: active ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OpenSpacesBadge({ count }) {
  if (count === undefined || count === null || count === '') return null;
  const n = Number(count);
  const color = n === 0 ? '#ef4444' : n <= 2 ? '#f59e0b' : '#10b981';
  const bg = n === 0 ? '#fef2f2' : n <= 2 ? '#fffbeb' : '#ecfdf5';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 20,
      background: bg, color, fontWeight: 700, fontSize: 13,
      border: `1px solid ${color}22`,
    }}>
      {n === 0 ? 'Full' : `${n} open`}
    </span>
  );
}


export default function ProvidersPage() {
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [newProviderName, setNewProviderName] = useState('');
  const [addingProvider, setAddingProvider] = useState(false);
  const [deletingProvider, setDeletingProvider] = useState(false);

  const providerList = Object.keys(profiles).sort();

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    setLoading(true);
    try {
      const data = await fetchProviderProfiles();
      const map = {};
      data.forEach((p) => { map[p.name] = p; });
      setProfiles(map);
    } catch (e) {
      setError('Failed to load provider profiles.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(name) {
    const existing = profiles[name] || {};
    setDraft({ ...EMPTY_PROFILE, ...existing, name });
    setEditingProvider(name);
    setSaveError(null);
  }

  function closeEdit() {
    setEditingProvider(null);
    setDraft(null);
  }

  async function saveEdit() {
    setSaving(true);
    setSaveError(null);
    try {
      const { name: _name, id: _id, updatedAt: _ua, ...dataToSave } = draft;
      await upsertProviderProfile(editingProvider, dataToSave);
      setProfiles((prev) => ({ ...prev, [editingProvider]: { ...draft, name: editingProvider } }));
      setSuccessMsg(`${editingProvider}'s profile saved.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      closeEdit();
    } catch (e) {
      setSaveError(e?.message || 'Failed to save. Check console for details.');
      console.error('upsertProviderProfile error:', e);
    } finally {
      setSaving(false);
    }
  }

  function setDraftField(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function addProvider() {
    const name = newProviderName.trim();
    if (!name) return;
    setAddingProvider(true);
    try {
      await upsertProviderProfile(name, {});
      setProfiles((prev) => ({ ...prev, [name]: { name } }));
      setNewProviderName('');
      setSuccessMsg(`${name} added.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      setError('Failed to add provider.');
      console.error(e);
    } finally {
      setAddingProvider(false);
    }
  }

  async function deleteProvider(name) {
    if (!window.confirm(`Remove ${name} from the system? This cannot be undone.`)) return;
    setDeletingProvider(true);
    try {
      await deleteProviderProfile(name);
      setProfiles((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      setSuccessMsg(`${name} removed.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      closeEdit();
    } catch (e) {
      setSaveError('Failed to delete provider.');
      console.error(e);
    } finally {
      setDeletingProvider(false);
    }
  }

  // ── Card grid ──────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Provider Profiles</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            Manage availability, modalities, insurances, and specialties for each clinician.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={newProviderName}
              onChange={(e) => setNewProviderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addProvider(); }}
              placeholder="New provider name…"
              style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, width: 180 }}
            />
            <button
              onClick={addProvider}
              disabled={addingProvider || !newProviderName.trim()}
              style={{
                padding: '7px 14px', borderRadius: 7, border: 'none',
                background: addingProvider || !newProviderName.trim() ? '#e5e7eb' : '#7c3aed',
                color: addingProvider || !newProviderName.trim() ? '#9ca3af' : '#fff',
                fontWeight: 600, fontSize: 13, cursor: addingProvider || !newProviderName.trim() ? 'default' : 'pointer',
              }}
            >
              {addingProvider ? 'Adding…' : '+ Add'}
            </button>
          </div>
          {successMsg && (
            <div style={{ padding: '6px 12px', borderRadius: 8, background: '#ecfdf5', color: '#065f46', fontSize: 13, fontWeight: 600, border: '1px solid #a7f3d0' }}>
              {successMsg}
            </div>
          )}
          {error && (
            <div style={{ padding: '6px 12px', borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: 13, fontWeight: 600, border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 14 }}>Loading profiles...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {providerList.map((name) => {
            const p = profiles[name] || {};
            const summary = [
              p.licensure,
              p.modalities?.length > 0 ? p.modalities.join(', ') : null,
              p.availableDays?.length > 0 ? p.availableDays.map((d) => d.slice(0, 3)).join(', ') : null,
            ].filter(Boolean).join(' · ');

            return (
              <div
                key={name}
                onClick={() => openEdit(name)}
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#a78bfa';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(124,58,237,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {summary || 'No profile yet'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {(p.roles || (p.isIntern ? ['intern'] : ['provider'])).filter(r => r !== 'provider').map(r => {
                    const c = ROLE_COLORS[r] || ROLE_COLORS.provider;
                    return (
                      <span key={r} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: c.bg, color: c.color, fontWeight: 600, border: `1px solid ${c.border}` }}>
                        {ROLE_LABELS[r] || r}
                      </span>
                    );
                  })}
                  <OpenSpacesBadge count={p.openSpaces} />
                  <span style={{ fontSize: 18, color: '#d1d5db' }}>›</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {editingProvider && draft && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
            zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeEdit(); }}
        >
          <div style={{
            width: 560,
            maxWidth: '95vw',
            height: '100vh',
            background: '#fff',
            overflowY: 'auto',
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                Edit — {editingProvider}
              </h2>
              <button onClick={closeEdit} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>✕</button>
            </div>

            {/* Basic info */}
            <Section title="Basic Info">
              <div style={{ marginBottom: 12 }}>
                <Field label="Google Workspace Email">
                  <input
                    type="email"
                    value={draft.email || ''}
                    onChange={(e) => setDraftField('email', e.target.value)}
                    placeholder="name@mindfulway-therapy.com"
                    style={inputStyle}
                  />
                </Field>
                <div style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}>
                  Required for the provider to log in. Must match their @mindfulway-therapy.com Google account.
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Gender">
                  <select
                    value={draft.gender}
                    onChange={(e) => setDraftField('gender', e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">—</option>
                    {GENDER_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Pronouns">
                  <input
                    type="text"
                    value={draft.pronouns}
                    onChange={(e) => setDraftField('pronouns', e.target.value)}
                    placeholder="e.g. she/her"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Licensure">
                  <select
                    value={draft.licensure}
                    onChange={(e) => setDraftField('licensure', e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">—</option>
                    {LICENSURE_OPTIONS.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Open Spaces">
                  <input
                    type="number"
                    min={0}
                    value={draft.openSpaces}
                    onChange={(e) => setDraftField('openSpaces', Number(e.target.value))}
                    style={inputStyle}
                  />
                </Field>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Roles
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ROLE_OPTIONS.map((r) => {
                    const active = (draft.roles || []).includes(r);
                    const c = ROLE_COLORS[r];
                    return (
                      <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '5px 12px', borderRadius: 20, border: `1px solid ${active ? c.border : '#e5e7eb'}`, background: active ? c.bg : '#fff', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? c.color : '#374151', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => {
                            const current = draft.roles || [];
                            setDraftField('roles', active ? current.filter(x => x !== r) : [...current, r]);
                          }}
                          style={{ display: 'none' }}
                        />
                        {ROLE_LABELS[r]}
                      </label>
                    );
                  })}
                </div>
              </div>
            </Section>

            {/* Availability */}
            <Section title="Availability">
              <CheckboxGroup
                label="Days"
                options={DAYS}
                selected={draft.availableDays}
                onChange={(v) => setDraftField('availableDays', v)}
              />
              <CheckboxGroup
                label="Times"
                options={TIMES}
                selected={draft.availableTimes}
                onChange={(v) => setDraftField('availableTimes', v)}
              />
            </Section>

            {/* Services */}
            <Section title="Services">
              <CheckboxGroup
                label="Modalities"
                options={MODALITIES}
                selected={draft.modalities}
                onChange={(v) => setDraftField('modalities', v)}
              />
              <CheckboxGroup
                label="Session Format"
                options={SESSION_FORMATS}
                selected={draft.sessionFormats}
                onChange={(v) => setDraftField('sessionFormats', v)}
              />
              <CheckboxGroup
                label="Client Ages"
                options={CLIENT_AGES}
                selected={draft.clientAges}
                onChange={(v) => setDraftField('clientAges', v)}
              />
            </Section>

            {/* Insurance */}
            <Section title="Insurance Accepted">
              <CheckboxGroup
                label=""
                options={INSURANCES}
                selected={draft.insurances}
                onChange={(v) => setDraftField('insurances', v)}
              />
            </Section>

            {/* Specialties */}
            <Section title="Specialties">
              <CheckboxGroup
                label=""
                options={SPECIALTIES}
                selected={draft.specialties}
                onChange={(v) => setDraftField('specialties', v)}
              />
            </Section>

            {/* Notes */}
            <Section title="Notes">
              <textarea
                value={draft.notes}
                onChange={(e) => setDraftField('notes', e.target.value)}
                placeholder="Any additional notes about this provider..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', minHeight: 80 }}
              />
            </Section>

            {/* Footer actions */}
            {saveError && (
              <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: 13, border: '1px solid #fecaca' }}>
                {saveError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={saveEdit}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 8,
                  border: 'none',
                  background: saving ? '#a78bfa' : '#7c3aed',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: saving ? 'default' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                onClick={closeEdit}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#374151',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
            <div style={{ marginTop: 12, borderTop: '1px solid #fee2e2', paddingTop: 12 }}>
              <button
                onClick={() => deleteProvider(editingProvider)}
                disabled={deletingProvider || saving}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  borderRadius: 8,
                  border: '1px solid #fca5a5',
                  background: '#fff',
                  color: '#dc2626',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: deletingProvider || saving ? 'default' : 'pointer',
                }}
              >
                {deletingProvider ? 'Removing…' : 'Remove Provider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small layout helpers ──────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {title && (
        <div style={{
          fontSize: 11, fontWeight: 700, color: '#7c3aed',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 14,
          paddingBottom: 6,
          borderBottom: '1px solid #ede9fe',
        }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 7,
  border: '1px solid #d1d5db',
  fontSize: 13,
  color: '#111827',
  background: '#fff',
  boxSizing: 'border-box',
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
};
