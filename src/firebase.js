import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDmNdwP1xogWXf1189CJsFw7fA3RX1iAl4",
  authDomain: "invest-track-aviad.firebaseapp.com",
  projectId: "invest-track-aviad",
  storageBucket: "invest-track-aviad.firebasestorage.app",
  messagingSenderId: "749067956110",
  appId: "1:749067956110:web:81b9aa7d3ff8caa4893edf",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
