import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, House, MessageCircleMore, UserRound, WalletCards, Bell, ThumbsUp, MessageCircle, X, Megaphone, Users, MessageSquare, Check } from 'lucide-react';
import { hasSupabaseConfig, supabase as supabaseClient } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import { HomeScreen } from './HomeScreen';
import { WALLPAPERS, type WallpaperKey } from '../lib/wallpapers';
import { AppLockOverlay } from './AppLockOverlay';
import { timeAgo } from '../data/communityData';
import { shiftMonth } from '../utils/helpers';
import { localDateStr } from '../lib/localDate';
import type { Tab } from '../lib/types';
import { recordAppVisit } from '../lib/appVisits';
import { getGuestSessionId } from '../lib/guestSession';
import { enqueueSyncItem } from '../lib/offlineSyncQueue';

const CalendarScreen = lazy(() => import('./CalendarScreen').then((m) => ({ default: m.CalendarScreen })));
const IncomeScreen = lazy(() => import('./IncomeScreen').then((m) => ({ default: m.IncomeScreen })));
const CommunityScreen = lazy(() => import('./CommunityScreen').then((m) => ({ default: m.CommunityScreen })));
const ProfileScreen = lazy(() => import('./ProfileScreen').then((m) => ({ default: m.ProfileScreen })));
const AdminScreen = lazy(() => import('./AdminScreen').then((m) => ({ default: m.AdminScreen })));

/* ── i18n labels for bottom tabs ── */
const tabLabels: Record<string, Record<Tab, string>> = {
  vi: { home: 'Trang chủ', calendar: 'Lịch', income: 'Thu nhập', friends: 'Cộng đồng', profile: 'Hồ sơ', admin: 'Quản trị' },
  ko: { home: '홈', calendar: '캘린더', income: '수입', friends: '커뮤니티', profile: '프로필', admin: '관리자' },
};

const tabIcons: Array<{ id: Exclude<Tab, 'admin'>; icon: typeof House }> = [
  { id: 'home', icon: House },
  { id: 'calendar', icon: CalendarDays },
  { id: 'income', icon: WalletCards },
  { id: 'friends', icon: MessageCircleMore },
  { id: 'profile', icon: UserRound },
];

type AppLang = 'vi' | 'ko';

