import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = {
  apiKey: "AIzaSyCw20afz6hEA2O7-Ix7tCuwuX_9JKpybA0",
  authDomain: "liqvape-shop.firebaseapp.com",
  projectId: "liqvape-shop",
  storageBucket: "liqvape-shop.firebasestorage.app",
  messagingSenderId: "311670552537",
  appId: "1:311670552537:web:4cbbec3994704adb64cbc8",
  measurementId: "G-0TRQ5Z3WPR"
};

// Названия коллекций в твоем Firebase (проверь в консоли Firestore)
const collectionsToExport = ["products", "user_requests", "user_profiles"];

console.log("🚀 Начинаем экспорт из Firebase...\n");

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

for (const colName of collectionsToExport) {
  try {
    console.log(`📥 Забираем коллекцию: ${colName}...`);
    const querySnapshot = await getDocs(collection(db, colName));
    
    const data = [];
    querySnapshot.forEach((doc) => {
      // Сохраняем ID документа и все его данные
      data.push({ id: doc.id, ...doc.data() });
    });

    fs.writeFileSync(`${colName}.json`, JSON.stringify(data, null, 2));
    console.log(`✅ Сохранено ${data.length} записей в ${colName}.json\n`);
  } catch (error) {
    console.error(`❌ Ошибка при экспорте ${colName}:`, error.message);
    console.log(`💡 Возможно, коллекция называется иначе или пуста.\n`);
  }
}

console.log("🎉 Экспорт завершен! Проверь папку на наличие .json файлов.");
