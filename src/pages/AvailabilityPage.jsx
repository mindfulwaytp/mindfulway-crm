import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { fetchProviderProfiles, upsertProviderProfile } from '../lib/providersProfileApi';
import NotificationBell from '../components/NotificationBell';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIMES = ['Morning', 'Afternoon', 'Evening'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };

function toggle(arr, item) {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function SaveIndicator({ state }) {
  if (state === 'saving') return <span style={{ fontSize: 11, color: '#9ca3af' }}>Saving…</span>;
  if (state === 'saved') return <span style={{ fontSize: 11, color: '#10b981' }}>Saved</span>;
  if (state === 'error') return <span style={{ fontSize: 11, color: '#ef4444' }}>Error</span>;
  return null;
}

export default function AvailabilityPage({ onNav }) {
  const { isAdmin, isIntern, isSupervisor, providerName, user, signOut } = useAuth();
  const showNavTabs = !!onNav;
  const hoursTabLabel = isIntern ? 'My Hours' : isSupervisor ? 'Intern Hours' : 'Hours';

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState({}); // { [name]: 'saving' | 'saved' | 'error' }

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

  async function saveField(name, field, value) {
    setSaveState((s) => ({ ...s, [name]: 'saving' }));
    setProfiles((prev) =>
      prev.map((p) => (p.name === name ? { ...p, [field]: value } : p))
    );
    try {
      await upsertProviderProfile(name, { [field]: value });
      setSaveState((s) => ({ ...s, [name]: 'saved' }));
      setTimeout(() => setSaveState((s) => ({ ...s, [name]: null })), 2000);
    } catch (e) {
      console.error(e);
      setSaveState((s) => ({ ...s, [name]: 'error' }));
    }
  }

  function handleDayToggle(name, day, currentDays) {
    saveField(name, 'availableDays', toggle(currentDays || [], day));
  }

  function handleTimeToggle(name, time, currentTimes) {
    saveField(name, 'availableTimes', toggle(currentTimes || [], time));
  }

  function handleOpenSpacesChange(name, value) {
    saveField(name, 'openSpaces', Number(value));
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
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
            {isAdmin
              ? 'View and edit availability for all providers.'
              : 'Update your available days, times, and open spots. Changes save automatically.'}
          </p>
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
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={thStyle}>Provider</th>
                  <th style={{ ...thStyle, width: 80 }}>Open Spots</th>
                  {DAYS.map((d) => (
                    <th key={d} style={{ ...thStyle, width: 52 }}>{DAY_SHORT[d]}</th>
                  ))}
                  {TIMES.map((t) => (
                    <th key={t} style={{ ...thStyle, width: 80 }}>{t}</th>
                  ))}
                  <th style={{ ...thStyle, width: 64 }}></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const editable = canEdit(p.name);
                  const isOwnRow = p.name === providerName;
                  const days = p.availableDays || [];
                  const times = p.availableTimes || [];
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

                      {/* Day checkboxes */}
                      {DAYS.map((day) => (
                        <td key={day} style={{ ...tdStyle, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={days.includes(day)}
                            disabled={!editable}
                            onChange={() => handleDayToggle(p.name, day, days)}
                            style={{ width: 15, height: 15, cursor: editable ? 'pointer' : 'default', accentColor: '#7c3aed' }}
                          />
                        </td>
                      ))}

                      {/* Time checkboxes */}
                      {TIMES.map((time) => (
                        <td key={time} style={{ ...tdStyle, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={times.includes(time)}
                            disabled={!editable}
                            onChange={() => handleTimeToggle(p.name, time, times)}
                            style={{ width: 15, height: 15, cursor: editable ? 'pointer' : 'default', accentColor: '#7c3aed' }}
                          />
                        </td>
                      ))}

                      {/* Save indicator */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
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

function tabStyle(active) {
  return {
    padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', background: active ? '#fff' : 'transparent',
    color: active ? '#111827' : '#6b7280',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
  };
}
