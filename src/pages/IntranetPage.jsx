import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const INTRANET_SECTIONS = [
  {
    id: 'news',
    label: 'News & Updates',
    description: 'Staff feed, announcements & celebrations',
    path: '/intranet/news',
    color: '#db2777',
    bg: '#fdf2f8',
    border: '#f9a8d4',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
        <path d="M18 14h-8"/>
        <path d="M15 18h-5"/>
        <path d="M10 6h8v4h-8V6z"/>
      </svg>
    ),
  },
  {
    id: 'resources',
    label: 'Resources',
    description: 'Shared documents, forms & team materials',
    path: '/intranet/resources',
    color: '#0369a1',
    bg: '#f0f9ff',
    border: '#bae6fd',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: 'policies',
    label: 'Policies & Procedures',
    description: 'Handbook, compliance & clinical protocols',
    path: '/intranet/policies',
    color: '#059669',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="9" y1="13" x2="15" y2="13"/>
        <line x1="9" y1="17" x2="15" y2="17"/>
      </svg>
    ),
  },
];

export default function IntranetPage({ embedded = false }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f8' }}>
      {!embedded && (
        <div style={{
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          padding: '20px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'none', border: '1px solid #e5e7eb',
                borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                fontSize: 13, color: '#6b7280', fontWeight: 600,
              }}
            >
              ← Hub
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>
                Intranet
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                MindfulWayOS Staff Portal
              </p>
            </div>
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
      )}

      <div style={{ padding: '48px 40px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
          Welcome to the Intranet
        </h2>
        <p style={{ margin: '0 0 36px', fontSize: 14, color: '#6b7280' }}>
          Select a section to explore team news, resources, and policies.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 20,
        }}>
          {INTRANET_SECTIONS.map(item => (
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
