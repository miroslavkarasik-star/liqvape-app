import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = body.userId;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const channelUsername = process.env.CHANNEL_USERNAME;

    if (!botToken || !channelUsername) {
      console.error('Missing TELEGRAM_BOT_TOKEN or CHANNEL_USERNAME');
      return NextResponse.json({ subscribed: false, error: 'Server config missing' });
    }

    if (!userId) {
      return NextResponse.json({ subscribed: false, error: 'No userId provided' });
    }

    // Запрос к Telegram API для проверки статуса участника
    const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=@${channelUsername}&user_id=${userId}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram API Error:', data.description);
      return NextResponse.json({ subscribed: false });
    }

    const status = data.result.status;
    // member, administrator, creator - подписан
    const subscribed = ['member', 'administrator', 'creator'].includes(status);

    return NextResponse.json({ subscribed, status });
  } catch (error) {
    console.error('Subscription check failed:', error);
    return NextResponse.json({ subscribed: false, error: 'Internal server error' });
  }
}