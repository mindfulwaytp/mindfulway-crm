import { isApproved, formatTimestamp } from '../lib/hourEntriesApi';

/** Sign-off state for an entry: locked (green) once a supervisor has approved it. */
export function SignOffBadge({ entry }) {
  if (!isApproved(entry)) {
    return (
      <span style={{ ...pillStyle, background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}>
        Pending
      </span>
    );
  }
  const who = entry.approvedBy?.name || 'Supervisor';
  const when = formatTimestamp(entry.approvedAt);
  return (
    <span
      title={`Signed off by ${who}${when ? ` on ${when}` : ''}`}
      style={{ ...pillStyle, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}
    >
      ✓ Signed off
    </span>
  );
}

/**
 * Row actions for an hour entry.
 * - Unapproved: owner/supervisor can edit or delete; supervisors can sign off.
 * - Approved:   locked. Supervisors can reopen; interns can only request a change.
 */
export function EntryActions({
  entry,
  canApprove = false,     // viewer is the supervisor/admin for this intern
  onEdit,
  onDelete,
  onApprove,
  onUnapprove,
  onRequestChange,
  hasPendingCR = false,
  changeRequest,          // supervisor view: the pending CR doc, if any
  onResolveCR,
  busy = false,
}) {
  const approved = isApproved(entry);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      {changeRequest && onResolveCR && (
        <div style={{ fontSize: 12 }}>
          <div style={{ color: '#d97706', fontWeight: 600, marginBottom: 2 }}>Change requested</div>
          <div style={{ color: '#6b7280', marginBottom: 4 }}>{changeRequest.reason}</div>
          <button onClick={() => onResolveCR(changeRequest.id)} style={btnStyle} disabled={busy}>
            Mark resolved
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {!approved && onEdit && (
          <button onClick={() => onEdit(entry)} style={btnStyle} disabled={busy}>Edit</button>
        )}
        {!approved && onDelete && (
          <button onClick={() => onDelete(entry)} style={dangerBtnStyle} disabled={busy}>Delete</button>
        )}
        {!approved && canApprove && onApprove && (
          <button onClick={() => onApprove(entry)} style={approveBtnStyle} disabled={busy}>Sign off</button>
        )}
        {approved && canApprove && onUnapprove && (
          <button onClick={() => onUnapprove(entry)} style={btnStyle} disabled={busy}>Reopen</button>
        )}
        {approved && !canApprove && onRequestChange && (
          hasPendingCR
            ? <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>Change requested</span>
            : <button onClick={() => onRequestChange(entry)} style={btnStyle} disabled={busy}>Request change</button>
        )}
      </div>
    </div>
  );
}

const pillStyle = {
  padding: '2px 9px', borderRadius: 20, fontWeight: 600, fontSize: 11,
  whiteSpace: 'nowrap', display: 'inline-block',
};

const btnStyle = {
  fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb',
  background: '#fff', cursor: 'pointer', color: '#6b7280',
};

const dangerBtnStyle = {
  ...btnStyle, borderColor: '#fecaca', color: '#dc2626',
};

const approveBtnStyle = {
  ...btnStyle, borderColor: '#a7f3d0', background: '#ecfdf5', color: '#047857', fontWeight: 600,
};