const WALLPAPER_THEME_VARS: Record<string, CSSProperties> = {
  default: {
    '--theme-accent': '#2752ff',
    '--theme-hero-bg': 'radial-gradient(circle at 86% 12%, rgba(215, 255, 95, 0.34), transparent 24%), radial-gradient(circle at 12% 100%, rgba(38, 217, 164, 0.24), transparent 32%), linear-gradient(135deg, #253adf 0%, #4f73ff 54%, #6b5cf6 100%)',
    '--theme-hero-sheen': 'linear-gradient(110deg, rgba(255, 255, 255, 0.18), transparent 42%)',
    '--theme-hero-shadow': '0 18px 38px rgba(39, 82, 255, 0.18)',
    // default inherits global --text-* vars
  } as CSSProperties,
  ocean: {
    '--theme-accent': '#0284c7',
    '--theme-hero-bg': 'radial-gradient(circle at 86% 12%, rgba(240, 249, 255, 0.58), transparent 25%), radial-gradient(circle at 10% 96%, rgba(125, 211, 252, 0.24), transparent 32%), linear-gradient(135deg, #0369a1 0%, #38bdf8 56%, #0f8fc8 100%)',
    '--theme-hero-sheen': 'linear-gradient(110deg, rgba(255, 255, 255, 0.22), transparent 44%)',
    '--theme-hero-shadow': '0 18px 38px rgba(14, 165, 233, 0.18)',
    '--text-main':  '#082f49',   // xanh biển rất tối
    '--text-soft':  '#0c4a6e',   // sky-900
    '--text-faint': '#075985',   // sky-800 — đủ tương phản trên nền cyan nhạt
  } as CSSProperties,
  sunset: {
    '--theme-accent': '#d97706',
    '--theme-hero-bg': 'radial-gradient(circle at 84% 14%, rgba(255, 247, 237, 0.58), transparent 25%), radial-gradient(circle at 12% 100%, rgba(251, 146, 60, 0.22), transparent 32%), linear-gradient(135deg, #c2410c 0%, #f59e0b 54%, #ea580c 100%)',
    '--theme-hero-sheen': 'linear-gradient(110deg, rgba(255, 255, 255, 0.22), transparent 44%)',
    '--theme-hero-shadow': '0 18px 38px rgba(217, 119, 6, 0.18)',
    '--text-main':  '#431407',   // orange-950
    '--text-soft':  '#7c2d12',   // orange-900
    '--text-faint': '#92400e',   // amber-800 — ấm, tương phản tốt trên nền vàng-cam
  } as CSSProperties,
  forest: {
    '--theme-accent': '#059669',
    '--theme-hero-bg': 'radial-gradient(circle at 86% 12%, rgba(240, 253, 244, 0.58), transparent 25%), radial-gradient(circle at 12% 100%, rgba(74, 222, 128, 0.22), transparent 32%), linear-gradient(135deg, #047857 0%, #22c55e 55%, #0f9f6e 100%)',
    '--theme-hero-sheen': 'linear-gradient(110deg, rgba(255, 255, 255, 0.22), transparent 44%)',
    '--theme-hero-shadow': '0 18px 38px rgba(5, 150, 105, 0.18)',
    '--text-main':  '#052e16',   // green-950
    '--text-soft':  '#14532d',   // green-900
    '--text-faint': '#166534',   // green-800 — tương phản tốt trên nền xanh lá nhạt
  } as CSSProperties,
  lavender: {
    '--theme-accent': '#7c3aed',
    '--theme-hero-bg': 'radial-gradient(circle at 86% 12%, rgba(250, 245, 255, 0.56), transparent 25%), radial-gradient(circle at 12% 100%, rgba(167, 139, 250, 0.22), transparent 32%), linear-gradient(135deg, #6d28d9 0%, #a78bfa 54%, #7c3aed 100%)',
    '--theme-hero-sheen': 'linear-gradient(110deg, rgba(255, 255, 255, 0.2), transparent 44%)',
    '--theme-hero-shadow': '0 18px 38px rgba(124, 58, 237, 0.18)',
    '--text-main':  '#2e1065',   // violet-950
    '--text-soft':  '#4c1d95',   // violet-900
    '--text-faint': '#5b21b6',   // violet-800 — tương phản tốt trên nền tím nhạt
  } as CSSProperties,
  rose: {
    '--theme-accent': '#be123c',
    '--theme-hero-bg': 'radial-gradient(circle at 86% 12%, rgba(255, 241, 242, 0.58), transparent 25%), radial-gradient(circle at 12% 100%, rgba(251, 113, 133, 0.2), transparent 32%), linear-gradient(135deg, #be123c 0%, #fb7185 54%, #db2777 100%)',
    '--theme-hero-sheen': 'linear-gradient(110deg, rgba(255, 255, 255, 0.22), transparent 44%)',
    '--theme-hero-shadow': '0 18px 38px rgba(190, 18, 60, 0.18)',
    '--text-main':  '#4c0519',   // rose-950
    '--text-soft':  '#881337',   // rose-900
    '--text-faint': '#9f1239',   // rose-800 — tương phản tốt trên nền hồng nhạt
  } as CSSProperties,
  vietnam: {
    '--theme-accent': '#dc2626',
    '--theme-hero-bg': 'radial-gradient(circle at 16% 12%, rgba(255, 213, 79, 0.78) 0 8%, transparent 9%), radial-gradient(ellipse at 84% 18%, rgba(255, 255, 255, 0.52), transparent 22%), radial-gradient(ellipse at 16% 90%, rgba(16, 185, 129, 0.20), transparent 32%), linear-gradient(135deg, #b91c1c 0%, #ef4444 52%, #f59e0b 100%)',
    '--theme-hero-sheen': 'linear-gradient(110deg, rgba(255, 255, 255, 0.24), transparent 42%)',
    '--theme-hero-shadow': '0 18px 38px rgba(220, 38, 38, 0.20)',
    '--text-main': '#450a0a',
    '--text-soft': '#7f1d1d',
    '--text-faint': '#991b1b',
  } as CSSProperties,
  korea: {
    '--theme-accent': '#2563eb',
    '--theme-hero-bg': 'radial-gradient(circle at 72% 16%, rgba(239, 68, 68, 0.34), transparent 18%), radial-gradient(circle at 28% 20%, rgba(37, 99, 235, 0.34), transparent 20%), radial-gradient(ellipse at 88% 86%, rgba(20, 184, 166, 0.20), transparent 30%), linear-gradient(135deg, #1d4ed8 0%, #60a5fa 48%, #ef4444 120%)',
    '--theme-hero-sheen': 'linear-gradient(110deg, rgba(255, 255, 255, 0.24), transparent 44%)',
    '--theme-hero-shadow': '0 18px 38px rgba(37, 99, 235, 0.20)',
    '--text-main': '#172554',
    '--text-soft': '#1e3a8a',
    '--text-faint': '#1d4ed8',
  } as CSSProperties,
  futureCat: {
    '--theme-accent': '#0284c7',
    '--theme-hero-bg': 'radial-gradient(circle at 50% 16%, rgba(255, 255, 255, 0.74), transparent 18%), radial-gradient(circle at 15% 20%, rgba(14, 165, 233, 0.35), transparent 22%), radial-gradient(circle at 88% 74%, rgba(250, 204, 21, 0.28), transparent 22%), linear-gradient(135deg, #0284c7 0%, #38bdf8 52%, #2563eb 100%)',
    '--theme-hero-sheen': 'linear-gradient(110deg, rgba(255, 255, 255, 0.26), transparent 44%)',
    '--theme-hero-shadow': '0 18px 38px rgba(2, 132, 199, 0.22)',
    '--text-main': '#082f49',
    '--text-soft': '#075985',
    '--text-faint': '#0369a1',
  } as CSSProperties,
};

const REFRESH_RATE_URL = 'https://api.coinbase.com/v2/exchange-rates?currency=KRW';

const ANNOUNCEMENT_PERM_HIDE_KEY = 'duhocmate-announcement-perm-hide'; // user bấm "không hiển thị lại"
const ANNOUNCEMENT_SESSION_DISMISS_KEY = 'duhocmate-announcement-session-dismissed';
const ANNOUNCEMENT_AUTO_DISMISS_MS = 12000;
const ANNOUNCEMENT_TTL_MS = 24 * 60 * 60 * 1000; // 24h kể từ created_at
const FIRST_SETUP_KEY = 'duhoc-mate-first-setup-v1';
const COMPANION_STORAGE_KEY = 'duhoc-mate-ach-companion';
const COMPANION_CHANGE_EVENT = 'duhoc-mate-ach-companion-change';

const FIRST_SETUP_COMPANIONS = [
  { key: 'hamster', imgKey: 'companion_hamster', label_vi: 'Mầm Non', label_ko: '새싹 친구' },
  { key: 'cat', imgKey: 'companion_cat', label_vi: 'Mèo Thần Tài', label_ko: '지갑 고양이' },
  { key: 'bunny', imgKey: 'companion_bunny', label_vi: 'Thỏ Tiết Kiệm', label_ko: '저축 토끼' },
  { key: 'bear', imgKey: 'companion_bear', label_vi: 'Gấu Chăm Chỉ', label_ko: '성실한 곰' },
  { key: 'fox', imgKey: 'companion_fox', label_vi: 'Cáo Nhanh Nhẹn', label_ko: '계획 여우' },
  { key: 'star', imgKey: 'companion_star', label_vi: 'Sao May Mắn', label_ko: '행운 별' },
];

const FIRST_SETUP_WALLPAPER_KEYS: WallpaperKey[] = ['default', 'futureCat', 'vietnam', 'korea', 'ocean', 'sunset', 'forest', 'lavender', 'rose'];

function iconUrl(name: string) {
  return `${import.meta.env.BASE_URL}icon/${name}.png?v=20260518-ach`;
}

