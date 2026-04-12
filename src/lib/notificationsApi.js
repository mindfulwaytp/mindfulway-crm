import {
  collection, addDoc, getDocs, query, where, doc, updateDoc, writeBatch, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export async function createNotification({ recipientProviderName, type, message, relatedId = null, createdByName = '' }) {
  return addDoc(collection(db, 'notifications'), {
    recipientProviderName,
    type,
    message,
    relatedId,
    createdByName,
    read: false,
    createdAt: Timestamp.now(),
  });
}

export async function fetchNotifications(recipientProviderName) {
  if (!recipientProviderName) return [];
  const snap = await getDocs(query(
    collection(db, 'notifications'),
    where('recipientProviderName', '==', recipientProviderName),
  ));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export async function markNotificationRead(id) {
  await updateDoc(doc(db, 'notifications', id), { read: true });
}

export async function markAllNotificationsRead(notifications) {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true }));
  await batch.commit();
}
