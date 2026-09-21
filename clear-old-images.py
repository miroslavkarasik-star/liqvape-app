import requests

PB_URL = "http://127.0.0.1:8090"
email = "miroslavkarasik@gmail.com"
password = "lypolinaA2"

print("🧹 Очищаем старые картинки из базы...")

# Авторизация
resp = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={"identity": email, "password": password})
token = resp.json()['token']
headers = {"Authorization": f"Bearer {token}"}

# Получаем все товары
resp = requests.get(f"{PB_URL}/api/collections/products/records?perPage=500", headers=headers)
products = resp.json()['items']

print(f"📦 Найдено товаров: {len(products)}")

cleaned = 0
for product in products:
    # Если есть старая ссылка (начинается с http или это не просто имя файла)
    if product.get('image') and ('http' in product['image'] or '/' in product['image']):
        # Очищаем поле image
        resp = requests.patch(
            f"{PB_URL}/api/collections/products/records/{product['id']}",
            headers=headers,
            json={"image": ""}
        )
        if resp.status_code == 200:
            cleaned += 1
            print(f"  ✅ Очищен: {product['name']}")

print(f"\n🎉 Готово! Очищено товаров: {cleaned}")
print(" Теперь закинь PNG картинки в папку public/images/products/ и выбери их в админке")
