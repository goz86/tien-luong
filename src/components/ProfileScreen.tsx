import { FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { ProfileDraft } from '../lib/types';
import { Field } from './shared/ui';
import { regions } from '../data';

export function ProfileScreen({
  authEmail,
  authMessage,
  sendingAuth,
  onAuthEmailChange,
  onSendMagicLink,
  profile,
  setProfile,
  saveProfile,
  savingProfile,
  session,
  isDarkMode,
  onToggleDarkMode
}: {
  authEmail: string;
  authMessage: string;
  sendingAuth: boolean;
  onAuthEmailChange: (value: string) => void;
  onSendMagicLink: (event: FormEvent<HTMLFormElement>) => void;
  profile: ProfileDraft;
  setProfile: (draft: ProfileDraft) => void;
  saveProfile: () => void;
  savingProfile: boolean;
  session: Session | null;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}) {
  return (
    <>
      <header className="appbar compact">
        <div>
          <p className="appbar-kicker">Hồ sơ và đồng bộ</p>
          <h1 className="appbar-title">Tài khoản của tôi</h1>
        </div>
      </header>

      <section className="surface-card card-section">
        <p className="card-title">Đăng nhập</p>
        <form onSubmit={onSendMagicLink} className="form-stack">
          <input className="solid-input" type="email" value={authEmail} onChange={(event) => onAuthEmailChange(event.target.value)} placeholder="name@email.com" />
          <button type="submit" className="solid-button">
            <LogIn size={16} />
            {sendingAuth ? 'Đang gửi...' : 'Gửi magic link'}
          </button>
        </form>
        <p className="helper-copy">{session?.user.email ? `Đang đăng nhập bằng ${session.user.email}` : authMessage || 'Bạn vẫn có thể dùng app ở chế độ khách.'}</p>
      </section>

      <section className="surface-card card-section">
        <p className="card-title">Thông tin cá nhân</p>
        <div className="form-stack">
          <Field label="Tên hiển thị">
            <input className="solid-input" value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} />
          </Field>
          <Field label="Trường / 어학당">
            <input className="solid-input" value={profile.school} onChange={(event) => setProfile({ ...profile, school: event.target.value })} />
          </Field>
          <Field label="Khu vực">
            <select className="solid-input" value={profile.region} onChange={(event) => setProfile({ ...profile, region: event.target.value })}>
              {regions.map((region) => (
                <option key={region}>{region}</option>
              ))}
            </select>
          </Field>
          <Field label="Giới thiệu ngắn">
            <textarea className="solid-input area" rows={4} value={profile.note} onChange={(event) => setProfile({ ...profile, note: event.target.value })} />
          </Field>
          <button type="button" className="solid-button bright" onClick={saveProfile}>
            {savingProfile ? 'Đang lưu...' : 'Lưu hồ sơ'}
          </button>
        </div>
      </section>

      <section className="surface-card card-section">
        <p className="card-title">Giao diện</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ display: 'block', fontSize: '15px' }}>Chế độ tối (Dark Mode)</strong>
            <span style={{ fontSize: '12px', color: 'var(--text-soft)' }}>Bảo vệ mắt khi sử dụng ban đêm</span>
          </div>
          <button 
            onClick={onToggleDarkMode}
            style={{ 
              width: '52px', 
              height: '30px', 
              borderRadius: '99px', 
              background: isDarkMode ? '#2752ff' : '#e2e8f0', 
              border: 'none', 
              position: 'relative',
              transition: 'all 0.3s'
            }}
          >
            <div style={{ 
              width: '24px', 
              height: '24px', 
              borderRadius: '50%', 
              background: 'white', 
              position: 'absolute', 
              top: '3px', 
              left: isDarkMode ? '25px' : '3px',
              transition: 'all 0.3s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }} />
          </button>
        </div>
      </section>

      <section className="surface-card card-section" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <p className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
          Huy hiệu thành tích
          <span style={{ fontSize: '11px', color: '#2752ff' }}>Xem tất cả</span>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
          {[
            { label: 'Chăm chỉ', icon: '🔥', color: '#ffedd5', border: '#f97316' },
            { label: 'Tiết kiệm', icon: '💰', color: '#dcfce7', border: '#22c55e' },
            { label: 'Chi tiêu giỏi', icon: '💎', color: '#f1f5f9', border: '#94a3b8' },
          ].map((badge, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                borderRadius: '50%', 
                background: badge.color, 
                border: `2px dashed ${badge.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                {badge.icon}
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, textAlign: 'center' }}>{badge.label}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
