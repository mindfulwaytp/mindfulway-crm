import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAt7ySEDdtn2ZQ7CA7nNSEVut3tur1aiJw",
  authDomain: "mindfulway-crm.firebaseapp.com",
  projectId: "mindfulway-crm",
  storageBucket: "mindfulway-crm.firebasestorage.app",
  messagingSenderId: "24488895720",
  appId: "1:24488895720:web:21a40ecf71d4c3f670d55d",
  measurementId: "G-H4SK9MP03L"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);