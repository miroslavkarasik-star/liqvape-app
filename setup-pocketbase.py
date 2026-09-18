import requests
import json

PB_URL = "http://127.0.0.1:8090"

print("🔧 Настройка PocketBase...")
print()

# Данные админа
email = input(" Email администратора: ")
password = input("🔑 Пароль: ")
print()

# 1. Авторизация
print("🔑 Авторизация...")
try:
    resp = requests.post(f"{PB_URL}/api/admins/auth-with-password", 
        json={"identity": email, "password": password})
    resp.raise_for_status()
    token = resp.json()['token']
    print("✅ Успешно!")
except Exception as e:
    print(f"❌ Ошибка: {e}")
    print("Проверь email и пароль")
    exit(1)

headers = {"Authorization": f"Bearer {token}"}

# 2. Создание коллекций
collections = [
    {
        "name": "products",
        "type": "base",
        "fields": [
            {"name": "name", "type": "text", "required": True},
            {"name": "category", "type": "text", "required": True},
            {"name": "price", "type": "number", "required": True},
            {"name": "image_url", "type": "text", "required": False},
            {"name": "stock_quantity", "type": "number", "required": True},
            {"name": "flavors", "type": "text", "required": False},
            {"name": "is_hidden", "type": "bool", "required": False},
            {"name": "is_preorder", "type": "bool", "required": False}
        ]
    },
    {
        "name": "user_requests",
        "type": "base",
        "fields": [
            {"name": "items", "type": "json", "required": True},
            {"name": "total_price", "type": "number", "required": True},
            {"name": "status", "type": "text", "required": True},
            {"name": "username", "type": "text", "required": False}
        ]
    },
    {
        "name": "user_profiles",
        "type": "base",
        "fields": [
            {"name": "username", "type": "text", "required": True},
            {"name": "user_id", "type": "text", "required": True}
        ]
    }
]

print("📦 Создаю таблицы...")
for col in collections:
    try:
        resp = requests.post(f"{PB_URL}/api/collections", 
            headers=headers, json=col)
        if resp.status_code == 200:
            print(f"  ✅ {col['name']}")
        else:
            print(f"  ⚠️  {col['name']}: {resp.json().get('message', 'ошибка')}")
    except Exception as e:
        print(f"  ❌ {col['name']}: {e}")

print()
print("🎉 Готово! Открой http://127.0.0.1:8090/_/ чтобы проверить")
