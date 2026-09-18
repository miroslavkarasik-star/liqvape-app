import PocketBase from 'pocketbase';

const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';
export const pb = new PocketBase(pbUrl);

// Получить ссылку на картинку
export function getImageUrl(record: any, fieldName: string, size = '400x0') {
  if (!record || !record[fieldName]) return '/placeholder.jpg';
  return pb.files.getUrl(record, record[fieldName], { thumb: size });
}

// Получить все видимые товары
export async function getProducts() {
  const records = await pb.collection('products').getFullList({
    sort: '-created',
    filter: 'is_hidden = false',
  });
  return records;
}

// Создать новый заказ
export async function createOrder(items: any[], totalPrice: number, username: string) {
  const data = {
    items: JSON.stringify(items),
    total_price: totalPrice,
    username: username,
    status: 'new',
  };
  return await pb.collection('user_requests').create(data);
}

// 📸 Загрузка картинки для товара
export async function uploadProductImage(productId: string, file: File) {
  const formData = new FormData();
  formData.append('image', file);
  
  // Обновляем запись с файлом
  const updatedRecord = await pb.collection('products').update(productId, formData);
  
  // Возвращаем полную ссылку
  return pb.files.getUrl(updatedRecord, updatedRecord.image);
}
