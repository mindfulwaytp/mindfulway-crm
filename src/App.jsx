import { useEffect, useMemo, useState } from 'react';
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

const columns = [
  { id: 'new', title: 'New', color: '#dbeafe', border: '#93c5fd' },
  { id: 'contact1', title: 'Contact 1', color: '#fef3c7', border: '#fcd34d' },
  { id: 'contact2', title: 'Contact 2', color: '#fde68a', border: '#fbbf24' },
  { id: 'scheduled', title: 'Scheduled', color: '#dcfce7', border: '#86efac' },
  { id: 'waitlist', title: 'Waitlist', color: '#f3e8ff', border: '#c4b5fd' },
];

function formatDate(value) {
  if (!value) return '—';

  if (typeof value?.toDate === 'function') {
    return value.toDate().toLocaleDateString();
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
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
}) {
  const record = isEditing ? draft : inquiry;

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

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {!isEditing ? (
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              padding: 16,
              background: '#fcfcfd',
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
              Pipeline
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 14,
                fontSize: 14,
              }}
            >
              {/* Status — spans both columns */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Status</label>
                {isEditing ? (
                  <select
                    value={record.pipeline?.status || 'new'}
                    onChange={(e) => onChange('pipeline.status', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="new">New</option>
                    <option value="contact1">Contact 1</option>
                    <option value="contact2">Contact 2</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="waitlist">Waitlist</option>
                    <option value="archived">Archived</option>
                    <option value="became client">Became Client</option>
                    <option value="declined">Declined</option>
                  </select>
                ) : (
                  <div style={readValueStyle}>{record.pipeline?.status || '—'}</div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Assigned Provider</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={record.pipeline?.assignedProvider || ''}
                    onChange={(e) => onChange('pipeline.assignedProvider', e.target.value)}
                    style={inputStyle}
                  />
                ) : (
                  <div style={readValueStyle}>
                    {record.pipeline?.assignedProvider || '—'}
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Possible Providers</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={record.pipeline?.possibleProviders || ''}
                    onChange={(e) => onChange('pipeline.possibleProviders', e.target.value)}
                    style={inputStyle}
                  />
                ) : (
                  <div style={readValueStyle}>
                    {record.pipeline?.possibleProviders || '—'}
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Contact Attempts</label>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    value={record.pipeline?.contactAttempts ?? 0}
                    onChange={(e) =>
                      onChange('pipeline.contactAttempts', Number(e.target.value) || 0)
                    }
                    style={inputStyle}
                  />
                ) : (
                  <div style={readValueStyle}>
                    {record.pipeline?.contactAttempts ?? 0}
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Last Contact</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={record.pipeline?.lastContactDate || ''}
                    onChange={(e) => onChange('pipeline.lastContactDate', e.target.value)}
                    placeholder="MM/DD/YYYY or leave blank"
                    style={inputStyle}
                  />
                ) : (
                  <div style={readValueStyle}>
                    {formatDate(record.pipeline?.lastContactDate)}
                  </div>
                )}
              </div>

              {/* Comments — spans both columns */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Comments</label>
                {isEditing ? (
                  <textarea
                    value={record.pipeline?.comments || ''}
                    onChange={(e) => onChange('pipeline.comments', e.target.value)}
                    placeholder="Add notes or comments..."
                    style={{
                      ...inputStyle,
                      minHeight: 80,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                ) : (
                  <div style={readValueStyle}>
                    {record.pipeline?.comments || '—'}
                  </div>
                )}
              </div>
            </div>
          </div>

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
                  <input type="text" value={record.intake?.phone || ''} onChange={(e) => onChange('intake.phone', e.target.value)} style={inputStyle} />
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
                  <input type="text" value={record.intake?.preferredProvider || ''} onChange={(e) => onChange('intake.preferredProvider', e.target.value)} style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{record.intake?.preferredProvider || '—'}</div>
                )}
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Open to Intern</label>
                {isEditing ? (
                  <input type="text" value={record.intake?.openToIntern || ''} onChange={(e) => onChange('intake.openToIntern', e.target.value)} style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{record.intake?.openToIntern || '—'}</div>
                )}
              </div>

              {/* Row 5: Insurance | Member ID */}
              <div style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}>Insurance</label>
                {isEditing ? (
                  <input type="text" value={record.intake?.insurance || ''} onChange={(e) => onChange('intake.insurance', e.target.value)} style={inputStyle} />
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
                  <div style={readValueStyle}>{record.intake?.problemChecklist || '—'}</div>
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
                  <input type="text" value={record.intake?.previousTherapy || ''} onChange={(e) => onChange('intake.previousTherapy', e.target.value)} style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{record.intake?.previousTherapy || '—'}</div>
                )}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Meds</label>
                {isEditing ? (
                  <input type="text" value={record.intake?.previousMeds || ''} onChange={(e) => onChange('intake.previousMeds', e.target.value)} style={inputStyle} />
                ) : (
                  <div style={readValueStyle}>{record.intake?.previousMeds || '—'}</div>
                )}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Safety</label>
                {isEditing ? (
                  <input type="text" value={record.intake?.safety || ''} onChange={(e) => onChange('intake.safety', e.target.value)} style={inputStyle} />
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
                  <input type="text" value={record.intake?.ipTele || ''} onChange={(e) => onChange('intake.ipTele', e.target.value)} style={inputStyle} />
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
  const [intakes, setIntakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [view, setView] = useState('active');
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftInquiry, setDraftInquiry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState({});
  const [pipelineFilters, setPipelineFilters] = useState({ insurance: [], service: [], provider: [], internOk: false });
  const [search, setSearch] = useState({ name: '', phone: '', email: '', insurance: '', date: '' });
  const [activeView, setActiveView] = useState({ type: 'all', value: '' });
  const [currentPage, setCurrentPage] = useState(1);
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

    loadIntakes();

    const interval = setInterval(loadIntakes, 10000);
    return () => clearInterval(interval);
  }, []);

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

  async function testFirestoreWrite() {
    setError('');

    try {
      const id = await createInquiry({
        source: 'manual-test',
        intake: {
          clientName: 'Test Client',
          preferredName: '',
          email: 'test@example.com',
          phone: '555-555-5555',
          insurance: 'Premera',
          servicesRequested: ['therapy'],
          preferredProvider: '',
          dob: '',
          problems: 'Firestore test',
          safety: '',
          availability: 'Afternoons',
        },
        pipeline: {
          status: 'new',
          assignedProvider: '',
          lastContactDate: null,
          nextStep: '',
          contactAttempts: 0,
          archived: false,
        },
      });

      console.log('Created inquiry:', id);

      const rows = await fetchInquiries();
      setIntakes(rows);
    } catch (err) {
      setError(err.message || 'Failed to write test inquiry');
    }
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
        'intake.insurance': updatedRecord.intake?.insurance || '',
        'intake.phone': updatedRecord.intake?.phone || '',
        'intake.email': updatedRecord.intake?.email || '',
        'intake.preferredProvider': updatedRecord.intake?.preferredProvider || '',
        'intake.servicesRequested': updatedRecord.intake?.servicesRequested || '',
        'intake.dob': updatedRecord.intake?.dob || '',
        'intake.problems': updatedRecord.intake?.problems || '',
        'intake.safety': updatedRecord.intake?.safety || '',
        'intake.availability': updatedRecord.intake?.availability || '',
        'pipeline.status': updatedRecord.pipeline?.status || 'new',
        'pipeline.assignedProvider': updatedRecord.pipeline?.assignedProvider || '',
        'pipeline.contactAttempts': updatedRecord.pipeline?.contactAttempts ?? 0,
        'pipeline.lastContactDate': updatedRecord.pipeline?.lastContactDate || '',
        'pipeline.nextStep': updatedRecord.pipeline?.nextStep || '',
      };

      await updateInquiryApi(selectedInquiry.id, changes);

      setIntakes((prev) =>
        prev.map((item) => (item.id === selectedInquiry.id ? updatedRecord : item))
      );

      setSelectedInquiry(updatedRecord);
      setDraftInquiry(cloneData(updatedRecord));
      setIsEditing(false);
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

  const pipelineFilterOptions = useMemo(() => ({
    insurance: [...new Set(intakes.map(r => r.intake?.insurance).filter(Boolean))].sort(),
    service: [...new Set(intakes.flatMap(r => {
      const s = r.intake?.servicesRequested;
      if (!s) return [];
      return Array.isArray(s) ? s : s.split(',').map(x => x.trim());
    }).filter(Boolean))].sort(),
    provider: [...new Set(intakes.map(r => r.pipeline?.assignedProvider).filter(Boolean))].sort(),
  }), [intakes]);

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
            onClick={testFirestoreWrite}
            style={{
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              background: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 12,
            }}
          >
            Test Firestore
          </button>
        </nav>
      </aside>

      <div style={{ minWidth: 0 }}>
        <main style={{ padding: 32, overflow: 'hidden', minWidth: 0 }}>
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
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ margin: 0, fontSize: 32 }}>Active Pipeline</h1>
                <p style={{ marginTop: 8, color: '#6b7280' }}>
                  Manage current outreach, scheduling, and waitlist activity.
                </p>
              </div>

              {/* Pipeline filters */}
              {(() => {
                const toggleFilter = (category, value) => {
                  setPipelineFilters(prev => ({
                    ...prev,
                    [category]: prev[category].includes(value)
                      ? prev[category].filter(v => v !== value)
                      : [...prev[category], value],
                  }));
                };
                const pillStyle = (active) => ({
                  padding: '4px 12px',
                  borderRadius: 20,
                  border: '1px solid',
                  fontSize: 13,
                  cursor: 'pointer',
                  borderColor: active ? '#7c3aed' : '#d1d5db',
                  background: active ? '#ede9fe' : '#fff',
                  color: active ? '#6d28d9' : '#374151',
                  fontWeight: active ? 600 : 400,
                });
                const anyActive = pipelineFilters.insurance.length || pipelineFilters.service.length || pipelineFilters.provider.length || pipelineFilters.internOk;
                return (
                  <div style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {pipelineFilterOptions.insurance.map(v => (
                      <button key={`ins-${v}`} onClick={() => toggleFilter('insurance', v)} style={pillStyle(pipelineFilters.insurance.includes(v))}>{v}</button>
                    ))}
                    {pipelineFilterOptions.service.map(v => (
                      <button key={`svc-${v}`} onClick={() => toggleFilter('service', v)} style={pillStyle(pipelineFilters.service.includes(v))}>{v}</button>
                    ))}
                    <button onClick={() => setPipelineFilters(prev => ({ ...prev, internOk: !prev.internOk }))} style={pillStyle(pipelineFilters.internOk)}>Intern OK</button>
                    {anyActive ? (
                      <button onClick={() => setPipelineFilters({ insurance: [], service: [], provider: [], internOk: false })} style={{ ...pillStyle(false), color: '#9ca3af' }}>Clear</button>
                    ) : null}
                  </div>
                );
              })()}

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
                      const columnCards = intakes.filter((intake) => {
                        if (intake.pipeline?.status !== column.id) return false;
                        if (pipelineFilters.insurance.length && !pipelineFilters.insurance.includes(intake.intake?.insurance)) return false;
                        if (pipelineFilters.provider.length && !pipelineFilters.provider.includes(intake.pipeline?.assignedProvider)) return false;
                        if (pipelineFilters.service.length) {
                          const s = intake.intake?.servicesRequested;
                          const services = Array.isArray(s) ? s : (s || '').split(',').map(x => x.trim());
                          if (!pipelineFilters.service.some(f => services.includes(f))) return false;
                        }
                        if (pipelineFilters.internOk && (!intake.intake?.openToIntern || intake.intake.openToIntern.toLowerCase() === 'no')) return false;
                        return true;
                      });
                      const isCollapsed = collapsedColumns[column.id];

                      return (
                        <Droppable droppableId={column.id} key={column.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              style={{
                                width: 300,
                                flexShrink: 0,
                                background: snapshot.isDraggingOver ? '#ffffff' : '#fafafa',
                                borderRadius: 16,
                                border: `1px solid ${column.border}`,
                                overflow: 'hidden',
                                minHeight: isCollapsed ? 'auto' : 240,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <div
                                style={{
                                  background: column.color,
                                  padding: '12px 14px',
                                  borderBottom: `1px solid ${column.border}`,
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

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                                    onClick={() => toggleColumn(column.id)}
                                    style={{
                                      border: `1px solid ${column.border}`,
                                      background: '#fff',
                                      borderRadius: 8,
                                      padding: '4px 8px',
                                      cursor: 'pointer',
                                      fontSize: 12,
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
                                                  <span style={{
                                                    fontSize: 11,
                                                    background: '#ede9fe',
                                                    color: '#6d28d9',
                                                    borderRadius: 6,
                                                    padding: '2px 7px',
                                                    whiteSpace: 'nowrap',
                                                    fontWeight: 500,
                                                  }}>
                                                    {(Array.isArray(card.intake.servicesRequested) ? card.intake.servicesRequested[0] : card.intake.servicesRequested.split(',')[0]).trim()}
                                                  </span>
                                                ) : null}
                                                {card.intake?.openToIntern && card.intake.openToIntern.toLowerCase() !== 'no' ? (
                                                  <span style={{
                                                    fontSize: 11,
                                                    background: '#d1fae5',
                                                    color: '#065f46',
                                                    borderRadius: 6,
                                                    padding: '2px 7px',
                                                    whiteSpace: 'nowrap',
                                                    fontWeight: 500,
                                                  }}>
                                                    Intern OK
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
          />
        ) : null}
      </div>
    </div>
  );
}
