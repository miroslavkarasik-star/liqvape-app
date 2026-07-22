import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCw20afz6hEA2O7-Ix7tCuwuX_9JKpybA0",
  authDomain: "liqvape-shop.firebaseapp.com",
  projectId: "liqvape-shop",
  storageBucket: "liqvape-shop.firebasestorage.app",
  messagingSenderId: "311670552537",
  appId: "1:311670552537:web:4cbbec3994704adb64cbc8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
