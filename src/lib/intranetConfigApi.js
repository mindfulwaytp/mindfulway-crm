import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const RESOURCES = 'intranet_resources';
const LINKS = 'intranet_links';

export function subscribeToResourceFolders(callback, onError) {
  const q = query(collection(db, RESOURCES), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

export async function addResourceFolder({ folderUrl, folderName, createdByUid, createdByName }) {
  return addDoc(collection(db, RESOURCES), {
    folderUrl,
    folderName,
    createdAt: serverTimestamp(),
    createdByUid,
    createdByName,
  });
}

export async function updateResourceFolder(id, { folderUrl, folderName }) {
  return updateDoc(doc(db, RESOURCES, id), { folderUrl, folderName });
}

export async function deleteResourceFolder(id) {
  return deleteDoc(doc(db, RESOURCES, id));
}

// ── Website links ────────────────────────────────────────────────────────────

export function subscribeToWebsiteLinks(callback, onError) {
  const q = query(collection(db, LINKS), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

export async function addWebsiteLink({ url, name, description, createdByUid, createdByName }) {
  return addDoc(collection(db, LINKS), {
    url,
    name,
    description: description || '',
    createdAt: serverTimestamp(),
    createdByUid,
    createdByName,
  });
}

export async function updateWebsiteLink(id, { url, name, description }) {
  return updateDoc(doc(db, LINKS, id), {
    url,
    name,
    description: description || '',
  });
}

export async function deleteWebsiteLink(id) {
  return deleteDoc(doc(db, LINKS, id));
}
