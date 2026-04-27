import { FormEvent, useState } from 'react';
import { LogIn, UserPlus, KeyRound, LogOut } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { ProfileDraft } from '../lib/types';
import { Field } from './shared/ui';
import { regions } from '../data';
import { supabase } from '../lib/supabase';

type AuthMode = 'login' | 'register' | 'forgot';

export function ProfileScreen({
  profile,
  setProfile,
  saveProfile,
  savingProfile,
  session,
  isDarkMode,
  onToggleDarkMode
}: {
  profile: ProfileDraft;
  setProfile: (draft: ProfileDraft) => void;
  saveProfile: () => void;
  savingProfile: boolean;
  session: Session | null;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}) {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setAuthMessage('');

    try {
      const client = supabase;
      if (authMode === 'login') {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthMessage('Đăng nhập thành công!');
      } else if (authMode === 'register') {
        const { error } = await client.auth.signUp({ email, password });
        if (error) throw error;
        setAuthMessage('Vui lòng kiểm tra email để xác nhận!');
      } else if (authMode === 'forgot') {
        const { error } = await client.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setAuthMessage('Đã gửi link đặt lại mật khẩu vào email!');
      }
    } catch (err: any) {
      setAuthMessage(err.message || 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase!.auth.signOut();
  }

  return (
    <>
      <header className="appbar compact">
        <span className="appbar-title" style={{ fontSize: '18px', fontWeight: 900 }}>Hồ sơ</span>
      </header>

      <section className="surface-card card-section">
        {session?.user.email ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p className="card-title">Tài khoản</p>
            <p className="helper-copy" style={{ color: '#0f172a', fontWeight: 600 }}>Đang đăng nhập bằng {session.user.email}</p>
            <button type="button" onClick={handleSignOut} className="solid-button" style={{ background: '#fef2f2', color: '#ef4444' }}>
              <LogOut size={16} />
              Đăng xuất
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button 
                className={`tab-pill ${authMode === 'login' ? 'active' : ''}`} 
                onClick={() => { setAuthMode('login'); setAuthMessage(''); }}
              >Đăng nhập</button>
              <button 
                className={`tab-pill ${authMode === 'register' ? 'active' : ''}`} 
                onClick={() => { setAuthMode('register'); setAuthMessage(''); }}
              >Đăng ký</button>
              <button 
                className={`tab-pill ${authMode === 'forgot' ? 'active' : ''}`} 
                onClick={() => { setAuthMode('forgot'); setAuthMessage(''); }}
              >Quên mật khẩu</button>
            </div>
            
            <form onSubmit={handleAuth} className="form-stack">
              <input className="solid-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
              {authMode !== 'forgot' && (
                <input className="solid-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu" required minLength={6} />
              )}
              <button type="submit" className="solid-button" disabled={loading}>
                {authMode === 'login' ? <LogIn size={16} /> : authMode === 'register' ? <UserPlus size={16} /> : <KeyRound size={16} />}
                {loading ? 'Đang xử lý...' : authMode === 'login' ? 'Đăng nhập' : authMode === 'register' ? 'Đăng ký' : 'Lấy lại mật khẩu'}
              </button>
            </form>
            {authMessage && <p className="helper-copy" style={{ marginTop: '12px', color: '#3b82f6' }}>{authMessage}</p>}
          </>
        )}
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
