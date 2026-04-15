import {
  collection, addDoc, deleteDoc, updateDoc,
  doc, query, orderBy, onSnapshot,
  getDocs, arrayUnion, arrayRemove, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const POSTS = 'intranet_posts';

// ── Feed ─────────────────────────────────────────────────────────────────────

/** Real-time subscription. Returns unsubscribe fn. */
export function subscribeToFeed(callback, onError) {
  const q = query(collection(db, POSTS), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Pinned always float to top
    posts.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
    });
    callback(posts);
  }, onError);
}

// ── Posts ─────────────────────────────────────────────────────────────────────

export async function createPost({ authorUid, authorName, content, category, requiresAcknowledgement = false }) {
  return addDoc(collection(db, POSTS), {
    authorUid,
    authorName,
    content: content.trim(),
    category: category || 'general',
    pinned: false,
    reactions: {},
    commentCount: 0,
    requiresAcknowledgement,
    createdAt: Timestamp.now(),
  });
}

export async function deletePost(postId) {
  await deleteDoc(doc(db, POSTS, postId));
}

export async function pinPost(postId, pinned) {
  await updateDoc(doc(db, POSTS, postId), { pinned });
}

// ── Acknowledgements ──────────────────────────────────────────────────────────

export async function acknowledgePost(postId, uid, name) {
  await updateDoc(doc(db, POSTS, postId), {
    [`acknowledgements.${uid}`]: { name, acknowledgedAt: Timestamp.now() },
  });
}

// ── Reactions ─────────────────────────────────────────────────────────────────

export async function toggleReaction(postId, reactionKey, uid, currentlyReacted) {
  await updateDoc(doc(db, POSTS, postId), {
    [`reactions.${reactionKey}`]: currentlyReacted
      ? arrayRemove(uid)
      : arrayUnion(uid),
  });
}

// ── Comments ─────────────────────────────────────────────────────────────────

function commentsRef(postId) {
  return collection(db, POSTS, postId, 'comments');
}

export function subscribeToComments(postId, callback) {
  const q = query(commentsRef(postId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addComment(postId, { authorUid, authorName, content }) {
  await addDoc(commentsRef(postId), {
    authorUid,
    authorName,
    content: content.trim(),
    createdAt: Timestamp.now(),
  });
  // Keep a comment count on the post for display without loading subcollection
  const postRef = doc(db, POSTS, postId);
  const snap = await getDocs(commentsRef(postId));
  await updateDoc(postRef, { commentCount: snap.size });
}

export async function deleteComment(postId, commentId) {
  await deleteDoc(doc(db, POSTS, postId, 'comments', commentId));
  const postRef = doc(db, POSTS, postId);
  const snap = await getDocs(commentsRef(postId));
  await updateDoc(postRef, { commentCount: snap.size });
}
