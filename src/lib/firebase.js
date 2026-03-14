import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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