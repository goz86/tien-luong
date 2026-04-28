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
  BookmarkCheck,
  MessageCircle,
  Heart,
  Palette,
  Check,
  Eye,
  EyeOff,
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
  saveProfile: () => void;
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

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  const displayName = profile.displayName || (isKo ? '유학생' : 'Du học sinh');
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

        <div className="pf-stats-row">
          <div className="pf-stat">
            <PenLine size={16} />
            <div>
              <strong>12</strong>
              <span>{isKo ? '게시물' : 'Bài viết'}</span>
            </div>
          </div>
          <div className="pf-stat-divider" />
          <div className="pf-stat">
            <MessageCircle size={16} />
            <div>
              <strong>48</strong>
              <span>{isKo ? '댓글' : 'Bình luận'}</span>
            </div>
          </div>
          <div className="pf-stat-divider" />
          <div className="pf-stat">
            <BookmarkCheck size={16} />
            <div>
              <strong>7</strong>
              <span>{isKo ? '저장' : 'Đã lưu'}</span>
            </div>
          </div>
          <div className="pf-stat-divider" />
          <div className="pf-stat">
            <Heart size={16} />
            <div>
              <strong>156</strong>
              <span>{isKo ? '좋아요' : 'Lượt thích'}</span>
            </div>
          </div>
        </div>
      </div>

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
                  <label>{isKo ? '학교 / 어학당' : 'Trường / 어학당'}</label>
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
              <button type="button" className="pf-save-btn" onClick={saveProfile} disabled={savingProfile}>
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
