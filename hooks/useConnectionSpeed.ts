import { useState, useEffect } from 'react';

type ConnectionSpeed = 'fast' | 'medium' | 'slow' | 'offline';

export function useConnectionSpeed() {
  const [speed, setSpeed] = useState<ConnectionSpeed>('fast');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateSpeed = () => {
      if (!navigator.onLine) {
        setSpeed('offline');
        setIsOnline(false);
        return;
      }

      setIsOnline(true);
      
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      
      if (connection) {
        const downlink = connection.downlink; // Mbps
        const effectiveType = connection.effectiveType; // 'slow-2g', '2g', '3g', '4g'
        
        if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 1) {
          setSpeed('slow');
        } else if (effectiveType === '3g' || downlink < 5) {
          setSpeed('medium');
        } else {
          setSpeed('fast');
        }
      } else {
        // Fallback: проверяем через загрузку маленького файла
        const startTime = Date.now();
        const img = new Image();
        img.onload = () => {
          const duration = (Date.now() - startTime) / 1000;
          if (duration > 3) setSpeed('slow');
          else if (duration > 1) setSpeed('medium');
          else setSpeed('fast');
        };
        img.onerror = () => setSpeed('offline');
        img.src = '/favicon.ico?' + Date.now();
      }
    };

    updateSpeed();
    
    window.addEventListener('online', updateSpeed);
    window.addEventListener('offline', updateSpeed);
    
    if ((navigator as any).connection) {
      (navigator as any).connection.addEventListener('change', updateSpeed);
    }

    return () => {
      window.removeEventListener('online', updateSpeed);
      window.removeEventListener('offline', updateSpeed);
      if ((navigator as any).connection) {
        (navigator as any).connection.removeEventListener('change', updateSpeed);
      }
    };
  }, []);

  return { speed, isOnline };
}
