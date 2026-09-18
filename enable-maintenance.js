const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

const maintenanceCheck = `
  const maintenanceUntil = new Date('2026-09-20T23:59:59');
  const isMaintenance = new Date() < maintenanceUntil;

  if (isMaintenance) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center animate-pulse">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </div>
        <h1 className="text-3xl font-bold mb-4 gradient-text">Технические работы</h1>
        <p className="text-gray-400 mb-2 max-w-md">Мы обновляем систему и переносим базу данных, чтобы всё работало идеально.</p>
        <p className="text-sm text-orange-400 font-medium">Ориентировочное окончание: 20 сентября</p>
      </div>
    );
  }
`;

// Вставляем проверку сразу после начала функции Home
content = content.replace(
  /export default function Home\(\) \{/,
  `export default function Home() {${maintenanceCheck}`
);

fs.writeFileSync('app/page.tsx', content);
console.log('✅ Заглушка до 20 сентября добавлена!');
