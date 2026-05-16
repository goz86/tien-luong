import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, House, MessageCircleMore, UserRound, WalletCards, Bell, ThumbsUp, MessageCircle, X, Megaphone } from 'lucide-react';
import { hasSupabaseConfig, supabase as supabaseClient } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import { HomeScreen } from './HomeScreen';
import { CalendarScreen } from './CalendarScreen';
import { IncomeScreen } from './IncomeScreen';
import { CommunityScreen } from './CommunityScreen';
import { AdminScreen } from './AdminScreen';
import { ProfileScreen, WALLPAPERS } from './ProfileScreen';
import { timeAgo } from '../data/communityData';
import { shiftMonth } from '../utils/helpers';
import type { Tab } from '../lib/types';

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
type WallpaperKey = string;

const REFRESH_RATE_URL = 'https://open.er-api.com/v6/latest/KRW';

const ANNOUNCEMENT_HIDE_TODAY_KEY = 'duhocmate-announcement-hide-today';
const ANNOUNCEMENT_SESSION_DISMISS_KEY = 'duhocmate-announcement-session-dismissed';
const ANNOUNCEMENT_AUTO_DISMISS_MS = 12000;
const ANNOUNCEMENT_HIDE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 giờ thực

export default function AppLayout() {
  const store = useAppStore();
  const suppressPopstate = useRef(false);
  const [activeBanner, setActiveBanner] = useState<{ id: string; title: string; body: string; severity: string } | null>(null);
  const [communityTargetPostId, setCommunityTargetPostId] = useState<string | null>(null);

  // Fetch latest admin announcement and show it as an entry popup for signed-in users.
  useEffect(() => {
    if (!supabaseClient || !store.session) {
      setActiveBanner(null);
      return;
    }
    const client = supabaseClient;

    const shouldShow = (item: { id: string }) => {
      const sessionDismissed = sessionStorage.getItem(ANNOUNCEMENT_SESSION_DISMISS_KEY);
      if (sessionDismissed === item.id) return false;

      const stored = localStorage.getItem(ANNOUNCEMENT_HIDE_TODAY_KEY);
      if (stored) {
        const colonIdx = stored.lastIndexOf(':');
        if (colonIdx !== -1) {
          const storedId = stored.slice(0, colonIdx);
          const storedTs = Number(stored.slice(colonIdx + 1));
          if (storedId === item.id && !Number.isNaN(storedTs) && Date.now() - storedTs < ANNOUNCEMENT_HIDE_DURATION_MS) {
            return false;
          }
        }
      }
      return true;
    };

    const showIfNeeded = (item: { id: string; title: string; body: string; severity: string } | null) => {
      if (!item) return;
      if (shouldShow(item)) setActiveBanner(item);
    };

    const loadLatest = () => {
      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      void client
        .from('admin_announcements')
        .select('id, title, body, severity')
        .eq('is_published', true)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          showIfNeeded((data?.[0] as { id: string; title: string; body: string; severity: string } | undefined) ?? null);
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
    suppressPopstate.current = true;
    history.pushState({ tab: nextTab }, '');
  }, []);

  const navigateToDate = useCallback((date: string) => {
    useAppStore.getState().navigateToDate(date);
    suppressPopstate.current = true;
    history.pushState({ modal: 'daysheet' }, '');
  }, []);

  const openAddToday = useCallback(() => {
    navigateToDate(new Date().toISOString().slice(0, 10));
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

  useEffect(() => {
    function handlePopstate(e: PopStateEvent) {
      if (suppressPopstate.current) {
        suppressPopstate.current = false;
        return;
      }
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

  /* ── refresh exchange rate ── */
  const refreshRate = useCallback(() => {
    fetch(REFRESH_RATE_URL)
      .then((r) => r.json())
      .then((p: any) => {
        const v = Number(p.rates?.VND);
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
    };
    s.addShift(shift, nextTab);
    if (supabaseClient && s.session) {
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
    }
  }, []);

  const updateShift = useCallback(async (shift: any) => {
    const s = useAppStore.getState();
    s.updateShift(shift);
    s.setSelectedDate(shift.date);
    if (supabaseClient && s.session) {
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
    }
  }, []);

  const deleteShift = useCallback(async (id: string) => {
    const s = useAppStore.getState();
    s.deleteShift(id);
    if (supabaseClient && s.session) {
      await supabaseClient.from('shift_entries').delete().eq('id', id);
    }
  }, []);

  /* ── expenses ── */
  const addExpense = useCallback(async (expense: any) => {
    const s = useAppStore.getState();
    const next = { ...expense, id: crypto.randomUUID() };
    s.addExpenseLocally(next);
    if (supabaseClient && s.session) {
      await supabaseClient.from('expenses').insert({
        id: next.id,
        user_id: s.session.user.id,
        category: next.category,
        amount: next.amount,
        date: next.date,
        note: next.note,
      });
    }
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    const s = useAppStore.getState();
    s.removeExpenseLocally(id);
    if (supabaseClient && s.session) {
      await supabaseClient.from('expenses').delete().eq('id', id);
    }
  }, []);

  /* ── notifications ── */
  const markAllAsRead = useCallback(async () => {
    store.markAllAsRead();
    if (supabaseClient && store.session) {
      await supabaseClient.from('community_notifications')
        .update({ is_read: true })
        .eq('recipient_id', store.session.user.id)
        .eq('is_read', false);
    }
  }, []);

  const handleOpenNotifications = useCallback(() => {
    store.handleOpenNotifications();
    void markAllAsRead();
  }, []);

  /* ── render ── */
  const wallpaperStyle =
    store.wallpaper !== 'default'
      ? { background: WALLPAPERS.find((w: any) => w.key === store.wallpaper)?.gradient }
      : undefined;

  return (
    <div className="app-stage">
      <div className="phone-shell" style={wallpaperStyle}>
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
                      localStorage.setItem(ANNOUNCEMENT_HIDE_TODAY_KEY, `${activeBanner.id}:${Date.now()}`);
                      setActiveBanner(null);
                    }}
                  >
                    {store.lang === 'ko' ? '오늘 하루 보지 않기' : 'không hiển thị lại'}
                  </button>
                  <button
                    type="button"
                    className="admin-entry-announcement-close"
                    onClick={() => {
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

        <main key={store.tab} className="screen-shell">
          {store.tab === 'home' && (
            <HomeScreen
              monthlyTotal={store.monthlyTotal}
              monthlyHours={store.monthlyHours}
              averageHourly={store.averageHourly}
              rate={store.rate}
              workplaces={store.workplaceSummary}
              recentShifts={store.recentShifts}
              allShifts={store.monthShifts}
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
              earnedBadges={store.earnedBadges}
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
                {store.toastNotification.type === 'like' ? <ThumbsUp size={14} /> : <MessageCircle size={14} />}
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
                          {n.type === 'like' ? <ThumbsUp size={12} /> : <MessageCircle size={12} />}
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
      </div>
    </div>
  );
}
