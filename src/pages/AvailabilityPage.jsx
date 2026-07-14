import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
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
    setSaveState((s) => ({ ...s, [name]: 'saving' }));
    setProfiles((prev) =>
      prev.map((p) => (p.name === name ? { ...p, ...fields } : p))
    );
    try {
      await upsertProviderProfile(name, fields);
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

  function handleOpenSpacesChange(name, value) {
    saveField(name, 'openSpaces', Number(value));
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
            <table style={{ width: '100%', minWidth: 1240, borderCollapse: 'collapse', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ ...thStyle, width: 220 }}>Provider</th>
                  <th style={{ ...thStyle, width: 90, textAlign: 'center' }}>Open Spots</th>
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
                      </td>

                      {/* Open Spots */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {editable ? (
                          <input
                            type="number"
                            min={0}
                            value={spaces}
                            onChange={(e) => handleOpenSpacesChange(p.name, e.target.value)}
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
