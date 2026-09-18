import requests
import json

PB_URL = "http://127.0.0.1:8090"

print("🚀 Импорт данных в PocketBase (с исправлением типов)...")

email = input("Email администратора PocketBase: ")
password = input("Пароль: ")

# 1. Авторизация
print("\n🔑 Авторизация...")
resp = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={"identity": email, "password": password})
if resp.status_code != 200:
    print("❌ Ошибка входа! Проверь email и пароль.")
    exit(1)

token = resp.json()['token']
headers = {"Authorization": f"Bearer {token}"}
print("✅ Успешно!")

# 2. Настройка файлов
files_to_import = {
    "products": "products.json",
    "user_requests": "user_requests.json",
    "user_profiles": "user_profiles.json"
}

# 3. Импорт
for col_name, filename in files_to_import.items():
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"\n📦 Импортируем '{col_name}' ({len(data)} записей)...")
        success_count = 0
        
        for item in data:
            payload = {k: v for k, v in item.items() if k != 'id'}
            
            # === ИСПРАВЛЕНИЕ ДАННЫХ ДЛЯ POCKETBASE ===
            if col_name == "products":
                # Чиним stock_quantity: если пусто или текст, делаем числом 0
                if payload.get('stock_quantity') is None or str(payload.get('stock_quantity')).strip() == '':
                    payload['stock_quantity'] = 0
                else:
                    try:
                        payload['stock_quantity'] = int(float(payload['stock_quantity']))
                    except (ValueError, TypeError):
                        payload['stock_quantity'] = 0
                
                # Чиним price на всякий случай
                if payload.get('price') is None or str(payload.get('price')).strip() == '':
                    payload['price'] = 0
                else:
                    try:
                        payload['price'] = float(payload['price'])
                    except (ValueError, TypeError):
                        payload['price'] = 0
            # ==========================================
            
            resp = requests.post(f"{PB_URL}/api/collections/{col_name}/records", headers=headers, json=payload)
            
            if resp.status_code in [200, 201]:
                success_count += 1
            elif resp.status_code == 400:
                # Если всё равно ошибка, выводим имя товара для диагностики
                item_name = payload.get('name', 'Без имени')
                print(f"  ⚠️ Пропущен: '{item_name}' -> {resp.text[:150]}")
            else:
                print(f"  ⚠️ Ошибка: {resp.text[:100]}")
        
        print(f"✅ Успешно импортировано: {success_count} из {len(data)}")
        
    except FileNotFoundError:
        print(f"❌ Файл {filename} не найден в папке!")
    except Exception as e:
        print(f"❌ Ошибка при обработке {filename}: {e}")

print("\n🎉 Импорт завершен! Проверь данные в админке PocketBase.")
