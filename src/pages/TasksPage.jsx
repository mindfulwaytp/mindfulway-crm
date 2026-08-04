import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { fetchProviderProfiles } from '../lib/providersProfileApi';
import {
  CADENCES, RECURRENCE_MODES, COMPLETION_MODES, WEEKDAYS, cadenceLabel, isWeekdayCadence,
  isSharedTask, effectiveCompletion,
  fetchTasks, addTask, updateTask, deleteTask,
  fetchAllCompletions, markTaskDone, unmarkTaskDone, taskStatus,
} from '../lib/tasksApi';

const STATE_STYLE = {
  overdue:  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  due:      { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  upcoming: { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
};

function fmtDate(str) {
  if (!str) return '';
  return new Date(`${str}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function StatusPill({ status }) {
  const s = STATE_STYLE[status.state];
  let label;
  if (status.state === 'overdue') label = `Overdue ${status.overdueDays}d`;
  else if (status.state === 'due') label = 'Due today';
  else label = status.lastCompletedDate ? `Done · next ${fmtDate(status.dueDate)}` : `Upcoming · ${fmtDate(status.dueDate)}`;
  return (
    <span style={{ padding: '2px 10px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

export default function TasksPage() {
  const navigate = useNavigate();
  const { isAdmin, isSupervisor, providerName, user, signOut } = useAuth();
  const canManage = isAdmin || isSupervisor;

  const [tasks, setTasks] = useState([]);
  const [completions, setCompletions] = useState({}); // { taskId: { providerName: doc } }
  const [providerNames, setProviderNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null); // task object or 'new'
  const [myView, setMyView] = useState('board'); // 'board' | 'list'

  const load = useCallback(async () => {
    setLoading(true);
    // Load providers INDEPENDENTLY of tasks. If the tasks read fails — e.g. the
    // tasks Firestore rules haven't been deployed yet — the assignee picker must
    // still populate, so a task-side error can't blank it.
    try {
      const providers = await fetchProviderProfiles();
      setProviderNames(providers.map((p) => p.name).filter(Boolean).sort());
    } catch (e) {
      console.error('Failed to load providers', e);
    }
    try {
      const taskList = await fetchTasks();
      const comps = await Promise.all(taskList.map((t) => fetchAllCompletions(t.id)));
      const byTask = {};
      taskList.forEach((t, i) => { byTask[t.id] = comps[i]; });
      setTasks(taskList);
      setCompletions(byTask);
    } catch (e) {
      console.error('Failed to load tasks (are the tasks Firestore rules deployed?)', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const editor = providerName || user?.email || 'Unknown';

  async function handleMarkDone(task, forName) {
    setBusyId(`${task.id}:${forName}`);
    try {
      const rec = await markTaskDone(task.id, forName, editor);
      setCompletions((prev) => ({ ...prev, [task.id]: { ...prev[task.id], [forName]: { providerName: forName, ...rec } } }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleUndo(task, forName) {
    setBusyId(`${task.id}:${forName}`);
    try {
      await unmarkTaskDone(task.id, forName);
      setCompletions((prev) => {
        const forTask = { ...(prev[task.id] || {}) };
        delete forTask[forName];
        return { ...prev, [task.id]: forTask };
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveTask(form) {
    if (editing === 'new') await addTask(form, editor);
    else await updateTask(editing.id, form);
    setEditing(null);
    await load();
  }

  async function handleDeleteTask(task) {
    if (!window.confirm(`Delete recurring task "${task.title}"? This removes it for everyone. This cannot be undone.`)) return;
    await deleteTask(task.id);
    await load();
  }

  // My tasks: those I'm assigned to, ordered overdue → due → upcoming.
  const myTasks = tasks
    .filter((t) => t.active !== false && (t.assignees || []).includes(providerName))
    .map((t) => {
      const eff = effectiveCompletion(t, completions[t.id], providerName);
      const status = taskStatus(t, eff);
      const shared = isSharedTask(t);
      const completer = eff?.providerName || null; // who actually did it
      const isDone = status.state === 'upcoming' && !!status.lastCompletedDate;
      // Only the person who completed it can undo (rules let you clear your own).
      const doneByMe = isDone && (!shared || completer === providerName);
      const doneByOther = isDone && shared && completer !== providerName;
      const doneByLabel = eff?.lastCompletedBy || completer;
      return { task: t, status, doneByMe, doneByOther, doneByLabel };
    })
    .sort((a, b) => rank(a.status) - rank(b.status) || a.status.daysUntilDue - b.status.daysUntilDue);

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Mindful Way</span>
          <button onClick={() => navigate('/')} style={ghostBtn}>← Hub</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{user?.email}</span>
          <button onClick={signOut} style={ghostBtn}>Sign out</button>
        </div>
      </div>

      <div style={{ padding: '40px 40px 60px', maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>Recurring Tasks</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            Track regularly recurring responsibilities and mark them done as you complete each cycle.
          </p>
        </div>

        {loading ? (
          <div style={{ color: '#6b7280', fontSize: 14 }}>Loading…</div>
        ) : (
          <>
            {/* ── My Tasks ─────────────────────────────────────────────── */}
            <Section
              title={`My Tasks${myTasks.length ? ` (${myTasks.length})` : ''}`}
              action={myTasks.length > 0 && <ViewToggle value={myView} onChange={setMyView} />}
            >
              {myTasks.length === 0 ? (
                <Empty>No recurring tasks are assigned to you.</Empty>
              ) : myView === 'board' ? (
                <TaskBoard
                  items={myTasks}
                  providerName={providerName}
                  busyId={busyId}
                  onMarkDone={handleMarkDone}
                  onUndo={handleUndo}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {myTasks.map(({ task, status, doneByMe, doneByOther, doneByLabel }) => (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff' }}>
                      <StatusPill status={status} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, textDecoration: status.doneForNow ? 'line-through' : 'none', color: status.doneForNow ? '#9ca3af' : '#111827' }}>{task.title}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                          {cadenceLabel(task)} · {task.recurrenceMode === 'rolling' ? 'rolling' : 'fixed'}
                          {isSharedTask(task) ? ' · shared' : ''}
                          {task.description ? ` · ${task.description}` : ''}
                        </div>
                      </div>
                      {status.state === 'upcoming' ? (
                        doneByMe ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>Done {fmtDate(status.lastCompletedDate)}</span>
                            <button
                              onClick={() => handleUndo(task, providerName)}
                              disabled={busyId === `${task.id}:${providerName}`}
                              style={ghostBtn}
                            >
                              {busyId === `${task.id}:${providerName}` ? '…' : '↩ Undo'}
                            </button>
                          </div>
                        ) : doneByOther ? (
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>Done by {doneByLabel} {fmtDate(status.lastCompletedDate)}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>Starts {fmtDate(status.dueDate)}</span>
                        )
                      ) : (
                        <button
                          onClick={() => handleMarkDone(task, providerName)}
                          disabled={busyId === `${task.id}:${providerName}`}
                          style={primaryBtn}
                        >
                          {busyId === `${task.id}:${providerName}` ? 'Saving…' : 'Mark done'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Manage (admin/supervisor) ────────────────────────────── */}
            {canManage && (
              <Section
                title="Manage Recurring Tasks"
                action={<button onClick={() => setEditing('new')} style={primaryBtn}>+ New Task</button>}
              >
                {tasks.length === 0 ? (
                  <Empty>No recurring tasks yet. Create one to get started.</Empty>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {tasks.map((task) => (
                      <ManageRow
                        key={task.id}
                        task={task}
                        completions={completions[task.id] || {}}
                        busyId={busyId}
                        editorName={editor}
                        onMarkDone={handleMarkDone}
                        onUndo={handleUndo}
                        onEdit={() => setEditing(task)}
                        onDelete={() => handleDeleteTask(task)}
                      />
                    ))}
                  </div>
                )}
              </Section>
            )}
          </>
        )}
      </div>

      {editing && (
        <TaskModal
          task={editing === 'new' ? null : editing}
          providerNames={providerNames}
          onClose={() => setEditing(null)}
          onSave={handleSaveTask}
        />
      )}
    </div>
  );
}

function rank(status) {
  return status.state === 'overdue' ? 0 : status.state === 'due' ? 1 : 2;
}

function ViewToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 3, background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
      {[['board', 'Board'], ['list', 'List']].map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: value === key ? '#fff' : 'transparent',
            color: value === key ? '#111827' : '#6b7280',
            boxShadow: value === key ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Columns are DERIVED from computed status — a card lands in "Done" only while it
// is completed-for-this-cycle, and automatically returns to Due/Overdue the moment
// its next occurrence comes around. No stored board state, no reset job.
const BOARD_COLUMNS = [
  { key: 'overdue',  label: 'Overdue',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  { key: 'due',      label: 'Due today', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { key: 'upcoming', label: 'Upcoming',  color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'done',     label: 'Done',      color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
];

function columnKey({ status }) {
  if (status.state === 'overdue') return 'overdue';
  if (status.state === 'due') return 'due';
  return status.lastCompletedDate ? 'done' : 'upcoming'; // completed-for-now vs. not-yet-started
}

function TaskBoard({ items, providerName, busyId, onMarkDone, onUndo }) {
  const byColumn = { overdue: [], due: [], upcoming: [], done: [] };
  items.forEach((it) => { byColumn[columnKey(it)].push(it); });

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
      {BOARD_COLUMNS.map((col) => {
        const cards = byColumn[col.key];
        return (
          <div key={col.key} style={{ flex: '1 1 0', minWidth: 220, background: '#f9fafb', border: '1px solid #eef0f3', borderRadius: 12, padding: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px 10px' }}>
              <span style={{ width: 8, height: 8, borderRadius: 8, background: col.color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{col.label}</span>
              <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>{cards.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 24 }}>
              {cards.length === 0 ? (
                <div style={{ fontSize: 12, color: '#cbd0d6', padding: '8px 4px' }}>—</div>
              ) : cards.map(({ task, status, doneByMe, doneByOther, doneByLabel }) => {
                const done = col.key === 'done';
                const busy = busyId === `${task.id}:${providerName}`;
                const shared = isSharedTask(task);
                return (
                  <div key={task.id} style={{ background: '#fff', border: `1px solid ${col.border}`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, textDecoration: done ? 'line-through' : 'none', color: done ? '#9ca3af' : '#111827' }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{cadenceLabel(task)}{shared ? ' · shared' : ''}</div>
                    <div style={{ marginTop: 8 }}>
                      {col.key === 'overdue' && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Was due {fmtDate(status.dueDate)}</span>}
                      {col.key === 'due' && <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>Due today</span>}
                      {col.key === 'upcoming' && <span style={{ fontSize: 11, color: '#6b7280' }}>Starts {fmtDate(status.dueDate)}</span>}
                      {done && <span style={{ fontSize: 11, color: '#059669' }}>Done {fmtDate(status.lastCompletedDate)}{doneByOther ? ` by ${doneByLabel}` : ''} · next {fmtDate(status.dueDate)}</span>}
                    </div>
                    {(col.key === 'overdue' || col.key === 'due') && (
                      <button
                        onClick={() => onMarkDone(task, providerName)}
                        disabled={busy}
                        style={{ marginTop: 10, width: '100%', padding: '6px 0', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 600, fontSize: 12, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}
                      >
                        {busy ? 'Saving…' : '✓ Mark done'}
                      </button>
                    )}
                    {done && doneByMe && (
                      <button
                        onClick={() => onUndo(task, providerName)}
                        disabled={busy}
                        style={{ marginTop: 8, width: '100%', padding: '5px 0', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 12, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}
                      >
                        {busy ? '…' : '↩ Undo'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ManageRow({ task, completions, busyId, editorName, onMarkDone, onUndo, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const assignees = task.assignees || [];
  const shared = isSharedTask(task);

  // Shared → one status for the whole group; each → per-person statuses.
  const sharedEff = shared ? effectiveCompletion(task, completions, null) : null;
  const sharedStatus = shared ? taskStatus(task, sharedEff) : null;
  const statuses = shared ? [] : assignees.map((name) => ({ name, status: taskStatus(task, completions[name]) }));
  const overdue = shared ? (sharedStatus.state === 'overdue' ? 1 : 0) : statuses.filter((s) => s.status.state === 'overdue').length;
  const due = shared ? (sharedStatus.state === 'due' ? 1 : 0) : statuses.filter((s) => s.status.state === 'due').length;

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <button onClick={() => setOpen((o) => !o)} style={{ ...ghostBtn, padding: '2px 8px' }}>{open ? '▾' : '▸'}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{task.title}{task.active === false && <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af' }}>(inactive)</span>}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
            {cadenceLabel(task)} · {task.recurrenceMode === 'rolling' ? 'rolling' : 'fixed'} · {shared ? `shared, ${assignees.length} can complete` : `${assignees.length} assigned`}
          </div>
        </div>
        {overdue > 0 && <span style={{ ...miniPill, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{overdue} overdue</span>}
        {due > 0 && <span style={{ ...miniPill, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>{due} due</span>}
        <button onClick={onEdit} style={ghostBtn}>Edit</button>
        <button onClick={onDelete} style={{ ...ghostBtn, color: '#dc2626', borderColor: '#fecaca' }}>Delete</button>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '10px 16px', background: '#fafafa' }}>
          {assignees.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>No one assigned.</div>
          ) : shared ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
              <StatusPill status={sharedStatus} />
              <span style={{ color: '#6b7280' }}>Anyone of: {assignees.join(', ')}</span>
              {sharedStatus.lastCompletedDate && <span style={{ fontSize: 12, color: '#9ca3af' }}>last {fmtDate(sharedStatus.lastCompletedDate)}{sharedStatus.lastCompletedBy ? ` by ${sharedStatus.lastCompletedBy}` : ''}</span>}
              {sharedStatus.state !== 'upcoming' ? (
                <button
                  onClick={() => onMarkDone(task, editorName)}
                  disabled={busyId === `${task.id}:${editorName}`}
                  style={{ ...ghostBtn, marginLeft: 'auto' }}
                >
                  {busyId === `${task.id}:${editorName}` ? '…' : 'Mark done'}
                </button>
              ) : sharedEff?.providerName && (
                <button
                  onClick={() => onUndo(task, sharedEff.providerName)}
                  disabled={busyId === `${task.id}:${sharedEff.providerName}`}
                  style={{ ...ghostBtn, marginLeft: 'auto' }}
                >
                  {busyId === `${task.id}:${sharedEff.providerName}` ? '…' : '↩ Undo'}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {statuses.map(({ name, status }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                  <span style={{ width: 160, fontWeight: 500 }}>{name}</span>
                  <StatusPill status={status} />
                  {status.lastCompletedDate && <span style={{ fontSize: 12, color: '#9ca3af' }}>last {fmtDate(status.lastCompletedDate)}{status.lastCompletedBy && status.lastCompletedBy !== name ? ` by ${status.lastCompletedBy}` : ''}</span>}
                  {status.state !== 'upcoming' ? (
                    <button
                      onClick={() => onMarkDone(task, name)}
                      disabled={busyId === `${task.id}:${name}`}
                      style={{ ...ghostBtn, marginLeft: 'auto' }}
                    >
                      {busyId === `${task.id}:${name}` ? '…' : 'Mark done'}
                    </button>
                  ) : status.lastCompletedDate && (
                    <button
                      onClick={() => onUndo(task, name)}
                      disabled={busyId === `${task.id}:${name}`}
                      style={{ ...ghostBtn, marginLeft: 'auto' }}
                    >
                      {busyId === `${task.id}:${name}` ? '…' : '↩ Undo'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskModal({ task, providerNames, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    title: task?.title || '',
    description: task?.description || '',
    assignees: task?.assignees || [],
    cadence: task?.cadence || 'monthly',
    weekdays: task?.weekdays || [],
    intervalDays: task?.intervalDays || 30,
    recurrenceMode: task?.recurrenceMode || 'fixed',
    completionMode: task?.completionMode || 'each',
    startDate: task?.startDate || todayStr(),
    active: task?.active !== false,
  }));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const byWeekday = isWeekdayCadence(form);
  const byCustomDays = form.cadence === 'custom_days';

  function toggleAssignee(name) {
    set('assignees', form.assignees.includes(name) ? form.assignees.filter((n) => n !== name) : [...form.assignees, name]);
  }

  function toggleWeekday(idx) {
    set('weekdays', form.weekdays.includes(idx) ? form.weekdays.filter((d) => d !== idx) : [...form.weekdays, idx]);
  }

  // A weekday task is always fixed and needs ≥1 day; a custom task needs a valid interval.
  const invalid = !form.title.trim()
    || (byWeekday && form.weekdays.length === 0)
    || (byCustomDays && !(Number(form.intervalDays) >= 1));

  async function submit(e) {
    e.preventDefault();
    if (invalid) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        recurrenceMode: byWeekday ? 'fixed' : form.recurrenceMode,
        weekdays: byWeekday ? [...form.weekdays].sort((a, b) => a - b) : [],
        intervalDays: byCustomDays ? Math.max(1, Math.round(Number(form.intervalDays))) : null,
      });
    } catch { setSaving(false); }
  }

  const mode = RECURRENCE_MODES.find((m) => m.key === form.recurrenceMode);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>{task ? 'Edit Task' : 'New Recurring Task'}</h2>
        <form onSubmit={submit}>
          <Field label="Title">
            <input value={form.title} onChange={(e) => set('title', e.target.value)} required style={input} placeholder="e.g. Submit weekly progress notes" />
          </Field>
          <Field label="Description (optional)">
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} style={{ ...input, resize: 'vertical' }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Cadence">
              <select value={form.cadence} onChange={(e) => set('cadence', e.target.value)} style={input}>
                {CADENCES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Field>
            {!byWeekday && (
              <Field label="Recurrence">
                <select value={form.recurrenceMode} onChange={(e) => set('recurrenceMode', e.target.value)} style={input}>
                  {RECURRENCE_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </Field>
            )}
          </div>

          {byCustomDays && (
            <Field label="Interval">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, color: '#374151' }}>Every</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.intervalDays}
                  onChange={(e) => set('intervalDays', e.target.value)}
                  style={{ ...input, width: 100 }}
                />
                <span style={{ fontSize: 14, color: '#374151' }}>days</span>
              </div>
            </Field>
          )}

          {byWeekday ? (
            <Field label="Days of the week">
              <div style={{ display: 'flex', gap: 6 }}>
                {WEEKDAYS.map((d) => {
                  const on = form.weekdays.includes(d.idx);
                  return (
                    <button
                      key={d.idx}
                      type="button"
                      onClick={() => toggleWeekday(d.idx)}
                      title={d.short}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                        border: `1px solid ${on ? '#7c3aed' : '#e5e7eb'}`,
                        background: on ? '#ede9fe' : '#fff',
                        color: on ? '#6d28d9' : '#9ca3af',
                        cursor: 'pointer',
                      }}
                    >
                      {d.letter}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
                {form.weekdays.length === 0 ? 'Pick at least one day.' : `Recurs weekly on ${cadenceLabel({ cadence: 'weekdays', weekdays: form.weekdays }).replace('Weekly on ', '')}.`}
              </div>
            </Field>
          ) : (
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: -8, marginBottom: 14 }}>{mode?.hint}</div>
          )}

          <Field label={byWeekday ? 'Active from' : (form.recurrenceMode === 'fixed' ? 'Anchor / start date (sets the schedule)' : 'Start date (first due)')}>
            <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} required style={input} />
          </Field>
          <Field label={`Assign to (${form.assignees.length})`}>
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {providerNames.length === 0 ? (
                <span style={{ fontSize: 13, color: '#9ca3af' }}>No providers found.</span>
              ) : providerNames.map((name) => (
                <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.assignees.includes(name)} onChange={() => toggleAssignee(name)} style={{ accentColor: '#7c3aed' }} />
                  {name}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Completion">
            <select value={form.completionMode} onChange={(e) => set('completionMode', e.target.value)} style={input}>
              {COMPLETION_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
              {COMPLETION_MODES.find((m) => m.key === form.completionMode)?.hint}
            </div>
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 18, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} style={{ accentColor: '#7c3aed' }} />
            Active (uncheck to pause without deleting)
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
            <button type="submit" disabled={saving || invalid} style={primaryBtn}>{saving ? 'Saving…' : 'Save Task'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Small building blocks ─────────────────────────────────────────────────────

function Section({ title, action, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ color: '#9ca3af', fontSize: 13, padding: '16px 0' }}>{children}</div>;
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

/** Local calendar day 'YYYY-MM-DD' for the date input default (kept out of render for lint). */
function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const primaryBtn = { padding: '7px 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const ghostBtn = { padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const miniPill = { padding: '2px 9px', borderRadius: 20, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' };
const input = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, color: '#111827', boxSizing: 'border-box', fontFamily: 'inherit' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 };
const modal = { background: '#fff', borderRadius: 16, padding: '32px 36px', width: 720, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' };
