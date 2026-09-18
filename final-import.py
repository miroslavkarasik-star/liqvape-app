import requests
import json

PB_URL = "http://127.0.0.1:8090"

print("🚀 Финальный импорт товаров...")

email = "miroslavkarasik@gmail.com"
password = "lypolinaA2"

resp = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={"identity": email, "password": password})
token = resp.json()['token']
headers = {"Authorization": f"Bearer {token}"}

with open('products.json', 'r', encoding='utf-8') as f:
    products = json.load(f)

success_count = 0
skip_count = 0

print(f"📦 Всего товаров для проверки: {len(products)}")

for item in products:
    payload = {k: v for k, v in item.items() if k != 'id'}
    
    # Гарантируем, что числовые поля в правильном формате
    if 'stock_quantity' in payload:
        try:
            payload['stock_quantity'] = int(float(str(payload['stock_quantity']).strip() or 0))
        except (ValueError, TypeError):
            payload['stock_quantity'] = 0
            
    if 'price' in payload:
        try:
            payload['price'] = float(str(payload['price']).strip() or 0)
        except (ValueError, TypeError):
            payload['price'] = 0

    resp = requests.post(f"{PB_URL}/api/collections/products/records", headers=headers, json=payload)
    
    if resp.status_code in [200, 201]:
        success_count += 1
    else:
        skip_count += 1

print(f"\n✅ Успешно импортировано/обновлено: {success_count}")
if skip_count > 0:
    print(f"⚠️ Пропущено (возможно, дубликаты или другие ошибки): {skip_count}")
print("🎉 Готово!")
