import { FormEvent, useState } from 'react';
import {
  LogIn,
  UserPlus,
  KeyRound,
  LogOut,
  ChevronRight,
  Moon,
  Sun,
  MapPin,
  GraduationCap,
  PenLine,
  Shield,
  Bell,
  Globe,
  Info,
  Settings,
  BookmarkCheck,
  MessageCircle,
  Heart,
} from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { ProfileDraft } from '../lib/types';
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
  onToggleDarkMode,
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
  const [isEditing, setIsEditing] = useState(false);

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
    await supabase.auth.signOut();
  }

  const displayName = profile.displayName || 'Du học sinh';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      {/* ===== HERO CARD ===== */}
      <div className="pf-hero">
        <div className="pf-hero-bg" />
        <div className="pf-avatar">
          <span>{initials}</span>
        </div>
        <h2 className="pf-name">{displayName}</h2>
        {profile.school && (
          <div className="pf-subtitle">
            <GraduationCap size={14} />
            <span>{profile.school}</span>
          </div>
        )}
        {profile.region && (
          <div className="pf-subtitle">
            <MapPin size={14} />
            <span>{profile.region}</span>
          </div>
        )}
        {profile.note && <p className="pf-bio">{profile.note}</p>}

        {/* Stats Row */}
        <div className="pf-stats-row">
          <div className="pf-stat">
            <PenLine size={16} />
            <div>
              <strong>12</strong>
              <span>Bài viết</span>
            </div>
          </div>
          <div className="pf-stat-divider" />
          <div className="pf-stat">
            <MessageCircle size={16} />
            <div>
              <strong>48</strong>
              <span>Bình luận</span>
            </div>
          </div>
          <div className="pf-stat-divider" />
          <div className="pf-stat">
            <BookmarkCheck size={16} />
            <div>
              <strong>7</strong>
              <span>Đã lưu</span>
            </div>
          </div>
          <div className="pf-stat-divider" />
          <div className="pf-stat">
            <Heart size={16} />
            <div>
              <strong>156</strong>
              <span>Lượt thích</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== AUTH SECTION ===== */}
      {!session?.user.email ? (
        <section className="pf-card">
          <div className="pf-card-header">
            <Shield size={18} />
            <span>Đăng nhập / Đăng ký</span>
          </div>
          <div className="pf-auth-tabs">
            <button
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => { setAuthMode('login'); setAuthMessage(''); }}
            >
              Đăng nhập
            </button>
            <button
              className={authMode === 'register' ? 'active' : ''}
              onClick={() => { setAuthMode('register'); setAuthMessage(''); }}
            >
              Đăng ký
            </button>
            <button
              className={authMode === 'forgot' ? 'active' : ''}
              onClick={() => { setAuthMode('forgot'); setAuthMessage(''); }}
            >
              Quên MK
            </button>
          </div>
          <form onSubmit={handleAuth} className="pf-auth-form">
            <input
              className="pf-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
            />
            {authMode !== 'forgot' && (
              <input
                className="pf-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                required
                minLength={6}
              />
            )}
            <button type="submit" className="pf-submit-btn" disabled={loading}>
              {authMode === 'login' ? <LogIn size={16} /> : authMode === 'register' ? <UserPlus size={16} /> : <KeyRound size={16} />}
              {loading ? 'Đang xử lý...' : authMode === 'login' ? 'Đăng nhập' : authMode === 'register' ? 'Đăng ký' : 'Lấy lại mật khẩu'}
            </button>
          </form>
          {authMessage && <p className="pf-auth-msg">{authMessage}</p>}
        </section>
      ) : (
        <section className="pf-card">
          <div className="pf-card-header">
            <Shield size={18} />
            <span>Tài khoản</span>
          </div>
          <p className="pf-account-email">{session.user.email}</p>
          <button type="button" onClick={handleSignOut} className="pf-signout-btn">
            <LogOut size={16} />
            Đăng xuất
          </button>
        </section>
      )}

      {/* ===== EDIT PROFILE ===== */}
      <section className="pf-card">
        <div className="pf-card-header" style={{ cursor: 'pointer' }} onClick={() => setIsEditing(!isEditing)}>
          <Settings size={18} />
          <span>Thông tin cá nhân</span>
          <ChevronRight size={18} style={{ marginLeft: 'auto', transform: isEditing ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
        {isEditing && (
          <div className="pf-edit-form">
            <div className="pf-field">
              <label>Tên hiển thị</label>
              <input
                className="pf-input"
                value={profile.displayName}
                onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                placeholder="Nhập tên..."
              />
            </div>
            <div className="pf-field">
              <label>Trường / 어학당</label>
              <input
                className="pf-input"
                value={profile.school}
                onChange={(e) => setProfile({ ...profile, school: e.target.value })}
                placeholder="Nhập tên trường..."
              />
            </div>
            <div className="pf-field">
              <label>Khu vực</label>
              <select
                className="pf-input"
                value={profile.region}
                onChange={(e) => setProfile({ ...profile, region: e.target.value })}
              >
                {regions.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="pf-field">
              <label>Giới thiệu</label>
              <textarea
                className="pf-input pf-textarea"
                rows={3}
                value={profile.note}
                onChange={(e) => setProfile({ ...profile, note: e.target.value })}
                placeholder="Viết gì đó về bạn..."
              />
            </div>
            <button type="button" className="pf-save-btn" onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        )}
      </section>

      {/* ===== SETTINGS ===== */}
      <section className="pf-card">
        <div className="pf-card-header">
          <Settings size={18} />
          <span>Cài đặt</span>
        </div>

        {/* Dark Mode Toggle */}
        <div className="pf-setting-row">
          <div className="pf-setting-icon">{isDarkMode ? <Moon size={18} /> : <Sun size={18} />}</div>
          <div className="pf-setting-info">
            <strong>Chế độ tối</strong>
            <span>Bảo vệ mắt khi sử dụng ban đêm</span>
          </div>
          <button className="pf-toggle" data-active={isDarkMode} onClick={onToggleDarkMode}>
            <div className="pf-toggle-knob" />
          </button>
        </div>

        <div className="pf-setting-row">
          <div className="pf-setting-icon"><Bell size={18} /></div>
          <div className="pf-setting-info">
            <strong>Thông báo</strong>
            <span>Nhận thông báo bài viết mới</span>
          </div>
          <ChevronRight size={18} color="#94a3b8" />
        </div>

        <div className="pf-setting-row">
          <div className="pf-setting-icon"><Globe size={18} /></div>
          <div className="pf-setting-info">
            <strong>Ngôn ngữ</strong>
            <span>Tiếng Việt</span>
          </div>
          <ChevronRight size={18} color="#94a3b8" />
        </div>

        <div className="pf-setting-row">
          <div className="pf-setting-icon"><Info size={18} /></div>
          <div className="pf-setting-info">
            <strong>Về ứng dụng</strong>
            <span>Duhoc Mate v1.0</span>
          </div>
          <ChevronRight size={18} color="#94a3b8" />
        </div>
      </section>

      {/* ===== BADGES ===== */}
      <section className="pf-card">
        <div className="pf-card-header">
          <span style={{ fontSize: '18px' }}>🏆</span>
          <span>Huy hiệu thành tích</span>
          <span className="pf-see-all">Xem tất cả</span>
        </div>
        <div className="pf-badges-grid">
          {[
            { label: 'Chăm chỉ', icon: '🔥', color: '#ffedd5', border: '#f97316', earned: true },
            { label: 'Tiết kiệm', icon: '💰', color: '#dcfce7', border: '#22c55e', earned: true },
            { label: 'Cộng đồng', icon: '💬', color: '#dbeafe', border: '#3b82f6', earned: true },
            { label: 'Chi tiêu giỏi', icon: '💎', color: '#f1f5f9', border: '#94a3b8', earned: false },
            { label: 'Thủ lĩnh', icon: '👑', color: '#fef9c3', border: '#eab308', earned: false },
            { label: 'Bí ẩn', icon: '🔮', color: '#f3e8ff', border: '#a855f7', earned: false },
          ].map((badge, i) => (
            <div key={i} className={`pf-badge ${badge.earned ? 'earned' : 'locked'}`}>
              <div className="pf-badge-icon" style={{ background: badge.color, borderColor: badge.border }}>
                {badge.icon}
              </div>
              <span>{badge.label}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
