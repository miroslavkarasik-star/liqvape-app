import requests

PB_URL = "http://127.0.0.1:8090"

print("🔧 Создаём недостающую таблицу user_requests...")
print()

email = input(" Email администратора: ")
password = input("🔑 Пароль: ")
print()

# Авторизация
resp = requests.post(f"{PB_URL}/api/admins/auth-with-password", 
    json={"identity": email, "password": password})
token = resp.json()['token']
headers = {"Authorization": f"Bearer {token}"}

# Создаём user_requests с правильным maxSize для JSON (5 МБ)
col = {
    "name": "user_requests",
    "type": "base",
    "schema": [
        {"name": "items", "type": "json", "required": True, "options": {"maxSize": 5000000}},
        {"name": "total_price", "type": "number", "required": True},
        {"name": "status", "type": "text", "required": True},
        {"name": "username", "type": "text", "required": False}
    ]
}

resp = requests.post(f"{PB_URL}/api/collections", headers=headers, json=col)

if resp.status_code == 200:
    print("✅ user_requests создана успешно!")
else:
    print(f"❌ Ошибка: {resp.text}")

print("\n🎉 Теперь все 3 таблицы готовы!")
