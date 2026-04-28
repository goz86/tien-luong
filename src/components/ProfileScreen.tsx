import { FormEvent, useState, useRef } from 'react';
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
  BookmarkCheck,
  MessageCircle,
  Heart,
  Palette,
  Check,
  Eye,
  EyeOff,
  Facebook,
  Camera,
} from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { ProfileDraft } from '../lib/types';
import { regions } from '../data';
import { supabase } from '../lib/supabase';

type AuthMode = 'login' | 'register' | 'forgot';

export type WallpaperKey = 'default' | 'ocean' | 'sunset' | 'forest' | 'lavender' | 'midnight';
export type AppLang = 'vi' | 'ko';

const WALLPAPERS: { key: WallpaperKey; label_vi: string; label_ko: string; gradient: string; preview: string }[] = [
  { key: 'default', label_vi: 'Mặc định', label_ko: '기본', gradient: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(247,249,253,0.96) 48%, #f3f6fb 100%)', preview: 'linear-gradient(135deg, #f8fafc, #e2e8f0)' },
  { key: 'ocean', label_vi: 'Đại dương', label_ko: '바다', gradient: 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 48%, #7dd3fc 100%)', preview: 'linear-gradient(135deg, #bae6fd, #38bdf8)' },
  { key: 'sunset', label_vi: 'Hoàng hôn', label_ko: '노을', gradient: 'linear-gradient(180deg, #fef3c7 0%, #fde68a 30%, #fdba74 70%, #fb923c 100%)', preview: 'linear-gradient(135deg, #fde68a, #fb923c)' },
  { key: 'forest', label_vi: 'Rừng xanh', label_ko: '숲', gradient: 'linear-gradient(180deg, #dcfce7 0%, #bbf7d0 48%, #86efac 100%)', preview: 'linear-gradient(135deg, #bbf7d0, #4ade80)' },
  { key: 'lavender', label_vi: 'Lavender', label_ko: '라벤더', gradient: 'linear-gradient(180deg, #f3e8ff 0%, #e9d5ff 48%, #d8b4fe 100%)', preview: 'linear-gradient(135deg, #e9d5ff, #a855f7)' },
  { key: 'midnight', label_vi: 'Nửa đêm', label_ko: '밤하늘', gradient: 'linear-gradient(180deg, #1e293b 0%, #0f172a 48%, #020617 100%)', preview: 'linear-gradient(135deg, #1e293b, #020617)' },
];

export { WALLPAPERS };

export function ProfileScreen({
  profile,
  setProfile,
  saveProfile,
  savingProfile,
  session,
  isDarkMode,
  onToggleDarkMode,
  wallpaper,
  onChangeWallpaper,
  lang,
  onChangeLang,
}: {
  profile: ProfileDraft;
  setProfile: (draft: ProfileDraft) => void;
  saveProfile: (draft?: ProfileDraft) => void;
  savingProfile: boolean;
  session: Session | null;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  wallpaper: WallpaperKey;
  onChangeWallpaper: (w: WallpaperKey) => void;
  lang: AppLang;
  onChangeLang: (l: AppLang) => void;
}) {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regSchool, setRegSchool] = useState('');
  const [regRegion, setRegRegion] = useState(regions[0]);
  const [authMessage, setAuthMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isKo = lang === 'ko';

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setAuthMessage('');
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthMessage(isKo ? '로그인 성공!' : 'Đăng nhập thành công!');
      } else if (authMode === 'register') {
        if (password !== confirmPassword) {
          throw new Error(isKo ? '비밀번호가 일치하지 않습니다.' : 'Mật khẩu không khớp!');
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: regName,
              school: regSchool,
              region: regRegion,
            },
          },
        });
        if (error) throw error;
        // Also update the profile state
        setProfile({ ...profile, displayName: regName, school: regSchool, region: regRegion });
        setAuthMessage(isKo ? '이메일을 확인해주세요!' : 'Vui lòng kiểm tra email để xác nhận!');
      } else if (authMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setAuthMessage(isKo ? '비밀번호 재설정 링크를 보냈습니다!' : 'Đã gửi link đặt lại mật khẩu vào email!');
      }
    } catch (err: any) {
      setAuthMessage(err.message || (isKo ? '오류가 발생했습니다.' : 'Có lỗi xảy ra.'));
    } finally {
      setLoading(false);
    }
  }

  const handleSocialLogin = async (provider: string) => {
    try {
      setLoading(true);
      if (!supabase) throw new Error('Supabase client not initialized');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: window.location.origin,
          // FB: public_profile to bypass dev restrictions, Google: default email/profile
          scopes: provider === 'facebook' ? 'public_profile' : 'email profile'
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthMessage(err.message || 'Lỗi đăng nhập mạng xã hội');
    } finally {
      setLoading(false);
    }
  };

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const resizeImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150;
        const MAX_HEIGHT = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Nén chất lượng xuống 70%
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressed = await resizeImage(reader.result as string);
      const updated = { ...profile, avatarUrl: compressed };
      setProfile(updated);
      // Lưu ngay lập tức với dữ liệu mới để tránh mất ảnh
      saveProfile(updated);
    };
    reader.readAsDataURL(file);
  };

  const displayName = profile.displayName || (isKo ? '유학생' : 'Du học sinh');
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      {/* ===== HERO CARD (only when logged in) ===== */}
      {session?.user.email ? (
        <div className="pf-hero">
          <div className="pf-hero-bg" />
          
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/*" 
            onChange={handleFileChange} 
          />

          <div className="pf-avatar" onClick={handleAvatarClick} style={{ cursor: 'pointer', position: 'relative' }}>
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <span>{initials}</span>
            )}
            <div className="avatar-edit-badge">
              <Camera size={12} color="white" />
            </div>
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

        <div className="pf-stats-row">
          <div className="pf-stat">
            <PenLine size={18} />
            <div className="pf-stat-content">
              <strong>12</strong>
              <span>{isKo ? '게시' : 'Bài viết'}</span>
            </div>
          </div>
          <div className="pf-stat-divider" />
          <div className="pf-stat">
            <MessageCircle size={18} />
            <div className="pf-stat-content">
              <strong>48</strong>
              <span>{isKo ? '댓글' : 'Bình luận'}</span>
            </div>
          </div>
          <div className="pf-stat-divider" />
          <div className="pf-stat">
            <BookmarkCheck size={18} />
            <div className="pf-stat-content">
              <strong>7</strong>
              <span>{isKo ? '저장' : 'Đã lưu'}</span>
            </div>
          </div>
          <div className="pf-stat-divider" />
          <div className="pf-stat">
            <Heart size={18} />
            <div className="pf-stat-content">
              <strong>156</strong>
              <span>{isKo ? '좋아요' : 'Thích'}</span>
            </div>
          </div>
        </div>
        </div>
      ) : (
        <header className="appbar compact" style={{ margin: '12px 6px 8px' }}>
          <span className="appbar-title" style={{ fontSize: '20px', fontWeight: 900 }}>{isKo ? '프로필' : 'Hồ sơ'}</span>
        </header>
      )}

      {/* ===== AUTH SECTION ===== */}
      {!session?.user.email ? (
        <section className="pf-card">
          <div className="pf-card-header">
            <Shield size={18} />
            <span>{authMode === 'login' ? (isKo ? '로그인' : 'Đăng nhập') : authMode === 'register' ? (isKo ? '회원가입' : 'Đăng ký') : (isKo ? '비밀번호 찾기' : 'Quên mật khẩu')}</span>
          </div>

          <form onSubmit={handleAuth} className="pf-auth-form">
            {/* Email */}
            <div className="pf-field">
              <label>{isKo ? '이메일' : 'Email'}</label>
              <input className="pf-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" required />
            </div>

            {/* Password - login & register */}
            {authMode !== 'forgot' && (
              <div className="pf-field">
                <label>{isKo ? '비밀번호' : 'Mật khẩu'}</label>
                <div className="pf-password-wrap">
                  <input className="pf-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required minLength={6} />
                  <button type="button" className="pf-eye-btn" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm password - register only */}
            {authMode === 'register' && (
              <>
                <div className="pf-field">
                  <label>{isKo ? '비밀번호 확인' : 'Xác nhận mật khẩu'}</label>
                  <input className="pf-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••" required minLength={6} />
                </div>
                <div className="pf-divider" />
                <div className="pf-field">
                  <label>{isKo ? '닉네임' : 'Tên hiển thị'}</label>
                  <input className="pf-input" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder={isKo ? '닉네임 입력' : 'Nhập tên...'} required />
                </div>
                <div className="pf-field">
                  <label>{isKo ? '학교 ' : 'Trường đang theo học'}</label>
                  <input className="pf-input" value={regSchool} onChange={(e) => setRegSchool(e.target.value)} placeholder={isKo ? '학교 이름' : 'Tên trường...'} />
                </div>
                <div className="pf-field">
                  <label>{isKo ? '지역' : 'Khu vực'}</label>
                  <select className="pf-input" value={regRegion} onChange={(e) => setRegRegion(e.target.value)}>
                    {regions.map((r) => (<option key={r}>{r}</option>))}
                  </select>
                </div>
              </>
            )}

            <button type="submit" className="pf-submit-btn" disabled={loading}>
              {authMode === 'login' ? <LogIn size={16} /> : authMode === 'register' ? <UserPlus size={16} /> : <KeyRound size={16} />}
              {loading
                ? (isKo ? '처리 중...' : 'Đang xử lý...')
                : authMode === 'login'
                  ? (isKo ? '로그인' : 'Đăng nhập')
                  : authMode === 'register'
                    ? (isKo ? '가입하기' : 'Tạo tài khoản')
                    : (isKo ? '재설정 링크 보내기' : 'Gửi link đặt lại')
              }
            </button>
          </form>

          {/* Social Logins */}
          {authMode !== 'forgot' && (
            <div className="pf-social-auth">
              <div className="pf-divider-text">
                <span>{isKo ? '또는' : 'Hoặc tiếp tục với'}</span>
              </div>
              <div className="pf-social-grid">
                <button type="button" className="pf-social-btn fb" onClick={() => handleSocialLogin('facebook')} disabled={loading}>
                  <Facebook size={18} fill="currentColor" />
                  <span>Facebook</span>
                </button>
                <button type="button" className="pf-social-btn google" onClick={() => handleSocialLogin('google')} disabled={loading}>
                  <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span>Google</span>
                </button>
              </div>
            </div>
          )}

          {authMessage && <p className="pf-auth-msg">{authMessage}</p>}

          {/* Switch between login/register/forgot */}
          <div className="pf-auth-switch">
            {authMode === 'login' ? (
              <>
                <button type="button" onClick={() => { setAuthMode('register'); setAuthMessage(''); }}>
                  {isKo ? '계정이 없으신가요? 회원가입' : 'Chưa có tài khoản? Đăng ký'}
                </button>
                <button type="button" onClick={() => { setAuthMode('forgot'); setAuthMessage(''); }}>
                  {isKo ? '비밀번호를 잊으셨나요?' : 'Quên mật khẩu?'}
                </button>
              </>
            ) : authMode === 'register' ? (
              <button type="button" onClick={() => { setAuthMode('login'); setAuthMessage(''); }}>
                {isKo ? '이미 계정이 있나요? 로그인' : 'Đã có tài khoản? Đăng nhập'}
              </button>
            ) : (
              <button type="button" onClick={() => { setAuthMode('login'); setAuthMessage(''); }}>
                {isKo ? '로그인으로 돌아가기' : 'Quay lại đăng nhập'}
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="pf-card">
          <div className="pf-card-header">
            <Shield size={18} />
            <span>{isKo ? '계정' : 'Tài khoản'}</span>
          </div>
          <p className="pf-account-email">{session.user.email}</p>
          <button type="button" onClick={handleSignOut} className="pf-signout-btn">
            <LogOut size={16} />
            {isKo ? '로그아웃' : 'Đăng xuất'}
          </button>
        </section>
      )}

      {/* ===== EDIT PROFILE (only when logged in) ===== */}
      {session?.user.email && (
        <section className="pf-card">
          <div className="pf-card-header" style={{ cursor: 'pointer' }} onClick={() => setIsEditing(!isEditing)}>
            <PenLine size={18} />
            <span>{isKo ? '프로필 수정' : 'Chỉnh sửa hồ sơ'}</span>
            <ChevronRight size={18} style={{ marginLeft: 'auto', transform: isEditing ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {isEditing && (
            <div className="pf-edit-form">
              <div className="pf-field">
                <label>{isKo ? '닉네임' : 'Tên hiển thị'}</label>
                <input className="pf-input" value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} />
              </div>
              <div className="pf-field">
                <label>{isKo ? '학교 / 어학당' : 'Trường / 어학당'}</label>
                <input className="pf-input" value={profile.school} onChange={(e) => setProfile({ ...profile, school: e.target.value })} />
              </div>
              <div className="pf-field">
                <label>{isKo ? '지역' : 'Khu vực'}</label>
                <select className="pf-input" value={profile.region} onChange={(e) => setProfile({ ...profile, region: e.target.value })}>
                  {regions.map((r) => (<option key={r}>{r}</option>))}
                </select>
              </div>
              <div className="pf-field">
                <label>{isKo ? '자기소개' : 'Giới thiệu'}</label>
                <textarea className="pf-input pf-textarea" rows={3} value={profile.note} onChange={(e) => setProfile({ ...profile, note: e.target.value })} />
              </div>
              <button type="button" className="pf-save-btn" onClick={() => saveProfile()} disabled={savingProfile}>
                {savingProfile ? (isKo ? '저장 중...' : 'Đang lưu...') : (isKo ? '저장' : 'Lưu thay đổi')}
              </button>
            </div>
          )}
        </section>
      )}

      {/* ===== SETTINGS ===== */}
      <section className="pf-card">
        <div className="pf-card-header">
          <span style={{ fontSize: '18px' }}>⚙️</span>
          <span>{isKo ? '설정' : 'Cài đặt'}</span>
        </div>

        {/* Dark Mode */}
        <div className="pf-setting-row">
          <div className="pf-setting-icon">{isDarkMode ? <Moon size={18} /> : <Sun size={18} />}</div>
          <div className="pf-setting-info">
            <strong>{isKo ? '다크 모드' : 'Chế độ tối'}</strong>
            <span>{isKo ? '야간 사용 시 눈 보호' : 'Bảo vệ mắt khi sử dụng ban đêm'}</span>
          </div>
          <button className="pf-toggle" data-active={isDarkMode} onClick={onToggleDarkMode}>
            <div className="pf-toggle-knob" />
          </button>
        </div>

        {/* Wallpaper */}
        <div className="pf-setting-row" style={{ cursor: 'pointer' }} onClick={() => setShowWallpaperPicker(!showWallpaperPicker)}>
          <div className="pf-setting-icon"><Palette size={18} /></div>
          <div className="pf-setting-info">
            <strong>{isKo ? '배경화면' : 'Hình nền'}</strong>
            <span>{WALLPAPERS.find((w) => w.key === wallpaper)?.[isKo ? 'label_ko' : 'label_vi']}</span>
          </div>
          <ChevronRight size={18} color="#94a3b8" style={{ transform: showWallpaperPicker ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
        {showWallpaperPicker && (
          <div className="pf-wallpaper-grid">
            {WALLPAPERS.map((w) => (
              <button key={w.key} className={`pf-wallpaper-item ${wallpaper === w.key ? 'active' : ''}`} onClick={() => onChangeWallpaper(w.key)}>
                <div className="pf-wallpaper-preview" style={{ background: w.preview }} />
                <span>{isKo ? w.label_ko : w.label_vi}</span>
                {wallpaper === w.key && <Check size={14} className="pf-wallpaper-check" />}
              </button>
            ))}
          </div>
        )}

        {/* Language */}
        <div className="pf-setting-row">
          <div className="pf-setting-icon"><Globe size={18} /></div>
          <div className="pf-setting-info">
            <strong>{isKo ? '언어' : 'Ngôn ngữ'}</strong>
            <span>{isKo ? '한국어' : 'Tiếng Việt'}</span>
          </div>
          <div className="pf-lang-toggle">
            <button className={lang === 'vi' ? 'active' : ''} onClick={() => onChangeLang('vi')}>🇻🇳</button>
            <button className={lang === 'ko' ? 'active' : ''} onClick={() => onChangeLang('ko')}>🇰🇷</button>
          </div>
        </div>

        {/* Notifications */}
        <div className="pf-setting-row">
          <div className="pf-setting-icon"><Bell size={18} /></div>
          <div className="pf-setting-info">
            <strong>{isKo ? '알림' : 'Thông báo'}</strong>
            <span>{isKo ? '새 글 알림 받기' : 'Nhận thông báo bài viết mới'}</span>
          </div>
          <ChevronRight size={18} color="#94a3b8" />
        </div>

        {/* About */}
        <div className="pf-setting-row">
          <div className="pf-setting-icon"><Info size={18} /></div>
          <div className="pf-setting-info">
            <strong>{isKo ? '앱 정보' : 'Về ứng dụng'}</strong>
            <span>Duhoc Mate v1.0</span>
          </div>
          <ChevronRight size={18} color="#94a3b8" />
        </div>
      </section>

      {/* ===== BADGES ===== */}
      <section className="pf-card">
        <div className="pf-card-header">
          <span style={{ fontSize: '18px' }}>🏆</span>
          <span>{isKo ? '업적 배지' : 'Huy hiệu thành tích'}</span>
          <span className="pf-see-all">{isKo ? '모두 보기' : 'Xem tất cả'}</span>
        </div>
        <div className="pf-badges-grid">
          {[
            { label_vi: 'Chăm chỉ', label_ko: '열심히', icon: '🔥', color: '#ffedd5', border: '#f97316', earned: true },
            { label_vi: 'Tiết kiệm', label_ko: '절약왕', icon: '💰', color: '#dcfce7', border: '#22c55e', earned: true },
            { label_vi: 'Cộng đồng', label_ko: '커뮤니티', icon: '💬', color: '#dbeafe', border: '#3b82f6', earned: true },
            { label_vi: 'Chi tiêu giỏi', label_ko: '소비왕', icon: '💎', color: '#f1f5f9', border: '#94a3b8', earned: false },
            { label_vi: 'Thủ lĩnh', label_ko: '리더', icon: '👑', color: '#fef9c3', border: '#eab308', earned: false },
            { label_vi: 'Bí ẩn', label_ko: '미스터리', icon: '🔮', color: '#f3e8ff', border: '#a855f7', earned: false },
          ].map((badge, i) => (
            <div key={i} className={`pf-badge ${badge.earned ? 'earned' : 'locked'}`}>
              <div className="pf-badge-icon" style={{ background: badge.color, borderColor: badge.border }}>
                {badge.icon}
              </div>
              <span>{isKo ? badge.label_ko : badge.label_vi}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
