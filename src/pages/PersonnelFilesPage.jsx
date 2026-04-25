import { useState, useEffect, useRef } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { fetchProviderProfiles } from '../lib/providersProfileApi';
import {
  fetchPersonnelRecords,
  addPersonnelRecord,
  updatePersonnelRecord,
  deletePersonnelRecord,
  fetchCeuSettings,
  saveCeuSettings,
} from '../lib/personnelApi';
import {
  fetchRequirements,
  fetchCompletionForProvider,
  setCompletion as setCompletionApi,
  deleteCompletion,
  calcNextDue,
} from '../lib/requirementsApi';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'compliance', label: 'Compliance' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'trainings', label: 'Trainings' },
  { id: 'ceu-history', label: 'CEU History' },
  { id: 'contracts', label: 'Contracts' },
];

const CREDENTIAL_TYPES = [
  'LMFT', 'LCSW', 'LPC', 'LMHC', 'PhD', 'PsyD',
  'Associate/Intern', 'Psychiatrist (MD)', 'ARNP',
  'NPI Number', 'DEA Registration', 'CPR Certification', 'Other',
];

const CEU_CATEGORIES = [
  'Clinical Skills', 'Cultural Competency',
  'Trauma', 'Substance Use',
  'Child/Adolescent', 'Supervision', 'Other (note below)',
];

const TRAINING_NAMES = [
  'Mandatory Reporter', 'CPR/First Aid', 'HIPAA/Privacy',
  'Cultural Competency', 'Suicide Prevention & Safety Planning',
  'Trauma-Informed Care', 'De-escalation', 'Other',
];

const CONTRACT_TYPES = [
  'Employment Agreement', 'Independent Contractor Agreement',
  'Supervision Agreement', 'Non-Disclosure Agreement',
  'Non-Compete Agreement', 'Insurance Credentialing', 'Other',
];

const CONTRACT_STATUSES = ['Active', 'Pending Signature', 'Expired', 'Terminated'];

