import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
  subscribeToFeed, createPost, deletePost, pinPost,
  toggleReaction, subscribeToComments, addComment, deleteComment,
} from '../lib/intranetApi';
import { fetchProviderProfiles } from '../lib/providersProfileApi';
import { createNotification } from '../lib/notificationsApi';

const REACTIONS = [
  { key: 'heart',      emoji: '❤️' },
  { key: 'thumbsup',   emoji: '👍' },
  { key: 'celebrate',  emoji: '🎉' },
  { key: 'clap',       emoji: '👏' },
  { key: 'blue_heart', emoji: '💙' },
];

const CATEGORIES = [
  { key: 'general',      label: 'General',      color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db' },
  { key: 'announcement', label: 'Announcement', color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  { key: 'celebration',  label: 'Celebration',  color: '#be185d', bg: '#fdf2f8', border: '#f9a8d4' },
  { key: 'update',       label: 'Update',       color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
];

function categoryMeta(key) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name) {
  const colors = ['#7c3aed','#0369a1','#059669','#d97706','#db2777','#dc2626','#0891b2'];
  let hash = 0;
  for (const c of (name ?? '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xfffffff;
  return colors[hash % colors.length];
}

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts.seconds * 1000) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts.seconds * 1000).toLocaleDateString();
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36 }) {
  const bg = avatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
      userSelect: 'none',
    }}>
      {initials(name)}
    </div>
  );
}

