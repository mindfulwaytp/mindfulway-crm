import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/notificationsApi';

export default function NotificationBell({ providerName }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = useCallback(async () => {
    if (!providerName) return;
    try {
      const list = await fetchNotifications(providerName);
      setNotifications(list);
    } catch (e) {
      console.error('Failed to load notifications', e);
    }
  }, [providerName]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!providerName) return undefined;
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [providerName, load]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleClickNotification(n) {
    if (!n.read) {
      await markNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(notifications);
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
  }

  if (!providerName) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        style={{
          position: 'relative', width: 36, height: 36, borderRadius: 8,
          border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 18, height: 18, borderRadius: 9,
            background: '#dc2626', color: '#fff',
            fontSize: 11, fontWeight: 700, padding: '0 5px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 360, maxWidth: '90vw', background: '#fff',
          border: '1px solid #e5e7eb', borderRadius: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 100,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => {
                const date = n.createdAt ? new Date(n.createdAt.seconds * 1000) : null;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    style={{
                      padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer', background: n.read ? '#fff' : '#f5f3ff',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}
                  >
                    {!n.read && (
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: '#7c3aed', marginTop: 6, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#111827', lineHeight: 1.4 }}>{n.message}</div>
                      {date && (
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                          {date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
