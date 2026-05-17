import { FormEvent, useState, useRef, useEffect } from 'react';
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
  MessageSquare,
  Bookmark,
  Shield,
  ShieldCheck,
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
  Settings,
  X,
  Trophy,
} from 'lucide-react';
import { BADGES, BADGE_CATEGORY_META, TIER_META, type BadgeCategory } from '../data/badgeData';
import { useAppStore } from '../store/appStore';

import { Session } from '@supabase/supabase-js';
import { ProfileDraft } from '../lib/types';
import { regions } from '../data';
import { supabase } from '../lib/supabase';
import { schools, School } from '../schools';
import { koreanRegions, Region } from '../regions';

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
  earnedBadges,
  isAdmin = false,
  onOpenAdmin,
  onStartDemo,
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
  earnedBadges: string[];
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
  onStartDemo?: () => void;
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
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showAuthInline, setShowAuthInline] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [schoolSuggestions, setSchoolSuggestions] = useState<School[]>([]);
  const [regionSuggestions, setRegionSuggestions] = useState<Region[]>([]);
  const [regRegionSuggestions, setRegRegionSuggestions] = useState<Region[]>([]);
  const [regSchoolSuggestions, setRegSchoolSuggestions] = useState<School[]>([]);
  const [stats, setStats] = useState({ posts: 0, comments: 0, bookmarks: 0, likes: 0 });
  const [policyPanel, setPolicyPanel] = useState<'privacy' | 'terms' | 'support' | 'delete' | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  // Badge progress data from store
  const badgeShifts = useAppStore(s => s.shifts);
  const badgeExpenses = useAppStore(s => s.expenses);
  const badgeCompanions = useAppStore(s => s.companions);
  const badgeData = {
    shifts: badgeShifts,
    expenses: badgeExpenses,
    posts: [],
    comments: [],
    companionsCount: badgeCompanions.length,
    likesCount: stats.likes,
  } as const;

  useEffect(() => {
    if (!session || !supabase) return;

    const userId = session.user.id;
    let isMounted = true;

    async function fetchStats() {
      const { count: postsCount } = await supabase!.from('community_posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { count: commentsCount } = await supabase!.from('community_comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { count: bookmarksCount } = await supabase!.from('community_bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { data: postsData } = await supabase!.from('community_posts')
        .select('likes_count')
        .eq('user_id', userId);

      const likesSum = postsData?.reduce((acc, curr) => acc + Number(curr.likes_count || 0), 0) || 0;

      if (isMounted) {
        setStats({
          posts: postsCount || 0,
          comments: commentsCount || 0,
          bookmarks: bookmarksCount || 0,
          likes: likesSum
        });
      }
    }

    void fetchStats();
    return () => { isMounted = false; };
  }, [session]);

  const isKo = lang === 'ko';
  const isAdminEmail = (session?.user.email || '').trim().toLowerCase() === 'michintashop@gmail.com';
  const canOpenAdmin = isAdmin || isAdminEmail;
  const profileTags = isKo
    ? ['TOPIK', '카페', '스터디', '절약', '맛집', '입국 초기', '한국어', '여행', '사진', '운동', '요리', '음악', '산책']
    : ['TOPIK', 'Cafe', 'Học nhóm', 'Budget', 'Ăn uống', 'Mới sang', 'Tiếng Hàn', 'Du lịch', 'Chụp ảnh', 'Thể thao', 'Nấu ăn', 'Âm nhạc', 'Dạo phố'];

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setAuthMessage(isKo ? 'Supabase 설정이 구성되지 않았습니다. .env 파일을 확인하세요.' : 'Cấu hình Supabase chưa hoàn tất. Vui lòng kiểm tra tệp .env của bạn!');
      return;
    }
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
      if (!supabase) throw new Error(isKo ? 'Supabase 설정이 구성되지 않았습니다. .env 파일을 확인하세요.' : 'Cấu hình Supabase chưa hoàn tất. Vui lòng kiểm tra tệp .env của bạn!');
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
      setAuthMessage(err.message || (isKo ? '소셜 로그인 오류' : 'Lỗi đăng nhập mạng xã hội'));
    } finally {
      setLoading(false);
    }
  };

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function handleDeleteAccount() {
    if (!supabase || !session || !deleteConfirmed) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('delete_own_account');
      if (error) {
        setAuthMessage('Xoá tài khoản thất bại: ' + error.message);
        setLoading(false);
        return;
      }
      // Đăng xuất sau khi xoá thành công
      await supabase.auth.signOut();
    } catch (err) {
      setAuthMessage('Có lỗi xảy ra, vui lòng thử lại.');
      setLoading(false);
    }
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
        // Fill white background for JPEG to avoid black transparency
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality JPEG with white bg
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
      saveProfile(updated);
    };
    reader.readAsDataURL(file);
  };

  const displayName = profile.displayName || (isKo ? '유학생' : 'Du học sinh');
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleSchoolChange = (val: string) => {
    setProfile({ ...profile, school: val });
    if (val.trim().length > 1) {
      const filtered = schools.filter(s =>
        s.ko.toLowerCase().includes(val.toLowerCase()) ||
        s.en.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5); // Hiển thị tối đa 5 gợi ý
      setSchoolSuggestions(filtered);
    } else {
      setSchoolSuggestions([]);
    }
  };

  const selectSchool = (s: School) => {
    setProfile({ ...profile, school: s.en });
    setSchoolSuggestions([]);
  };

  const handleRegionChange = (val: string) => {
    setProfile({ ...profile, region: val });
    if (val.trim().length > 1) {
      const filtered = koreanRegions.filter(r =>
        r.ko.toLowerCase().includes(val.toLowerCase()) ||
        r.en.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setRegionSuggestions(filtered);
    } else {
      setRegionSuggestions([]);
    }
  };

  const selectRegion = (r: Region) => {
    setProfile({ ...profile, region: r.ko }); // Lưu tên tiếng Hàn cho khu vực
    setRegionSuggestions([]);
  };

  const handleRegRegionChange = (val: string) => {
    setRegRegion(val);
    if (val.trim().length > 1) {
      const filtered = koreanRegions.filter(r =>
        r.ko.toLowerCase().includes(val.toLowerCase()) ||
        r.en.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setRegRegionSuggestions(filtered);
    } else {
      setRegRegionSuggestions([]);
    }
  };

  const selectRegRegion = (r: Region) => {
    setRegRegion(r.ko);
    setRegRegionSuggestions([]);
  };

  const handleRegSchoolChange = (val: string) => {
    setRegSchool(val);
    if (val.trim().length > 1) {
      const filtered = schools.filter(s =>
        s.ko.toLowerCase().includes(val.toLowerCase()) ||
        s.en.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setRegSchoolSuggestions(filtered);
    } else {
      setRegSchoolSuggestions([]);
    }
  };

  const selectRegSchool = (s: School) => {
    setRegSchool(s.en);
    setRegSchoolSuggestions([]);
  };

  return (
    <div className="profile-wrapper">
      {/* ===== HEADER / HERO SECTION (Only when logged in) ===== */}
      {session?.user.email ? (
        <>
          <div className="pf-hero" style={{ position: 'relative' }}>
            {/* Top-right action buttons */}
            <div className="pf-hero-actions">
              {canOpenAdmin && (
                <button
                  type="button"
                  className="pf-hero-action-btn pf-hero-action-btn--admin"
                  onClick={() => { onOpenAdmin ? onOpenAdmin() : (window.location.hash = 'admin'); }}
                  title={isKo ? '관리자 대시보드' : 'Dashboard admin'}
                >
                  <ShieldCheck size={17} />
                </button>
              )}
              <button
                type="button"
                className="pf-hero-action-btn"
                onClick={() => setShowSettings(true)}
                title={isKo ? '설정' : 'Cài đặt'}
              >
                <Settings size={17} />
              </button>
            </div>
            <div className="pf-hero-bg" />

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handleFileChange}
            />

            <div className="pf-avatar-container" onClick={handleAvatarClick}>
              <div className="pf-avatar">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Avatar" className="pf-avatar-img" />
                ) : (
                  <span className="pf-avatar-initials">{initials}</span>
                )}
              </div>
              <div className="avatar-edit-badge">
                <Camera size={14} color="white" />
              </div>
            </div>

            <h2 className="pf-name">{displayName}</h2>

            <div className="pf-subtitle-group">
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
            </div>

            {profile.note && <p className="pf-bio">{profile.note}</p>}

            {profile.tags && profile.tags.length > 0 && (
              <div className="pf-tags-row" style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
                {profile.tags.map(tag => (
                  <span key={tag} style={{ background: 'rgba(39, 82, 255, 0.08)', color: '#2752ff', padding: '6px 12px', borderRadius: '14px', fontSize: '13px', fontWeight: 800 }}>{tag}</span>
                ))}
              </div>
            )}

            <div className="pf-stats-row">
              <div className="pf-stat">
                <div className="pf-stat-icon"><PenLine size={14} /></div>
                <strong>{stats.posts}</strong>
                <span>{isKo ? '게시글' : 'Bài viết'}</span>
              </div>
              <div className="pf-stat">
                <div className="pf-stat-icon"><MessageSquare size={14} /></div>
                <strong>{stats.comments}</strong>
                <span>{isKo ? '댓글' : 'Bình luận'}</span>
              </div>
              <div className="pf-stat">
                <div className="pf-stat-icon"><Bookmark size={14} /></div>
                <strong>{stats.bookmarks}</strong>
                <span>{isKo ? '북마크' : 'Đã lưu'}</span>
              </div>
              <div className="pf-stat">
                <div className="pf-stat-icon"><Heart size={14} /></div>
                <strong>{stats.likes}</strong>
                <span>{isKo ? '좋아요' : 'Thích'}</span>
              </div>
            </div>
          </div>

          {/* ===== BADGES SECTION ===== */}
          <section className="pf-card pf-badge-card">
            <div className="pf-card-header">
              <Trophy size={18} color="#f59e0b" />
              <span>{isKo ? '업적 배지' : 'Huy hiệu thành tích'}</span>
              <span className="pf-badge-count-pill">{earnedBadges.length}<span>/{BADGES.length}</span></span>
            </div>

            {/* Progress summary bar */}
            <div className="pf-badge-progress-overview">
              <div className="pf-badge-progress-track">
                <div
                  className="pf-badge-progress-fill-main"
                  style={{ width: `${Math.round(earnedBadges.length / BADGES.length * 100)}%` }}
                />
              </div>
              <span className="pf-badge-progress-pct">
                {Math.round(earnedBadges.length / BADGES.length * 100)}%
              </span>
            </div>

            {/* Badges grouped by category */}
            {(Object.keys(BADGE_CATEGORY_META) as BadgeCategory[]).map(cat => {
              const catBadges = BADGES.filter(b => b.category === cat);
              if (!catBadges.length) return null;
              const meta = BADGE_CATEGORY_META[cat];
              return (
                <div key={cat} className="pf-badge-group">
                  <div className="pf-badge-group-title">
                    <span>{meta.icon}</span>
                    <span>{isKo ? meta.label_ko : meta.label_vi}</span>
                  </div>
                  <div className="pf-badges-grid">
                    {catBadges.map(badge => {
                      const isEarned = earnedBadges.includes(badge.id);
                      const prog = badge.getProgress(badgeData as any);
                      const pct = Math.min(100, Math.round((prog.current / prog.target) * 100));
                      const tierLabel = isKo ? TIER_META[badge.tier].label_ko : TIER_META[badge.tier].label_vi;

                      // Format progress text
                      let progText = '';
                      if (!isEarned) {
                        if (badge.category === 'income') {
                          const fmtM = (v: number) => v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}M`
                            : `${Math.round(v / 1000)}k`;
                          progText = `${fmtM(prog.current)} / ${fmtM(prog.target)}₩`;
                        } else {
                          progText = `${prog.current} / ${prog.target}`;
                        }
                      }

                      return (
                        <div
                          key={badge.id}
                          className={`pf-badge2 pf-tier-${badge.tier} ${isEarned ? 'earned' : 'locked'}`}
                          style={isEarned ? {
                            background: badge.color,
                            borderColor: badge.border,
                            boxShadow: `0 4px 18px ${badge.glow}`,
                          } : undefined}
                        >
                          {/* Tier pill */}
                          <span className="pf-badge2-tier">{tierLabel}</span>

                          {/* Icon */}
                          <div className="pf-badge2-emoji">{badge.icon}</div>

                          {/* Name */}
                          <span className="pf-badge2-name">
                            {isKo ? badge.label_ko : badge.label_vi}
                          </span>

                          {/* Progress bar (locked only) */}
                          {!isEarned && (
                            <div className="pf-badge2-progress">
                              <div className="pf-badge2-prog-bar">
                                <div className="pf-badge2-prog-fill" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="pf-badge2-prog-text">{progText}</span>
                            </div>
                          )}

                          {/* Lock overlay */}
                          {!isEarned && <span className="pf-badge2-lock">🔒</span>}

                          {/* Shine overlay for earned */}
                          {isEarned && <span className="pf-badge2-shine" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>

        </>
      ) : (
        /* ===== GUEST: Compact login banner + gear ===== */
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="pf-settings-gear-btn pf-settings-gear-btn--guest"
            onClick={() => setShowSettings(true)}
            title={isKo ? '설정' : 'Cài đặt'}
          >
            <Settings size={18} />
          </button>
          <div className="pf-guest-banner" onClick={() => setShowAuthInline(true)}>
            <div className="pf-guest-banner-text">
              <span className="pf-guest-banner-title">{isKo ? '로그인하고 데이터를 안전하게 보관하세요' : 'Đăng nhập để lưu dữ liệu an toàn'}</span>
            </div>
            <button
              type="button"
              className="pf-guest-login-btn"
              onClick={(e) => { e.stopPropagation(); setShowAuthInline(true); }}
            >
              {isKo ? '로그인' : 'Đăng nhập'}
            </button>
          </div>
        </div>
      )}

      {/* ===== SETTINGS BOTTOM SHEET ===== */}
      {showSettings && (
        <div className="pf-settings-sheet-overlay" onClick={() => setShowSettings(false)}>
          <div className="pf-settings-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="pf-settings-sheet-handle" />
            <div className="pf-settings-sheet-head">
              <h3>{isKo ? '설정' : 'Cài đặt'}</h3>
              <button type="button" onClick={() => setShowSettings(false)}><X size={20} /></button>
            </div>
            <div className="pf-settings-sheet-body">

              {/* TÀI KHOẢN — chỉ khi đã đăng nhập */}
              {session && (
                <div className="pf-settings-group">
                  <div className="pf-settings-group-label">{isKo ? '계정' : 'TÀI KHOẢN'}</div>
                  <div className="pf-settings-card">
                    <div className="pf-setting-row mini pf-account-info-row">
                      <div className="pf-setting-icon"><LogIn size={16} /></div>
                      <span className="pf-account-email">{session.user.email}</span>
                      <button className="pf-pop-signout" onClick={handleSignOut} style={{ marginLeft: 'auto' }}>
                        <LogOut size={14} /> {isKo ? '로그아웃' : 'Đăng xuất'}
                      </button>
                    </div>
                    <div className="pf-setting-divider" />
                    <button type="button" className="pf-setting-row mini" onClick={() => setIsEditing(!isEditing)}>
                      <div className="pf-setting-icon"><PenLine size={16} /></div>
                      <span>{isKo ? '프로필 수정' : 'Chỉnh sửa hồ sơ'}</span>
                      <ChevronRight size={16} style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: isEditing ? 'rotate(90deg)' : 'none' }} />
                    </button>
                    {isEditing && (
                      <div className="pf-edit-form compact" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12, marginTop: 4 }}>
                        <div className="pf-pop-field">
                          <span>{isKo ? '닉네임' : 'Tên hiển thị'}</span>
                          <input className="pf-input" placeholder={isKo ? '닉네임 입력' : 'Nhập tên...'} value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} />
                        </div>
                        <div className="pf-pop-field" style={{ position: 'relative' }}>
                          <span>{isKo ? '학교' : 'Trường học'}</span>
                          <input className="pf-input" placeholder={isKo ? '학교 이름' : 'Tên trường...'} value={profile.school} onChange={(e) => handleSchoolChange(e.target.value)} />
                          {schoolSuggestions.length > 0 && (
                            <div className="pf-autocomplete-list">
                              {schoolSuggestions.map((s, idx) => (
                                <div key={idx} className="pf-autocomplete-item" onClick={() => selectSchool(s)}>
                                  <div className="pf-ac-en">{s.en}</div>
                                  <div className="pf-ac-ko">{s.ko}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="pf-pop-field" style={{ position: 'relative' }}>
                          <span>{isKo ? '지역' : 'Khu vực'}</span>
                          <input className="pf-input" placeholder={isKo ? '서울 노원구' : 'Ví dụ: Seoul Nowon-gu'} value={profile.region} onChange={(e) => handleRegionChange(e.target.value)} />
                          {regionSuggestions.length > 0 && (
                            <div className="pf-autocomplete-list">
                              {regionSuggestions.map((r, idx) => (
                                <div key={idx} className="pf-autocomplete-item" onClick={() => selectRegion(r)}>
                                  <div className="pf-ac-en">{r.en}</div>
                                  <div className="pf-ac-ko">{r.ko}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="pf-pop-field">
                          <span>{isKo ? '소개' : 'Giới thiệu bản thân'}</span>
                          <textarea className="pf-input pf-textarea" placeholder={isKo ? '자신을 소개해주세요' : 'Viết vài dòng giới thiệu...'} rows={2} value={profile.note || ''} onChange={(e) => setProfile({ ...profile, note: e.target.value })} />
                        </div>
                        <div className="pf-pop-field">
                          <span>{isKo ? '관심사 (태그)' : 'Sở thích / Mục tiêu (Thẻ)'}</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                            {profileTags.map(tag => {
                              const isSelected = profile.tags?.includes(tag);
                              return (
                                <button key={tag} type="button"
                                  onClick={() => {
                                    const currentTags = profile.tags || [];
                                    const newTags = isSelected ? currentTags.filter(t => t !== tag) : [...currentTags, tag];
                                    if (newTags.length <= 4) setProfile({ ...profile, tags: newTags });
                                  }}
                                  style={{ padding: '6px 12px', borderRadius: '16px', border: `1px solid ${isSelected ? '#2752ff' : '#e2e8f0'}`, background: isSelected ? 'rgba(39,82,255,0.08)' : 'transparent', color: isSelected ? '#2752ff' : '#64748b', fontSize: '13px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
                                >{tag}</button>
                              );
                            })}
                          </div>
                          <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{isKo ? '최대 4개 선택 가능' : 'Chọn tối đa 4 thẻ'}</span>
                        </div>
                        <button type="button" className="pf-save-btn" onClick={() => { saveProfile(profile); setIsEditing(false); }} disabled={savingProfile}>
                          {savingProfile ? '...' : (isKo ? '저장' : 'Lưu thay đổi')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* QUẢN TRỊ — admin only */}
              {canOpenAdmin && (
                <div className="pf-settings-group">
                  <div className="pf-settings-group-label">{isKo ? '관리자' : 'QUẢN TRỊ'}</div>
                  <div className="pf-settings-card">
                    <button type="button" className="pf-setting-row mini" onClick={() => { setShowSettings(false); onOpenAdmin ? onOpenAdmin() : (window.location.hash = 'admin'); }}>
                      <div className="pf-setting-icon"><Shield size={16} /></div>
                      <span>{isKo ? '관리자 대시보드' : 'Dashboard admin'}</span>
                      <ChevronRight size={16} style={{ marginLeft: 'auto' }} />
                    </button>
                  </div>
                </div>
              )}

              {/* ỨNG DỤNG */}
              <div className="pf-settings-group">
                <div className="pf-settings-group-label">{isKo ? '일반' : 'ỨNG DỤNG'}</div>
                <div className="pf-settings-card">
                  <div className="pf-setting-row mini" onClick={onToggleDarkMode} style={{ cursor: 'pointer' }}>
                    <div className="pf-setting-icon">{isDarkMode ? <Moon size={16} /> : <Sun size={16} />}</div>
                    <span>{isKo ? '다크 모드' : 'Chế độ tối'}</span>
                    <div className="pf-toggle" data-active={isDarkMode} style={{ marginLeft: 'auto' }}><div className="pf-toggle-knob" /></div>
                  </div>
                  <div className="pf-setting-divider" />
                  <div className="pf-setting-row mini" onClick={() => setShowWallpaperPicker(!showWallpaperPicker)} style={{ cursor: 'pointer' }}>
                    <div className="pf-setting-icon"><Palette size={16} /></div>
                    <span>{isKo ? '배경화면' : 'Hình nền'}</span>
                    <ChevronRight size={16} style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: showWallpaperPicker ? 'rotate(90deg)' : 'none' }} />
                  </div>
                  {showWallpaperPicker && (
                    <div className="pf-wallpaper-grid compact" style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 12 }}>
                      {WALLPAPERS.map((w) => (
                        <button key={w.key} className={`pf-wallpaper-item ${wallpaper === w.key ? 'active' : ''}`} onClick={() => onChangeWallpaper(w.key)}>
                          <div className="pf-wallpaper-preview" style={{ background: w.preview }} />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="pf-setting-divider" />
                  <div className="pf-setting-row mini">
                    <div className="pf-setting-icon"><Globe size={16} /></div>
                    <span>{isKo ? '언어' : 'Ngôn ngữ'}</span>
                    <div className="pf-lang-toggle mini" style={{ marginLeft: 'auto' }}>
                      <button className={lang === 'vi' ? 'active' : ''} onClick={() => onChangeLang('vi')}>VI</button>
                      <button className={lang === 'ko' ? 'active' : ''} onClick={() => onChangeLang('ko')}>KO</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* STORE SAFETY */}
              <div className="pf-settings-group">
                <div className="pf-settings-group-label">{isKo ? '지원' : 'STORE SAFETY'}</div>
                <div className="pf-settings-card">
                  <button type="button" className="pf-setting-row mini" onClick={() => setPolicyPanel('privacy')}>
                    <div className="pf-setting-icon"><Shield size={16} /></div>
                    <span>{isKo ? '개인정보 처리방침' : 'Chính sách bảo mật'}</span>
                    <ChevronRight size={16} style={{ marginLeft: 'auto' }} />
                  </button>
                  <div className="pf-setting-divider" />
                  <button type="button" className="pf-setting-row mini" onClick={() => setPolicyPanel('terms')}>
                    <div className="pf-setting-icon"><Info size={16} /></div>
                    <span>{isKo ? '이용약관' : 'Điều khoản sử dụng'}</span>
                    <ChevronRight size={16} style={{ marginLeft: 'auto' }} />
                  </button>
                  <div className="pf-setting-divider" />
                  <button type="button" className="pf-setting-row mini" onClick={() => setPolicyPanel('support')}>
                    <div className="pf-setting-icon"><MessageCircle size={16} /></div>
                    <span>{isKo ? '지원 문의' : 'Liên hệ hỗ trợ'}</span>
                    <ChevronRight size={16} style={{ marginLeft: 'auto' }} />
                  </button>
                  {session && (
                    <>
                      <div className="pf-setting-divider" />
                      <button type="button" className="pf-setting-row mini pf-danger-row" onClick={() => setPolicyPanel('delete')}>
                        <div className="pf-setting-icon"><LogOut size={16} /></div>
                        <span>{isKo ? '계정 삭제 요청' : 'Yêu cầu xoá tài khoản'}</span>
                        <ChevronRight size={16} style={{ marginLeft: 'auto' }} />
                      </button>
                    </>
                  )}
                </div>
              </div>

            </div>{/* /sheet-body */}
          </div>{/* /sheet */}
        </div>
      )}

      {/* ===== AUTH OVERLAY for guests ===== */}
      {showAuthInline && !session && (
        <div className="pf-settings-overlay" onClick={() => setShowAuthInline(false)}>
          <div className="pf-settings-popover" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="pf-popover-head">
              <h3>{authMode === 'register' ? (isKo ? '회원가입' : 'Tạo tài khoản') : authMode === 'forgot' ? (isKo ? '비밀번호 재설정' : 'Quên mật khẩu') : (isKo ? '로그인' : 'Đăng nhập')}</h3>
              <button type="button" onClick={() => setShowAuthInline(false)}><X size={20} /></button>
            </div>
            <div className="pf-popover-body">
              <form onSubmit={handleAuth} className="pf-auth-form">
                <div className="pf-field">
                  <label>{isKo ? '이메일' : 'Email'}</label>
                  <input className="pf-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="duhocmate@email.com" required />
                </div>
                {authMode !== 'forgot' && (
                  <div className="pf-field">
                    <label>{isKo ? '비밀번호' : 'Mật khẩu'}</label>
                    <div className="pf-password-wrap">
                      <input className="pf-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="······" required minLength={6} />
                      <button type="button" className="pf-eye-btn" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}
                {authMode === 'register' && (
                  <>
                    <div className="pf-field">
                      <label>{isKo ? '비밀번호 확인' : 'Xác nhận mật khẩu'}</label>
                      <input className="pf-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="······" required minLength={6} />
                    </div>
                    <div className="pf-divider" />
                    <div className="pf-field">
                      <label>{isKo ? '닉네임' : 'Tên hiển thị'}</label>
                      <input className="pf-input" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder={isKo ? '닉네임 입력' : 'Nhập tên...'} required />
                    </div>
                    <div className="pf-field" style={{ position: 'relative' }}>
                      <label>{isKo ? '학교' : 'Trường đang theo học'}</label>
                      <input className="pf-input" value={regSchool} onChange={(e) => handleRegSchoolChange(e.target.value)} placeholder={isKo ? '학교 이름' : 'Tên trường...'} />
                      {regSchoolSuggestions.length > 0 && (
                        <div className="pf-autocomplete-list">
                          {regSchoolSuggestions.map((s, idx) => (
                            <div key={idx} className="pf-autocomplete-item" onClick={() => selectRegSchool(s)}>
                              <div className="pf-ac-main">{s.en}</div>
                              <div className="pf-ac-sub">{s.ko}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="pf-field" style={{ position: 'relative' }}>
                      <label>{isKo ? '지역' : 'Khu vực'}</label>
                      <input className="pf-input" placeholder={isKo ? '서울 노원구' : 'Ví dụ: Seoul Nowon-gu'} value={regRegion} onChange={(e) => handleRegRegionChange(e.target.value)} />
                      {regRegionSuggestions.length > 0 && (
                        <div className="pf-autocomplete-list">
                          {regRegionSuggestions.map((r, idx) => (
                            <div key={idx} className="pf-autocomplete-item" onClick={() => selectRegRegion(r)}>
                              <div className="pf-ac-en">{r.en}</div>
                              <div className="pf-ac-ko">{r.ko}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <button type="submit" className="pf-submit-btn" disabled={loading}>
                  {authMode === 'login' ? <LogIn size={16} /> : authMode === 'register' ? <UserPlus size={16} /> : <KeyRound size={16} />}
                  {loading ? (isKo ? '처리 중...' : 'Đang xử lý...') : authMode === 'login' ? (isKo ? '로그인' : 'Đăng nhập') : authMode === 'register' ? (isKo ? '가입하기' : 'Tạo tài khoản') : (isKo ? '재설정 링크 보내기' : 'Gửi link đặt lại')}
                </button>
              </form>
              {authMode !== 'forgot' && (
                <div className="pf-social-auth">
                  <div className="pf-divider-text"><span>{isKo ? '또는' : 'Hoặc tiếp tục với'}</span></div>
                  <div className="pf-social-grid">
                    <button type="button" className="pf-social-btn fb" onClick={() => handleSocialLogin('facebook')} disabled={loading}>
                      <Facebook size={18} fill="currentColor" /><span>Facebook</span>
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
              <div className="pf-auth-switch">
                {authMode === 'login' ? (
                  <>
                    <button type="button" onClick={() => { setAuthMode('register'); setAuthMessage(''); }}>{isKo ? '계정이 없으신가요? 회원가입' : 'Chưa có tài khoản? Đăng ký'}</button>
                    <button type="button" onClick={() => { setAuthMode('forgot'); setAuthMessage(''); }}>{isKo ? '비밀번호를 잊으셨나요?' : 'Quên mật khẩu?'}</button>
                  </>
                ) : (
                  <button type="button" onClick={() => { setAuthMode('login'); setAuthMessage(''); }}>{isKo ? '로그인으로 돌아가기' : authMode === 'register' ? 'Đã có tài khoản? Đăng nhập' : 'Quay lại đăng nhập'}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {policyPanel ? (
        <div className="pf-policy-overlay" onClick={() => setPolicyPanel(null)}>
          <div className="pf-policy-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="pf-popover-head">
              <h3>
                {policyPanel === 'privacy'
                  ? (isKo ? '개인정보 처리방침' : 'Chính sách bảo mật')
                  : policyPanel === 'terms'
                    ? (isKo ? '이용약관' : 'Điều khoản sử dụng')
                    : policyPanel === 'support'
                      ? (isKo ? '지원 문의' : 'Liên hệ hỗ trợ')
                      : (isKo ? '계정 삭제 요청' : 'Yêu cầu xoá tài khoản')}
              </h3>
              <button type="button" onClick={() => setPolicyPanel(null)}><X size={20} /></button>
            </div>
            {policyPanel === 'delete' ? (
              <div className="pf-policy-body">
                <div className="pf-policy-warn-box">
                  <p>⚠️ <strong>Cảnh báo – Hành động không thể hoàn tác</strong></p>
                  <p>Tài khoản và toàn bộ dữ liệu sẽ bị <strong>xoá vĩnh viễn ngay lập tức</strong>, bao gồm: lịch làm việc, chi tiêu, bài viết, bình luận và hồ sơ cá nhân.</p>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: '4px 0 12px' }}>
                  Tài khoản đang đăng nhập: <strong>{session?.user.email}</strong>
                </p>

                <textarea
                  className="pf-input pf-textarea"
                  rows={3}
                  value={deleteReason}
                  onChange={(event) => setDeleteReason(event.target.value)}
                  placeholder="Lý do xoá tài khoản (tuỳ chọn)"
                />

                <label className="pf-delete-confirm-label">
                  <input
                    type="checkbox"
                    checked={deleteConfirmed}
                    onChange={(e) => setDeleteConfirmed(e.target.checked)}
                  />
                  <span>Tôi hiểu rằng dữ liệu sẽ bị xoá vĩnh viễn và không thể khôi phục</span>
                </label>

                <button
                  type="button"
                  className="pf-delete-account-btn"
                  disabled={loading || !deleteConfirmed}
                  onClick={() => void handleDeleteAccount()}
                >
                  {loading ? 'Đang xoá tài khoản...' : 'Xoá tài khoản ngay'}
                </button>
              </div>
            ) : (
              <div className="pf-policy-body">
                {policyPanel === 'privacy' ? (
                  <>
                    <p className="pf-policy-updated">Cập nhật lần cuối: 01/05/2025</p>

                    <h4 className="pf-policy-h">1. Thông tin chúng tôi thu thập</h4>
                    <p>DuhocMate thu thập các thông tin sau khi bạn đăng ký và sử dụng ứng dụng:</p>
                    <ul className="pf-policy-list">
                      <li>Thông tin tài khoản: tên hiển thị, địa chỉ email, ảnh đại diện</li>
                      <li>Thông tin công việc: tên nơi làm, ca làm việc, mức lương, chi tiêu</li>
                      <li>Nội dung cộng đồng: bài viết, bình luận, đánh giá địa điểm</li>
                      <li>Dữ liệu sử dụng: thời gian truy cập, thiết bị, phiên bản ứng dụng</li>
                    </ul>

                    <h4 className="pf-policy-h">2. Mục đích sử dụng</h4>
                    <ul className="pf-policy-list">
                      <li>Đồng bộ dữ liệu giữa các thiết bị của bạn</li>
                      <li>Cung cấp tính năng cộng đồng và kết nối người dùng</li>
                      <li>Cải thiện chất lượng dịch vụ và trải nghiệm người dùng</li>
                      <li>Gửi thông báo quan trọng liên quan đến tài khoản</li>
                    </ul>

                    <h4 className="pf-policy-h">3. Chia sẻ dữ liệu</h4>
                    <p>DuhocMate <strong>không bán, không cho thuê</strong> dữ liệu cá nhân của bạn cho bên thứ ba. Dữ liệu chỉ được chia sẻ trong các trường hợp:</p>
                    <ul className="pf-policy-list">
                      <li>Yêu cầu hợp pháp từ cơ quan nhà nước có thẩm quyền</li>
                      <li>Các nhà cung cấp dịch vụ kỹ thuật (Supabase) phục vụ vận hành ứng dụng</li>
                    </ul>

                    <h4 className="pf-policy-h">4. Bảo mật dữ liệu</h4>
                    <p>Dữ liệu được mã hoá trong quá trình truyền (HTTPS/TLS) và lưu trữ trên hạ tầng đám mây bảo mật. Chúng tôi áp dụng các biện pháp kỹ thuật phù hợp để ngăn chặn truy cập trái phép.</p>

                    <h4 className="pf-policy-h">5. Quyền của bạn</h4>
                    <ul className="pf-policy-list">
                      <li>Yêu cầu xem, chỉnh sửa hoặc xoá dữ liệu cá nhân</li>
                      <li>Rút lại sự đồng ý bất kỳ lúc nào</li>
                      <li>Yêu cầu xoá tài khoản hoàn toàn trong mục Cài đặt</li>
                    </ul>
                    <p>Liên hệ: <strong>duhocmate@gmail.com</strong></p>
                  </>
                ) : policyPanel === 'terms' ? (
                  <>
                    <p className="pf-policy-updated">Cập nhật lần cuối: 01/05/2025</p>

                    <h4 className="pf-policy-h">1. Chấp nhận điều khoản</h4>
                    <p>Khi sử dụng DuhocMate, bạn đồng ý tuân thủ các điều khoản này. Nếu không đồng ý, vui lòng ngừng sử dụng ứng dụng.</p>

                    <h4 className="pf-policy-h">2. Mô tả dịch vụ</h4>
                    <p>DuhocMate là ứng dụng hỗ trợ du học sinh, thực tập sinh tại Hàn Quốc quản lý lịch làm việc, thu nhập, chi tiêu và kết nối cộng đồng. Thông tin về lương, thuế, phụ cấp chỉ mang tính <strong>tham khảo</strong>, không thay thế tư vấn pháp lý hoặc tài chính chuyên nghiệp.</p>

                    <h4 className="pf-policy-h">3. Nghĩa vụ người dùng</h4>
                    <ul className="pf-policy-list">
                      <li>Cung cấp thông tin chính xác khi đăng ký</li>
                      <li>Bảo mật thông tin đăng nhập, không chia sẻ tài khoản</li>
                      <li>Chịu trách nhiệm về mọi hoạt động dưới tài khoản của mình</li>
                    </ul>

                    <h4 className="pf-policy-h">4. Nội dung bị cấm</h4>
                    <ul className="pf-policy-list">
                      <li>Nội dung quấy rối, phân biệt đối xử, thù địch</li>
                      <li>Thông tin cá nhân của người khác khi chưa được phép</li>
                      <li>Lừa đảo, spam, quảng cáo không được phép</li>
                      <li>Nội dung vi phạm pháp luật Hàn Quốc hoặc Việt Nam</li>
                      <li>Thông tin sai lệch gây hoang mang cộng đồng</li>
                    </ul>

                    <h4 className="pf-policy-h">5. Xử lý vi phạm</h4>
                    <p>DuhocMate có quyền xoá nội dung vi phạm, tạm khoá hoặc xoá vĩnh viễn tài khoản mà không cần báo trước trong trường hợp vi phạm nghiêm trọng.</p>

                    <h4 className="pf-policy-h">6. Giới hạn trách nhiệm</h4>
                    <p>DuhocMate không chịu trách nhiệm về thiệt hại phát sinh từ việc sử dụng thông tin trong ứng dụng cho các quyết định tài chính, pháp lý hoặc nghề nghiệp.</p>

                    <h4 className="pf-policy-h">7. Thay đổi điều khoản</h4>
                    <p>Điều khoản có thể được cập nhật. Thay đổi quan trọng sẽ được thông báo qua ứng dụng. Tiếp tục sử dụng đồng nghĩa với việc chấp nhận điều khoản mới.</p>
                  </>
                ) : (
                  <>
                    <h4 className="pf-policy-h">Liên hệ chúng tôi</h4>
                    <div className="pf-support-card">
                      <span className="pf-support-icon">✉️</span>
                      <div>
                        <p className="pf-support-label">Email hỗ trợ</p>
                        <p className="pf-support-value">duhocmate@gmail.com</p>
                      </div>
                    </div>
                    <div className="pf-support-card">
                      <span className="pf-support-icon">⏱️</span>
                      <div>
                        <p className="pf-support-label">Thời gian phản hồi</p>
                        <p className="pf-support-value">Trong vòng 24–48 giờ (ngày làm việc)</p>
                      </div>
                    </div>

                    <h4 className="pf-policy-h" style={{ marginTop: 20 }}>Báo cáo nội dung vi phạm</h4>
                    <p>Nếu bạn gặp bài viết, bình luận hoặc tài khoản vi phạm, hãy nhấn nút <strong>Báo cáo</strong> ngay trong ứng dụng để admin có đủ ngữ cảnh xử lý nhanh nhất.</p>

                    <h4 className="pf-policy-h">Các vấn đề thường gặp</h4>
                    <ul className="pf-policy-list">
                      <li>Không đăng nhập được → kiểm tra email & mật khẩu, thử "Quên mật khẩu"</li>
                      <li>Dữ liệu không đồng bộ → kiểm tra kết nối mạng, tải lại trang</li>
                      <li>Quên mật khẩu → nhấn "Quên mật khẩu" tại màn hình đăng nhập</li>
                      <li>Muốn đổi email → liên hệ qua email hỗ trợ bên trên</li>
                    </ul>

                    <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 16 }}>Khi gửi email, hãy cung cấp: tên tài khoản, mô tả vấn đề và ảnh chụp màn hình (nếu có) để được hỗ trợ nhanh hơn.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
