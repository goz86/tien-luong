import { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import {
  getLocalAppLockDelayMs,
  getLocalAppLockConfig,
  LOCAL_APP_LOCK_CHANGED,
  LOCAL_APP_LOCK_NOW,
  verifyLocalAppLockPin,
} from '../lib/localAppLock';

export function AppLockOverlay({ lang }: { lang: 'vi' | 'ko' }) {
  const isKo = lang === 'ko';
  const [locked, setLocked] = useState(() => Boolean(getLocalAppLockConfig()));
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [delayMs, setDelayMs] = useState(() => getLocalAppLockDelayMs());

  useEffect(() => {
    const sync = () => {
      const enabled = Boolean(getLocalAppLockConfig());
      if (!enabled) setLocked(false);
      setDelayMs(getLocalAppLockDelayMs());
      if (!enabled) {
        setPin('');
        setMessage('');
      }
    };
    const lockNow = () => {
      if (getLocalAppLockConfig()) setLocked(true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && getLocalAppLockConfig()) {
        setLocked(true);
        setPin('');
      }
    };

    window.addEventListener(LOCAL_APP_LOCK_CHANGED, sync);
    window.addEventListener(LOCAL_APP_LOCK_NOW, lockNow);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener(LOCAL_APP_LOCK_CHANGED, sync);
      window.removeEventListener(LOCAL_APP_LOCK_NOW, lockNow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!locked) return;
    const timer = window.setInterval(() => setDelayMs(getLocalAppLockDelayMs()), 500);
    return () => window.clearInterval(timer);
  }, [locked]);

  if (!locked) return null;

  const delaySeconds = Math.ceil(delayMs / 1000);

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    if (delayMs > 0 || busy) return;
    setBusy(true);
    const ok = await verifyLocalAppLockPin(pin);
    setBusy(false);
    if (ok) {
      setLocked(false);
      setPin('');
      setMessage('');
      return;
    }
    const nextDelay = getLocalAppLockDelayMs();
    setDelayMs(nextDelay);
    setMessage(
      nextDelay > 0
        ? (isKo ? '잠시 후 다시 시도하세요.' : 'Sai nhiều lần, vui lòng thử lại sau.')
        : (isKo ? 'PIN이 올바르지 않습니다.' : 'PIN chưa đúng. Thử lại nhé.'),
    );
    setPin('');
  };

  return (
    <div className="app-lock-overlay" role="dialog" aria-modal="true">
      <form className="app-lock-card" onSubmit={unlock}>
        <div className="app-lock-icon"><LockKeyhole size={28} /></div>
        <h2>{isKo ? '앱 잠금' : 'Khoá app'}</h2>
        <p>{isKo ? '계속하려면 PIN을 입력하세요.' : 'Nhập PIN để tiếp tục sử dụng app.'}</p>
        <input
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          type="password"
          autoFocus
          placeholder="••••"
          disabled={delayMs > 0}
        />
        {message ? <span className="app-lock-message">{message}</span> : null}
        {delayMs > 0 ? <span className="app-lock-wait">{delaySeconds}s</span> : null}
        <button type="submit" disabled={pin.length < 4 || busy || delayMs > 0}>
          {busy ? '...' : (isKo ? '잠금 해제' : 'Mở khoá')}
        </button>
      </form>
    </div>
  );
}
