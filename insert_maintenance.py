with open('maintenance_block.tsx', 'r', encoding='utf-8') as f:
    maintenance_code = f.read()

with open('app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Находим строку и вставляем после неё
target = "export default function Home() {\n"
if target in content:
    content = content.replace(target, target + maintenance_code + "\n", 1)
    with open('app/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Заглушка добавлена!")
else:
    print("❌ Не найдена точка вставки")
