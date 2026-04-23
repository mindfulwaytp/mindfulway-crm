import { useState, useEffect, useRef } from 'react';
import {
  fetchRequirements, addRequirement, updateRequirement, deleteRequirement,
  fetchCompletionsForReq, setCompletion, deleteCompletion, calcNextDue,
} from '../lib/requirementsApi';
import { fetchProviderProfiles } from '../lib/providersProfileApi';
import { fetchCeuSettings, fetchPersonnelRecords } from '../lib/personnelApi';

// ── Constants ─────────────────────────────────────────────────────────────────

const REQUIREMENT_TYPES = ['Training', 'CEU', 'Credential', 'Contract', 'Other'];

const RECURRENCE_OPTIONS = [
  { label: 'One-time (does not expire)', value: null },
  { label: 'Every 6 months', value: 6 },
  { label: 'Annually', value: 12 },
  { label: 'Every 2 years', value: 24 },
  { label: 'Every 3 years', value: 36 },
  { label: 'Every 4 years', value: 48 },
  { label: 'Every 6 years', value: 72 },
];

const EMPTY_REQ_FORM = {
  name: '', type: 'Training', recurrenceMonths: 24,
  ceuHours: '', appliesTo: 'all', selectedProviders: [], notes: '',
};

const TYPE_COLORS = {
  Training:   { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  CEU:        { bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
  Credential: { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
  Contract:   { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  Other:      { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
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

function getCellStatus(req, completion) {
  if (!completion?.lastCompletedDate) return 'missing';
  if (!req.recurrenceMonths) return 'complete';
  return getExpirationStatus(completion.nextDueDate) || 'current';
}

const CELL_STYLES = {
  missing:  { bg: '#fef2f2', color: '#dc2626' },
  complete: { bg: '#ecfdf5', color: '#065f46' },
  current:  { bg: '#ecfdf5', color: '#065f46' },
  expiring: { bg: '#fffbeb', color: '#92400e' },
  expired:  { bg: '#fef2f2', color: '#dc2626' },
};

const CELL_ICONS = { missing: '—', complete: '✓', current: '✓', expiring: '⚠', expired: '✗' };

function formatDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function recurrenceLabel(months) {
  if (months === null || months === undefined) return 'One-time';
  const opt = RECURRENCE_OPTIONS.find((o) => o.value === months);
  return opt ? opt.label : `Every ${months} months`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
    if (cycleEnd >= today) return { start: toDateStr(cycleStart), end: toDateStr(cycleEnd) };
    cycleStart = new Date(cycleStart);
    cycleStart.setMonth(cycleStart.getMonth() + Number(cycleMonths));
  }
  return null;
}

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

// ── Requirement form ──────────────────────────────────────────────────────────

function RequirementForm({ draft, onChange, providers }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="Requirement Name">
          <input
            value={draft.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="e.g. Mandatory Reporter Training"
            style={inputStyle}
          />
        </Field>
      </div>
      <Field label="Type">
        <select value={draft.type} onChange={(e) => onChange('type', e.target.value)} style={selectStyle}>
          {REQUIREMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Recurrence">
        <select
          value={draft.recurrenceMonths ?? ''}
          onChange={(e) => onChange('recurrenceMonths', e.target.value === '' ? null : Number(e.target.value))}
          style={selectStyle}
        >
          {RECURRENCE_OPTIONS.map((o) => (
            <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>
          ))}
        </select>
      </Field>
      {draft.type === 'CEU' && (
        <Field label="Required CEU Hours">
          <input
            type="number" min="0" step="0.5"
            value={draft.ceuHours}
            onChange={(e) => onChange('ceuHours', e.target.value)}
            placeholder="e.g. 50"
            style={inputStyle}
          />
        </Field>
      )}
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="Applies To">
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            {['all', 'selected'].map((opt) => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: draft.appliesTo === opt ? 700 : 400 }}>
                <input
                  type="radio" name="appliesTo" value={opt}
                  checked={draft.appliesTo === opt}
                  onChange={() => onChange('appliesTo', opt)}
                />
                {opt === 'all' ? 'All providers' : 'Selected providers only'}
              </label>
            ))}
          </div>
          {draft.appliesTo === 'selected' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {providers.map((p) => {
                const active = (draft.selectedProviders || []).includes(p);
                return (
                  <button
                    key={p} type="button"
                    onClick={() => {
                      const cur = draft.selectedProviders || [];
                      onChange('selectedProviders', active ? cur.filter((x) => x !== p) : [...cur, p]);
                    }}
                    style={{
                      padding: '4px 12px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontSize: 13,
                      borderColor: active ? '#7c3aed' : '#d1d5db',
                      background: active ? '#ede9fe' : '#fff',
                      color: active ? '#6d28d9' : '#374151',
                      fontWeight: active ? 600 : 400,
                    }}
                  >{p}</button>
                );
              })}
            </div>
          )}
        </Field>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="Notes / Regulation Reference">
          <textarea
            value={draft.notes}
            onChange={(e) => onChange('notes', e.target.value)}
            placeholder="e.g. WAC 388-06-0170"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>
      </div>
    </div>
  );
}

// ── Compliance board cell ─────────────────────────────────────────────────────

function BoardCell({ req, completion }) {
  const status = getCellStatus(req, completion);
  const s = CELL_STYLES[status];
  return (
    <div style={{ textAlign: 'center', padding: '8px 6px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{CELL_ICONS[status]}</div>
      {completion?.lastCompletedDate
        ? <div style={{ fontSize: 10, color: s.color, marginTop: 2 }}>{formatDate(completion.lastCompletedDate)}</div>
        : <div style={{ fontSize: 10, color: s.color, marginTop: 2 }}>Not on file</div>
      }
      {completion?.nextDueDate && (
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>Due {formatDate(completion.nextDueDate)}</div>
      )}
    </div>
  );
}

// ── Mark Complete modal ───────────────────────────────────────────────────────

function MarkCompleteModal({ target, matrix, onSave, onClear, onClose }) {
  const existing = matrix[target.req.id]?.[target.providerName];
  const [form, setForm] = useState({
    lastCompletedDate: existing?.lastCompletedDate || todayStr(),
    documentUrl: existing?.documentUrl || '',
    notes: existing?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!form.lastCompletedDate) { setError('Completion date is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const nextDueDate = calcNextDue(form.lastCompletedDate, target.req.recurrenceMonths);
      await onSave(target.req.id, target.providerName, { ...form, nextDueDate });
    } catch (e) {
      setError(e?.message || 'Save failed.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!window.confirm('Clear this completion record?')) return;
    setSaving(true);
    try { await onClear(target.req.id, target.providerName); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  const nextDue = calcNextDue(form.lastCompletedDate, target.req.recurrenceMonths);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, maxWidth: '92vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Log Completion</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
          {target.req.name} — <strong>{target.providerName}</strong>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Completion Date">
            <input
              type="date" value={form.lastCompletedDate}
              onChange={(e) => setForm((f) => ({ ...f, lastCompletedDate: e.target.value }))}
              style={inputStyle}
            />
          </Field>
          <Field label="Document / Certificate URL">
            <input
              type="url" value={form.documentUrl}
              onChange={(e) => setForm((f) => ({ ...f, documentUrl: e.target.value }))}
              placeholder="https://…" style={inputStyle}
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>
        </div>
        {nextDue && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#eff6ff', color: '#1d4ed8', fontSize: 12, border: '1px solid #bfdbfe' }}>
            Next due: <strong>{formatDate(nextDue)}</strong>
          </div>
        )}
        {error && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: 13, border: '1px solid #fecaca' }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: saving ? '#a78bfa' : '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose} disabled={saving}
            style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
        {existing && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #fee2e2', textAlign: 'center' }}>
            <button
              onClick={handleClear} disabled={saving}
              style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Clear completion record
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RequirementsPage() {
  const [pageTab, setPageTab] = useState('requirements');
  const [requirements, setRequirements] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loadingInit, setLoadingInit] = useState(true);

  // Requirements tab
  const [showForm, setShowForm] = useState(false);
  const [editingReq, setEditingReq] = useState(null);
  const [formDraft, setFormDraft] = useState(EMPTY_REQ_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Compliance board
  const [matrix, setMatrix] = useState({});
  const [ceuSettingsMap, setCeuSettingsMap] = useState({});
  const [ceuRecordsMap, setCeuRecordsMap] = useState({});
  const [loadingBoard, setLoadingBoard] = useState(false);
  const boardLoadedRef = useRef(false);
  const [markTarget, setMarkTarget] = useState(null);

  // ── Load on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [reqs, provData] = await Promise.all([fetchRequirements(), fetchProviderProfiles()]);
        setRequirements(reqs);
        setProviders(provData.map((p) => p.name).sort());
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingInit(false);
      }
    }
    init();
  }, []);

  // ── Load compliance board when tab first opened ──────────────────────────
  useEffect(() => {
    if (pageTab !== 'compliance' || boardLoadedRef.current || requirements.length === 0) return;

    let cancelled = false;
    async function loadBoard() {
      setLoadingBoard(true);
      try {
        const [arrays, ceuResults, ceuRecordResults] = await Promise.all([
          Promise.all(requirements.map((r) => fetchCompletionsForReq(r.id))),
          Promise.all(providers.map((p) => fetchCeuSettings(p))),
          Promise.all(providers.map((p) => fetchPersonnelRecords(p, 'ceus'))),
        ]);
        if (cancelled) return;
        const m = {};
        requirements.forEach((r, i) => {
          m[r.id] = {};
          arrays[i].forEach((c) => { m[r.id][c.providerName] = c; });
        });
        const csm = {};
        const crm = {};
        providers.forEach((p, i) => {
          csm[p] = ceuResults[i];
          crm[p] = ceuRecordResults[i] || [];
        });
        setMatrix(m);
        setCeuSettingsMap(csm);
        setCeuRecordsMap(crm);
        boardLoadedRef.current = true;
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoadingBoard(false);
      }
    }
    loadBoard();
    return () => { cancelled = true; };
  }, [pageTab, requirements, providers]);

  // ── Requirement CRUD ─────────────────────────────────────────────────────
  function openAdd() {
    setFormDraft({ ...EMPTY_REQ_FORM });
    setEditingReq(null);
    setShowForm(true);
    setFormError('');
  }

  function openEdit(req) {
    setFormDraft({
      name: req.name || '',
      type: req.type || 'Training',
      recurrenceMonths: req.recurrenceMonths ?? 24,
      ceuHours: req.ceuHours || '',
      appliesTo: req.appliesTo === 'all' ? 'all' : 'selected',
      selectedProviders: req.appliesTo === 'all' ? [] : (req.appliesTo || []),
      notes: req.notes || '',
    });
    setEditingReq(req);
    setShowForm(true);
    setFormError('');
  }

  function cancelForm() {
    setShowForm(false);
    setEditingReq(null);
    setFormDraft(EMPTY_REQ_FORM);
    setFormError('');
  }

  function setField(key, val) {
    setFormDraft((d) => ({ ...d, [key]: val }));
  }

  async function handleSave() {
    if (!formDraft.name.trim()) { setFormError('Name is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const appliesToValue = formDraft.appliesTo === 'all' ? 'all' : (formDraft.selectedProviders || []);
      const data = {
        name: formDraft.name.trim(),
        type: formDraft.type,
        recurrenceMonths: formDraft.recurrenceMonths,
        ceuHours: formDraft.type === 'CEU' ? (formDraft.ceuHours || null) : null,
        appliesTo: appliesToValue,
        notes: formDraft.notes,
      };
      if (editingReq) {
        await updateRequirement(editingReq.id, data);
        setRequirements((prev) => prev.map((r) => r.id === editingReq.id ? { ...r, ...data } : r));
      } else {
        const id = await addRequirement(data);
        setRequirements((prev) => [...prev, { id, ...data }]);
      }
      setSuccessMsg(editingReq ? 'Requirement updated.' : 'Requirement added.');
      setTimeout(() => setSuccessMsg(''), 3000);
      boardLoadedRef.current = false;
      cancelForm();
    } catch (e) {
      setFormError(e?.message || 'Save failed.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(req) {
    if (!window.confirm(`Delete "${req.name}"? All completion records will also be removed.`)) return;
    setDeletingId(req.id);
    try {
      await deleteRequirement(req.id);
      setRequirements((prev) => prev.filter((r) => r.id !== req.id));
      setSuccessMsg('Requirement deleted.');
      setTimeout(() => setSuccessMsg(''), 3000);
      boardLoadedRef.current = false;
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  }

  // ── Completion handlers (passed to modal) ────────────────────────────────
  async function handleMarkSave(reqId, providerName, data) {
    await setCompletion(reqId, providerName, data);
    setMatrix((prev) => ({
      ...prev,
      [reqId]: { ...(prev[reqId] || {}), [providerName]: { providerName, ...data } },
    }));
    setMarkTarget(null);
  }

  async function handleMarkClear(reqId, providerName) {
    await deleteCompletion(reqId, providerName);
    setMatrix((prev) => {
      const next = { ...prev, [reqId]: { ...(prev[reqId] || {}) } };
      delete next[reqId][providerName];
      return next;
    });
    setMarkTarget(null);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 32 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Requirements & Compliance</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            Define state-mandated requirements and track compliance across all providers.
          </p>
        </div>
        {successMsg && (
          <div style={{ padding: '8px 14px', borderRadius: 8, background: '#ecfdf5', color: '#065f46', fontSize: 13, fontWeight: 600, border: '1px solid #a7f3d0', flexShrink: 0 }}>
            {successMsg}
          </div>
        )}
      </div>

      {/* Page tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e5e7eb', marginBottom: 28 }}>
        {[{ id: 'requirements', label: 'Requirements' }, { id: 'compliance', label: 'Compliance Board' }].map((t) => (
          <button
            key={t.id}
            onClick={() => setPageTab(t.id)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: pageTab === t.id ? 700 : 500,
              color: pageTab === t.id ? '#7c3aed' : '#6b7280',
              borderBottom: pageTab === t.id ? '2px solid #7c3aed' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loadingInit ? (
        <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</div>

      ) : pageTab === 'requirements' ? (
        // ── Requirements list ──────────────────────────────────────────────
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            {!showForm && (
              <button
                onClick={openAdd}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                + Add Requirement
              </button>
            )}
          </div>

          {showForm && (
            <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#6d28d9', marginBottom: 16 }}>
                {editingReq ? 'Edit Requirement' : 'New Requirement'}
              </div>
              <RequirementForm draft={formDraft} onChange={setField} providers={providers} />
              {formError && (
                <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: 13, border: '1px solid #fecaca' }}>
                  {formError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  onClick={handleSave} disabled={saving}
                  style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: saving ? '#a78bfa' : '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={cancelForm} disabled={saving}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {requirements.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '48px 0' }}>
              No requirements defined yet. Add your first requirement above.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {requirements.map((req) => {
                const tc = TYPE_COLORS[req.type] || TYPE_COLORS.Other;
                const appLabel = req.appliesTo === 'all'
                  ? 'All providers'
                  : Array.isArray(req.appliesTo) ? req.appliesTo.join(', ') : '—';
                return (
                  <div key={req.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 5 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{req.name}</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, fontWeight: 600 }}>
                          {req.type}
                        </span>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{recurrenceLabel(req.recurrenceMonths)}</span>
                        {req.type === 'CEU' && req.ceuHours && (
                          <span style={{ fontSize: 12, color: '#6b7280' }}>{req.ceuHours} hrs required</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Applies to: {appLabel}</div>
                      {req.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>{req.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => openEdit(req)}
                        style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(req)} disabled={deletingId === req.id}
                        style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: deletingId === req.id ? 'default' : 'pointer' }}
                      >
                        {deletingId === req.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      ) : (
        // ── Compliance Board ───────────────────────────────────────────────
        <div>
          {loadingBoard ? (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading compliance data…</div>
          ) : requirements.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '48px 0' }}>
              No requirements defined. Add requirements first.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
                Click any cell to log or update a completion record.
              </div>
              <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: requirements.length > 5 ? 150 + 110 + requirements.length * 200 : '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontWeight: 700, minWidth: 130, position: 'sticky', left: 0, zIndex: 2 }}>
                        Provider
                      </th>
                      <th style={{ padding: '10px 12px', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', borderRight: '2px solid #d1d5db', fontWeight: 600, minWidth: 130, textAlign: 'center', lineHeight: 1.3, verticalAlign: 'bottom' }}>
                        <div style={{ fontSize: 12, color: '#374151' }}>CEU Requirement</div>
                      </th>
                      {requirements.map((req) => (
                        <th key={req.id} style={{ padding: '10px 12px', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontWeight: 600, minWidth: 120, maxWidth: 150, textAlign: 'center', lineHeight: 1.3, verticalAlign: 'bottom' }}>
                          <div style={{ fontSize: 12, color: '#374151' }}>{req.name}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, fontWeight: 400 }}>{recurrenceLabel(req.recurrenceMonths)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map((providerName, pi) => {
                      const rowBg = pi % 2 === 0 ? '#fff' : '#fafafa';
                      return (
                        <tr key={providerName}>
                          <td style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontWeight: 600, fontSize: 13, position: 'sticky', left: 0, background: rowBg, zIndex: 1 }}>
                            {providerName}
                          </td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', borderRight: '2px solid #d1d5db', textAlign: 'center', background: rowBg }}>
                            {(() => {
                              const cs = ceuSettingsMap[providerName];
                              if (!cs?.requiredHours) return <span style={{ color: '#d1d5db', fontSize: 13 }}>—</span>;
                              const required = Number(cs.requiredHours) || 0;
                              const cycleLabel = cs.cycleMonths == 12 ? 'Annual' : cs.cycleMonths == 24 ? 'Every 2 yrs' : cs.cycleMonths == 36 ? 'Every 3 yrs' : `Every ${cs.cycleMonths} mo`;
                              const cycle = getCurrentCycle(cs.cycleStartDate, cs.cycleMonths);
                              // Hours from CEU-type requirements completed within this cycle
                              const reqHours = requirements
                                .filter((r) => r.type === 'CEU' && (r.appliesTo === 'all' || (Array.isArray(r.appliesTo) && r.appliesTo.includes(providerName))))
                                .reduce((sum, r) => {
                                  const completedDate = matrix[r.id]?.[providerName]?.lastCompletedDate;
                                  if (!completedDate) return sum;
                                  if (cycle && (completedDate < cycle.start || completedDate > cycle.end)) return sum;
                                  return sum + (Number(r.ceuHours) || 0);
                                }, 0);
                              // Hours from manually entered CEU records within this cycle
                              const manualHours = (ceuRecordsMap[providerName] || []).reduce((sum, r) => {
                                if (!r.completionDate) return sum;
                                if (cycle && (r.completionDate < cycle.start || r.completionDate > cycle.end)) return sum;
                                return sum + (parseFloat(r.hours) || 0);
                              }, 0);
                              const completedHours = reqHours + manualHours;
                              const pct = required > 0 ? Math.min(completedHours / required, 1) : 0;
                              const met = completedHours >= required;
                              return (
                                <>
                                  <div style={{ fontWeight: 700, fontSize: 12, color: met ? '#065f46' : '#6d28d9' }}>
                                    {completedHours} / {required} hrs
                                  </div>
                                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{cycleLabel}</div>
                                  {cycle && (
                                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                                      Renews {formatDate(cycle.end)}
                                    </div>
                                  )}
                                  <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden', width: '80%', margin: '5px auto 0' }}>
                                    <div style={{ width: `${pct * 100}%`, height: '100%', background: met ? '#059669' : '#7c3aed', borderRadius: 2 }} />
                                  </div>
                                </>
                              );
                            })()}
                          </td>
                          {requirements.map((req) => {
                            const applies = req.appliesTo === 'all' || (Array.isArray(req.appliesTo) && req.appliesTo.includes(providerName));
                            if (!applies) {
                              return (
                                <td key={req.id} style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center', color: '#d1d5db', background: '#fafafa', fontSize: 13 }}>
                                  —
                                </td>
                              );
                            }
                            const completion = matrix[req.id]?.[providerName];
                            const status = getCellStatus(req, completion);
                            const cs = CELL_STYLES[status];
                            return (
                              <td
                                key={req.id}
                                onClick={() => setMarkTarget({ providerName, req })}
                                title={`${providerName} — ${req.name}`}
                                style={{ padding: 0, borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', cursor: 'pointer', background: cs.bg, transition: 'filter 0.1s' }}
                                onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(0.93)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                              >
                                <BoardCell req={req} completion={completion} />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
                {[
                  { color: '#065f46', bg: '#ecfdf5', label: 'Current' },
                  { color: '#92400e', bg: '#fffbeb', label: 'Expiring within 90 days' },
                  { color: '#dc2626', bg: '#fef2f2', label: 'Expired / Not on file' },
                  { color: '#d1d5db', bg: '#fafafa', label: 'N/A' },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: item.bg, border: `1px solid ${item.color}33`, display: 'inline-block' }} />
                    {item.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Mark Complete modal */}
      {markTarget && (
        <MarkCompleteModal
          target={markTarget}
          matrix={matrix}
          onSave={handleMarkSave}
          onClear={handleMarkClear}
          onClose={() => setMarkTarget(null)}
        />
      )}
    </div>
  );
}
