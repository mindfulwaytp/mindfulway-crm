import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBOLtG1Z-WMuhpYZomhFZ1TlOXAwKL857c",
  authDomain: "mwcrm-5970d.firebaseapp.com",
  projectId: "mwcrm-5970d",
  storageBucket: "mwcrm-5970d.firebasestorage.app",
  messagingSenderId: "849006395579",
  appId: "1:849006395579:web:cd9359d628cebd42e1e99e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Restrict sign-in to @mindfulway-therapy.com accounts
googleProvider.setCustomParameters({ hd: 'mindfulway-therapy.com' });