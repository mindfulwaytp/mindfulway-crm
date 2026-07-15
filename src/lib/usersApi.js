import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';

/** Email addresses are case-insensitive in practice; compare them normalized. */
function normalizeEmail(e) {
  return (e || '').trim().toLowerCase();
}

/**
 * Resolves roles for a signed-in user.
 * Returns { email, roles: [], providerName } or null if no access.
 *
 * Legacy docs with { role: string } are normalized to { roles: [string] }.
 */
export async function getOrCreateUserRole(uid, email) {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  const existing = userSnap.exists() ? userSnap.data() : null;

  // For users tied to a provider, always re-sync roles from the provider doc.
  // This way, role changes on the Providers page propagate on next sign-in
  // instead of being permanently cached at signup time.
  //
  // Match on a normalized email: the provider profile stores whatever casing/
  // whitespace was typed, but Google returns a canonical lowercase address, so
  // an exact === would spuriously reject a provider whose profile reads
  // "John.Smith@…" or has a stray trailing space.
  const target = normalizeEmail(email);
  const providersSnap = await getDocs(collection(db, 'providers'));
  const matchingProvider = providersSnap.docs.find(
    (d) => normalizeEmail(d.data().email) === target
  );
  if (matchingProvider) {
    const providerData = matchingProvider.data();
    const roles = Array.isArray(providerData.roles) && providerData.roles.length > 0
      ? providerData.roles
      : ['provider'];
    const userData = { email, roles, providerName: matchingProvider.id };
    const existingRoles = existing?.roles || (existing?.role ? [existing.role] : []);
    const rolesChanged =
      !existing ||
      existing.providerName !== matchingProvider.id ||
      existingRoles.length !== roles.length ||
      existingRoles.some((r) => !roles.includes(r));
    if (rolesChanged) {
      // The users doc is only a CACHE — roles are recomputed from the provider
      // doc on every sign-in. Non-admins can create this doc but the rules forbid
      // them updating it, so a re-sync write throws with "permission denied" for
      // any provider whose cached doc already exists and has drifted. That must
      // NOT block sign-in: fall back to the freshly computed roles in memory.
      try {
        await setDoc(userRef, userData, { merge: true });
      } catch (e) {
        console.warn('Could not persist role cache for', email, '- using live roles.', e);
      }
    }
    return userData;
  }

  // No matching provider — fall back to existing user doc if present
  if (existing) {
    if (existing.role && !existing.roles) {
      return { ...existing, roles: [existing.role] };
    }
    return existing;
  }

  // 3. Check config/admins for admin email list
  const adminConfigSnap = await getDoc(doc(db, 'config', 'admins'));
  const adminEmails = (adminConfigSnap.exists() ? adminConfigSnap.data().emails : []) || [];
  if (adminEmails.some((e) => normalizeEmail(e) === target)) {
    const userData = { email, roles: ['admin'], providerName: null };
    await setDoc(userRef, userData);
    return userData;
  }

  // 4. No access
  return null;
}
