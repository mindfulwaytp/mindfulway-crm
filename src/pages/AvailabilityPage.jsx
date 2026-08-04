import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { serverTimestamp } from 'firebase/firestore';
import { fetchProviderProfiles, upsertProviderProfile } from '../lib/providersProfileApi';
import NotificationBell from '../components/NotificationBell';
import { DAYS, SLOTS, getAvailability, toggleSlot, toProfileFields } from '../lib/availability';
import { DayCell } from '../components/AvailabilityGrid';

function SaveIndicator({ state }) {
  if (state === 'saving') return <span style={{ fontSize: 11, color: '#9ca3af' }}>Saving…</span>;
  if (state === 'saved') return <span style={{ fontSize: 11, color: '#10b981' }}>Saved</span>;
  if (state === 'error') return <span style={{ fontSize: 11, color: '#ef4444' }}>Error</span>;
  return null;
}

export default function AvailabilityPage({ onNav }) {
  const { isAdmin, isIntern, isAssociate, isSupervisor, providerName, user, signOut } = useAuth();
  const showNavTabs = !!onNav;
  const hoursTabLabel = (isIntern || isAssociate) ? 'My Hours' : isSupervisor ? 'Hours Log' : 'Hours';

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState({}); // { [name]: 'saving' | 'saved' | 'error' }
  const [noteDrafts, setNoteDrafts] = useState({}); // in-flight text, keyed by provider

  useEffect(() => {
    fetchProviderProfiles()
      .then((data) => {
        const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
        setProfiles(sorted);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function canEdit(name) {
    return isAdmin || name === providerName;
  }

  async function saveFields(name, fields) {
    // Every edit on this page is an availability change, so stamp who/when.
    const editor = providerName || user?.email || 'Unknown';
    setSaveState((s) => ({ ...s, [name]: 'saving' }));
    // Optimistic: show a client-side time immediately (Firestore Timestamp shape
    // so the same formatter works before and after the server value lands).
    const localStamp = clientStamp();
    setProfiles((prev) =>
      prev.map((p) => (p.name === name
        ? { ...p, ...fields, availabilityUpdatedBy: editor, availabilityUpdatedAt: localStamp }
        : p))
    );
    try {
      await upsertProviderProfile(name, {
        ...fields,
        availabilityUpdatedBy: editor,
        availabilityUpdatedAt: serverTimestamp(),
      });
      setSaveState((s) => ({ ...s, [name]: 'saved' }));
      setTimeout(() => setSaveState((s) => ({ ...s, [name]: null })), 2000);
    } catch (e) {
      console.error(e);
      setSaveState((s) => ({ ...s, [name]: 'error' }));
    }
  }

  const saveField = (name, field, value) => saveFields(name, { [field]: value });

  /** Toggle one day+slot cell and persist the whole grid (plus derived fields). */
  function handleSlotToggle(profile, day, slot) {
    const next = toggleSlot(getAvailability(profile), day, slot);
    saveFields(profile.name, toProfileFields(next));
  }

  /** Persist a numeric spot count (open / sliding-fee / pro-bono). */
  function handleSpotsChange(name, field, value) {
    saveField(name, field, value === '' ? 0 : Number(value));
  }

  /**
   * Free-text availability notes. Saved on blur rather than on every keystroke —
   * a Firestore write per character would be wasteful and would make the "Saved"
   * indicator flicker while typing.
   */
  function handleNoteBlur(profile) {
    const draft = noteDrafts[profile.name];
    if (draft === undefined) return;                       // never edited
    if (draft === (profile.availabilityNotes || '')) {     // edited back to the same value
      setNoteDrafts((d) => { const n = { ...d }; delete n[profile.name]; return n; });
      return;
    }
    saveFields(profile.name, { availabilityNotes: draft });
    setNoteDrafts((d) => { const n = { ...d }; delete n[profile.name]; return n; });
  }

  const myProfile = profiles.find((p) => p.name === providerName);

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Mindful Way</span>
          {showNavTabs ? (
            <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
              <button style={tabStyle(true)}>My Availability</button>
              <button onClick={() => onNav('hours')} style={tabStyle(false)}>{hoursTabLabel}</button>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>
              {isAdmin ? 'Availability — Admin View' : 'My Availability'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {showNavTabs && <NotificationBell providerName={providerName} />}
          <span style={{ fontSize: 13, color: '#6b7280' }}>{user?.email}</span>
          <button
            onClick={signOut}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              fontSize: 13,
              cursor: 'pointer',
              color: '#374151',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={{ padding: '40px 40px 32px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1.3, letterSpacing: '0.01em' }}>Provider Availability</h1>
          <p style={{ margin: '0 0 14px', fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
            {isAdmin
              ? 'View and edit availability for all providers.'
              : 'Set which time slots you are available on each day, plus your open spots. Changes save automatically.'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#6b7280' }}>
            <span style={{ fontWeight: 600 }}>Slots:</span>
            {SLOTS.map((s) => (
              <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 5, fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid #3a93ed', background: '#3a93ed', color: '#fff',
                }}>{s.short}</span>
                {s.label} <span style={{ color: '#9ca3af' }}>{s.hint}</span>
              </span>
            ))}
          </div>
        </div>

        {!isAdmin && myProfile && (
          <div style={{
            background: '#ede9fe',
            border: '1px solid #c4b5fd',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: 13,
            color: '#5b21b6',
            fontWeight: 500,
          }}>
            You are editing your own row. Changes are saved automatically.
          </div>
        )}

        {loading ? (
          <div style={{ color: '#6b7280', fontSize: 14 }}>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 1390, borderCollapse: 'collapse', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ ...thStyle, width: 220 }}>Provider</th>
                  <th style={{ ...thStyle, width: 90, textAlign: 'center' }}>Open Spots</th>
                  <th style={{ ...thStyle, width: 150, borderLeft: DIVIDER }}>Fee Spots</th>
                  {DAYS.map((d) => (
                    <th key={d.key} style={{ ...thStyle, ...dayColStyle, textAlign: 'center' }}>{d.short}</th>
                  ))}
                  {/* Comments is the flexible column: it soaks up the slack on wide
                      screens, so the fixed columns keep their widths and the extra
                      room goes somewhere useful instead of into dead space. */}
                  <th style={{ ...thStyle, width: '100%', minWidth: 340, borderLeft: DIVIDER }}>Comments</th>
                  <th style={{ ...thStyle, width: 72, borderLeft: DIVIDER }}></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const editable = canEdit(p.name);
                  const isOwnRow = p.name === providerName;
                  const grid = getAvailability(p);
                  const spaces = p.openSpaces ?? '';

                  return (
                    <tr
                      key={p.name}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isOwnRow ? '#faf5ff' : '#fff',
                      }}
                    >
                      {/* Name */}
                      <td style={{ ...tdStyle, fontWeight: isOwnRow ? 700 : 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {p.name}
                          {isOwnRow && (
                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: '#ede9fe', color: '#6d28d9', fontWeight: 600 }}>
                              you
                            </span>
                          )}
                        </div>
                        {p.availabilityUpdatedAt && (
                          <div style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af', marginTop: 3, lineHeight: 1.4 }}>
                            Updated {formatUpdatedAt(p.availabilityUpdatedAt)}
                            {p.availabilityUpdatedBy ? ` by ${p.availabilityUpdatedBy}` : ''}
                          </div>
                        )}
                      </td>

                      {/* Open Spots */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {editable ? (
                          <input
                            type="number"
                            min={0}
                            value={spaces}
                            onChange={(e) => handleSpotsChange(p.name, 'openSpaces', e.target.value)}
                            style={{
                              width: 52,
                              padding: '4px 6px',
                              borderRadius: 6,
                              border: '1px solid #d1d5db',
                              fontSize: 13,
                              textAlign: 'center',
                              background: spaces === 0 || spaces === '0' ? '#fef2f2' : spaces === '' ? '#fff' : '#ecfdf5',
                              color: spaces === 0 || spaces === '0' ? '#dc2626' : '#111827',
                            }}
                          />
                        ) : (
                          <OpenBadge count={spaces} />
                        )}
                      </td>

                      {/* Fee Spots — sliding-fee and pro-bono openings, stacked */}
                      <td style={{ ...tdStyle, borderLeft: DIVIDER, padding: '8px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <LabeledSpot
                            label="Sliding Fee"
                            value={p.slidingFeeSpots}
                            editable={editable}
                            onChange={(v) => handleSpotsChange(p.name, 'slidingFeeSpots', v)}
                          />
                          <LabeledSpot
                            label="Pro Bono"
                            value={p.proBonoSpots}
                            editable={editable}
                            onChange={(v) => handleSpotsChange(p.name, 'proBonoSpots', v)}
                          />
                        </div>
                      </td>

                      {/* One cell per day, each holding Morning/Afternoon/Evening toggles */}
                      {DAYS.map((d) => (
                        <td key={d.key} style={{ ...tdStyle, ...dayColStyle }}>
                          <DayCell
                            grid={grid}
                            day={d.key}
                            readOnly={!editable}
                            onToggle={(day, slot) => handleSlotToggle(p, day, slot)}
                          />
                        </td>
                      ))}

                      {/* Comments — free text, never parsed for matching */}
                      <td style={{ ...tdStyle, borderLeft: DIVIDER, padding: '8px 10px' }}>
                        {editable ? (
                          <textarea
                            value={noteDrafts[p.name] ?? p.availabilityNotes ?? ''}
                            onChange={(e) => setNoteDrafts((d) => ({ ...d, [p.name]: e.target.value }))}
                            onBlur={() => handleNoteBlur(p)}
                            rows={2}
                            placeholder="e.g. Sundays are telehealth only; last Thu of the month unavailable"
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: 6,
                              border: '1px solid #d1d5db',
                              fontSize: 12,
                              lineHeight: 1.45,
                              color: '#111827',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                              boxSizing: 'border-box',
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: p.availabilityNotes ? '#374151' : '#d1d5db', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                            {p.availabilityNotes || '—'}
                          </span>
                        )}
                      </td>

                      {/* Save indicator */}
                      <td style={{ ...tdStyle, textAlign: 'center', borderLeft: DIVIDER }}>
                        <SaveIndicator state={saveState[p.name]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Current time as a Firestore-Timestamp-shaped object, for optimistic display. */
function clientStamp() {
  return { seconds: Math.floor(Date.now() / 1000) };
}

/** Firestore Timestamp (or {seconds}) → "Jul 16, 2026, 3:42 PM". */
function formatUpdatedAt(ts) {
  if (!ts?.seconds) return '';
  return new Date(ts.seconds * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function OpenBadge({ count }) {
  const n = Number(count);
  if (count === '' || count === undefined || count === null) return <span style={{ color: '#9ca3af' }}>—</span>;
  const color = n === 0 ? '#dc2626' : n <= 2 ? '#d97706' : '#059669';
  const bg = n === 0 ? '#fef2f2' : n <= 2 ? '#fffbeb' : '#ecfdf5';
  return (
    <span style={{ padding: '2px 9px', borderRadius: 20, background: bg, color, fontWeight: 700, fontSize: 12, border: `1px solid ${color}22` }}>
      {n === 0 ? 'Full' : n}
    </span>
  );
}

/** One labelled spot count, laid out to stack cleanly with siblings in a column. */
function LabeledSpot({ label, value, editable, onChange }) {
  const v = value ?? '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
      {editable ? (
        <input
          type="number"
          min={0}
          value={v}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 46, padding: '3px 6px', borderRadius: 6, border: '1px solid #d1d5db',
            fontSize: 13, textAlign: 'center', color: '#111827',
          }}
        />
      ) : (
        <FeeSpotBadge count={v} />
      )}
    </div>
  );
}

/** Read-only badge for sliding-fee / pro-bono counts. Zero here just means "none offered". */
function FeeSpotBadge({ count }) {
  if (count === '' || count === undefined || count === null) return <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>;
  const n = Number(count);
  const has = n > 0;
  return (
    <span style={{ padding: '2px 9px', borderRadius: 20, background: has ? '#ecfdf5' : '#f3f4f6', color: has ? '#059669' : '#9ca3af', fontWeight: 700, fontSize: 12, border: `1px solid ${has ? '#05966922' : '#e5e7eb'}` }}>
      {n}
    </span>
  );
}

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: 12,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '12px 16px',
  verticalAlign: 'middle',
};

const DIVIDER = '1px solid #e5e7eb';

// Each day is its own column of M/A/E toggles; without a rule between them the
// 21 pills read as one undifferentiated block.
const dayColStyle = {
  width: 84,
  padding: '12px 10px',
  borderLeft: DIVIDER,
};

function tabStyle(active) {
  return {
    padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', background: active ? '#fff' : 'transparent',
    color: active ? '#111827' : '#6b7280',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
  };
}
