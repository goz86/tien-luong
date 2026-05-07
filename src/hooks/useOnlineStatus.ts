import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export function useOnlineStatus() {
  const setOnline = useAppStore((s) => s.setOnline);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [setOnline]);
}
