export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="glass-panel p-6 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold mb-4 gradient-text">404 - Страница не найдена</h2>
        <p className="text-gray-400 mb-6">
          К сожалению, страница не найдена. Попробуйте обновить приложение.
        </p>
        <a
          href="/"
          className="inline-block w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white"
        >
          На главную
        </a>
      </div>
    </div>
  );
}
