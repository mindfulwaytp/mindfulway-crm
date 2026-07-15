import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export const EMPTY_INTERN_REQUIREMENTS = {
  supervisorName: '',
  startDate: '',
  endDate: '', // applies to interns only
  totalHoursRequired: 0,
  directContactHoursRequired: 0,
  supervisionHoursRequired: 0,
  groupTherapyHoursRequired: 0,
  relationalTherapyHoursRequired: 0, // 0 = not applicable
  adminHoursRequired: 0,
  // Hour types that ALSO count toward the Direct Contact requirement for this
  // person, e.g. ['group_therapy', 'relational_therapy']. Credited hours are not
  // double-counted in the total. See progressByType() in hourEntriesApi.
  directCreditTypes: [],
};

export async function fetchInternProfile(providerName) {
  const snap = await getDoc(doc(db, 'internProfiles', providerName));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchAllInternProfiles() {
  const snap = await getDocs(collection(db, 'internProfiles'));
  const result = {};
  snap.docs.forEach((d) => { result[d.id] = d.data(); });
  return result;
}

export async function upsertInternProfile(providerName, data) {
  await setDoc(doc(db, 'internProfiles', providerName), data, { merge: true });
}
