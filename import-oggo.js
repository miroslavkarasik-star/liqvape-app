const https = require('https');

const firebaseApiKey = 'AIzaSyCw20afz6hEA2O7-Ix7tCuwuX_9JKpybA0';
const projectId = 'liqvape-shop';
const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products?key=${firebaseApiKey}`;

const products = [
  {
    name: "OGGO AQUA 30 мл (70 мг)",
    category: "Жидкости",
    price: 18,
    is_preorder: false,
    variants: [
      "RedBull с Лесными Ягодами",
      "Ананас Ежевика",
      "Ананасовый Лимонад со Льдом",
      "Апельсиновая Кола",
      "Арбуз с Ягодами",
      "Банан Лед",
      "Виноградный RedBull со Льдом",
      "Вишня Черника",
      "Двойное Яблоко Персик",
      "Дикие Ягоды",
      "Доктор Пеппер Черешня",
      "Жвачка Арбуз",
      "Жвачка Виноград",
      "Жвачка Ежевика",
      "Жвачка Смородина",
      "Кислая Fanta с Малиной",
      "Кислый Виноградный Микс",
      "Кислый Чупа Чупс",
      "Клубничный Мохито",
      "Кокос Ананас",
      "Малиновый Джем",
      "Мармеладные Червячки",
      "Морс из Диких Ягод",
      "Нектарин Вишня",
      "Тропический Микс",
      "Цитрусовый RedBull",
      "Черника Малина",
      "Черничный RedBull",
      "Ягодный Йогурт"
    ]
  },
  {
    name: "OGGO PREMIUM 30 мл (20 мг)",
    category: "Жидкости",
    price: 20,
    is_preorder: false,
    variants: [
      "Алое Клубника Киви",
      "Алоэ Виноград",
      "Апельсин Вишня",
      "Банан Манго",
      "Виноградная Содовая",
      "Вишневая Газировка Mountain Dew",
      "Земляничный Мохито",
      "Киви Ананас",
      "Киви Лимон Клюква",
      "Кислая Вишня",
      "Кислая Клюква Лимон",
      "Кислое Яблоко",
      "Кислые Ананас Малина",
      "Кислые Мармеладные Мишки",
      "Кислые Яблочные Конфеты",
      "Кислый Арбуз",
      "Кислый Виноградный Чупа Чупс",
      "Кислый Киви",
      "Кислый Мандарин Киви",
      "Кислый Скиттлс",
      "Клубника Банан",
      "Клубнично Арбузный Фреш",
      "Клюквенная Содовая",
      "Лайм Яблоко",
      "Лесной Морс",
      "Маракуйя Апелстн Гуава",
      "Мармеладные Червячки с Колой",
      "Мятная Жвачка",
      "Персик",
      "Персик Груша Дыня",
      "Пина Колада",
      "Сладкая Вишня",
      "Сладкий Манго",
      "Цитрусовый Микс",
      "Черника Мята",
      "Чернично Малиновый Лимонад",
      "Энергетик Киви Яблоко",
      "Энергетик Маракуйя",
      "Энергетик с Лесными Ягодами",
      "Ягодный Orbit"
    ]
  }
];

async function importProducts() {
  console.log(`🚀 Начинаем импорт ${products.length} товаров...`);
  
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
        console.log(`✅ ${product.name} - ${product.price} BYN (${product.variants.length} вкусов)`);
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
