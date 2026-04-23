import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const PERSONNEL_ITEMS = [
  {
    id: 'files',
    label: 'Personnel Files',
    description: 'Credentials, trainings, contracts & compliance tracking per provider',
    path: '/personnel/files',
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
    id: 'compliance',
    label: 'Compliance',
    description: 'Define state-mandated requirements and track completion across all providers',
    path: '/personnel/compliance',
    color: '#0369a1',
    bg: '#f0f9ff',
    border: '#bae6fd',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    id: 'hours',
    label: 'Intern Hours',
    description: 'Track supervised hours and progress toward licensure',
    path: '/personnel/hours',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
];

export default function PersonnelHubPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

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
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 4, display: 'block' }}
          >
            ← Hub
          </button>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>
            Personnel
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            Staff files, compliance & hours
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

      {/* Cards */}
      <div style={{ padding: '48px 40px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 20,
        }}>
          {PERSONNEL_ITEMS.map(item => (
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
