const https = require('https');

const firebaseApiKey = 'AIzaSyCw20afz6hEA2O7-Ix7tCuwuX_9JKpybA0';
const projectId = 'liqvape-shop';
const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products?key=${firebaseApiKey}`;

const products = [
  {
    name: "ELFX Pod",
    category: "POD-системы",
    price: 58,
    is_preorder: false,
    variants: ["Black", "Blue", "Gray", "Purple", "Silver", "Pink"]
  },
  {
    name: "ELFX ULTRA",
    category: "POD-системы",
    price: 90,
    is_preorder: false,
    variants: ["Black", "Blue", "Green", "Grey", "Greyline", "Pink"]
  },
  {
    name: "ELFX MINI",
    category: "POD-системы",
    price: 50,
    is_preorder: false,
    variants: ["Золотой", "Небесный", "Океан", "Розовый", "Серебристый", "Серый", "Сиреневый", "Черный"]
  },
  {
    name: "ELFX PRO Pod",
    category: "POD-системы",
    price: 78,
    is_preorder: false,
    variants: ["Black", "Blue", "Gray", "Purple", "Silver", "Pink"]
  }
];

async function importProducts() {
  console.log(`🚀 Начинаем импорт ${products.length} POD-систем...`);
  
  let success = 0;
  let failed = 0;
  
  for (const product of products) {
    try {
      const flavors = product.variants.map(v => ({
        mapValue: {
          fields: {
            name: { stringValue: v },
            stock: { integerValue: 0 },
            price: { doubleValue: product.price }
          }
        }
      }));
      
      const firestoreData = {
        fields: {
          name: { stringValue: product.name },
          price: { doubleValue: product.price },
          category: { stringValue: product.category },
          image_url: { stringValue: "" },
          flavors: { arrayValue: { values: flavors } },
          stock_quantity: { integerValue: 0 },
          is_hidden: { booleanValue: false },
          is_preorder: { booleanValue: product.is_preorder },
          created_at: { stringValue: new Date().toISOString() }
        }
      };

      const response = await new Promise((resolve, reject) => {
        const url = new URL(firestoreUrl);
        const options = {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        };
        
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.write(JSON.stringify(firestoreData));
        req.end();
      });

      if (response.status === 200) {
        success++;
        console.log(`✅ ${product.name} - ${product.price} BYN (${product.variants.length} цветов)`);
      } else {
        failed++;
        console.error(`❌ ${product.name}: ${response.status} - ${response.data}`);
      }
      
      await new Promise(r => setTimeout(r, 200));
      
    } catch (e) {
      failed++;
      console.error(`❌ ${product.name}: ${e.message}`);
    }
  }
  
  console.log(`\n🎉 Готово! Успешно: ${success}, Ошибок: ${failed}`);
}

importProducts();
