import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
  subscribeToResourceFolders,
  addResourceFolder,
  updateResourceFolder,
  deleteResourceFolder,
  subscribeToWebsiteLinks,
  addWebsiteLink,
  updateWebsiteLink,
  deleteWebsiteLink,
} from '../lib/intranetConfigApi';

// ── Shared form used for both folders and links ──────────────────────────────
function ItemForm({ initial, fields, onCancel, onSubmit, submitLabel = 'Save' }) {
  const [values, setValues] = useState(() => {
    const init = {};
    for (const f of fields) init[f.key] = initial?.[f.key] ?? '';
    return init;
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function setField(key, v) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit() {
    const trimmed = {};
    for (const f of fields) trimmed[f.key] = (values[f.key] ?? '').trim();

    for (const f of fields) {
      if (f.required && !trimmed[f.key]) {
        setError(`${f.label} is required.`);
        return;
      }
      if (f.type === 'url' && trimmed[f.key]) {
        try { new URL(trimmed[f.key]); }
        catch { setError(`${f.label} must be a valid URL.`); return; }
      }
    }

    setSaving(true);
    setError('');
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div>
      {fields.map((f) => (
        <div key={f.key} style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            {f.label}{f.required ? '' : ' (optional)'}
          </label>
          {f.multiline ? (
            <textarea
              value={values[f.key]}
              onChange={(e) => setField(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={2}
              style={{
                width: '100%', border: '1px solid #e5e7eb', borderRadius: 8,
                padding: '9px 12px', fontSize: 13, fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box', resize: 'vertical',
              }}
            />
          ) : (
            <input
              value={values[f.key]}
              onChange={(e) => setField(f.key, e.target.value)}
              placeholder={f.placeholder}
              style={{
                width: '100%', border: '1px solid #e5e7eb', borderRadius: 8,
                padding: '9px 12px', fontSize: 13, fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          )}
        </div>
      ))}

      {error && (
        <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            padding: '8px 18px', borderRadius: 8,
            border: 'none', background: '#0369a1', color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: '8px 18px', borderRadius: 8,
            background: '#fff', border: '1px solid #e5e7eb',
            color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Generic item card (folder or link) ───────────────────────────────────────
function ItemCard({
  icon, iconBg, iconColor, name, subtitle, url,
  isAdmin, onEdit, onDelete,
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1px solid #e5e7eb',
      padding: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subtitle}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 8,
            background: '#0369a1', color: '#fff',
            fontWeight: 700, fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Open ↗
        </a>
        {isAdmin && (
          <>
            <button
              onClick={onEdit}
              title="Edit"
              style={{
                background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
                fontSize: 13, color: '#6b7280',
              }}
            >
              ✏️
            </button>
            <button
              onClick={onDelete}
              title="Remove"
              style={{
                background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
                fontSize: 13, color: '#6b7280',
              }}
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Generic section with list + add/edit ─────────────────────────────────────
function ResourceSection({
  title, subtitle, addLabel, emptyIcon, emptyTitle, emptyHintAdmin, emptyHintUser,
  items, loading, isAdmin, icon, iconBg, iconColor,
  fields, getName, getSubtitle, getUrl,
  onAdd, onUpdate, onDelete,
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  async function handleAdd(vals) {
    await onAdd(vals);
    setAdding(false);
  }

  async function handleUpdate(id, vals) {
    await onUpdate(id, vals);
    setEditingId(null);
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Remove "${name}"?`)) return;
    await onDelete(id);
  }

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
            {title}
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
            {subtitle}
          </p>
        </div>
        {isAdmin && !adding && (
          <button
            onClick={() => setAdding(true)}
            style={{
              padding: '9px 16px', borderRadius: 8,
              border: 'none', background: '#0369a1', color: '#fff',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            + {addLabel}
          </button>
        )}
      </div>

      {adding && (
        <div style={{
          background: '#fff', borderRadius: 14,
          border: '1px solid #e5e7eb',
          padding: 20, marginBottom: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#111827' }}>
            {addLabel}
          </div>
          <ItemForm
            fields={fields}
            onCancel={() => setAdding(false)}
            onSubmit={handleAdd}
            submitLabel={addLabel}
          />
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 14 }}>
          Loading…
        </div>
      ) : items.length === 0 && !adding ? (
        <div style={{
          textAlign: 'center', padding: 40,
          background: '#fff', borderRadius: 14,
          border: '1px solid #e5e7eb', color: '#9ca3af',
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>{emptyIcon}</div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#374151' }}>
            {emptyTitle}
          </div>
          <div style={{ fontSize: 13 }}>
            {isAdmin ? emptyHintAdmin : emptyHintUser}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((item) =>
            editingId === item.id ? (
              <div
                key={item.id}
                style={{
                  background: '#fff', borderRadius: 14,
                  border: '1px solid #e5e7eb',
                  padding: 20,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#111827' }}>
                  Edit
                </div>
                <ItemForm
                  initial={item}
                  fields={fields}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(vals) => handleUpdate(item.id, vals)}
                />
              </div>
            ) : (
              <ItemCard
                key={item.id}
                icon={icon}
                iconBg={iconBg}
                iconColor={iconColor}
                name={getName(item)}
                subtitle={getSubtitle(item)}
                url={getUrl(item)}
                isAdmin={isAdmin}
                onEdit={() => setEditingId(item.id)}
                onDelete={() => handleDelete(item.id, getName(item))}
              />
            )
          )}
        </div>
      )}
    </section>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function IntranetResourcesPage({ embedded = false }) {
  const navigate = useNavigate();
  const { user, providerName, isAdmin, signOut } = useAuth();

  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [links, setLinks] = useState([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = subscribeToResourceFolders(
      (list) => { setFolders(list); setFoldersLoading(false); },
      (err) => { setError(err.message); setFoldersLoading(false); },
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToWebsiteLinks(
      (list) => { setLinks(list); setLinksLoading(false); },
      (err) => { setError(err.message); setLinksLoading(false); },
    );
    return unsub;
  }, []);

  const createdBy = {
    createdByUid: user.uid,
    createdByName: providerName || user.email || 'Admin',
  };

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
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Resources</h1>
              <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Shared documents, forms & team materials</p>
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

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px' }}>

        {error && (
          <div style={{
            padding: 14, borderRadius: 10,
            background: '#fef2f2', border: '1px solid #fecaca',
            color: '#b91c1c', fontSize: 13, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <ResourceSection
          title="Shared Folders"
          subtitle="Google Drive folders linked for the team. Opens in a new tab."
          addLabel="Add folder"
          emptyIcon="📁"
          emptyTitle="No folders linked yet"
          emptyHintAdmin='Click "Add folder" above to link your first shared Google Drive folder.'
          emptyHintUser="An admin hasn't linked any shared folders yet. Check back soon."
          items={folders}
          loading={foldersLoading}
          isAdmin={isAdmin}
          icon="📁"
          iconBg="#f0f9ff"
          iconColor="#0369a1"
          fields={[
            { key: 'folderUrl',  label: 'Google Drive folder URL', type: 'url', required: true, placeholder: 'https://drive.google.com/drive/folders/…' },
            { key: 'folderName', label: 'Display name',            required: true, placeholder: 'e.g. Clinical Forms' },
          ]}
          getName={(f) => f.folderName}
          getSubtitle={(f) => f.folderUrl}
          getUrl={(f) => f.folderUrl}
          onAdd={(vals) => addResourceFolder({ ...vals, ...createdBy })}
          onUpdate={(id, vals) => updateResourceFolder(id, vals)}
          onDelete={(id) => deleteResourceFolder(id)}
        />

        <ResourceSection
          title="Websites & Links"
          subtitle="Helpful external websites and tools."
          addLabel="Add link"
          emptyIcon="🔗"
          emptyTitle="No links yet"
          emptyHintAdmin='Click "Add link" above to add your first website link.'
          emptyHintUser="An admin hasn't added any website links yet. Check back soon."
          items={links}
          loading={linksLoading}
          isAdmin={isAdmin}
          icon="🔗"
          iconBg="#f5f3ff"
          iconColor="#7c3aed"
          fields={[
            { key: 'url',         label: 'URL',         type: 'url', required: true, placeholder: 'https://example.com' },
            { key: 'name',        label: 'Name',                     required: true, placeholder: 'e.g. Practice Management Portal' },
            { key: 'description', label: 'Description', multiline: true,              placeholder: 'Short note about what this link is for' },
          ]}
          getName={(l) => l.name}
          getSubtitle={(l) => l.description || l.url}
          getUrl={(l) => l.url}
          onAdd={(vals) => addWebsiteLink({ ...vals, ...createdBy })}
          onUpdate={(id, vals) => updateWebsiteLink(id, vals)}
          onDelete={(id) => deleteWebsiteLink(id)}
        />

      </div>
    </div>
  );
}
