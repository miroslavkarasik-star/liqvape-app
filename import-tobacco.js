const https = require('https');

const firebaseApiKey = 'AIzaSyCw20afz6hEA2O7-Ix7tCuwuX_9JKpybA0';
const projectId = 'liqvape-shop';
const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products?key=${firebaseApiKey}`;

// Данные из таблицы (распарсено вручную из JSON)
const products = [
  {
    name: "Бестабачка - BRUSKO 50 г (Medium)",
    category: "Табак-угли",
    price: 0,
    is_preorder: true,
    variants: ["Абрикос","Ананас с помело и личи","Ананас","Апельсин с мятой","Арбуз с киви и клубникой","Банан","Банановый пирог","Бельгийские вафли","Бузина","Виноград","Вишневая кола","Вишневый лимонад","Гранат","Грейпфрут с малиной","Дыня с кокосом и карамелью","Имбирный лимонад","Инжирное варенье","Кактусовый финик","Капучино","Киви с лимоном","Клубничный джем","Клюква","Кокос со льдом","Красный виноград и черная смородина со льдом","Куба либре","Ледяная смородина","Ледяной арбуз","Лимон с мелиссой","Лимонный пирог","Личи со льдом","Малина","Манго с апельсином и мятой","Манго с маракуйя","Манго со льдом","Маракуйя","Мохито","Мультифрукт","Мята","Начос","Огуречный лимонад","Ореховое печенье","Папайя","Персик с бананом и клубникой","Печенье с бананом","Пина колада","Сибирский лимонад","Сливочная карамель","Смузи из маракуйи и малины","Смузи из яблока и киви","Тархун","Тропический смузи","Фейхоа с ягодами и маракуйей","Фейхоа","Фруктовое драже","Холодный персиковый чай","Холодок","Цитрусовый чай","Чай Пуэр","Черника с мятой","Чизкейк","Шоколад с мятой","Энергетик с манго","Энергетик","Яблоко с мятой","Яблочный штрудель","Ягодная хвоя","Ягодные леденцы","Ягодный морс"]
  },
  {
    name: "Табак - MUST HAVE Undeecoal 25 г",
    category: "Табак-угли",
    price: 0,
    is_preorder: true,
    variants: ["Вишневый сок","Яблочные леденцы","Ягодный коктейль"]
  },
  {
    name: "Табак - MUST HAVE 125 г (Medium)",
    category: "Табак-угли",
    price: 0,
    is_preorder: true,
    variants: ["Pinkman (розовые фрукты и ягоды)","Raspberry (малина)","Lemon-Lime (лимон и лайм)","Strawberry-Lychee (земляника и личи)","Mango Sling (манго слинг)","Forest Berries (лесные ягоды)","Black Currant (чёрная смородина)","Nord Star (вишня)","Melonade (арбуз и дыня)","Mad Pear (груша)","Cherry-Cola (вишня и кола)","Banana Mama (банан)","Orange Team (апельсин и мандарин)","Blackberry (ежевика)","Kiwi Smoothie (киви)","Marula (марула)","Blueberry (черника)","Berry Holls (ягодные леденцы)","Morocco (цитрусовый чай)","Milky Rice (молочная рисовая каша)","Estragon (эстрагон)","Coconut Shake (кокос)","Grapefruit (грейпфрут)","Apple Drops (яблочные конфеты)","Space Flavour (манго, маракуйя, личи, роза)","Ruby Grape (рубиновый виноград)","Cranberry (клюква)","Frosty (охлаждающий)","Sea Buckthorn Tea (облепиховый чай)","Quince (айва)","Baikal (лесные травы и хвоя)","Red Bomb (гранат)","Tropic Juice (тропические фрукты)","Pineapple Rings (ананасовые кольца)","Candy Cow (карамель и сгущёнка)","Feijoa (фейхоа)","Fizzy Dizzy (шампанское и барбарис)","Honey Holls (медовые леденцы)","Lemon Pie (лимонный пирог)","Paradise (банан, кокос, карамель)","Sweet Peach (сладкий персик)","Cola (Кола)","Cucunade (огуречный лимонад)","Ice Cream (мороженое)","Ice Mint (освежающая мята)","Caribbean Rum (ром)","Araram (чернослив, арбуз, виноград)","Citrus Spritz (цитрусовый коктейль)","Earl Grey (чай)","Gooseberry (крыжовник)","Holland Pie (Голландский пирог)","Mandarin (мандарин)","Rocketman (клубника, киви, грейпфрут)","Watermelon (арбуз)","Tipsy (ягодный коктейль)","Green Fizz (кактус, киви, абсент)","Jumango (манго, малина, мёд)","Pearl Pool (тропические фрукты и моринга)","Strawberry (садовая клубника)","Prosecco (игристое полусухое вино)","Alova (алоэ и розовая гуава)","Berry Mors (брусника, черешня, малина)","Elderberry (бузина)","Lemongrass (лемонграсс и лайм)","Milk Oolong (Молочный Улун)","Pineapple Rings (ананасовые кольца)","Sweet Melon (сладкая дыня)","Unicorn Treats (кукурузные палочки и безе)","Cacao (какао и маршмеллоу)","Cinnamon ROLL (булочка с корицей)","Garnet Grape (гранат и виноград)","Cream Soda (сливочный напиток)","Guanapapa (гуанабана и папайя)","Passion Plum (слива и маракуйя)","Red Tea (красный фруктовый чай)","Lemon Tonic (лимонный тоник)","Yolka (хвоя)","Cherry Juice (вишневый сок)"]
  },
  {
    name: "Табак - Darkside Shot 120 г (Medium)",
    category: "Табак-угли",
    price: 0,
    is_preorder: true,
    variants: ["Алтайский (Хвоя / Фейхоа / Эвкалипт)","Амурский (Арбуз / Малина / Смородина)","Донской (Нуга / Дыня / Лимон)","Карельский (Черника / Земляника / Малина)","Каспийский (Личи / Малина / Кола)","Крымский (Дыня / Персик / Виноград)","Курильский (Яблоко / Маракуйя / Манго)","Невский (Энергетик / Виноград / Лайм)","Столичный (Клюква / Земляника / Лайм)","Таежный (Лемонграсс / Фейхоа / Эвкалипт)","Центральный (Виноград / Лайм / Клюква)","Южный (Груша / Манго / Мята)"]
  },
  {
    name: "Табак - Darkside Core 100 г (Medium)",
    category: "Табак-угли",
    price: 0,
    is_preorder: true,
    variants: ["Овсяная каша с ягодами","Банан","Апельсин - лимон - грейпфрут","Апельсиновый сок","Базилик","Бузина","Бергамот","Чёрная смородина","Сицилийский апельсин","Черника","Кокос","Гранат","Вишнёвые леденцы","Черника - сирень","Клюква - ликёр","Белый виноград","Киви","Мороженное с шоколадом","Кола - лимон","Зелёный чай - жасмин","Манго - маракуйя","Малина","Виноград","Зелёное яблоко","Грейпфрут","Сгущёное молоко","Лимон","Манго","Хвоя","Клюквенный морс","Груша","Ананас","Помело","Арбуз - дыня - сок","Красная смородина","Красный чай","Клубничный джем","Клубника","Ментол","Клюква - банан","Дыня","Кокос - ананас - тропические фрукты","Персик","Вафли - лимон","Лесные ягоды","Земляника - лесные ягоды"]
  },
  {
    name: "Табак - Black Burn 100 г (Medium)",
    category: "Табак-угли",
    price: 0,
    is_preorder: true,
    variants: ["After 8","Almond Ice Cream","Ananas Shock","Apple Shock","Asian Lychee","Barberry Shock","Berry Lemonade","Black Honey","Bubblegum","Cherry Garden","Cherry Shock","Chupa Graper","Cranberry Shock","Ekzo Mango","Elderberry Shock","Elka","Epic Yogurt","Etalon Melon","Famous Apple","Garnet","Grapefruit","Green Tea","Haribon","Ice Baby","Iceberg","Irich Cream","It's Not Black Currant","Juicy Smoothie","Kiwi Stoner","Lemon Shock","Lemon Sweets","Lulo","Malibu","Melon Halls","Mirinda","Overdose","Papaya V Obed","Peachberry","Peach Killer","Peach Yogurt","Peal P.F.","Pear Lemonade","Pinacolada","Pineapple","Pineapple Yogurt","Pistachio Ice Snow","Pomelo","Raspberries","Raspberry Shock","Red Energy","Red Kiwi","Red Orange","Rising Star","Salak","Shock, Currant Shock","Siberian Soda","Skittles","Something Berry","Something Sweet","Something Tropical","Sou-Sep","Strawberry Coconut","Strawberry Jam","Summer Basket","Sundaysun","Tik Tak","Tropic Jack","Watermelon"]
  },
  {
    name: "Кокосовый уголь",
    category: "Табак-угли",
    price: 0,
    is_preorder: true,
    variants: ["BigMaks 25мм (111гр./ 8 куб.)","BigMaks 25мм (222гр./ 16 куб.)","BigMaks GO 25мм (1кг)","BigMaks GO \"Пейджер\" 12 куб., 25мм","IZZY COCO HORECA 72 куб (упаковка)","IZZY BADGE HORECA 72 куб (упаковка)","CHAMELEON 72 куб (упаковка)","DUFT 72 куб (упаковка)","COCOLOCO 12 куб (упаковка)","COCOLOCO 72 куб (упаковка)"]
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
            price: { doubleValue: 0 }
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
        console.log(`✅ ${product.name} (${product.variants.length} вкусов)`);
      } else {
        failed++;
        console.error(`❌ ${product.name}: ${response.status} - ${response.data}`);
      }
      
      // Небольшая задержка чтобы не спамить API
      await new Promise(r => setTimeout(r, 200));
      
    } catch (e) {
      failed++;
      console.error(`❌ ${product.name}: ${e.message}`);
    }
  }
  
  console.log(`\n🎉 Готово! Успешно: ${success}, Ошибок: ${failed}`);
}

importProducts();
