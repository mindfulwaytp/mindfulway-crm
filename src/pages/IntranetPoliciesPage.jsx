import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function IntranetPoliciesPage({ embedded = false }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f8' }}>
      {!embedded && (
        <div style={{
          background: '#fff', borderBottom: '1px solid #e5e7eb',
          padding: '16px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => navigate('/intranet')}
              style={{
                background: 'none', border: '1px solid #e5e7eb',
                borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                fontSize: 13, color: '#6b7280', fontWeight: 600,
              }}
            >
              ← Intranet
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Policies & Procedures</h1>
              <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Handbook, compliance & clinical protocols</p>
            </div>
          </div>
          <button
            onClick={signOut}
            style={{
              border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8,
              padding: '7px 14px', fontSize: 13, color: '#6b7280', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      )}

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 40px' }}>
        <div style={{
          textAlign: 'center', padding: 64,
          background: '#fff', borderRadius: 16,
          border: '1px solid #e5e7eb', color: '#9ca3af',
        }}>
          <div style={{ fontSize: 42, marginBottom: 14 }}>📘</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#374151', marginBottom: 6 }}>
            Policies coming soon
          </div>
          <div style={{ fontSize: 14 }}>
            Employee handbook, compliance docs & clinical protocols will live here.
          </div>
        </div>
      </div>
    </div>
  );
}
