export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <style jsx global>{`
        @keyframes gradient-shift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .lava-lamp { position: fixed; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden; z-index: 0; pointer-events: none; }
        .lava-blob { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.35; animation: float 25s infinite ease-in-out; }
        .lava-blob-1 { width: 500px; height: 500px; background: radial-gradient(circle, rgba(255, 94, 0, 0.6), transparent); top: -150px; left: -150px; }
        .lava-blob-2 { width: 450px; height: 450px; background: radial-gradient(circle, rgba(255, 20, 147, 0.6), transparent); bottom: -150px; right: -150px; animation-delay: -8s; }
        @keyframes float { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(80px, -80px) scale(1.1); } 66% { transform: translate(-60px, 60px) scale(0.9); } }
      `}</style>
      
      <div className="lava-lamp">
        <div className="lava-blob lava-blob-1"></div>
        <div className="lava-blob lava-blob-2"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gradient-to-br from-gray-900/95 to-black/95 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center animate-pulse shadow-lg shadow-orange-500/50">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
            Технические работы
          </h1>
          
          <div className="space-y-4 text-sm text-gray-300 mb-6">
            <p className="font-medium text-white">Сегодня обновляем наличие в приложении❗❗</p>
            <p>Плюсом, убираем косяки выявленные в ходе двухнедельной работы. Поэтому сегодня-завтра работаем через таблицу.</p>
            <p>Дабы не перегружать бота и у Вас всё работало исправно, на эти два дня вводим такой режим работы</p>
            <p className="text-orange-400 font-medium">Всё делается для оптимизации и улучшения пользования🙏</p>
          </div>

          <div className="space-y-3">
            <a href="https://docs.google.com/spreadsheets/d/1ABC123" target="_blank" rel="noopener noreferrer" className="block w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold text-lg shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all hover:scale-105">
              📊 Открыть PRICE
            </a>
            <a href="https://t.me/LiqVape_2" target="_blank" rel="noopener noreferrer" className="block w-full py-3 rounded-xl bg-white/10 border border-white/20 text-white font-medium hover:bg-white/20 transition-all">
              💬 Написать менеджеру
            </a>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-gray-500">🟢 Сроки: до 20.09.2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}
