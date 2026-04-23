import { useState, useEffect, useRef } from 'react';
import { fetchProviderProfiles } from '../lib/providersProfileApi';
import {
  fetchPersonnelRecords,
  addPersonnelRecord,
  updatePersonnelRecord,
  deletePersonnelRecord,
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
  { id: 'credentials', label: 'Credentials' },
  { id: 'ceus', label: 'CEUs' },
  { id: 'trainings', label: 'Trainings' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'compliance', label: 'Compliance' },
];

const CREDENTIAL_TYPES = [
  'LMFT', 'LCSW', 'LPC', 'LMHC', 'PhD', 'PsyD',
  'Associate/Intern', 'Psychiatrist (MD)', 'ARNP',
  'NPI Number', 'DEA Registration', 'CPR Certification', 'Other',
];

const CEU_CATEGORIES = [
  'Ethics', 'Clinical Skills', 'Cultural Competency',
  'Suicide Prevention', 'Trauma', 'Substance Use',
  'Child/Adolescent', 'Supervision', 'Other',
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
  ceus: { title: '', organization: '', hours: '', category: '', completionDate: '', cycleLabel: '', notes: '' },
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

function providerComplianceStatus(records) {
  // records: { credentials, trainings } — checks both for expired/expiring items
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

function Field({ label, children, half }) {
  return (
    <div style={half ? {} : {}}>
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

function CeuForm({ draft, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="Course Title">
          <input value={draft.title} onChange={(e) => onChange('title', e.target.value)} placeholder="e.g. Trauma-Focused CBT" style={inputStyle} />
        </Field>
      </div>
      <Field label="Provider / Organization">
        <input value={draft.organization} onChange={(e) => onChange('organization', e.target.value)} placeholder="e.g. NASW" style={inputStyle} />
      </Field>
      <Field label="CEU Hours">
        <input type="number" min="0" step="0.5" value={draft.hours} onChange={(e) => onChange('hours', e.target.value)} placeholder="e.g. 3" style={inputStyle} />
      </Field>
      <Field label="Category">
        <select value={draft.category} onChange={(e) => onChange('category', e.target.value)} style={selectStyle}>
          <option value="">— Select —</option>
          {CEU_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Completion Date">
        <input type="date" value={draft.completionDate} onChange={(e) => onChange('completionDate', e.target.value)} style={inputStyle} />
      </Field>
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="License Renewal Cycle (optional)">
          <input value={draft.cycleLabel} onChange={(e) => onChange('cycleLabel', e.target.value)} placeholder="e.g. LMFT 2024–2026" style={inputStyle} />
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

function CeuCard({ record, onEdit, onDelete, deleting }) {
  return (
    <RecordCard onEdit={onEdit} onDelete={onDelete} deleting={deleting}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{record.title || 'CEU Record'}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        {record.hours && (
          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd', fontWeight: 600 }}>
            {record.hours} hrs
          </span>
        )}
        {record.category && (
          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', fontWeight: 500 }}>
            {record.category}
          </span>
        )}
      </div>
      <CardRow label="Organization" value={record.organization} />
      <CardRow label="Completed" value={formatDate(record.completionDate)} />
      <CardRow label="Cycle" value={record.cycleLabel} />
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
  ceus: {
    label: 'CEUs',
    emptyMsg: 'No CEU records yet. Add a completed continuing education course.',
    FormComponent: CeuForm,
    CardComponent: CeuCard,
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
      {/* Add button */}
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

      {/* Add / Edit form */}
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

      {/* Records list */}
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
  const map = { 6: 'Every 6 months', 12: 'Annually', 24: 'Every 2 years', 36: 'Every 3 years', 60: 'Every 5 years' };
  return map[months] || `Every ${months} months`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function ComplianceTabContent({ data, loading, onSave, onClear }) {
  const [activeReqId, setActiveReqId] = useState(null);
  const [form, setForm] = useState({ lastCompletedDate: '', documentUrl: '', notes: '' });
  const [saving, setSaving] = useState(false);

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 13, padding: '24px 0' }}>Loading…</div>;
  if (!data) return null;

  const { reqs, completions } = data;

  if (reqs.length === 0) {
    return (
      <div style={{ color: '#9ca3af', fontSize: 13, padding: '32px 0', textAlign: 'center' }}>
        No requirements are assigned to this provider. Define requirements in the Requirements page.
      </div>
    );
  }

  function openForm(req) {
    const existing = completions[req.id];
    setForm({
      lastCompletedDate: existing?.lastCompletedDate || todayStr(),
      documentUrl: existing?.documentUrl || '',
      notes: existing?.notes || '',
    });
    setActiveReqId(req.id);
  }

  async function handleSave(req) {
    setSaving(true);
    try {
      const nextDueDate = calcNextDue(form.lastCompletedDate, req.recurrenceMonths);
      await onSave(req.id, { ...form, nextDueDate });
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
            {/* Row */}
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
                  onClick={() => isOpen ? setActiveReqId(null) : openForm(req)}
                  style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: isOpen ? '#f3f4f6' : '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {isOpen ? 'Cancel' : (completion?.lastCompletedDate ? 'Update' : 'Log Completion')}
                </button>
              </div>
            </div>

            {/* Inline form */}
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
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Document / Certificate URL</div>
                    <input
                      type="url" value={form.documentUrl}
                      onChange={(e) => setForm((f) => ({ ...f, documentUrl: e.target.value }))}
                      placeholder="https://…" style={inputStyle}
                    />
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PersonnelFilesPage() {
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [activeTab, setActiveTab] = useState('credentials');

  // records per provider: { [providerName]: { credentials, ceus, trainings, contracts } }
  const [allRecords, setAllRecords] = useState({});
  const [loadingTab, setLoadingTab] = useState(false);
  // tracks which (provider, tab) pairs have already been fetched — ref avoids dep-array issues
  const fetchedRef = useRef({});

  // compliance: { [providerName]: { reqs: [], completions: { [reqId]: completion|null } } }
  const [complianceData, setComplianceData] = useState({});
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  const compFetchedRef = useRef(new Set());

  // ── Load providers ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchProviderProfiles()
      .then((data) => {
        const sorted = data.map((p) => p.name).sort();
        setProviders(sorted);
      })
      .catch(console.error)
      .finally(() => setLoadingProviders(false));
  }, []);

  // ── Load tab records when tab/provider changes ──────────────────────────────
  useEffect(() => {
    if (!selectedProvider || !activeTab) return;
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

  // ── Load compliance data when compliance tab is opened ─────────────────────
  useEffect(() => {
    if (!selectedProvider || activeTab !== 'compliance') return;
    if (compFetchedRef.current.has(selectedProvider)) return;

    let cancelled = false;
    async function load() {
      setLoadingCompliance(true);
      try {
        const allReqs = await fetchRequirements();
        const applicable = allReqs.filter((r) =>
          r.appliesTo === 'all' || (Array.isArray(r.appliesTo) && r.appliesTo.includes(selectedProvider))
        );
        const results = await Promise.all(
          applicable.map((r) => fetchCompletionForProvider(r.id, selectedProvider))
        );
        if (cancelled) return;
        const completions = {};
        applicable.forEach((r, i) => { completions[r.id] = results[i]; });
        setComplianceData((prev) => ({ ...prev, [selectedProvider]: { reqs: applicable, completions } }));
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
    setActiveTab('credentials');
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

  async function handleComplianceSave(reqId, data) {
    await setCompletionApi(reqId, selectedProvider, data);
    setComplianceData((prev) => ({
      ...prev,
      [selectedProvider]: {
        ...prev[selectedProvider],
        completions: { ...prev[selectedProvider].completions, [reqId]: { providerName: selectedProvider, ...data } },
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

  const currentRecords = allRecords[selectedProvider] || {};
  const tabRecords = currentRecords[activeTab] || [];

  // Compliance dot: only shown once both credentials and trainings are loaded
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

      {/* ── Provider list (left) ─────────────────────────────────────── */}
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
            {/* Header */}
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
                    const issues = cd.reqs.filter((r) => {
                      const s = getCellStatus(r, cd.completions[r.id]);
                      return s === 'missing' || s === 'expired' || s === 'expiring';
                    }).length;
                    badge = issues > 0
                      ? <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>{issues}</span>
                      : <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 20, background: '#ecfdf5', color: '#065f46', fontWeight: 700 }}>✓</span>;
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
                data={complianceData[selectedProvider]}
                loading={loadingCompliance}
                onSave={handleComplianceSave}
                onClear={handleComplianceClear}
              />
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
