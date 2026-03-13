import { useEffect, useMemo, useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
} from '@hello-pangea/dnd';
import {
  fetchInquiries,
  updateInquiry as updateInquiryApi,
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

  return (
    <aside
      style={{
        width: 380,
        flexShrink: 0,
        borderLeft: '1px solid #e5e7eb',
        background: '#fff',
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
          <h2 style={{ margin: 0, fontSize: 24 }}>
            {record.intake?.clientName || 'No name'}
          </h2>
          {record.intake?.preferredName ? (
            <p style={{ marginTop: 6, color: '#6b7280' }}>
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
            padding: '8px 10px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Close
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          padding: 16,
          marginBottom: 16,
          background: '#fafafa',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>Pipeline</h3>

        <div style={{ display: 'grid', gap: 14, fontSize: 14 }}>
          <div>
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
              </select>
            ) : (
              <div>{record.pipeline?.status || '—'}</div>
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
              <div>{record.pipeline?.assignedProvider || '—'}</div>
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
              <div>{record.pipeline?.contactAttempts ?? 0}</div>
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
              <div>{formatDate(record.pipeline?.lastContactDate)}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Next Step</label>
            {isEditing ? (
              <input
                type="text"
                value={record.pipeline?.nextStep || ''}
                onChange={(e) => onChange('pipeline.nextStep', e.target.value)}
                style={inputStyle}
              />
            ) : (
              <div>{record.pipeline?.nextStep || '—'}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Archived</label>
            {isEditing ? (
              <select
                value={record.pipeline?.archived ? 'true' : 'false'}
                onChange={(e) =>
                  onChange('pipeline.archived', e.target.value === 'true')
                }
                style={inputStyle}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            ) : (
              <div>{record.pipeline?.archived ? 'Yes' : 'No'}</div>
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
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>
          Intake Details
        </h3>

        <div style={{ display: 'grid', gap: 14, fontSize: 14 }}>
          <div>
            <label style={labelStyle}>Client Name</label>
            {isEditing ? (
              <input
                type="text"
                value={record.intake?.clientName || ''}
                onChange={(e) => onChange('intake.clientName', e.target.value)}
                style={inputStyle}
              />
            ) : (
              <div>{record.intake?.clientName || '—'}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Preferred Name</label>
            {isEditing ? (
              <input
                type="text"
                value={record.intake?.preferredName || ''}
                onChange={(e) => onChange('intake.preferredName', e.target.value)}
                style={inputStyle}
              />
            ) : (
              <div>{record.intake?.preferredName || '—'}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Insurance</label>
            {isEditing ? (
              <input
                type="text"
                value={record.intake?.insurance || ''}
                onChange={(e) => onChange('intake.insurance', e.target.value)}
                style={inputStyle}
              />
            ) : (
              <div>{record.intake?.insurance || '—'}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Phone</label>
            {isEditing ? (
              <input
                type="text"
                value={record.intake?.phone || ''}
                onChange={(e) => onChange('intake.phone', e.target.value)}
                style={inputStyle}
              />
            ) : (
              <div>{record.intake?.phone || '—'}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            {isEditing ? (
              <input
                type="email"
                value={record.intake?.email || ''}
                onChange={(e) => onChange('intake.email', e.target.value)}
                style={inputStyle}
              />
            ) : (
              <div>{record.intake?.email || '—'}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Preferred Provider</label>
            {isEditing ? (
              <input
                type="text"
                value={record.intake?.preferredProvider || ''}
                onChange={(e) => onChange('intake.preferredProvider', e.target.value)}
                style={inputStyle}
              />
            ) : (
              <div>{record.intake?.preferredProvider || '—'}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Services Requested</label>
            {isEditing ? (
              <input
                type="text"
                value={record.intake?.servicesRequested || ''}
                onChange={(e) => onChange('intake.servicesRequested', e.target.value)}
                style={inputStyle}
              />
            ) : (
              <div>{record.intake?.servicesRequested || '—'}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>DOB</label>
            {isEditing ? (
              <input
                type="text"
                value={record.intake?.dob || ''}
                onChange={(e) => onChange('intake.dob', e.target.value)}
                placeholder="MM/DD/YYYY or leave blank"
                style={inputStyle}
              />
            ) : (
              <div>{formatDate(record.intake?.dob)}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Problems</label>
            {isEditing ? (
              <textarea
                value={record.intake?.problems || ''}
                onChange={(e) => onChange('intake.problems', e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            ) : (
              <div>{record.intake?.problems || '—'}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Safety</label>
            {isEditing ? (
              <textarea
                value={record.intake?.safety || ''}
                onChange={(e) => onChange('intake.safety', e.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            ) : (
              <div>{record.intake?.safety || '—'}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Availability</label>
            {isEditing ? (
              <textarea
                value={record.intake?.availability || ''}
                onChange={(e) => onChange('intake.availability', e.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            ) : (
              <div>{record.intake?.availability || '—'}</div>
            )}
          </div>
        </div>
      </div>
    </aside>
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
      'pipeline.archived': updatedRecord.pipeline?.archived ? true : false,
    };

    await updateInquiryApi(selectedInquiry.id, changes);

    setIntakes((prev) =>
      prev.map((item) =>
        item.id === selectedInquiry.id ? updatedRecord : item
      )
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
      ? {
          ...item,
          pipeline: {
            ...item.pipeline,
            status: newStatus,
          },
        }
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
    await updateInquiryApi(draggableId, {
      'pipeline.status': newStatus,
    });
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


  const allInquiries = useMemo(() => {
    return [...intakes].sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }, [intakes]);

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
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            Mindful Way CRM
          </h2>
          <p
            style={{
              marginTop: 6,
              fontSize: 13,
              color: '#6b7280',
            }}
          >
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
        </nav>
      </aside>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedInquiry ? '1fr 380px' : '1fr',
          minWidth: 0,
        }}
      >
        <main
          style={{
            padding: 32,
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
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

              <DragDropContext onDragEnd={handleDragEnd}>
                <div
                  style={{
                    width: '100%',
                    overflowX: 'auto',
                    paddingBottom: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 24,
                      alignItems: 'flex-start',
                      minWidth: 'max-content',
                    }}
                  >
                    {columns.map((column) => {
                      const columnCards = intakes.filter(
                        (intake) => intake.pipeline?.status === column.id
                      );

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
                                minHeight: 240,
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
                                }}
                              >
                                <h3
                                  style={{
                                    margin: 0,
                                    fontSize: 16,
                                    fontWeight: 600,
                                  }}
                                >
                                  {column.title}
                                </h3>

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
                              </div>

                              <div style={{ padding: 12 }}>
                                {columnCards.map((card, index) => (
                                  <Draggable
                                    draggableId={card.id}
                                    index={index}
                                    key={card.id}
                                  >
                                    {(providedDraggable, snapshotDraggable) => (
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
                                          border:
                                            selectedInquiry?.id === card.id
                                              ? '1px solid #7c3aed'
                                              : updatingId === card.id
                                              ? '1px solid #7c3aed'
                                              : '1px solid #ececec',
                                          cursor: 'pointer',
                                          ...providedDraggable.draggableProps.style,
                                        }}
                                      >
                                        <strong>
                                          {card.intake?.clientName || 'No name'}
                                        </strong>

                                        <div
                                          style={{
                                            fontSize: 13,
                                            marginTop: 6,
                                            color: '#555',
                                          }}
                                        >
                                          Insurance: {card.intake?.insurance || '—'}
                                        </div>

                                        {card.intake?.preferredProvider ? (
                                          <div
                                            style={{
                                              fontSize: 13,
                                              marginTop: 4,
                                              color: '#555',
                                            }}
                                          >
                                            Pref. Provider: {card.intake.preferredProvider}
                                          </div>
                                        ) : null}
                                      </div>
                                    )}
                                  </Draggable>
                                ))}

                                {provided.placeholder}

                                {columnCards.length === 0 ? (
                                  <p
                                    style={{
                                      fontSize: 13,
                                      color: '#666',
                                      marginTop: 8,
                                    }}
                                  >
                                    No records
                                  </p>
                                ) : null}
                              </div>
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
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ margin: 0, fontSize: 32 }}>All Inquiries</h1>
                <p style={{ marginTop: 8, color: '#6b7280' }}>
                  Review all inquiries, including archived and no-response records.
                </p>
              </div>

              <div
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.2fr 1.2fr 1.2fr 1fr',
                    gap: 12,
                    padding: '14px 16px',
                    background: '#f9fafb',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#374151',
                  }}
                >
                  <div>Name</div>
                  <div>Insurance</div>
                  <div>Status</div>
                  <div>Created</div>
                  <div>Contacts</div>
                </div>

                {allInquiries.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => openInquiry(item)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1.2fr 1.2fr 1.2fr 1fr',
                      gap: 12,
                      padding: '14px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: 14,
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: selectedInquiry?.id === item.id ? '#faf5ff' : '#fff',
                    }}
                  >
                    <div>{item.intake?.clientName || '—'}</div>
                    <div>{item.intake?.insurance || '—'}</div>
                    <div>{item.pipeline?.status || '—'}</div>
                    <div>{formatDate(item.createdAt)}</div>
                    <div>{item.pipeline?.contactAttempts ?? 0}</div>
                  </div>
                ))}

                {allInquiries.length === 0 ? (
                  <div style={{ padding: 20, color: '#6b7280' }}>
                    No inquiries found.
                  </div>
                ) : null}
              </div>
            </>
          )}
        </main>

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
      </div>
    </div>
  );
}
