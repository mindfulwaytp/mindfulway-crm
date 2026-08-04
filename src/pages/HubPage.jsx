import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const HUB_ITEMS = [
  {
    id: 'crm',
    label: 'CRM',
    description: 'Client intake, pipeline & matching',
    path: '/crm',
    adminOnly: true,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#c4b5fd',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: 'providers',
    label: 'Providers List',
    description: 'Manage provider profiles & availability',
    path: '/providers',
    adminOnly: true,
    color: '#0369a1',
    bg: '#f0f9ff',
    border: '#bae6fd',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
  },
  {
    id: 'availability',
    label: 'Availability',
    description: 'Set and view provider availability',
    path: '/availability',
    adminOnly: false,
    color: '#059669',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <path d="M9 16l2 2 4-4"/>
      </svg>
    ),
  },
  {
    id: 'personnel',
    label: 'Personnel',
    description: 'Staff files, compliance requirements & hours log',
    path: '/personnel',
    adminOrSupervisor: true,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#c4b5fd',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    id: 'tasks',
    label: 'Tasks',
    description: 'Recurring responsibilities & to-dos',
    path: '/tasks',
    adminOnly: false,
    color: '#ca8a04',
    bg: '#fefce8',
    border: '#fde047',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    id: 'intranet',
    label: 'Intranet',
    description: 'Staff updates, posts & announcements',
    path: '/intranet',
    adminOnly: false,
    color: '#db2777',
    bg: '#fdf2f8',
    border: '#f9a8d4',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
];

export default function HubPage() {
  const navigate = useNavigate();
  const { isAdmin, isSupervisor, signOut } = useAuth();

  const visibleItems = HUB_ITEMS.filter(item => {
    if (item.adminOnly) return isAdmin;
    if (item.adminOrSupervisor) return isAdmin || isSupervisor;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f8' }}>
      {/* Header */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '20px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>
            MindfulWayOS
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            Internal Staff Portal
          </p>
        </div>
        <button
          onClick={signOut}
          style={{
            border: '1px solid #e5e7eb',
            background: '#fff',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            color: '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>

      {/* Hub grid */}
      <div style={{ padding: '48px 40px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
          Welcome to the Hub
        </h2>
        <p style={{ margin: '0 0 36px', fontSize: 14, color: '#6b7280' }}>
          Select a section to get started.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 20,
        }}>
          {visibleItems.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              style={{
                textAlign: 'left',
                background: '#fff',
                border: `1px solid ${item.border}`,
                borderRadius: 16,
                padding: 24,
                cursor: 'pointer',
                transition: 'box-shadow 0.15s, transform 0.1s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Icon area */}
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 14,
                background: item.bg,
                color: item.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}>
                {item.icon}
              </div>

              <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 6 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                {item.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
