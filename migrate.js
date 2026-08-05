const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aatluurwhgrqvjwdnyzg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhdGx1dXJ3aGdycXZqd2RueXpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5Mzg2MzcsImV4cCI6MjA5NjUxNDYzN30.fbYSEG0Ou8d9ayz04Yz3Pz4sgaP1ZVDQg3l_Y_XlUaI';
const supabase = createClient(supabaseUrl, supabaseKey);

const firebaseApiKey = 'AIzaSyCw20afz6hEA2O7-Ix7tCuwuX_9JKpybA0';
const projectId = 'liqvape-shop';
const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products?key=${firebaseApiKey}`;

function parseFlavors(flavors) {
  if (!flavors) return [];
  if (Array.isArray(flavors)) {
    return flavors.map(f => ({ mapValue: { fields: { 
      name: { stringValue: String(f.name || f) }, 
      stock: { integerValue: Number(f.stock) || 0 }, 
      price: { doubleValue: Number(f.price) || 0 } 
    }}}));
  }
  try {
    const parsed = JSON.parse(flavors);
    if (Array.isArray(parsed)) {
      return parsed.map(f => ({ mapValue: { fields: { 
        name: { stringValue: String(f.name || f) }, 
        stock: { integerValue: Number(f.stock) || 0 }, 
        price: { doubleValue: Number(f.price) || 0 } 
      }}}));
    }
  } catch (e) {}
  return [];
}

async function migrate() {
  console.log('🚀 Загрузка товаров из старой базы...');
  const { data, error } = await supabase.from('products').select('*');
  
  if (error) {
    console.error('❌ Ошибка Supabase:', error.message);
    console.log('⚠️ Возможно, старая база полностью заблокирована. Проверь оплату или лимиты в панели Supabase.');
    return;
  }
  
  console.log(`✅ Найдено ${data.length} товаров. Начинаем перенос...`);
  
  let successCount = 0;
  for (const product of data) {
    try {
      const firestoreData = {
        fields: {
          name: { stringValue: product.name || '' },
          price: { doubleValue: Number(product.price) || 0 },
          category: { stringValue: product.category || 'Другое' },
          image_url: { stringValue: product.image_url || '' },
          flavors: { arrayValue: { values: parseFlavors(product.flavors) } },
          stock_quantity: { integerValue: product.stock_quantity || 0 },
          is_hidden: { booleanValue: Boolean(product.is_hidden) },
          is_preorder: { booleanValue: Boolean(product.is_preorder) },
          created_at: { stringValue: product.created_at || new Date().toISOString() }
        }
      };

      const response = await fetch(firestoreUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firestoreData)
      });

      if (response.ok) {
        successCount++;
        console.log(`✅ Перенесён: ${product.name}`);
      } else {
        const errText = await response.text();
        console.error(`❌ Ошибка для ${product.name}:`, errText);
      }
    } catch (e) {
      console.error(`❌ Сбой при переносе ${product.name}:`, e.message);
    }
  }
  
  console.log(`\n🎉 Перенос завершён! Успешно: ${successCount} из ${data.length}`);
}

migrate();
