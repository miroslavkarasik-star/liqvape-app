'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="glass-panel p-6 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold mb-4 gradient-text">Что-то пошло не так</h2>
        <p className="text-gray-400 mb-6">
          Произошла ошибка при загрузке приложения. Попробуйте обновить страницу.
        </p>
        <button
          onClick={reset}
          className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white"
        >
          Попробовать снова
        </button>
      </div>
    </div>
  );
}
