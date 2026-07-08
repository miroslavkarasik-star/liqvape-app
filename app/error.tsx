'use client';

import { useEffect, useState } from 'react';
import { Cloud, RefreshCw, MessageCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    console.error('Application error:', error);
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          reset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [error, reset]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Lava Lamp Background */}
      <div className="lava-lamp">
        <div className="lava-blob lava-blob-1"></div>
        <div className="lava-blob lava-blob-2"></div>
        <div className="lava-blob lava-blob-3"></div>
        <div className="lava-blob lava-blob-4"></div>
      </div>

      <style jsx>{`
        .lava-lamp {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          z-index: 0;
          pointer-events: none;
        }
        .lava-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.35;
          animation: float 25s infinite ease-in-out;
        }
        .lava-blob-1 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(255, 94, 0, 0.6), transparent);
          top: -150px;
          left: -150px;
        }
        .lava-blob-2 {
          width: 450px;
          height: 450px;
          background: radial-gradient(circle, rgba(255, 20, 147, 0.6), transparent);
          bottom: -150px;
          right: -150px;
          animation-delay: -8s;
        }
        .lava-blob-3 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(255, 140, 0, 0.5), transparent);
          top: 40%;
          left: 30%;
          animation-delay: -16s;
        }
        .lava-blob-4 {
          width: 350px;
          height: 350px;
          background: radial-gradient(circle, rgba(255, 94, 0, 0.4), transparent);
          top: 60%;
          right: 20%;
          animation-delay: -12s;
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(80px, -80px) scale(1.1); }
          66% { transform: translate(-60px, 60px) scale(0.9); }
        }
        .glass-panel {
          background: rgba(30, 30, 30, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 1.5rem;
        }
        .gradient-text {
          background: linear-gradient(135deg, #ff5e00, #ff1493);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      <div className="glass-panel p-6 max-w-sm w-full text-center relative z-10">
        {/* Logo */}
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow">
          <Cloud className="w-10 h-10 text-white" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold mb-2 gradient-text">Ooops!</h2>
        <p className="text-gray-400 text-sm mb-6">Что-то пошло не так</p>

        {/* Error Info */}
        <div className="glass-card p-3 mb-6 text-left">
          <p className="text-xs text-gray-400 mb-1">Ошибка:</p>
          <p className="text-xs text-orange-400 font-mono break-all">{error.message}</p>
        </div>

        {/* Auto-reload */}
        <div className="mb-4">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-2">
            <RefreshCw className={`w-4 h-4 ${countdown > 0 ? 'animate-spin' : ''}`} />
            <span>Автоперезагрузка через {countdown} сек...</span>
          </div>
        </div>

        {/* Manual Actions */}
        <div className="space-y-2">
          <button
            onClick={reset}
            className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white flex items-center justify-center gap-2 hover:from-orange-600 hover:to-pink-600 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Попробовать снова
          </button>

          <a
            href="https://t.me/LiqVape_2"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 rounded-xl font-bold bg-white/5 text-gray-300 flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            Написать менеджеру
          </a>
        </div>

        {/* Help Text */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-[10px] text-gray-500 mb-2">Если ошибка повторяется:</p>
          <ol className="text-[10px] text-gray-400 text-left space-y-1">
            <li>1. Закрой Telegram полностью</li>
            <li>2. Открой бота заново</li>
            <li>3. Нажми /start</li>
            <li>4. Подожди 2-3 минуты</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
