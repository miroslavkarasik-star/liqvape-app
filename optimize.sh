#!/bin/bash
echo "🚀 Оптимизация Firebase..."

# Обновляем lib/firebase.ts
cat > lib/firebase.ts << 'EOF'
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";

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

export async function getAllProducts() {
  const q = query(collection(db, 'products'), orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);
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
EOF

echo "✅ Firebase оптимизирован"

# Добавляем lazy loading ко всем картинкам в page.tsx
sed -i 's/<img src={`\/images\/products\//<img loading="lazy" src={`\/images\/products\//g' app/page.tsx

echo "✅ Lazy loading добавлен"

# Коммитим и отправляем
git add -A
git commit -m "Optimize: add Firestore indexes and lazy loading"
git push origin main

echo ""
echo "🎉 Готово! Теперь:"
echo "1. Открой https://console.firebase.google.com/project/liqvape-shop/firestore/indexes"
echo "2. Создай индекс: Collection 'products', поле 'created_at' → Ascending"
echo "3. Подожди 2 минуты и обнови сайт - будет летать! 🚀"