// ── Compose Box ───────────────────────────────────────────────────────────────
function ComposeBox({ authorName, authorUid, isAdmin, onPost }) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [sendNotification, setSendNotification] = useState(false);
  const [posting, setPosting] = useState(false);

  async function handlePost() {
    if (!content.trim()) return;
    setPosting(true);
    await onPost({ content, category, sendNotification });
    setContent('');
    setCategory('general');
    setSendNotification(false);
    setPosting(false);
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: '1px solid #e5e7eb',
      padding: 20, marginBottom: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Avatar name={authorName} />
        <div style={{ flex: 1 }}>
          <textarea
            placeholder="Share an update, announcement, or celebration…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost(); }}
            style={{
              width: '100%', minHeight: 80, resize: 'vertical',
              border: '1px solid #e5e7eb', borderRadius: 10,
              padding: '10px 12px', fontSize: 14,
              fontFamily: 'inherit', outline: 'none',
              boxSizing: 'border-box', lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: `1px solid ${c.border}`,
                  background: category === c.key ? c.bg : '#fff',
                  color: category === c.key ? c.color : '#9ca3af',
                }}
              >
                {c.label}
              </button>
            ))}
            {isAdmin && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', cursor: 'pointer', marginLeft: 4 }}>
                <input
                  type="checkbox"
                  checked={sendNotification}
                  onChange={(e) => setSendNotification(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: '#7c3aed' }}
                />
                Send notification
              </label>
            )}
            <button
              onClick={handlePost}
              disabled={!content.trim() || posting}
              style={{
                marginLeft: 'auto', padding: '8px 18px', borderRadius: 10,
                border: 'none', background: '#7c3aed', color: '#fff',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
                opacity: (!content.trim() || posting) ? 0.5 : 1,
              }}
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Comment Section ───────────────────────────────────────────────────────────
function CommentSection({ postId, currentUid, currentName, isAdmin }) {
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeToComments(postId, setComments);
    return unsub;
  }, [postId]);

  async function handleSubmit() {
    if (!draft.trim()) return;
    setSubmitting(true);
    await addComment(postId, { authorUid: currentUid, authorName: currentName, content: draft });
    setDraft('');
    setSubmitting(false);
  }

  async function handleDelete(commentId) {
    await deleteComment(postId, commentId);
  }

  return (
    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14, marginTop: 4 }}>
      {comments.map((c) => (
        <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <Avatar name={c.authorName} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              background: '#f9fafb', borderRadius: 10,
              padding: '8px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{c.authorName}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{relativeTime(c.createdAt)}</span>
                {(isAdmin || c.authorUid === currentUid) && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    style={{
                      marginLeft: 'auto', background: 'none', border: 'none',
                      cursor: 'pointer', color: '#d1d5db', fontSize: 12,
                      padding: '0 2px',
                    }}
                    title="Delete comment"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.45 }}>{c.content}</p>
            </div>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 4 }}>
        <Avatar name={currentName} size={28} />
        <div style={{ flex: 1, display: 'flex', gap: 6 }}>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="Write a comment…"
            style={{
              flex: 1, border: '1px solid #e5e7eb', borderRadius: 20,
              padding: '7px 14px', fontSize: 13, fontFamily: 'inherit',
              outline: 'none', background: '#f9fafb',
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!draft.trim() || submitting}
            style={{
              padding: '7px 14px', borderRadius: 20,
              border: 'none', background: '#7c3aed', color: '#fff',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              opacity: (!draft.trim() || submitting) ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            Reply
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────────────
function PostCard({ post, currentUid, currentName, isAdmin, onDelete, onPin, onReact }) {
  const [showComments, setShowComments] = useState(false);
  const cat = categoryMeta(post.category);
  const isOwn = post.authorUid === currentUid;

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: post.pinned ? '1.5px solid #c4b5fd' : '1px solid #e5e7eb',
      padding: 20, marginBottom: 16,
      boxShadow: post.pinned
        ? '0 2px 12px rgba(124,58,237,0.08)'
        : '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        <Avatar name={post.authorName} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{post.authorName}</span>
            {post.pinned && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f5f3ff', color: '#7c3aed', fontWeight: 600, border: '1px solid #c4b5fd' }}>
                📌 Pinned
              </span>
            )}
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
              background: cat.bg, color: cat.color, border: `1px solid ${cat.border}`,
            }}>
              {cat.label}
            </span>
            <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{relativeTime(post.createdAt)}</span>
          </div>
        </div>

        {(isAdmin || isOwn) && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {isAdmin && (
              <button
                onClick={() => onPin(post.id, !post.pinned)}
                title={post.pinned ? 'Unpin' : 'Pin to top'}
                style={{
                  background: 'none', border: '1px solid #e5e7eb',
                  borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                  fontSize: 14, color: post.pinned ? '#7c3aed' : '#9ca3af',
                }}
              >
                📌
              </button>
            )}
            {(isAdmin || isOwn) && (
              <button
                onClick={() => onDelete(post.id)}
                title="Delete post"
                style={{
                  background: 'none', border: '1px solid #e5e7eb',
                  borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                  fontSize: 13, color: '#9ca3af',
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      <p style={{ margin: '0 0 14px', fontSize: 15, color: '#111827', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {post.content}
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {REACTIONS.map(({ key, emoji }) => {
          const uids = post.reactions?.[key] ?? [];
          const reacted = uids.includes(currentUid);
          return (
            <button
              key={key}
              onClick={() => onReact(post.id, key, reacted)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 20, fontSize: 13,
                border: reacted ? '1.5px solid #c4b5fd' : '1px solid #e5e7eb',
                background: reacted ? '#f5f3ff' : '#fff',
                cursor: 'pointer', fontWeight: reacted ? 700 : 400,
                color: reacted ? '#7c3aed' : '#6b7280',
              }}
            >
              <span>{emoji}</span>
              {uids.length > 0 && <span style={{ fontSize: 12 }}>{uids.length}</span>}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setShowComments((v) => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: '#6b7280', fontWeight: 600, padding: 0,
        }}
      >
        {showComments ? 'Hide comments' : `💬 ${post.commentCount > 0 ? `${post.commentCount} comment${post.commentCount !== 1 ? 's' : ''}` : 'Comment'}`}
      </button>

      {showComments && (
        <div style={{ marginTop: 12 }}>
          <CommentSection
            postId={post.id}
            currentUid={currentUid}
            currentName={currentName}
            isAdmin={isAdmin}
          />
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function IntranetNewsPage({ embedded = false }) {
  const navigate = useNavigate();
  const { user, providerName, isAdmin, signOut } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const displayName = providerName || user?.email?.split('@')[0] || 'Staff';

  useEffect(() => {
    const unsub = subscribeToFeed(
      (p) => { setPosts(p); setLoading(false); },
      (err) => { console.error('Feed error:', err); setFeedError(err.message); setLoading(false); },
    );
    return unsub;
  }, []);

  async function handlePost({ content, category, sendNotification }) {
    try {
      const postRef = await createPost({
        authorUid: user.uid,
        authorName: displayName,
        content,
        category,
      });
      if (sendNotification) {
        const providers = await fetchProviderProfiles();
        await Promise.all(providers.map((p) =>
          createNotification({
            recipientProviderName: p.name,
            type: 'intranet_post',
            message: `${displayName} posted in News & Updates: "${content.slice(0, 80)}${content.length > 80 ? '…' : ''}"`,
            relatedId: postRef.id,
            createdByName: displayName,
          })
        ));
      }
    } catch (err) {
      console.error('Post error:', err);
      alert('Failed to post: ' + err.message);
    }
  }

  async function handleDelete(postId) {
    if (!window.confirm('Delete this post?')) return;
    await deletePost(postId);
  }

  async function handlePin(postId, pinned) {
    await pinPost(postId, pinned);
  }

  async function handleReact(postId, reactionKey, currentlyReacted) {
    await toggleReaction(postId, reactionKey, user.uid, currentlyReacted);
  }

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
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>News & Updates</h1>
              <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Staff feed, announcements & celebrations</p>
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

      <div style={{
        maxWidth: 1060, margin: '0 auto', padding: '28px 16px',
        display: 'grid', gridTemplateColumns: '1fr 220px', gap: 24,
        alignItems: 'start',
      }}>

        <div>
          <ComposeBox
            authorName={displayName}
            authorUid={user.uid}
            isAdmin={isAdmin}
            onPost={handlePost}
          />

          {feedError ? (
            <div style={{ padding: 20, borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
              <strong>Could not load feed:</strong> {feedError}
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 14 }}>
              Loading feed…
            </div>
          ) : (() => {
            const filtered = selectedCategory === 'all'
              ? posts
              : selectedCategory === 'pinned'
              ? posts.filter(p => p.pinned)
              : posts.filter(p => p.category === selectedCategory);

            return filtered.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: 48,
                background: '#fff', borderRadius: 16,
                border: '1px solid #e5e7eb', color: '#9ca3af',
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                  {selectedCategory === 'all' ? 'No posts yet' : 'No posts in this category'}
                </div>
                <div style={{ fontSize: 13 }}>
                  {selectedCategory === 'all' ? 'Be the first to share something with the team.' : 'Try a different category.'}
                </div>
              </div>
            ) : filtered.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUid={user.uid}
                currentName={displayName}
                isAdmin={isAdmin}
                onDelete={handleDelete}
                onPin={handlePin}
                onReact={handleReact}
              />
            ));
          })()}
        </div>

        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{
            background: '#fff', borderRadius: 16,
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>Browse by Category</span>
            </div>

            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                width: '100%', textAlign: 'left', padding: '11px 16px',
                border: 'none', borderBottom: '1px solid #f3f4f6',
                background: selectedCategory === 'all' ? '#f5f3ff' : '#fff',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: selectedCategory === 'all' ? 700 : 500, color: selectedCategory === 'all' ? '#7c3aed' : '#374151' }}>
                All Posts
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', background: '#f3f4f6', borderRadius: 10, padding: '1px 7px' }}>
                {posts.length}
              </span>
            </button>

            {posts.some(p => p.pinned) && (
              <button
                onClick={() => setSelectedCategory('pinned')}
                style={{
                  width: '100%', textAlign: 'left', padding: '11px 16px',
                  border: 'none', borderBottom: '1px solid #f3f4f6',
                  background: selectedCategory === 'pinned' ? '#f5f3ff' : '#fff',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: selectedCategory === 'pinned' ? 700 : 500, color: selectedCategory === 'pinned' ? '#7c3aed' : '#374151' }}>
                  📌 Pinned
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', background: '#f3f4f6', borderRadius: 10, padding: '1px 7px' }}>
                  {posts.filter(p => p.pinned).length}
                </span>
              </button>
            )}

            {CATEGORIES.map((cat, i) => {
              const count = posts.filter(p => p.category === cat.key).length;
              const isLast = i === CATEGORIES.length - 1;
              return (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '11px 16px',
                    border: 'none', borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                    background: selectedCategory === cat.key ? cat.bg : '#fff',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: selectedCategory === cat.key ? 700 : 500, color: selectedCategory === cat.key ? cat.color : '#374151' }}>
                    {cat.label}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, borderRadius: 10, padding: '1px 7px', background: selectedCategory === cat.key ? cat.border : '#f3f4f6', color: selectedCategory === cat.key ? cat.color : '#9ca3af' }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
