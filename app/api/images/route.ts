import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const imagesDir = path.join(process.cwd(), 'public', 'images', 'products');
    
    // Если папки нет, создаём
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    const files = fs.readdirSync(imagesDir);
    
    // Фильтруем только PNG (и можно добавить JPG/WebP)
    const images = files
      .filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp'))
      .map(f => ({
        name: f,
        url: `/images/products/${f}`
      }));
    
    return NextResponse.json(images);
  } catch (error) {
    console.error('Error reading images:', error);
    return NextResponse.json([]);
  }
}