function getStoredCompanionKey() {
  if (typeof window === 'undefined') return 'fox';
  const stored = window.localStorage.getItem(COMPANION_STORAGE_KEY);
  return FIRST_SETUP_COMPANIONS.some((option) => option.key === stored) ? stored! : 'fox';
}

export default function AppLayout() {
  const store = useAppStore();
  const wasDaySheetOpenRef = useRef(false);
  const [activeBanner, setActiveBanner] = useState<{ id: string; title: string; body: string; severity: string; created_at: string } | null>(null);
  const [communityTargetPostId, setCommunityTargetPostId] = useState<string | null>(null);
  const [showFirstSetup, setShowFirstSetup] = useState(() => (
    typeof window !== 'undefined' ? window.localStorage.getItem(FIRST_SETUP_KEY) !== '1' : false
  ));
  const [setupCompanion, setSetupCompanion] = useState(() => getStoredCompanionKey());
  const [setupWallpaper, setSetupWallpaper] = useState<WallpaperKey>(() => store.wallpaper || 'default');

  const finishFirstSetup = useCallback((markSkipped = false) => {
    const companionKey = FIRST_SETUP_COMPANIONS.some((option) => option.key === setupCompanion) ? setupCompanion : 'fox';
    window.localStorage.setItem(COMPANION_STORAGE_KEY, companionKey);
    window.dispatchEvent(new CustomEvent(COMPANION_CHANGE_EVENT, { detail: companionKey }));
    if (!markSkipped) store.setWallpaper(setupWallpaper);
    window.localStorage.setItem(FIRST_SETUP_KEY, '1');
    setShowFirstSetup(false);
  }, [setupCompanion, setupWallpaper, store]);

  // Ping visitor tracking – ghi nhận lượt truy cập (guest + registered)
  useEffect(() => {
    void recordAppVisit(store.session?.user.id ?? null);
  }, [store.session]);

  // Fetch latest admin announcement and show it as an entry popup for signed-in users.
  useEffect(() => {
    if (!supabaseClient || !store.session) {
      setActiveBanner(null);
      return;
    }
    const client = supabaseClient;

    const shouldShow = (item: { id: string; created_at: string }) => {
      // 1. Thông báo đã quá 24h kể từ khi tạo → không hiện với bất kỳ ai
      const ageMs = Date.now() - new Date(item.created_at).getTime();
      if (ageMs >= ANNOUNCEMENT_TTL_MS) return false;

      // 2. User đã bấm "không hiển thị lại" → lưu vĩnh viễn trong localStorage
      const permHidden = localStorage.getItem(ANNOUNCEMENT_PERM_HIDE_KEY);
      if (permHidden === item.id) return false;

      // 3. Đã tắt trong session này → không hiện lại cho đến khi đăng nhập lại
      const sessionDismissed = sessionStorage.getItem(ANNOUNCEMENT_SESSION_DISMISS_KEY);
      if (sessionDismissed === item.id) return false;

      return true;
    };

    const showIfNeeded = (item: { id: string; title: string; body: string; severity: string; created_at: string } | null) => {
      if (!item) return;
      if (shouldShow(item)) setActiveBanner(item);
    };

    const loadLatest = () => {
      // Chỉ lấy thông báo trong vòng 24h để nhất quán với TTL
      const cutoff = new Date(Date.now() - ANNOUNCEMENT_TTL_MS).toISOString();
      void client
        .from('admin_announcements')
        .select('id, title, body, severity, created_at')
        .eq('is_published', true)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          showIfNeeded((data?.[0] as { id: string; title: string; body: string; severity: string; created_at: string } | undefined) ?? null);
        });
    };

    loadLatest();

    const channel = client
      .channel('app-admin-announcements')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_announcements' },
        (payload) => {
          const row = payload.new as any;
          if (row?.is_published !== false) {
            showIfNeeded({
              id: row.id,
              title: row.title ?? '',
              body: row.body ?? '',
              severity: row.severity ?? 'info',
              created_at: row.created_at ?? new Date().toISOString(),
            });
          }
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [store.session]);

  useEffect(() => {
    if (!activeBanner) return;
    const timer = window.setTimeout(() => {
      // Auto-dismiss sau 12s → chỉ lưu session (sẽ hiện lại khi đăng nhập lần sau trong 24h đầu)
      sessionStorage.setItem(ANNOUNCEMENT_SESSION_DISMISS_KEY, activeBanner.id);
      setActiveBanner((current) => (current?.id === activeBanner.id ? null : current));
    }, ANNOUNCEMENT_AUTO_DISMISS_MS);

    return () => window.clearTimeout(timer);
  }, [activeBanner?.id]);

  /* ── tab routing ── */
  const changeTab = useCallback((nextTab: Tab) => {
    const s = useAppStore.getState();
    if (nextTab !== 'calendar') s.setIsDaySheetOpen(false);
    s.setTab(nextTab);
    window.location.hash = nextTab === 'home' ? '' : nextTab;
    history.pushState({ tab: nextTab }, '');
  }, []);

  const navigateToDate = useCallback((date: string, venue?: string) => {
    useAppStore.getState().navigateToDate(date, venue);
    history.pushState({ modal: 'daysheet' }, '');
  }, []);

  const openAddToday = useCallback((venue?: string) => {
    navigateToDate(localDateStr(), venue);
  }, [navigateToDate]);

  const openCommunityPost = useCallback((postId: string) => {
    setCommunityTargetPostId(postId);
    changeTab('friends');
  }, [changeTab]);

  const startDemoMode = useCallback(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const demoShifts = [
      { id: 'demo-shift-1', date: `${y}-${m}-03`, label: 'Cafe Hongdae', startTime: '18:00', endTime: '22:30', hourlyWage: 11500, breakMinutes: 0, notes: 'Ca toi', nightShift: false, taxDeduction: false, holidayAllowance: 0 },
      { id: 'demo-shift-2', date: `${y}-${m}-08`, label: 'Chicken House', startTime: '17:00', endTime: '23:30', hourlyWage: 12000, breakMinutes: 30, notes: 'Cuoi tuan', nightShift: true, taxDeduction: true, holidayAllowance: 0 },
      { id: 'demo-shift-3', date: `${y}-${m}-14`, label: 'Convenience Store', startTime: '09:00', endTime: '15:00', hourlyWage: 11000, breakMinutes: 30, notes: 'Ca sang', nightShift: false, taxDeduction: false, holidayAllowance: 0 },
      { id: 'demo-shift-4', date: `${y}-${m}-21`, label: 'Cafe Hongdae', startTime: '18:00', endTime: '23:00', hourlyWage: 11500, breakMinutes: 0, notes: 'Training', nightShift: true, taxDeduction: false, holidayAllowance: 0 },
    ];
    store.setProfile({
      displayName: 'Demo Student',
      school: 'Hongik University',
      region: 'Seoul Mapo-gu',
      note: 'Demo mode for store reviewers.',
      tags: ['TOPIK', 'Budget', 'Cafe'],
    });
    store.setShifts(demoShifts as any);
    store.setExpenses([
      { id: 'demo-expense-1', category: 'rent', amount: 450000, date: `${y}-${m}-01`, note: 'Goshiwon' },
      { id: 'demo-expense-2', category: 'food', amount: 180000, date: `${y}-${m}-12`, note: 'Food' },
      { id: 'demo-expense-3', category: 'transport', amount: 62000, date: `${y}-${m}-16`, note: 'T-money' },
    ] as any);
    store.setIncomeTarget(1800000);
    store.setCalendarMonth(`${y}-${m}-01`);
    store.setTab('home');
    store.recalc();
    store.persist();
    localStorage.setItem('duhoc-mate-demo-mode', 'true');
  }, [store]);

  // Synchronize programmatical daysheet closing with browser history
  useEffect(() => {
    const isOpen = store.isDaySheetOpen;
    if (isOpen && !wasDaySheetOpenRef.current) {
      if (history.state?.modal !== 'daysheet') {
        history.pushState({ modal: 'daysheet' }, '');
      }
    } else if (!isOpen && wasDaySheetOpenRef.current) {
      if (history.state?.modal === 'daysheet') {
        history.back();
      }
    }
    wasDaySheetOpenRef.current = isOpen;
  }, [store.isDaySheetOpen]);

  useEffect(() => {
    function handlePopstate(e: PopStateEvent) {
      const s = useAppStore.getState();
      if (s.isDaySheetOpen) {
        s.setIsDaySheetOpen(false);
        return;
      }
      const hashTab = (window.location.hash.replace('#', '') || 'home') as Tab;
      const valid: Tab[] = ['home', 'calendar', 'income', 'friends', 'profile', 'admin'];
      s.setTab(valid.includes(hashTab) ? hashTab : 'home');
    }
    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, []);

  useEffect(() => {
    const hash = (window.location.hash.replace('#', '') || 'home') as Tab;
    history.replaceState({ tab: hash }, '');
  }, []);

  /* ── PWA shortcut: ?action=add-shift ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'add-shift') {
      const clean = window.location.pathname + window.location.hash;
      history.replaceState({}, '', clean);
      setTimeout(() => openAddToday(), 300);
    }
  }, []);

  /* ── Deep link: ?post={id} → mở đúng bài viết trong cộng đồng ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('post');
    if (postId) {
      // Xoá query param khỏi URL ngay (tránh reload lại)
      const clean = window.location.pathname + window.location.hash;
      history.replaceState({}, '', clean);
      // Chuyển sang tab Cộng đồng và báo hiệu mở bài
      useAppStore.getState().setTab('friends');
      setCommunityTargetPostId(postId);
    }
  }, []);

  /* ── refresh exchange rate ── */
  const refreshRate = useCallback(() => {
    fetch(REFRESH_RATE_URL)
      .then((r) => r.json())
      .then((p: any) => {
        const v = Number(p.data?.rates?.VND);
        if (Number.isFinite(v)) useAppStore.getState().setRate({ value: v, source: 'live', updatedAt: new Date().toISOString() });
      })
      .catch(() => useAppStore.getState().setRate((prev) => ({ ...prev, source: 'cached' })));
  }, []);

  /* ── auth callbacks ── */
  const sendMagicLink = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabaseClient || !store.authEmail) {
      store.setAuthMessage('Hãy cấu hình Supabase trước khi gửi magic link.');
      return;
    }
    store.setSendingAuth(true);
    const { error } = await supabaseClient.auth.signInWithOtp({
      email: store.authEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    store.setSendingAuth(false);
    store.setAuthMessage(error ? 'Chưa gửi được link đăng nhập.' : 'Mình đã gửi magic link vào email của bạn.');
  }, [store.authEmail, store]);

  const saveProfile = useCallback(async (draft?: any) => {
    const toSave = draft ?? store.profile;
    store.setSavingProfile(true);
    if (supabaseClient && store.session) {
      await supabaseClient.from('profiles').upsert({
        id: store.session.user.id,
        display_name: toSave.displayName,
        school: toSave.school,
        region: toSave.region,
        note: toSave.note,
        avatar_url: toSave.avatarUrl,
        tags: toSave.tags,
      });
    }
    store.setSavingProfile(false);
  }, [store.session, store.profile]);

  /* ── connections ── */
  const requestConnection = useCallback(async (targetId: string) => {
    if (!supabaseClient || !store.session) return;
    const client = supabaseClient;
    const userId = store.session.user.id;
    const actorName = store.profile.displayName?.trim() || store.session.user.email?.split('@')[0] || 'Một người bạn';

    const mergeF = (row: any) => {
      store.setFriendships((prev: any[]) => {
        const exists = prev.some((f: any) => f.id === row.id);
        return exists ? prev.map((f: any) => (f.id === row.id ? row : f)) : [row, ...prev];
      });
    };

    const notify = async (rid: string, type: string, title: string, body: string) => {
      await client.from('community_notifications').insert({ recipient_id: rid, actor_id: userId, type, title, body });
    };

    const acceptF = async (existing: any) => {
      // Optimistic update so UI feels instant
      const optimistic = { ...existing, status: 'accepted', updated_at: new Date().toISOString() };
      mergeF(optimistic);
      store.setRequested((prev) => prev.filter((id) => id !== targetId));

      // Direct DB update — more reliable than a custom RPC that may not exist
      const { data: updatedRow, error: updateErr } = await client
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', existing.id)
        .select()
        .single();

      if (!updateErr && updatedRow) {
        mergeF(updatedRow);
      } else if (updateErr) {
        // Rollback optimistic update on failure — restore friendship to previous state
        mergeF(existing);
        console.error('Lỗi chấp nhận kết bạn:', updateErr);
        throw new Error('Chưa chấp nhận được lời mời kết bạn.');
      }

      await notify(targetId, 'friend_accept', 'Đã trở thành bạn bè', `${actorName} đã chấp nhận lời mời kết bạn.`);
    };

    const local = store.friendships.find(
      (f: any) =>
        (f.requester_id === userId && f.target_profile_id === targetId) ||
        (f.requester_id === targetId && f.target_profile_id === userId),
    );

    // Incoming pending → accept
    if (local?.requester_id === targetId && local?.target_profile_id === userId && local.status === 'pending') {
      await acceptF(local);
      return;
    }

    const { data: dbRow } = await client
      .from('friend_requests')
      .select('*')
      .or(`and(requester_id.eq.${userId},target_profile_id.eq.${targetId}),and(requester_id.eq.${targetId},target_profile_id.eq.${userId})`)
      .limit(1)
      .maybeSingle();

    const existing = dbRow ?? local;

    if (existing?.status === 'accepted') { mergeF(existing); return; }
    if (existing && existing.requester_id === targetId && existing.target_profile_id === userId) {
      await acceptF(existing);
      return;
    }

    // Optimistic UI: show "sent" immediately
    store.addRequested(targetId);

    if (existing && existing.requester_id === userId) {
      if (existing.status === 'pending') return; // already pending, done
      const { data, error: updateErr } = await client
        .from('friend_requests')
        .update({ status: 'pending' })
        .eq('id', existing.id)
        .select()
        .single();
      if (data) mergeF(data);
      else if (updateErr) store.setRequested((prev) => prev.filter((id) => id !== targetId));
      return;
    }

    const { data: newReq, error } = await client
      .from('friend_requests')
      .insert({ requester_id: userId, target_profile_id: targetId, status: 'pending' })
      .select()
      .single();

    if (!error && newReq) {
      mergeF(newReq);
      await notify(targetId, 'friend_request', 'Lời mời kết bạn mới', `${actorName} muốn kết bạn với bạn.`);
    } else if (error) {
      // Revert optimistic update if insert failed
      store.setRequested((prev) => prev.filter((id) => id !== targetId));
      console.error('Lỗi gửi lời mời kết bạn:', error);
      throw new Error('Chưa gửi được lời mời kết bạn.');
    }
  }, [store.session, store.profile, store.friendships]);

  const handleToggleAnonymous = useCallback(async (val: boolean) => {
    if (!supabaseClient || !store.session) return;
    store.setIsAnonymousRank(val);
    await supabaseClient.from('profiles').update({ is_anonymous_rank: val }).eq('id', store.session.user.id);
  }, [store.session]);

  /* ── shift CRUD ── */
  const addShift = useCallback(async (nextTab?: Tab) => {
    const s = useAppStore.getState();
    const shift: any = {
      id: `shift-${Date.now()}`,
      date: s.draft.date,
      label: s.draft.venue,
      startTime: s.draft.startTime,
      endTime: s.draft.endTime,
      hourlyWage: s.draft.hourlyWage,
      breakMinutes: s.draft.breakMinutes,
      notes: s.draft.note || '',
      nightShift: s.draft.nightShift,
      taxDeduction: s.draft.taxDeduction,
      holidayAllowance: s.draft.holidayAllowance,
      wageType: s.draft.wageType,
      monthlyWage: s.draft.wageType === 'monthly' ? (s.draft.wageInput ?? undefined) : undefined,
    };
    s.addShift(shift, nextTab);
    if (supabaseClient && s.session) {
      if (!s.online) {
        enqueueSyncItem(s.session.user.id, { type: 'upsert_shift', payload: shift });
        return;
      }
      try {
        await supabaseClient.from('shift_entries').upsert({
          id: shift.id,
          user_id: s.session.user.id,
          work_date: shift.date,
          venue: shift.label,
          start_time: shift.startTime,
          end_time: shift.endTime,
          hourly_wage: shift.hourlyWage,
          break_minutes: shift.breakMinutes,
          notes: shift.notes,
          night_shift: shift.nightShift,
          tax_deduction: shift.taxDeduction,
          holiday_allowance: shift.holidayAllowance,
        });
      } catch (error) {
        enqueueSyncItem(s.session.user.id, { type: 'upsert_shift', payload: shift });
        console.warn('Saved shift locally; Supabase sync will retry later.', error);
      }
    }
  }, []);

  const updateShift = useCallback(async (shift: any) => {
    const s = useAppStore.getState();
    s.updateShift(shift);
    s.setSelectedDate(shift.date);
    if (supabaseClient && s.session) {
      if (!s.online) {
        enqueueSyncItem(s.session.user.id, { type: 'upsert_shift', payload: shift });
        return;
      }
      try {
        await supabaseClient.from('shift_entries').upsert({
          id: shift.id,
          user_id: s.session.user.id,
          work_date: shift.date,
          venue: shift.label,
          start_time: shift.startTime,
          end_time: shift.endTime,
          hourly_wage: shift.hourlyWage,
          break_minutes: shift.breakMinutes,
          notes: shift.notes,
          night_shift: shift.nightShift,
          tax_deduction: shift.taxDeduction,
          holiday_allowance: shift.holidayAllowance,
        });
      } catch (error) {
        enqueueSyncItem(s.session.user.id, { type: 'upsert_shift', payload: shift });
        console.warn('Updated shift locally; Supabase sync will retry later.', error);
      }
    }
  }, []);

  const deleteShift = useCallback(async (id: string) => {
    const s = useAppStore.getState();
    s.deleteShift(id);
    if (supabaseClient && s.session) {
      if (!s.online) {
        enqueueSyncItem(s.session.user.id, { type: 'delete_shift', payload: { id } });
        return;
      }
      try {
        await supabaseClient.from('shift_entries').delete().eq('id', id);
      } catch (error) {
        enqueueSyncItem(s.session.user.id, { type: 'delete_shift', payload: { id } });
        console.warn('Deleted shift locally; Supabase delete could not sync yet.', error);
      }
    }
  }, []);

  /* ── expenses ── */
  const addExpense = useCallback(async (expense: any) => {
    const s = useAppStore.getState();
    const next = { ...expense, id: crypto.randomUUID() };
    s.addExpenseLocally(next);
    if (supabaseClient && s.session) {
      if (!s.online) {
        enqueueSyncItem(s.session.user.id, { type: 'upsert_expense', payload: next });
        return;
      }
      try {
        await supabaseClient.from('expenses').upsert({
          id: next.id,
          user_id: s.session.user.id,
          category: next.category,
          amount: next.amount,
          date: next.date,
          note: next.note,
        });
      } catch (error) {
        enqueueSyncItem(s.session.user.id, { type: 'upsert_expense', payload: next });
        console.warn('Saved expense locally; Supabase sync will retry later.', error);
      }
    }
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    const s = useAppStore.getState();
    s.removeExpenseLocally(id);
    if (supabaseClient && s.session) {
      if (!s.online) {
        enqueueSyncItem(s.session.user.id, { type: 'delete_expense', payload: { id } });
        return;
      }
      try {
        await supabaseClient.from('expenses').delete().eq('id', id);
      } catch (error) {
        enqueueSyncItem(s.session.user.id, { type: 'delete_expense', payload: { id } });
        console.warn('Deleted expense locally; Supabase delete could not sync yet.', error);
      }
    }
  }, []);

  /* ── notifications ── */
  const markAllAsRead = useCallback(async () => {
    store.markAllAsRead();
    if (!supabaseClient) return;
    if (store.session) {
      // User đã đăng nhập: mark read theo recipient_id
      await supabaseClient.from('community_notifications')
        .update({ is_read: true })
        .eq('recipient_id', store.session.user.id)
        .eq('is_read', false);
    } else {
      // Khách: mark read theo guest_session_id
      const guestId = getGuestSessionId();
      if (guestId) {
        await supabaseClient.from('community_notifications')
          .update({ is_read: true })
          .eq('recipient_guest_session_id', guestId)
          .eq('is_read', false);
      }
    }
  }, []);

  const handleOpenNotifications = useCallback(() => {
    store.handleOpenNotifications();
    void markAllAsRead();
  }, []);

  /* ── render ── */
  const activeWallpaper = WALLPAPERS.find((w: any) => w.key === store.wallpaper);
  const wallpaperStyle = {
    ...(WALLPAPER_THEME_VARS[store.wallpaper] ?? WALLPAPER_THEME_VARS.default),
    ...(store.wallpaper !== 'default' && activeWallpaper?.gradient ? { background: activeWallpaper.gradient } : {}),
  } as CSSProperties;
  const setupWallpaperOptions = FIRST_SETUP_WALLPAPER_KEYS
    .map((key) => WALLPAPERS.find((w: any) => w.key === key))
    .filter(Boolean) as typeof WALLPAPERS;

  return (
    <div className="app-stage">
      <div className="phone-shell" data-wallpaper={store.wallpaper} style={wallpaperStyle}>
        <div className="wallpaper-art" aria-hidden="true" />
        {/* Admin announcement entry popup */}
        <AnimatePresence>
          {activeBanner ? (
            <>
              <motion.div
                className="admin-entry-announcement-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              <motion.section
                className={`admin-entry-announcement admin-entry-announcement--${activeBanner.severity}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-entry-announcement-title"
                initial={{ opacity: 0, scale: 0.94, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 18 }}
                transition={{ type: 'spring', damping: 24, stiffness: 260 }}
              >
                <div className="admin-entry-announcement-head">
                  <span className="admin-entry-announcement-icon">
                    <Megaphone size={28} />
                  </span>
                  <h2 id="admin-entry-announcement-title">{activeBanner.title}</h2>
                </div>
                <div className="admin-entry-announcement-body">
                  {activeBanner.body.split('\n').map((line, index) => (
                    <p key={`${activeBanner.id}-${index}`}>{line || '\u00a0'}</p>
                  ))}
                </div>
                <motion.div
                  key={activeBanner.id}
                  className="admin-entry-announcement-progress"
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: ANNOUNCEMENT_AUTO_DISMISS_MS / 1000, ease: 'linear' }}
                />
                <div className="admin-entry-announcement-actions">
                  <button
                    type="button"
                    className="admin-entry-announcement-muted"
                    onClick={() => {
                      // Lưu vĩnh viễn vào localStorage → không bao giờ hiện lại trên thiết bị này
                      localStorage.setItem(ANNOUNCEMENT_PERM_HIDE_KEY, activeBanner.id);
                      setActiveBanner(null);
                    }}
                  >
                    {store.lang === 'ko' ? '다시 보지 않기' : 'không hiển thị lại'}
                  </button>
                  <button
                    type="button"
                    className="admin-entry-announcement-close"
                    onClick={() => {
                      // Đóng → chỉ lưu session, sẽ hiện lại khi đăng nhập lần sau (nếu còn trong 24h)
                      sessionStorage.setItem(ANNOUNCEMENT_SESSION_DISMISS_KEY, activeBanner.id);
                      setActiveBanner(null);
                    }}
                  >
                    {store.lang === 'ko' ? '닫기' : 'Đóng'}
                  </button>
                </div>
              </motion.section>
            </>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {showFirstSetup ? (
            <motion.section
              className="first-setup-backdrop"
              role="dialog"
              aria-modal="true"
              aria-labelledby="first-setup-title"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="first-setup-card"
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.96 }}
                transition={{ type: 'spring', damping: 24, stiffness: 260, delay: 0.15 }}
              >
                <div className="first-setup-orbit" aria-hidden="true" />
                <div className="first-setup-head">
                  <span className="first-setup-kicker">{store.lang === 'ko' ? '처음 설정' : 'Chào mừng bạn đến với Duhoc Mate'}</span>
                  <h2 id="first-setup-title">{store.lang === 'ko' ? '함께할 캐릭터를 골라요' : 'Chọn người bạn đồng hành'}</h2>
                  <div className="first-setup-lang-container">
                    <div className="first-setup-lang-label">
                      <span>{store.lang === 'ko' ? '언어 선택' : 'Ngôn ngữ'}</span>
                    </div>
                    <div className="first-setup-lang-toggle">
                      <button
                        type="button"
                        className={`first-setup-lang-btn ${store.lang === 'vi' ? 'active' : ''}`}
                        onClick={() => store.setLang('vi')}
                      >
                        Tiếng Việt
                      </button>
                      <button
                        type="button"
                        className={`first-setup-lang-btn ${store.lang === 'ko' ? 'active' : ''}`}
                        onClick={() => store.setLang('ko')}
                      >
                        한국어
                      </button>
                    </div>
                  </div>
                </div>

                <div className="first-setup-section">
                  <div className="first-setup-section-title">
                    <span>{store.lang === 'ko' ? '동반자' : 'Linh vật'}</span>
                  </div>
                  <div className="first-setup-companions" aria-label={store.lang === 'ko' ? '동반자 선택' : 'Chọn linh vật'}>
                    {FIRST_SETUP_COMPANIONS.map((option) => {
                      const active = setupCompanion === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          className={`first-setup-companion ${active ? 'active' : ''}`}
                          onClick={() => setSetupCompanion(option.key)}
                          aria-pressed={active}
                        >
                          <span className="first-setup-companion-img">
                            <img src={iconUrl(option.imgKey)} alt="" decoding="async" loading="eager" />
                          </span>
                          <span>{store.lang === 'ko' ? option.label_ko : option.label_vi}</span>
                          {active ? <Check size={15} className="first-setup-check" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="first-setup-section">
                  <div className="first-setup-section-title">
                    <span>{store.lang === 'ko' ? '배경' : 'Hình nền'}</span>
                  </div>
                  <div className="first-setup-wallpapers" aria-label={store.lang === 'ko' ? '배경 선택' : 'Chọn hình nền'}>
                    {setupWallpaperOptions.map((wallpaper) => {
                      const active = setupWallpaper === wallpaper.key;
                      return (
                        <button
                          key={wallpaper.key}
                          type="button"
                          className={`first-setup-wallpaper ${active ? 'active' : ''}`}
                          onClick={() => setSetupWallpaper(wallpaper.key)}
                          aria-pressed={active}
                        >
                          <span className={`first-setup-wallpaper-preview pf-wallpaper-preview pf-wallpaper-preview--${wallpaper.key}`} style={{ background: wallpaper.preview }} />
                          <span>{store.lang === 'ko' ? wallpaper.label_ko : wallpaper.label_vi}</span>
                          {active ? <Check size={14} className="first-setup-check" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="first-setup-actions">
                  <button type="button" className="first-setup-secondary" onClick={() => finishFirstSetup(true)}>
                    {store.lang === 'ko' ? '나중에' : 'Để sau'}
                  </button>
                  <button type="button" className="first-setup-primary" onClick={() => finishFirstSetup(false)}>
                    {store.lang === 'ko' ? '시작하기' : 'Bắt đầu'}
                  </button>
                </div>
              </motion.div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <main key={store.tab} className="screen-shell">
          <Suspense fallback={<div className="tab-loading">{store.lang === 'ko' ? '불러오는 중...' : 'Đang tải...'}</div>}>
          {store.tab === 'home' && (
            <HomeScreen
              monthlyTotal={store.monthlyTotal}
              monthlyHours={store.monthlyHours}
              averageHourly={store.averageHourly}
              rate={store.rate}
              workplaces={store.workplaceSummary}
              recentShifts={store.recentShifts}
              allShifts={store.shifts}
              expenses={store.expenses}
              onRefresh={refreshRate}
              onOpenAdd={openAddToday}
              onEditShift={(shift) => {
                const s = useAppStore.getState();
                s.setEditingShiftId(shift.id);
                s.setDraft({
                  venue: shift.label,
                  date: shift.date,
                  startTime: shift.startTime,
                  endTime: shift.endTime,
                  breakMinutes: shift.breakMinutes,
                  hourlyWage: shift.hourlyWage,
                  label: shift.notes,
                  note: shift.notes,
                  nightShift: shift.nightShift,
                  taxDeduction: shift.taxDeduction,
                  holidayAllowance: shift.holidayAllowance,
                });
                s.setSelectedDate(shift.date);
                s.setCalendarMonth(shift.date.slice(0, 7) + '-01');
                s.setIsDaySheetOpen(true);
                s.setTab('calendar');
              }}
              onDeleteShift={deleteShift}
              venueColors={store.venueColors}
              currentMonth={store.calendarMonth}
              onPrevMonth={() => store.setCalendarMonth(shiftMonth(store.calendarMonth, -1))}
              onNextMonth={() => store.setCalendarMonth(shiftMonth(store.calendarMonth, 1))}
              onOpenNotifications={handleOpenNotifications}
              onOpenCommunityPost={openCommunityPost}
              unreadCount={store.unreadCount}
              profile={store.profile}
              lang={store.lang}
              isAnonymousRank={store.isAnonymousRank}
              onToggleAnonymous={handleToggleAnonymous}
              rankings={store.rankings}
              myId={store.session?.user.id || ''}
              currencyMode={store.currencyMode}
            />
          )}
          {store.tab === 'calendar' && (
            <CalendarScreen
              shifts={store.shifts}
              selectedDate={store.selectedDate}
              month={store.calendarMonth}
              venueSuggestions={[...new Set(store.workplaceSummary.map((i) => i.label))].slice(0, 4)}
              draft={store.draft}
              setDraft={store.setDraft}
              editingShiftId={store.editingShiftId}
              setEditingShiftId={store.setEditingShiftId}
              isSheetOpen={store.isDaySheetOpen}
              onCloseSheet={() => store.setIsDaySheetOpen(false)}
              onPrevMonth={() => {
                const nm = shiftMonth(store.calendarMonth, -1);
                store.setCalendarMonth(nm);
                store.setSelectedDate(nm);
                store.setDraft((d) => ({ ...d, date: nm }));
              }}
              onNextMonth={() => {
                const nm = shiftMonth(store.calendarMonth, 1);
                store.setCalendarMonth(nm);
                store.setSelectedDate(nm);
                store.setDraft((d) => ({ ...d, date: nm }));
              }}
              onSetMonth={(m) => {
                store.setCalendarMonth(m);
                store.setSelectedDate(m);
                store.setDraft((d) => ({ ...d, date: m }));
              }}
              onSelectDate={(date) => {
                store.setEditingShiftId(null);
                store.setSelectedDate(date);
                store.setDraft((d) => ({ ...d, date, note: '' }));
                store.setIsDaySheetOpen(true);
              }}
              onQuickSave={() => void addShift('calendar')}
              onUpdateShift={(shift) => void updateShift(shift)}
              onDeleteShift={deleteShift}
              venueColors={store.venueColors}
              onSetVenueColor={store.setVenueColor}
              lang={store.lang}
            />
          )}
          {store.tab === 'income' && (
            <IncomeScreen
              minimumWage={10320}
              rate={store.rate}
              shifts={store.shifts}
              venueColors={store.venueColors}
              expenses={store.expenses}
              onAddExpense={addExpense}
              onDeleteExpense={deleteExpense}
              target={store.incomeTarget}
              onSetTarget={store.setIncomeTarget}
              lang={store.lang}
              currencyMode={store.currencyMode}
            />
          )}
          {store.tab === 'friends' && (
            <CommunityScreen
              profile={store.profile}
              companions={store.companions}
              requested={store.requested}
              friendships={store.friendships}
              onRequest={requestConnection}
              session={store.session}
              onOpenNotifications={handleOpenNotifications}
              unreadCount={store.unreadCount}
              onNavigateToProfile={() => changeTab('profile')}
              targetPostId={communityTargetPostId}
              onTargetPostConsumed={() => setCommunityTargetPostId(null)}
              lang={store.lang}
              isAdmin={store.isAdmin}
            />
          )}
          {store.tab === 'profile' && (
            <ProfileScreen
              profile={store.profile}
              setProfile={store.setProfile}
              saveProfile={(draft) => void saveProfile(draft)}
              savingProfile={store.savingProfile}
              session={store.session}
              isDarkMode={store.isDarkMode}
              onToggleDarkMode={() => store.setIsDarkMode(!store.isDarkMode)}
              wallpaper={store.wallpaper}
              onChangeWallpaper={store.setWallpaper}
              lang={store.lang}
              onChangeLang={store.setLang}
              isAdmin={store.isAdmin}
              onOpenAdmin={() => changeTab('admin')}
              onStartDemo={startDemoMode}
            />
          )}
          {store.tab === 'admin' && (
            <AdminScreen
              session={store.session}
              isAdmin={store.isAdmin}
              lang={store.lang}
              onBack={() => changeTab('profile')}
            />
          )}
          </Suspense>
        </main>

        {/* ── Bottom Tabs ── */}
        <nav className="bottom-tabs" aria-label={store.lang === 'ko' ? '주요 내비게이션' : 'Điều hướng chính'}>
          {tabIcons.map(({ id, icon: Icon }) => {
            const isActive = store.tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => changeTab(id)}
                className={isActive ? 'tab-item active' : 'tab-item'}
              >
                {isActive ? (
                  <motion.span
                    layoutId="nav-active"
                    className="tab-active-bg"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                ) : null}
                <span className="tab-icon-wrap"><Icon size={20} /></span>
                <span className="tab-label">{tabLabels[store.lang][id]}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Push Toast ── */}
        <AnimatePresence>
          {store.toastNotification && (
            <motion.div
              className="cm-push-toast"
              initial={{ opacity: 0, y: -50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              onClick={handleOpenNotifications}
            >
              <div className={`cm-notif-icon-circle ${store.toastNotification.type}`}>
                {store.toastNotification.type === 'like' ? <ThumbsUp size={14} />
                  : store.toastNotification.type === 'friend_request' || store.toastNotification.type === 'friend_accept' ? <Users size={14} />
                  : store.toastNotification.type === 'message' ? <MessageSquare size={14} />
                  : <MessageCircle size={14} />}
              </div>
              <div className="cm-push-toast-content">
                <strong>{store.toastNotification.title}</strong>
                <p>{store.toastNotification.body}</p>
              </div>
              <button
                className="cm-push-toast-close"
                onClick={(e) => { e.stopPropagation(); store.setToastNotification(null); }}
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Notification Popover ── */}
        <AnimatePresence>
          {store.showNotifications && (
            <>
              <motion.div
                className="cm-notif-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => store.setShowNotifications(false)}
              />
              <motion.div
                className="cm-notif-popover"
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
              >
                <div className="cm-notif-popover-head">
                  <strong>Thông báo & Hoạt động</strong>
                  <button onClick={() => store.setShowNotifications(false)}><X size={16} /></button>
                </div>
                <div className="cm-notif-popover-body">
                  {store.notifications.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                      <Bell size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                      <p>Bạn chưa có thông báo nào</p>
                    </div>
                  ) : (
                    store.notifications.map((n) => (
                      <div key={`notif-${n.id}`} className={`cm-notif-item ${!n.is_read ? 'unread' : ''}`} style={{ cursor: 'pointer' }}>
                        <div className={`cm-notif-icon-circle ${n.type}`}>
                          {n.type === 'like' ? <ThumbsUp size={12} />
                            : n.type === 'friend_request' || n.type === 'friend_accept' ? <Users size={12} />
                            : n.type === 'message' ? <MessageSquare size={12} />
                            : <MessageCircle size={12} />}
                        </div>
                        <div className="cm-notif-item-content">
                          <p>{n.body}</p>
                          <span className="cm-notif-time">{timeAgo(n.created_at)}</span>
                        </div>
                        {!n.is_read && <div style={{ width: 8, height: 8, background: '#2752ff', borderRadius: '50%', flexShrink: 0 }} />}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <AppLockOverlay lang={store.lang} />
      </div>
    </div>
  );
}
