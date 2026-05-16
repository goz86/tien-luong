import { useEffect, useRef, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { getEarliestGuestExpiry, hasActiveGuestContent } from '../../lib/guestSession';

type Props = {
  lang?: 'vi' | 'ko';
  onLoginClick?: () => void;
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function GuestExpiryTicker({ lang = 'vi', onLoginClick }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ui = lang === 'ko' ? {
    msg: (t: string) => `👤 비로그인 게시물은 ${t} 후 자동 삭제됩니다`,
    tooltip: '로그인하지 않은 계정의 게시물과 댓글은 작성 후 3시간이 지나면 자동으로 삭제됩니다.',
    loginBtn: '로그인하여 영구 저장 →',
    close: '닫기',
  } : {
    msg: (t: string) => `👤 Bài/bình luận của bạn sẽ tự xoá sau  ${t}`,
    tooltip: 'Tài khoản chưa đăng nhập — bài viết & bình luận sẽ tự động xoá sau 3 giờ. Đăng nhập để lưu vĩnh viễn nhé!',
    loginBtn: 'Đăng nhập để lưu mãi mãi →',
    close: 'Đóng',
  };

  // Kiểm tra xem có content guest không
  useEffect(() => {
    const check = () => {
      if (!dismissed && hasActiveGuestContent()) {
        setVisible(true);
        const expiry = getEarliestGuestExpiry();
        if (expiry) {
          setTimeLeft(Math.max(0, expiry.getTime() - Date.now()));
        }
      } else {
        setVisible(false);
      }
    };

    check();
    // Kiểm tra lại mỗi 5 giây (phòng khi content mới được tạo)
    const pollId = setInterval(check, 5000);
    return () => clearInterval(pollId);
  }, [dismissed]);

  // Đếm ngược mỗi giây
  useEffect(() => {
    if (!visible) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = Math.max(0, prev - 1000);
        if (next === 0) setVisible(false);
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      {/* Ticker bar */}
      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(90deg, #fff4e0 0%, #ffe8b2 50%, #fff4e0 100%)',
          backgroundSize: '200% 100%',
          animation: 'ticker-slide 4s linear infinite',
          borderBottom: '1px solid #f5c842',
          padding: '7px 40px 7px 14px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#92600a',
          cursor: 'pointer',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 50,
        }}
        onClick={() => setShowTooltip((v) => !v)}
      >
        <Clock size={13} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {ui.msg(formatCountdown(timeLeft))}
        </span>

        {/* Nút X đóng ticker */}
        <button
          type="button"
          aria-label={ui.close}
          onClick={(e) => { e.stopPropagation(); setDismissed(true); setVisible(false); }}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#b07820',
            padding: '2px',
            display: 'flex',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Tooltip popup khi click */}
      {showTooltip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '60px',
          }}
          onClick={() => setShowTooltip(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '20px',
              maxWidth: '320px',
              width: 'calc(100% - 40px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              border: '1px solid #f5c842',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Clock size={18} color="#f59e0b" />
              <strong style={{ fontSize: '15px', color: '#08162b' }}>
                {lang === 'ko' ? '게스트 모드' : 'Chế độ khách'}
              </strong>
            </div>

            {/* Đồng hồ lớn */}
            <div style={{
              textAlign: 'center',
              fontSize: '28px',
              fontWeight: 900,
              letterSpacing: '0.04em',
              color: timeLeft < 30 * 60 * 1000 ? '#ef4444' : '#f59e0b',
              margin: '8px 0 12px',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatCountdown(timeLeft)}
            </div>

            <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.6, marginBottom: '14px' }}>
              {ui.tooltip}
            </p>

            {onLoginClick && (
              <button
                type="button"
                onClick={() => { setShowTooltip(false); onLoginClick(); }}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'linear-gradient(135deg, #2752ff, #4f73ff)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {ui.loginBtn}
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes ticker-slide {
          0%   { background-position: 0% 0%; }
          100% { background-position: 200% 0%; }
        }
      `}</style>
    </>
  );
}
