import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, limit, startAfter } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCw20afz6hEA2O7-Ix7tCuwuX_9JKpybA0",
  authDomain: "liqvape-shop.firebaseapp.com",
  projectId: "liqvape-shop",
  storageBucket: "liqvape-shop.firebasestorage.app",
  messagingSenderId: "311670552537",
  appId: "1:311670552537:web:4cbbec3994704adb64cbc8",
  measurementId: "G-0TRQ5Z3WPR"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Пагинация - грузим по 20 товаров
export async function getProductsPage(lastDoc?: any, pageSize = 20) {
  let q = query(collection(db, 'products'), orderBy('created_at', 'desc'), limit(pageSize));
  if (lastDoc) {
    q = query(collection(db, 'products'), orderBy('created_at', 'desc'), startAfter(lastDoc), limit(pageSize));
  }
  const snapshot = await getDocs(q);
  return {
    products: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
    hasMore: snapshot.docs.length === pageSize
  };
}

// Все товары (для админки)
export async function getAllProducts() {
  const snapshot = await getDocs(collection(db, 'products'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createProduct(data: any) {
  return await addDoc(collection(db, 'products'), { ...data, created_at: new Date().toISOString() });
}

export async function updateProduct(id: string, data: any) {
  return await updateDoc(doc(db, 'products', id), data);
}

export async function deleteProductRecord(id: string) {
  return await deleteDoc(doc(db, 'products', id));
}

export async function createOrder(data: any) {
  return await addDoc(collection(db, 'user_requests'), { ...data, created_at: new Date().toISOString() });
}

export async function getAllOrders() {
  const snapshot = await getDocs(collection(db, 'user_requests'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function deleteOrderRecord(id: string) {
  return await deleteDoc(doc(db, 'user_requests', id));
}
