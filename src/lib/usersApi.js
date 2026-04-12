import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';

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
  const providersSnap = await getDocs(collection(db, 'providers'));
  const matchingProvider = providersSnap.docs.find(
    (d) => d.data().email === email
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
      await setDoc(userRef, userData, { merge: true });
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
  if (adminConfigSnap.exists() && adminConfigSnap.data().emails?.includes(email)) {
    const userData = { email, roles: ['admin'], providerName: null };
    await setDoc(userRef, userData);
    return userData;
  }

  // 4. No access
  return null;
}