const EMPTY_FORMS = {
  credentials: { licenseType: '', licenseNumber: '', state: 'WA', issueDate: '', expirationDate: '', notes: '' },
  trainings: { name: '', category: '', completionDate: '', expirationDate: '', certificateUrl: '', notes: '' },
  contracts: { type: '', title: '', startDate: '', endDate: '', status: 'Active', documentUrl: '', notes: '' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getExpirationStatus(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const exp = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = Math.ceil((exp - now) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 90) return 'expiring';
  return 'current';
}

const EXP_STYLE = {
  expired:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'Expired' },
  expiring: { bg: '#fffbeb', color: '#92400e', border: '#fde68a', label: 'Expiring Soon' },
  current:  { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0', label: 'Current' },
};

function ExpirationBadge({ dateStr }) {
  const status = getExpirationStatus(dateStr);
  if (!status) return null;
  const s = EXP_STYLE[status];
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

function formatDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Returns { start: Date, end: Date } for the cycle that contains today
function getCurrentCycle(startDateStr, cycleMonths) {
  if (!startDateStr || !cycleMonths) return null;
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  let cycleStart = new Date(sy, sm - 1, sd);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 100; i++) {
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setMonth(cycleEnd.getMonth() + Number(cycleMonths));
    cycleEnd.setDate(cycleEnd.getDate() - 1);
    if (cycleEnd >= today) return { start: cycleStart, end: cycleEnd };
    cycleStart = new Date(cycleStart);
    cycleStart.setMonth(cycleStart.getMonth() + Number(cycleMonths));
  }
  return null;
}

function providerComplianceStatus(records) {
  const items = [
    ...(records.credentials || []).map((r) => r.expirationDate),
    ...(records.trainings || []).map((r) => r.expirationDate),
  ].filter(Boolean);
  if (items.some((d) => getExpirationStatus(d) === 'expired')) return 'alert';
  if (items.some((d) => getExpirationStatus(d) === 'expiring')) return 'warning';
  if (items.length > 0) return 'ok';
  return null;
}

const COMPLIANCE_DOT = {
  alert:   { color: '#ef4444', title: 'Expired item' },
  warning: { color: '#f59e0b', title: 'Expiring within 90 days' },
  ok:      { color: '#10b981', title: 'All current' },
};

// ── Input styles ──────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', padding: '7px 10px', borderRadius: 7,
  border: '1px solid #d1d5db', fontSize: 13, color: '#111827',
  background: '#fff', boxSizing: 'border-box',
};

const selectStyle = { ...inputStyle, cursor: 'pointer' };

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

// ── Forms ─────────────────────────────────────────────────────────────────────

function CredentialForm({ draft, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Field label="License / Credential Type">
        <select value={draft.licenseType} onChange={(e) => onChange('licenseType', e.target.value)} style={selectStyle}>
          <option value="">— Select —</option>
          {CREDENTIAL_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="License Number">
        <input value={draft.licenseNumber} onChange={(e) => onChange('licenseNumber', e.target.value)} placeholder="e.g. LF12345" style={inputStyle} />
      </Field>
      <Field label="Issuing State">
        <input value={draft.state} onChange={(e) => onChange('state', e.target.value)} placeholder="WA" style={inputStyle} />
      </Field>
      <Field label="Issue Date">
        <input type="date" value={draft.issueDate} onChange={(e) => onChange('issueDate', e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Expiration Date">
        <input type="date" value={draft.expirationDate} onChange={(e) => onChange('expirationDate', e.target.value)} style={inputStyle} />
      </Field>
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="Notes">
          <textarea value={draft.notes} onChange={(e) => onChange('notes', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </Field>
      </div>
    </div>
  );
}

function TrainingForm({ draft, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Field label="Training Name">
        <input
          value={draft.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g. Mandatory Reporter"
          list="training-names-list"
          style={inputStyle}
        />
        <datalist id="training-names-list">
          {TRAINING_NAMES.map((n) => <option key={n} value={n} />)}
        </datalist>
      </Field>
      <Field label="Completion Date">
        <input type="date" value={draft.completionDate} onChange={(e) => onChange('completionDate', e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Expiration Date">
        <input type="date" value={draft.expirationDate} onChange={(e) => onChange('expirationDate', e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Certificate / Document URL">
        <input type="url" value={draft.certificateUrl} onChange={(e) => onChange('certificateUrl', e.target.value)} placeholder="https://…" style={inputStyle} />
      </Field>
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="Notes">
          <textarea value={draft.notes} onChange={(e) => onChange('notes', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </Field>
      </div>
    </div>
  );
}

function ContractForm({ draft, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Field label="Contract Type">
        <select value={draft.type} onChange={(e) => onChange('type', e.target.value)} style={selectStyle}>
          <option value="">— Select —</option>
          {CONTRACT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Status">
        <select value={draft.status} onChange={(e) => onChange('status', e.target.value)} style={selectStyle}>
          {CONTRACT_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="Title / Description">
          <input value={draft.title} onChange={(e) => onChange('title', e.target.value)} placeholder="e.g. 2025 Employment Agreement" style={inputStyle} />
        </Field>
      </div>
      <Field label="Effective Date">
        <input type="date" value={draft.startDate} onChange={(e) => onChange('startDate', e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Expiration Date">
        <input type="date" value={draft.endDate} onChange={(e) => onChange('endDate', e.target.value)} style={inputStyle} />
      </Field>
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="Document URL (Google Drive, etc.)">
          <input type="url" value={draft.documentUrl} onChange={(e) => onChange('documentUrl', e.target.value)} placeholder="https://drive.google.com/…" style={inputStyle} />
        </Field>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="Notes">
          <textarea value={draft.notes} onChange={(e) => onChange('notes', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </Field>
      </div>
    </div>
  );
}

// ── Record Cards ──────────────────────────────────────────────────────────────

function RecordCard({ children, onEdit, onDelete, deleting }) {
  return (
    <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, paddingTop: 2 }}>
        <button onClick={onEdit} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Edit
        </button>
        <button onClick={onDelete} disabled={deleting} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: deleting ? 'default' : 'pointer' }}>
          {deleting ? '…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

function CardRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>
      <span style={{ color: '#9ca3af', fontWeight: 500 }}>{label}: </span>{value}
    </div>
  );
}

function CredentialCard({ record, onEdit, onDelete, deleting }) {
  return (
    <RecordCard onEdit={onEdit} onDelete={onDelete} deleting={deleting}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{record.licenseType || 'Credential'}</span>
        {record.licenseNumber && <span style={{ fontSize: 13, color: '#6b7280' }}>#{record.licenseNumber}</span>}
        <ExpirationBadge dateStr={record.expirationDate} />
      </div>
      <CardRow label="State" value={record.state} />
      <CardRow label="Issued" value={formatDate(record.issueDate)} />
      <CardRow label="Expires" value={formatDate(record.expirationDate)} />
      {record.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, fontStyle: 'italic' }}>{record.notes}</div>}
    </RecordCard>
  );
}

function TrainingCard({ record, onEdit, onDelete, deleting }) {
  return (
    <RecordCard onEdit={onEdit} onDelete={onDelete} deleting={deleting}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{record.name || 'Training'}</span>
        <ExpirationBadge dateStr={record.expirationDate} />
      </div>
      <CardRow label="Completed" value={formatDate(record.completionDate)} />
      <CardRow label="Expires" value={formatDate(record.expirationDate)} />
      {record.certificateUrl && (
        <div style={{ marginTop: 6 }}>
          <a href={record.certificateUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
            View Certificate →
          </a>
        </div>
      )}
      {record.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, fontStyle: 'italic' }}>{record.notes}</div>}
    </RecordCard>
  );
}

function ContractCard({ record, onEdit, onDelete, deleting }) {
  const statusColors = {
    'Active': { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
    'Pending Signature': { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
    'Expired': { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    'Terminated': { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
  };
  const sc = statusColors[record.status] || statusColors['Active'];

  return (
    <RecordCard onEdit={onEdit} onDelete={onDelete} deleting={deleting}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{record.title || record.type || 'Contract'}</span>
        {record.status && (
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontWeight: 600 }}>
            {record.status}
          </span>
        )}
      </div>
      {record.type && record.title && <CardRow label="Type" value={record.type} />}
      <CardRow label="Effective" value={formatDate(record.startDate)} />
      <CardRow label="Expires" value={record.endDate ? formatDate(record.endDate) : 'Ongoing'} />
      {record.documentUrl && (
        <div style={{ marginTop: 6 }}>
          <a href={record.documentUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
            View Document →
          </a>
        </div>
      )}
      {record.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, fontStyle: 'italic' }}>{record.notes}</div>}
    </RecordCard>
  );
}

// ── Tab content ───────────────────────────────────────────────────────────────

const TAB_CONFIG = {
  credentials: {
    label: 'Credentials',
    emptyMsg: 'No credentials on file. Add a license or certification to get started.',
    FormComponent: CredentialForm,
    CardComponent: CredentialCard,
  },
  trainings: {
    label: 'Trainings',
    emptyMsg: 'No training records yet. Add mandatory or state-required trainings.',
    FormComponent: TrainingForm,
    CardComponent: TrainingCard,
  },
  contracts: {
    label: 'Contracts',
    emptyMsg: 'No contracts on file. Add employment agreements, IC contracts, or supervision agreements.',
    FormComponent: ContractForm,
    CardComponent: ContractCard,
  },
};

function TabPanel({
  tabId, records, loading,
  onAdd, onUpdate, onDelete,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formDraft, setFormDraft] = useState(EMPTY_FORMS[tabId]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [formError, setFormError] = useState('');

  const { emptyMsg, FormComponent, CardComponent } = TAB_CONFIG[tabId];

  function openAdd() {
    setFormDraft(EMPTY_FORMS[tabId]);
    setEditingId(null);
    setShowForm(true);
    setFormError('');
  }

  function openEdit(record) {
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = record;
    setFormDraft({ ...EMPTY_FORMS[tabId], ...rest });
    setEditingId(record.id);
    setShowForm(true);
    setFormError('');
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setFormDraft(EMPTY_FORMS[tabId]);
    setFormError('');
  }

  function setField(key, value) {
    setFormDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await onUpdate(tabId, editingId, formDraft);
      } else {
        await onAdd(tabId, formDraft);
      }
      cancelForm();
    } catch (e) {
      setFormError(e?.message || 'Save failed.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record) {
    if (!window.confirm(`Delete this ${TAB_CONFIG[tabId].label.slice(0, -1).toLowerCase()} record? This cannot be undone.`)) return;
    setDeletingId(record.id);
    try {
      await onDelete(tabId, record.id);
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {!showForm && (
          <button
            onClick={openAdd}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            + Add
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#6d28d9', marginBottom: 16 }}>
            {editingId ? `Edit ${TAB_CONFIG[tabId].label.slice(0, -1)}` : `Add ${TAB_CONFIG[tabId].label.slice(0, -1)}`}
          </div>
          <FormComponent draft={formDraft} onChange={setField} />
          {formError && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: 13, border: '1px solid #fecaca' }}>
              {formError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: saving ? '#a78bfa' : '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={cancelForm}
              disabled={saving}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#9ca3af', fontSize: 13, padding: '24px 0' }}>Loading…</div>
      ) : records.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>{emptyMsg}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {records.map((record) => (
            <CardComponent
              key={record.id}
              record={record}
              onEdit={() => openEdit(record)}
              onDelete={() => handleDelete(record)}
              deleting={deletingId === record.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── CEU Tracker (inside Compliance tab) ──────────────────────────────────────

const EMPTY_SETTINGS_DRAFT = { requiredHours: '', cycleMonths: '12', cycleStartDate: '' };
const EMPTY_CEU_RECORD = { title: '', organization: '', hours: '', category: '', completionDate: '', notes: '' };

function CeuProgressSection({ providerName, settings, records, reqContributions = [], onSettingsSave, onRecordAdd, onRecordDelete }) {
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(EMPTY_SETTINGS_DRAFT);
  const [showAddForm, setShowAddForm] = useState(false);
  const [recordDraft, setRecordDraft] = useState(EMPTY_CEU_RECORD);
  const [proofFile, setProofFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  function openSettingsEdit() {
    setSettingsDraft({
      requiredHours: settings?.requiredHours ?? '',
      cycleMonths: String(settings?.cycleMonths ?? '12'),
      cycleStartDate: settings?.cycleStartDate ?? '',
    });
    setEditingSettings(true);
  }

  async function handleSettingsSave() {
    setSaving(true);
    try {
      const s = {
        requiredHours: Number(settingsDraft.requiredHours),
        cycleMonths: Number(settingsDraft.cycleMonths),
        cycleStartDate: settingsDraft.cycleStartDate,
      };
      await onSettingsSave(s);
      setEditingSettings(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleRecordAdd() {
    setSaving(true);
    try {
      let proofUrl = '';
      if (proofFile) {
        const fileRef = storageRef(storage, `ceu-proofs/${providerName}/${Date.now()}-${proofFile.name}`);
        await uploadBytes(fileRef, proofFile);
        proofUrl = await getDownloadURL(fileRef);
      }
      await onRecordAdd({ ...recordDraft, proofUrl });
      setShowAddForm(false);
      setRecordDraft(EMPTY_CEU_RECORD);
      setProofFile(null);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleRecordDelete(id) {
    if (!window.confirm('Delete this CEU record?')) return;
    setDeletingId(id);
    try { await onRecordDelete(id); }
    catch (e) { console.error(e); }
    finally { setDeletingId(null); }
  }

  const cycle = settings?.cycleStartDate ? getCurrentCycle(settings.cycleStartDate, settings.cycleMonths) : null;
  const cycleRecords = cycle
    ? records.filter((r) => r.completionDate >= toDateStr(cycle.start) && r.completionDate <= toDateStr(cycle.end))
    : records;
  const cycleReqContributions = cycle
    ? reqContributions.filter((c) => c.completedDate >= toDateStr(cycle.start) && c.completedDate <= toDateStr(cycle.end))
    : reqContributions;
  const totalHours =
    cycleRecords.reduce((sum, r) => sum + (parseFloat(r.hours) || 0), 0) +
    cycleReqContributions.reduce((sum, c) => sum + (parseFloat(c.hours) || 0), 0);
  const requiredHours = settings?.requiredHours || 0;
  const pct = requiredHours > 0 ? Math.min(100, (totalHours / requiredHours) * 100) : 0;
  const progressColor = pct >= 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const cycleLabel = settings?.cycleMonths === 12 ? 'Annual' : settings?.cycleMonths ? `Every ${settings.cycleMonths / 12} years` : '';

  return (
    <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 12, padding: '20px', marginBottom: 24 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: settings || editingSettings ? 16 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#6d28d9' }}>CEU Tracker</span>
          {settings?.requiredHours && !editingSettings && (
            <span style={{ fontSize: 12, color: '#8b5cf6', padding: '2px 8px', background: '#ede9fe', borderRadius: 20, border: '1px solid #c4b5fd' }}>
              {settings.requiredHours} hrs · {cycleLabel}
            </span>
          )}
        </div>
        {!editingSettings && (
          <button
            onClick={openSettingsEdit}
            style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #c4b5fd', background: '#fff', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {settings?.requiredHours ? 'Edit Settings' : 'Set Up CEU Requirement'}
          </button>
        )}
      </div>

      {/* Settings edit form */}
      {editingSettings && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Required CEU Hours</div>
              <input
                type="number" min="0" step="0.5"
                value={settingsDraft.requiredHours}
                onChange={(e) => setSettingsDraft((d) => ({ ...d, requiredHours: e.target.value }))}
                placeholder="e.g. 36" style={inputStyle}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Cycle Length</div>
              <select
                value={settingsDraft.cycleMonths}
                onChange={(e) => setSettingsDraft((d) => ({ ...d, cycleMonths: e.target.value }))}
                style={selectStyle}
              >
                <option value="12">Annually (1 year)</option>
                <option value="24">Every 2 years</option>
                <option value="36">Every 3 years</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Cycle Start Date</div>
              <input
                type="date"
                value={settingsDraft.cycleStartDate}
                onChange={(e) => setSettingsDraft((d) => ({ ...d, cycleStartDate: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSettingsSave} disabled={saving}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: saving ? '#a78bfa' : '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            <button
              onClick={() => setEditingSettings(false)}
              style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {settings?.requiredHours && !editingSettings ? (
        <>
          {/* Progress bar */}
          <div style={{ marginBottom: 16 }}>
            {cycle && (
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                Current cycle: <strong>{formatDate(toDateStr(cycle.start))}</strong> — <strong>{formatDate(toDateStr(cycle.end))}</strong>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, background: '#e5e7eb', borderRadius: 99, height: 10, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: progressColor, borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: progressColor, whiteSpace: 'nowrap' }}>
                {totalHours.toFixed(1)} / {requiredHours} hrs
              </span>
            </div>
          </div>

          {/* Records list */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                CEU Records{cycle ? ' (this cycle)' : ''}
              </div>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #c4b5fd', background: '#fff', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  + Add CEU
                </button>
              )}
            </div>

            {showAddForm && (
              <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Course Title</div>
                    <input value={recordDraft.title} onChange={(e) => setRecordDraft((d) => ({ ...d, title: e.target.value }))} placeholder="e.g. Trauma-Focused CBT" style={inputStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Provider / Organization</div>
                    <input value={recordDraft.organization} onChange={(e) => setRecordDraft((d) => ({ ...d, organization: e.target.value }))} placeholder="e.g. NASW" style={inputStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>CEU Hours</div>
                    <input type="number" min="0" step="0.5" value={recordDraft.hours} onChange={(e) => setRecordDraft((d) => ({ ...d, hours: e.target.value }))} placeholder="e.g. 3" style={inputStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Category</div>
                    <select value={recordDraft.category} onChange={(e) => setRecordDraft((d) => ({ ...d, category: e.target.value }))} style={selectStyle}>
                      <option value="">— Select —</option>
                      {CEU_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Completion Date</div>
                    <input type="date" value={recordDraft.completionDate} onChange={(e) => setRecordDraft((d) => ({ ...d, completionDate: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Notes</div>
                    <textarea value={recordDraft.notes} onChange={(e) => setRecordDraft((d) => ({ ...d, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Proof / Certificate (PDF)</div>
                    <input
                      type="file" accept=".pdf,application/pdf"
                      onChange={(e) => setProofFile(e.target.files[0] || null)}
                      style={{ fontSize: 13, color: '#374151' }}
                    />
                    {proofFile && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{proofFile.name}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleRecordAdd} disabled={saving} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: saving ? '#a78bfa' : '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
                    {saving ? 'Uploading…' : 'Save'}
                  </button>
                  <button onClick={() => { setShowAddForm(false); setProofFile(null); }} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {cycleRecords.length === 0 && cycleReqContributions.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>
                No CEU records for this cycle yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Requirement-based CEU completions (auto-counted, read-only) */}
                {cycleReqContributions.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontWeight: 600 }}>
                          from requirements
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
                        {c.hours > 0 && (
                          <span style={{ fontSize: 12, padding: '1px 7px', borderRadius: 20, background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd', fontWeight: 600 }}>
                            {c.hours} hrs
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(c.completedDate)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Manually added CEU records */}
                {cycleRecords.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.title || 'Untitled'}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
                        {r.hours && (
                          <span style={{ fontSize: 12, padding: '1px 7px', borderRadius: 20, background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd', fontWeight: 600 }}>
                            {r.hours} hrs
                          </span>
                        )}
                        {r.category && <span style={{ fontSize: 12, color: '#6b7280' }}>{r.category}</span>}
                        {r.completionDate && <span style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(r.completionDate)}</span>}
                        {r.organization && <span style={{ fontSize: 12, color: '#6b7280' }}>{r.organization}</span>}
                        {r.proofUrl && (
                          <a href={r.proofUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                            View PDF →
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRecordDelete(r.id)}
                      disabled={deletingId === r.id}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: deletingId === r.id ? 'default' : 'pointer', flexShrink: 0, marginLeft: 12 }}
                    >
                      {deletingId === r.id ? '…' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : !editingSettings && (
        <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>
          No CEU requirement configured. Click "Set Up CEU Requirement" to get started.
        </div>
      )}
    </div>
  );
}

// ── CEU History tab ───────────────────────────────────────────────────────────

function CeuHistoryEntry({ entry }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{entry.label}</span>
        {entry.type === 'req' && (
          <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontWeight: 600 }}>
            from requirements
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {entry.hours && (
          <span style={{ fontSize: 12, padding: '1px 7px', borderRadius: 20, background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd', fontWeight: 600 }}>
            {entry.hours} hrs
          </span>
        )}
        {entry.category && <span style={{ fontSize: 12, color: '#6b7280' }}>{entry.category}</span>}
        {entry.date && <span style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(entry.date)}</span>}
        {entry.organization && <span style={{ fontSize: 12, color: '#6b7280' }}>{entry.organization}</span>}
        {entry.notes && <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>{entry.notes}</span>}
        {entry.proofUrl && (
          <a href={entry.proofUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
            View PDF →
          </a>
        )}
      </div>
    </div>
  );
}

function CeuHistoryTab({ loading, settings, records, reqContributions }) {
  if (loading) return <div style={{ color: '#9ca3af', fontSize: 13, padding: '24px 0' }}>Loading…</div>;

  const allEntries = [
    ...records.map((r) => ({
      key: `m-${r.id}`, type: 'manual', date: r.completionDate || '',
      label: r.title || 'Untitled', hours: r.hours,
      category: r.category, organization: r.organization, notes: r.notes, proofUrl: r.proofUrl,
    })),
    ...reqContributions.map((c) => ({
      key: `r-${c.id}`, type: 'req', date: c.completedDate || '',
      label: c.name, hours: c.hours,
    })),
  ];

  if (allEntries.length === 0) {
    return <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '48px 0' }}>No CEU records on file yet.</div>;
  }

  const rawCycle = settings?.cycleStartDate
    ? getCurrentCycle(settings.cycleStartDate, settings.cycleMonths)
    : null;
  // getCurrentCycle returns { start: Date, end: Date } — convert to strings for comparison/display
  const currentCycle = rawCycle
    ? { start: toDateStr(rawCycle.start), end: toDateStr(rawCycle.end) }
    : null;

  if (!currentCycle) {
    const sorted = [...allEntries].sort((a, b) => b.date.localeCompare(a.date));
    const totalHours = sorted.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>{totalHours.toFixed(1)} total hours on file</div>
        {sorted.map((entry) => <CeuHistoryEntry key={entry.key} entry={entry} />)}
      </div>
    );
  }

  function assignCycle(dateStr) {
    if (!dateStr) return null;
    const [sy, sm, sd] = settings.cycleStartDate.split('-').map(Number);
    let start = new Date(sy, sm - 1, sd);
    if (dateStr < toDateStr(start)) return null;
    for (let i = 0; i < 200; i++) {
      const end = new Date(start);
      end.setMonth(end.getMonth() + Number(settings.cycleMonths));
      end.setDate(end.getDate() - 1);
      const s = toDateStr(start); const e = toDateStr(end);
      if (dateStr <= e) return { start: s, end: e };
      start = new Date(start);
      start.setMonth(start.getMonth() + Number(settings.cycleMonths));
    }
    return null;
  }

  const cycleGroups = {};
  cycleGroups[currentCycle.start] = { ...currentCycle, isCurrent: true, entries: [] };
  const unassigned = [];

  allEntries.forEach((entry) => {
    const cycle = assignCycle(entry.date);
    if (!cycle) { unassigned.push(entry); return; }
    if (!cycleGroups[cycle.start]) {
      cycleGroups[cycle.start] = { ...cycle, isCurrent: false, entries: [] };
    }
    cycleGroups[cycle.start].entries.push(entry);
  });

  const sortedGroups = Object.values(cycleGroups).sort((a, b) => b.start.localeCompare(a.start));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {sortedGroups.map((group) => {
        const groupHours = group.entries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
        return (
          <div key={group.start}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: group.isCurrent ? '#6d28d9' : '#374151' }}>
                {group.isCurrent ? 'Current Cycle' : 'Past Cycle'}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{formatDate(group.start)} — {formatDate(group.end)}</div>
              <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: group.isCurrent ? '#6d28d9' : '#374151' }}>
                {groupHours.toFixed(1)} hrs
                {settings.requiredHours && (
                  <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 12 }}> / {settings.requiredHours} required</span>
                )}
              </div>
            </div>
            {group.entries.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>No records for this cycle.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...group.entries].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => (
                  <CeuHistoryEntry key={entry.key} entry={entry} />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {unassigned.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#6b7280', marginBottom: 12, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>
            Pre-Cycle Records
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...unassigned].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => (
              <CeuHistoryEntry key={entry.key} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Compliance tab helpers ────────────────────────────────────────────────────

const COMP_TYPE_COLORS = {
  Training:   { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  CEU:        { bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
  Credential: { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
  Contract:   { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  Other:      { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
};

const COMP_STATUS_STYLES = {
  missing:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'Not on file' },
  complete: { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0', label: 'Complete' },
  current:  { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0', label: 'Current' },
  expiring: { bg: '#fffbeb', color: '#92400e', border: '#fde68a', label: 'Expiring Soon' },
  expired:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'Expired' },
};

function getCellStatus(req, completion) {
  if (!completion?.lastCompletedDate) return 'missing';
  if (!req.recurrenceMonths) return 'complete';
  const exp = completion.nextDueDate;
  if (!exp) return 'current';
  const [y, m, d] = exp.split('-').map(Number);
  const expDate = new Date(y, m - 1, d);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = Math.ceil((expDate - now) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 90) return 'expiring';
  return 'current';
}

function recurrenceLabel(months) {
  if (months === null || months === undefined) return 'One-time';
  const map = { 6: 'Every 6 months', 12: 'Annually', 24: 'Every 2 years', 36: 'Every 3 years', 48: 'Every 4 years', 72: 'Every 6 years' };
  return map[months] || `Every ${months} months`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// Reusable list of requirement rows with inline completion forms.
// Used in the Compliance tab (non-Training reqs) and Trainings tab (Training reqs).
function RequirementList({ providerName, reqs, completions, onSave, onClear }) {
  const [activeReqId, setActiveReqId] = useState(null);
  const [form, setForm] = useState({ lastCompletedDate: '', documentUrl: '', notes: '' });
  const [reqProofFile, setReqProofFile] = useState(null);
  const [saving, setSaving] = useState(false);

  if (reqs.length === 0) return null;

  function openForm(req) {
    const existing = completions[req.id];
    setForm({
      lastCompletedDate: existing?.lastCompletedDate || todayStr(),
      documentUrl: existing?.documentUrl || '',
      notes: existing?.notes || '',
    });
    setReqProofFile(null);
    setActiveReqId(req.id);
  }

  async function handleSave(req) {
    setSaving(true);
    try {
      let { documentUrl } = form;
      if (reqProofFile) {
        const fileRef = storageRef(storage, `requirement-proofs/${providerName}/${req.id}/${Date.now()}-${reqProofFile.name}`);
        await uploadBytes(fileRef, reqProofFile);
        documentUrl = await getDownloadURL(fileRef);
      }
      const nextDueDate = calcNextDue(form.lastCompletedDate, req.recurrenceMonths);
      await onSave(req.id, { ...form, documentUrl, nextDueDate });
      setReqProofFile(null);
      setActiveReqId(null);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleClear(req) {
    if (!window.confirm('Clear this completion record?')) return;
    setSaving(true);
    try { await onClear(req.id); setActiveReqId(null); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {reqs.map((req) => {
        const completion = completions[req.id];
        const status = getCellStatus(req, completion);
        const ss = COMP_STATUS_STYLES[status];
        const tc = COMP_TYPE_COLORS[req.type] || COMP_TYPE_COLORS.Other;
        const isOpen = activeReqId === req.id;
        const nextDuePreview = isOpen ? calcNextDue(form.lastCompletedDate, req.recurrenceMonths) : null;

        return (
          <div key={req.id} style={{ background: '#fafafa', border: `1px solid ${isOpen ? '#c4b5fd' : '#e5e7eb'}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{req.name}</span>
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, fontWeight: 600 }}>
                    {req.type}
                  </span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{recurrenceLabel(req.recurrenceMonths)}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {completion?.lastCompletedDate ? (
                    <>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>
                        Last completed: <strong>{formatDate(completion.lastCompletedDate)}</strong>
                      </span>
                      {completion.nextDueDate && (
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                          · Next due: <strong>{formatDate(completion.nextDueDate)}</strong>
                        </span>
                      )}
                      {completion.documentUrl && (
                        <a href={completion.documentUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                          View doc →
                        </a>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Not on file</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, fontWeight: 600 }}>
                  {ss.label}
                </span>
                <button
                  onClick={() => { if (isOpen) { setActiveReqId(null); setReqProofFile(null); } else { openForm(req); } }}
                  style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: isOpen ? '#f3f4f6' : '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {isOpen ? 'Cancel' : (completion?.lastCompletedDate ? 'Update' : 'Log Completion')}
                </button>
              </div>
            </div>

            {isOpen && (
              <div style={{ padding: '16px 20px', borderTop: '1px solid #ede9fe', background: '#f5f3ff', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Completion Date</div>
                    <input
                      type="date" value={form.lastCompletedDate}
                      onChange={(e) => setForm((f) => ({ ...f, lastCompletedDate: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Proof / Certificate (PDF)</div>
                    <input
                      type="file" accept=".pdf,application/pdf"
                      onChange={(e) => setReqProofFile(e.target.files[0] || null)}
                      style={{ fontSize: 13, color: '#374151', width: '100%' }}
                    />
                    {reqProofFile && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{reqProofFile.name}</div>
                    )}
                    {!reqProofFile && form.documentUrl && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Current: <a href={form.documentUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed', fontWeight: 600 }}>View existing →</a>
                      </div>
                    )}
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Notes</div>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
                {nextDuePreview && (
                  <div style={{ fontSize: 12, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, padding: '6px 10px' }}>
                    Next due will be set to: <strong>{formatDate(nextDuePreview)}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleSave(req)} disabled={saving}
                    style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: saving ? '#a78bfa' : '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  {completion?.lastCompletedDate && (
                    <button
                      onClick={() => handleClear(req)} disabled={saving}
                      style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    >
                      Clear record
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ComplianceTabContent({
  providerName, data, loading, onSave, onClear,
  ceuSettings, ceuRecords,
  onCeuSettingsSave, onCeuRecordAdd, onCeuRecordDelete,
}) {
  if (loading) return <div style={{ color: '#9ca3af', fontSize: 13, padding: '24px 0' }}>Loading…</div>;

  const allReqs = data?.reqs ?? [];
  const completions = data?.completions ?? {};

  // Training-type reqs go to the Trainings tab — exclude them here
  const reqs = allReqs.filter((r) => r.type !== 'Training');

  // CEU-type requirements with logged completions — auto-counted toward the CEU tracker
  const ceuReqContributions = reqs
    .filter((r) => r.type === 'CEU' && completions[r.id]?.lastCompletedDate)
    .map((r) => ({
      id: r.id,
      name: r.name,
      hours: r.ceuHours || 0,
      completedDate: completions[r.id].lastCompletedDate,
    }));

  return (
    <div>
      {/* CEU tracker always shown at top */}
      <CeuProgressSection
        providerName={providerName}
        settings={ceuSettings}
        records={ceuRecords}
        reqContributions={ceuReqContributions}
        onSettingsSave={onCeuSettingsSave}
        onRecordAdd={onCeuRecordAdd}
        onRecordDelete={onCeuRecordDelete}
      />

      {/* State-mandated requirements (non-Training) */}
      {reqs.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
          No requirements are assigned to this provider. Define requirements in the Requirements page.
        </div>
      ) : (
        <RequirementList
          providerName={providerName}
          reqs={reqs}
          completions={completions}
          onSave={onSave}
          onClear={onClear}
        />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PersonnelFilesPage({ lockedProvider = null }) {
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(!lockedProvider);
  const [selectedProvider, setSelectedProvider] = useState(lockedProvider);
  const [activeTab, setActiveTab] = useState('compliance');

  // records per provider: { [providerName]: { credentials, trainings, contracts } }
  const [allRecords, setAllRecords] = useState({});
  const [loadingTab, setLoadingTab] = useState(false);
  const fetchedRef = useRef({});

  // compliance: { [providerName]: { reqs, completions, ceuSettings, ceuRecords } }
  const [complianceData, setComplianceData] = useState({});
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  const compFetchedRef = useRef(new Set());

  // ── Load providers (admin only — skip when locked to a single provider) ──────
  useEffect(() => {
    if (lockedProvider) return;
    fetchProviderProfiles()
      .then((data) => {
        const sorted = data.map((p) => p.name).sort();
        setProviders(sorted);
      })
      .catch(console.error)
      .finally(() => setLoadingProviders(false));
  }, [lockedProvider]);

  // ── Load tab records when tab/provider changes ──────────────────────────────
  useEffect(() => {
    if (!selectedProvider || !activeTab || activeTab === 'compliance') return;
    if (fetchedRef.current[selectedProvider]?.has(activeTab)) return;

    let cancelled = false;
    async function load() {
      setLoadingTab(true);
      try {
        const data = await fetchPersonnelRecords(selectedProvider, activeTab);
        if (cancelled) return;
        setAllRecords((prev) => ({
          ...prev,
          [selectedProvider]: {
            ...(prev[selectedProvider] || {}),
            [activeTab]: data,
          },
        }));
        if (!fetchedRef.current[selectedProvider]) {
          fetchedRef.current[selectedProvider] = new Set();
        }
        fetchedRef.current[selectedProvider].add(activeTab);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedProvider, activeTab]);

  // ── Load compliance + CEU data when compliance or trainings tab opened ───────
  useEffect(() => {
    if (!selectedProvider || (activeTab !== 'compliance' && activeTab !== 'trainings' && activeTab !== 'ceu-history')) return;
    if (compFetchedRef.current.has(selectedProvider)) return;

    let cancelled = false;
    async function load() {
      setLoadingCompliance(true);
      try {
        const [allReqs, ceuSettings, ceuRecords] = await Promise.all([
          fetchRequirements(),
          fetchCeuSettings(selectedProvider),
          fetchPersonnelRecords(selectedProvider, 'ceus'),
        ]);
        const applicable = allReqs.filter((r) =>
          r.appliesTo === 'all' || (Array.isArray(r.appliesTo) && r.appliesTo.includes(selectedProvider))
        );
        const results = await Promise.all(
          applicable.map((r) => fetchCompletionForProvider(r.id, selectedProvider))
        );
        if (cancelled) return;
        const completions = {};
        applicable.forEach((r, i) => { completions[r.id] = results[i]; });
        setComplianceData((prev) => ({
          ...prev,
          [selectedProvider]: { reqs: applicable, completions, ceuSettings, ceuRecords },
        }));
        compFetchedRef.current.add(selectedProvider);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoadingCompliance(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedProvider, activeTab]);

  function selectProvider(name) {
    setSelectedProvider(name);
    setActiveTab('compliance');
  }

  // ── Record mutations ────────────────────────────────────────────────────────
  async function handleAdd(tabId, data) {
    const id = await addPersonnelRecord(selectedProvider, tabId, data);
    setAllRecords((prev) => ({
      ...prev,
      [selectedProvider]: {
        ...(prev[selectedProvider] || {}),
        [tabId]: [...(prev[selectedProvider]?.[tabId] || []), { id, ...data }],
      },
    }));
  }

  async function handleUpdate(tabId, recordId, data) {
    await updatePersonnelRecord(selectedProvider, tabId, recordId, data);
    setAllRecords((prev) => ({
      ...prev,
      [selectedProvider]: {
        ...(prev[selectedProvider] || {}),
        [tabId]: (prev[selectedProvider]?.[tabId] || []).map((r) =>
          r.id === recordId ? { ...r, ...data } : r
        ),
      },
    }));
  }

  async function handleDelete(tabId, recordId) {
    await deletePersonnelRecord(selectedProvider, tabId, recordId);
    setAllRecords((prev) => ({
      ...prev,
      [selectedProvider]: {
        ...(prev[selectedProvider] || {}),
        [tabId]: (prev[selectedProvider]?.[tabId] || []).filter((r) => r.id !== recordId),
      },
    }));
  }

  async function handleComplianceSave(reqId, data) {
    await setCompletionApi(reqId, selectedProvider, data);
    const updated = await fetchCompletionForProvider(reqId, selectedProvider);
    setComplianceData((prev) => ({
      ...prev,
      [selectedProvider]: {
        ...prev[selectedProvider],
        completions: { ...prev[selectedProvider].completions, [reqId]: updated },
      },
    }));
  }

  async function handleComplianceClear(reqId) {
    await deleteCompletion(reqId, selectedProvider);
    setComplianceData((prev) => ({
      ...prev,
      [selectedProvider]: {
        ...prev[selectedProvider],
        completions: { ...prev[selectedProvider].completions, [reqId]: null },
      },
    }));
  }

  async function handleCeuSettingsSave(settings) {
    await saveCeuSettings(selectedProvider, settings);
    setComplianceData((prev) => ({
      ...prev,
      [selectedProvider]: { ...prev[selectedProvider], ceuSettings: settings },
    }));
  }

  async function handleCeuRecordAdd(data) {
    const id = await addPersonnelRecord(selectedProvider, 'ceus', data);
    setComplianceData((prev) => ({
      ...prev,
      [selectedProvider]: {
        ...prev[selectedProvider],
        ceuRecords: [...(prev[selectedProvider]?.ceuRecords || []), { id, ...data }],
      },
    }));
  }

  async function handleCeuRecordDelete(recordId) {
    await deletePersonnelRecord(selectedProvider, 'ceus', recordId);
    setComplianceData((prev) => ({
      ...prev,
      [selectedProvider]: {
        ...prev[selectedProvider],
        ceuRecords: (prev[selectedProvider]?.ceuRecords || []).filter((r) => r.id !== recordId),
      },
    }));
  }

  const currentRecords = allRecords[selectedProvider] || {};
  const tabRecords = currentRecords[activeTab] || [];

  function getProviderDot(name) {
    const r = allRecords[name];
    if (!r) return null;
    const status = providerComplianceStatus(r);
    if (!status) return null;
    const dot = COMPLIANCE_DOT[status];
    return (
      <span
        title={dot.title}
        style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: dot.color, flexShrink: 0 }}
      />
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Provider list (left — hidden when locked to a single provider) ── */}
      {!lockedProvider && (
        <aside style={{
          width: 220, flexShrink: 0, borderRight: '1px solid #e5e7eb',
          overflowY: 'auto', padding: '24px 12px', background: '#fafafa',
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, paddingLeft: 4 }}>
            Providers
          </div>
          {loadingProviders ? (
            <div style={{ color: '#9ca3af', fontSize: 13, padding: '12px 4px' }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {providers.map((name) => {
                const active = selectedProvider === name;
                return (
                  <button
                    key={name}
                    onClick={() => selectProvider(name)}
                    style={{
                      textAlign: 'left', padding: '9px 12px', borderRadius: 8,
                      border: '1px solid', cursor: 'pointer', fontSize: 15, fontWeight: active ? 700 : 500,
                      borderColor: active ? '#c4b5fd' : 'transparent',
                      background: active ? '#ede9fe' : 'transparent',
                      color: active ? '#6d28d9' : '#374151',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    }}
                  >
                    <span>{name}</span>
                    {getProviderDot(name)}
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      )}

      {/* ── Detail panel (right) ─────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
        {!selectedProvider ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Select a provider</div>
              <div style={{ fontSize: 13 }}>Choose a provider from the list to view their personnel file.</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{selectedProvider}</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Personnel file — compliance tracking</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e5e7eb', marginBottom: 24 }}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;

                let badge = null;
                if (tab.id === 'compliance') {
                  const cd = complianceData[selectedProvider];
                  if (cd) {
                    const issues = (cd.reqs || []).filter((r) => {
                      const s = getCellStatus(r, cd.completions[r.id]);
                      return s === 'missing' || s === 'expired' || s === 'expiring';
                    }).length;
                    badge = issues > 0
                      ? <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>{issues}</span>
                      : <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 20, background: '#ecfdf5', color: '#065f46', fontWeight: 700 }}>✓</span>;
                  }
                } else if (tab.id === 'ceu-history') {
                  const cd = complianceData[selectedProvider];
                  if (cd) {
                    const reqCount = (cd.reqs || [])
                      .filter((r) => r.type === 'CEU')
                      .reduce((sum, r) => {
                        const comp = cd.completions[r.id];
                        if (!comp) return sum;
                        return sum + (comp.lastCompletedDate ? 1 : 0) + (comp.completionHistory?.length || 0);
                      }, 0);
                    const total = (cd.ceuRecords || []).length + reqCount;
                    if (total > 0) badge = <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 20, background: isActive ? '#ede9fe' : '#f3f4f6', color: isActive ? '#6d28d9' : '#9ca3af', fontWeight: 700 }}>{total}</span>;
                  }
                } else {
                  const count = currentRecords[tab.id]?.length ?? null;
                  if (count !== null) {
                    badge = <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 20, background: isActive ? '#ede9fe' : '#f3f4f6', color: isActive ? '#6d28d9' : '#9ca3af', fontWeight: 700 }}>{count}</span>;
                  }
                }

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
                      fontSize: 14, fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#7c3aed' : '#6b7280',
                      borderBottom: isActive ? '2px solid #7c3aed' : '2px solid transparent',
                      marginBottom: -2,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {tab.label}
                    {badge}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            {activeTab === 'compliance' ? (
              <ComplianceTabContent
                key={selectedProvider}
                providerName={selectedProvider}
                data={complianceData[selectedProvider]}
                loading={loadingCompliance}
                onSave={handleComplianceSave}
                onClear={handleComplianceClear}
                ceuSettings={complianceData[selectedProvider]?.ceuSettings ?? null}
                ceuRecords={complianceData[selectedProvider]?.ceuRecords ?? []}
                onCeuSettingsSave={handleCeuSettingsSave}
                onCeuRecordAdd={handleCeuRecordAdd}
                onCeuRecordDelete={handleCeuRecordDelete}
              />
            ) : activeTab === 'ceu-history' ? (
              <CeuHistoryTab
                loading={loadingCompliance}
                settings={complianceData[selectedProvider]?.ceuSettings ?? null}
                records={complianceData[selectedProvider]?.ceuRecords ?? []}
                reqContributions={(() => {
                  const cd = complianceData[selectedProvider];
                  if (!cd) return [];
                  return (cd.reqs || [])
                    .filter((r) => r.type === 'CEU')
                    .flatMap((r) => {
                      const comp = cd.completions[r.id];
                      if (!comp) return [];
                      const entries = [];
                      if (comp.lastCompletedDate) {
                        entries.push({ id: r.id, name: r.name, hours: r.ceuHours || 0, completedDate: comp.lastCompletedDate });
                      }
                      (comp.completionHistory || []).forEach((date, i) => {
                        entries.push({ id: `${r.id}-h${i}`, name: r.name, hours: r.ceuHours || 0, completedDate: date });
                      });
                      return entries;
                    });
                })()}
              />
            ) : activeTab === 'trainings' ? (
              <>
                {/* Required Trainings from the requirements board shown above manual records */}
                {(() => {
                  const cd = complianceData[selectedProvider];
                  const trainingReqs = (cd?.reqs ?? []).filter((r) => r.type === 'Training');
                  if (loadingCompliance || trainingReqs.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 28 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                        Required Trainings
                      </div>
                      <RequirementList
                        key={selectedProvider}
                        providerName={selectedProvider}
                        reqs={trainingReqs}
                        completions={cd?.completions ?? {}}
                        onSave={handleComplianceSave}
                        onClear={handleComplianceClear}
                      />
                    </div>
                  );
                })()}
                <TabPanel
                  key={`${selectedProvider}-${activeTab}`}
                  tabId={activeTab}
                  records={tabRecords}
                  loading={loadingTab}
                  onAdd={handleAdd}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              </>
            ) : (
              <TabPanel
                key={`${selectedProvider}-${activeTab}`}
                tabId={activeTab}
                records={tabRecords}
                loading={loadingTab}
                onAdd={handleAdd}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
