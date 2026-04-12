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
  // 1. Check for existing user doc
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const data = userSnap.data();
    // Normalize legacy single-role docs
    if (data.role && !data.roles) {
      return { ...data, roles: [data.role] };
    }
    return data;
  }

  // 2. Check if this email matches a provider's email field
  const providersSnap = await getDocs(collection(db, 'providers'));
  const matchingProvider = providersSnap.docs.find(
    (d) => d.data().email === email
  );
  if (matchingProvider) {
    const providerData = matchingProvider.data();
    // Use roles from the provider profile if set, otherwise default to ['provider']
    const roles = Array.isArray(providerData.roles) && providerData.roles.length > 0
      ? providerData.roles
      : ['provider'];
    const userData = { email, roles, providerName: matchingProvider.id };
    await setDoc(userRef, userData);
    return userData;
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
