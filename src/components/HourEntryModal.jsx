import { useState } from 'react';
import { HOUR_TYPES, todayDateStr, entryDateStr } from '../lib/hourEntriesApi';

export default function HourEntryModal({ onClose, onSave, internName, title, entry }) {
  const isEdit = !!entry;
  const [form, setForm] = useState(() => (
    isEdit
      ? { date: entryDateStr(entry), type: entry.type, hours: String(entry.hours ?? ''), notes: entry.notes || '' }
      : { date: todayDateStr(), type: 'direct_contact', hours: '', notes: '' }
  ));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.hours || Number(form.hours) <= 0) { setError('Please enter a valid number of hours.'); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save entry.');
      setSaving(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>
          {title || (isEdit ? 'Edit Hours Entry' : 'Add Hours Entry')}
        </h2>
        {internName && (
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 18 }}>For <strong style={{ color: '#374151' }}>{internName}</strong></div>
        )}
        <form onSubmit={handleSubmit}>
          <Field label="Date">
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required style={inputStyle} />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => set('type', e.target.value)} style={inputStyle}>
              {HOUR_TYPES.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Hours">
            <input
              type="number" min={0.5} step={0.5}
              value={form.hours} onChange={(e) => set('hours', e.target.value)}
              placeholder="e.g. 1.5" required style={inputStyle}
            />
          </Field>
          <Field label="Notes (optional)">
            <textarea
              value={form.notes} onChange={(e) => set('notes', e.target.value)}
              rows={3} placeholder="Any additional context…"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>
          {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
            <button type="submit" disabled={saving} style={primaryBtnStyle}>
              {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Save Entry')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modalStyle = {
  background: '#fff', borderRadius: 16, padding: 32,
  width: 460, maxWidth: '90vw', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
};

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
