import { useCallback, useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, House, MessageCircleMore, UserRound, WalletCards, Cloud, CloudOff, Bell, ThumbsUp, MessageCircle, X, Flame, ShieldCheck } from 'lucide-react';
import { demoCompanions, demoProfile, demoShifts } from './data';
import { DEFAULT_KRW_TO_VND, MINIMUM_WAGE_2026, calculateShiftPay, shiftHours, Shift } from './lib/salary';
import { hasSupabaseConfig, supabase } from './lib/supabase';
import { Tab, StoredState, ShiftDraft, VenueColors, Expense, ProfileDraft } from './lib/types';
import { startOfMonth, shiftMonth, formatMonthHeader } from './utils/helpers';
import { HomeScreen } from './components/HomeScreen';
import { CalendarScreen } from './components/CalendarScreen';
import { IncomeScreen } from './components/IncomeScreen';
import { CommunityScreen } from './components/CommunityScreen';
import { ProfileScreen, WALLPAPERS, type WallpaperKey, type AppLang } from './components/ProfileScreen';

const STORAGE_KEY = 'duhoc-mate-redesign-state';
const getLocalDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todayIso = getLocalDateString();

const tabLabels: Record<AppLang, Record<Tab, string>> = {
  vi: { home: 'Trang chủ', calendar: 'Lịch', income: 'Thu nhập', friends: 'Cộng đồng', profile: 'Hồ sơ' },
  ko: { home: '홈', calendar: '캘린더', income: '수입', friends: '커뮤니티', profile: '프로필' },
};

const tabIcons: Array<{ id: Tab; icon: typeof House }> = [
  { id: 'home', icon: House },
  { id: 'calendar', icon: CalendarDays },
  { id: 'income', icon: WalletCards },
  { id: 'friends', icon: MessageCircleMore },
  { id: 'profile', icon: UserRound }
];

const defaultDraft: ShiftDraft = {
  venue: 'Việc làm thêm',
  date: todayIso,
  startTime: '18:00',
  endTime: '22:00',
  breakMinutes: 0,
  hourlyWage: 11000,
  label: 'Ca tối',
  note: ''
};

function fallbackState(): StoredState {
  return {
    shifts: demoShifts,
    profile: demoProfile,
    companions: demoCompanions,
    requested: [],
    rate: { value: DEFAULT_KRW_TO_VND, source: 'cached', updatedAt: new Date().toISOString() },
    venueColors: {},
    incomeTarget: 2000000,
    expenses: []
  };
}

function loadState(): StoredState {
  if (typeof window === 'undefined') return fallbackState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallbackState();
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      shifts: Array.isArray(parsed.shifts) && parsed.shifts.length ? parsed.shifts : demoShifts,
      profile: parsed.profile ? { ...demoProfile, ...parsed.profile } : demoProfile,
      companions: Array.isArray(parsed.companions) && parsed.companions.length ? parsed.companions : demoCompanions,
      requested: Array.isArray(parsed.requested) ? parsed.requested : [],
      rate: parsed.rate ? { ...parsed.rate, source: parsed.rate.source === 'live' ? 'live' : 'cached' } : fallbackState().rate,
      venueColors: (parsed as Record<string, unknown>).venueColors && typeof (parsed as Record<string, unknown>).venueColors === 'object' ? (parsed as Record<string, unknown>).venueColors as VenueColors : {},
      incomeTarget: typeof parsed.incomeTarget === 'number' ? parsed.incomeTarget : 2000000,
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : []
    };
  } catch {
    return fallbackState();
  }
}

const VALID_TABS: Tab[] = ['home', 'calendar', 'income', 'friends', 'profile'];

function getTabFromHash(): Tab {
  const hash = window.location.hash.replace('#', '');
  return VALID_TABS.includes(hash as Tab) ? (hash as Tab) : 'home';
}

export default function App() {
  const initial = loadState();
  const [tab, setTab] = useState<Tab>(() => getTabFromHash());
  const [session, setSession] = useState<Session | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [authEmail, setAuthEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [sendingAuth, setSendingAuth] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>(initial.shifts);
  const [profile, setProfile] = useState(initial.profile);
  const [companions] = useState(initial.companions);
  const [requested, setRequested] = useState(initial.requested);
  const [showNotifications, setShowNotifications] = useState(false);

  // Demo notifications data
  const demoNotifications = [
    { id: 1, type: 'like', user: 'Linh', post: 'Kinh nghiệm leo núi...', time: '2 phút trước' },
    { id: 2, type: 'comment', user: 'Tuấn', post: 'Tìm bạn cùng phòng', content: 'Mình quan tâm ạ!', time: '15 phút trước' },
    { id: 3, type: 'like', user: 'Ẩn danh', post: 'Sinchon có gì vui?', time: '1 giờ trước' },
  ];
  const [rate, setRate] = useState(initial.rate);
  const [venueColors, setVenueColors] = useState<VenueColors>(initial.venueColors);
  const [incomeTarget, setIncomeTarget] = useState(initial.incomeTarget ?? 2000000);
  const [expenses, setExpenses] = useState(initial.expenses ?? []);
  const [draft, setDraft] = useState<ShiftDraft>(defaultDraft);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(todayIso));
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [isDaySheetOpen, setIsDaySheetOpen] = useState(false);
  const suppressPopstate = useRef(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('duhoc-mate-dark') === 'true';
  });
  const [wallpaper, setWallpaper] = useState<WallpaperKey>(() => {
    if (typeof window === 'undefined') return 'default';
    return (window.localStorage.getItem('duhoc-mate-wallpaper') as WallpaperKey) || 'default';
  });
  const [lang, setLang] = useState<AppLang>(() => {
    if (typeof window === 'undefined') return 'vi';
    return (window.localStorage.getItem('duhoc-mate-lang') as AppLang) || 'vi';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    window.localStorage.setItem('duhoc-mate-dark', isDarkMode.toString());
  }, [isDarkMode]);

  useEffect(() => {
    window.localStorage.setItem('duhoc-mate-wallpaper', wallpaper);
  }, [wallpaper]);

  useEffect(() => {
    window.localStorage.setItem('duhoc-mate-lang', lang);
  }, [lang]);

  async function addExpense(expense: Omit<Expense, 'id'>) {
    const next: Expense = { ...expense, id: crypto.randomUUID() };
    setExpenses((current) => [...current, next]);
    if (supabase && session) {
      await supabase!.from('expenses').insert({
        id: next.id,
        user_id: session.user.id,
        category: next.category,
        amount: next.amount,
        date: next.date,
        note: next.note
      });
    }
  }

  async function deleteExpense(id: string) {
    setExpenses((current) => current.filter((e) => e.id !== id));
    if (supabase && session) {
      await supabase!.from('expenses').delete().eq('id', id);
    }
  }

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ shifts, profile, companions, requested, rate, venueColors, incomeTarget, expenses } as StoredState));
  }, [companions, profile, rate, requested, shifts, venueColors, incomeTarget, expenses]);

  // Tự động xoá ca bị lỗi ngày 15/4 theo yêu cầu
  useEffect(() => {
    // Quét tìm tất cả các ca "Cafe" có ngày 15/4 (kể cả khi chuỗi date bị sai định dạng)
    setShifts(prev => {
      const buggedIds = prev.filter(s => {
        if (s.label === 'Cafe') {
          try {
            const d = new Date(`${s.date}T00:00:00`);
            if (d.getDate() === 15 && d.getMonth() === 3) return true;
          } catch { }
          if (s.date.includes('15/04') || s.date.includes('-4-15') || s.date.includes('-04-15')) return true;
        }
        return false;
      }).map(s => s.id);

      if (buggedIds.length > 0) {
        if (supabase && session) {
          buggedIds.forEach(id => {
            supabase?.from('shifts').delete().eq('id', id).then();
          });
        }
        return prev.filter(s => !buggedIds.includes(s.id));
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    void refreshRate();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;
    const client = supabase;
    let isMounted = true;
    Promise.all([
      client.from('shift_entries').select('*').eq('user_id', session.user.id),
      client.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      client.from('expenses').select('*').eq('user_id', session.user.id)
    ]).then(([shiftsRes, profileRes, expensesRes]) => {
      if (!isMounted) return;
      if (shiftsRes.data) {
        setShifts(shiftsRes.data.map(row => ({
          id: row.id,
          date: row.work_date,
          label: row.venue,
          startTime: row.start_time,
          endTime: row.end_time,
          hourlyWage: row.hourly_wage,
          breakMinutes: row.break_minutes,
          notes: row.notes || '',
          nightShift: row.night_shift,
          taxDeduction: row.tax_deduction,
          holidayAllowance: row.holiday_allowance
        })));
      }
      if (profileRes.data) {
        setProfile({
          displayName: profileRes.data.display_name || '',
          school: profileRes.data.school || '',
          region: profileRes.data.region || '',
          note: profileRes.data.note || '',
          avatarUrl: profileRes.data.avatar_url || ''
        });
      }
      if (expensesRes.data) {
        setExpenses(expensesRes.data.map(row => ({
          id: row.id,
          category: row.category as Expense['category'],
          amount: row.amount,
          date: row.date,
          note: row.note || ''
        })));
      }
    });
    return () => { isMounted = false; };
  }, [session]);

  const monthKey = calendarMonth.slice(0, 7);
  const monthShifts = useMemo(() => shifts.filter((shift) => shift.date.startsWith(monthKey)), [monthKey, shifts]);
  const monthlyTotal = useMemo(() => monthShifts.reduce((sum, shift) => sum + calculateShiftPay(shift).total, 0), [monthShifts]);
  const monthlyHours = useMemo(() => monthShifts.reduce((sum, shift) => sum + shiftHours(shift), 0), [monthShifts]);
  const averageHourly = monthlyHours ? monthlyTotal / monthlyHours : 0;
  const workplaceSummary = useMemo(() => {
    const map = new Map<string, { label: string; total: number; count: number; hours: number }>();
    monthShifts.forEach((shift) => {
      const current = map.get(shift.label) ?? { label: shift.label, total: 0, count: 0, hours: 0 };
      const pay = calculateShiftPay(shift);
      current.total += pay.total;
      current.count += 1;
      current.hours += pay.hours;
      map.set(shift.label, current);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [monthShifts]);

  const recentShifts = useMemo(
    () => [...shifts].sort((a, b) => {
      const strA = `${a.date}T${a.startTime || '00:00'}`;
      const strB = `${b.date}T${b.startTime || '00:00'}`;
      return strA < strB ? 1 : strA > strB ? -1 : 0;
    }).slice(0, 4),
    [shifts]
  );

  async function refreshRate() {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/KRW');
      const payload = (await response.json()) as { rates?: { VND?: number } };
      const value = Number(payload.rates?.VND);
      if (Number.isFinite(value)) setRate({ value, source: 'live', updatedAt: new Date().toISOString() });
    } catch {
      setRate((current) => ({ ...current, source: 'cached' }));
    }
  }

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !authEmail) {
      setAuthMessage('Hãy cấu hình Supabase trước khi gửi magic link.');
      return;
    }
    setSendingAuth(true);
    const { error } = await supabase!.auth.signInWithOtp({ email: authEmail, options: { emailRedirectTo: window.location.origin } });
    setSendingAuth(false);
    setAuthMessage(error ? 'Chưa gửi được link đăng nhập.' : 'Mình đã gửi magic link vào email của bạn.');
  }

  async function saveProfile(updatedProfile?: ProfileDraft) {
    const toSave = updatedProfile || profile;
    setSavingProfile(true);
    if (supabase && session) {
      const { error } = await supabase!.from('profiles').upsert({
        id: session.user.id,
        display_name: toSave.displayName,
        school: toSave.school,
        region: toSave.region,
        note: toSave.note,
        avatar_url: toSave.avatarUrl
      });
      if (error) console.error('Lỗi lưu hồ sơ:', error);
    }
    setSavingProfile(false);
  }

  async function addShift(nextTab: Tab = 'calendar') {
    const shift: Shift = {
      id: `shift-${Date.now()}`,
      date: draft.date,
      label: draft.venue,
      startTime: draft.startTime,
      endTime: draft.endTime,
      hourlyWage: draft.hourlyWage,
      breakMinutes: draft.breakMinutes,
      notes: draft.note || draft.label,
      nightShift: draft.nightShift,
      taxDeduction: draft.taxDeduction,
      holidayAllowance: draft.holidayAllowance
    };
    setShifts((current) => [shift, ...current]);
    setSelectedDate(shift.date);
    setCalendarMonth(startOfMonth(shift.date));
    setIsDaySheetOpen(false);
    if (supabase && session) {
      await supabase!.from('shift_entries').upsert({
        id: shift.id,
        user_id: session.user.id,
        work_date: shift.date,
        venue: shift.label,
        start_time: shift.startTime,
        end_time: shift.endTime,
        hourly_wage: shift.hourlyWage,
        break_minutes: shift.breakMinutes,
        notes: shift.notes,
        night_shift: shift.nightShift,
        tax_deduction: shift.taxDeduction,
        holiday_allowance: shift.holidayAllowance
      });
    }
    setTab(nextTab);
  }

  async function updateShift(nextShift: Shift) {
    setShifts((current) => current.map((shift) => (shift.id === nextShift.id ? nextShift : shift)));
    setSelectedDate(nextShift.date);
    setCalendarMonth(startOfMonth(nextShift.date));
    if (supabase && session) {
      await supabase!.from('shift_entries').upsert({
        id: nextShift.id,
        user_id: session.user.id,
        work_date: nextShift.date,
        venue: nextShift.label,
        start_time: nextShift.startTime,
        end_time: nextShift.endTime,
        hourly_wage: nextShift.hourlyWage,
        break_minutes: nextShift.breakMinutes,
        notes: nextShift.notes,
        night_shift: nextShift.nightShift,
        tax_deduction: nextShift.taxDeduction,
        holiday_allowance: nextShift.holidayAllowance
      });
    }
  }

  async function deleteShift(id: string) {
    setShifts((current) => current.filter((shift) => shift.id !== id));
    if (editingShiftId === id) {
      setEditingShiftId(null);
      setIsDaySheetOpen(false);
    }
    if (supabase && session) {
      await supabase!.from('shift_entries').delete().eq('id', id);
    }
  }

  function handleEditShift(shift: Shift) {
    setEditingShiftId(shift.id);
    setDraft({
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
      holidayAllowance: shift.holidayAllowance
    });
    setSelectedDate(shift.date);
    setCalendarMonth(startOfMonth(shift.date));
    setIsDaySheetOpen(true);
    setTab('calendar');
  }

  async function requestConnection(id: string) {
    setRequested((current) => [...new Set([...current, id])]);
    if (supabase && session) {
      await supabase!.from('companion_requests').insert({ requester_id: session.user.id, companion_id: id });
    }
  }

  function openAddToday() {
    setEditingShiftId(null);
    navigateToDate(todayIso);
  }

  function navigateToDate(date: string) {
    setSelectedDate(date);
    setCalendarMonth(startOfMonth(date));
    setDraft((current) => ({ ...current, date, note: '' }));
    setIsDaySheetOpen(true);
    setTab('calendar');
    window.location.hash = 'calendar';
    // Push extra entry for the day sheet so back can close it
    suppressPopstate.current = true;
    history.pushState({ modal: 'daysheet' }, '');
  }

  function setVenueColor(venue: string, color: string) {
    setVenueColors((current) => ({ ...current, [venue]: color }));
  }

  const changeTab = useCallback((nextTab: Tab) => {
    if (nextTab !== 'calendar') setIsDaySheetOpen(false);
    setTab(nextTab);
    window.location.hash = nextTab === 'home' ? '' : nextTab;
    // Push history entry so back button returns to previous tab
    suppressPopstate.current = true;
    history.pushState({ tab: nextTab }, '');
  }, []);

  // Sync tab from hash on popstate (back/forward button)
  useEffect(() => {
    function handlePopstate(e: PopStateEvent) {
      if (suppressPopstate.current) {
        suppressPopstate.current = false;
        return;
      }
      // If a day sheet is open, close it first
      if (isDaySheetOpen) {
        setIsDaySheetOpen(false);
        return;
      }
      // Otherwise navigate to the tab from state or hash
      if (e.state?.tab) {
        setTab(e.state.tab);
      } else {
        const hashTab = getTabFromHash();
        setTab(hashTab);
      }
    }
    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [isDaySheetOpen]);

  // Set initial history entry
  useEffect(() => {
    const initialTab = getTabFromHash();
    history.replaceState({ tab: initialTab }, '');
  }, []);

  const wallpaperStyle = wallpaper !== 'default'
    ? { background: WALLPAPERS.find(w => w.key === wallpaper)?.gradient }
    : undefined;

  return (
    <div className="app-stage">
      <div className="phone-shell" style={wallpaperStyle}>
        <main key={tab} className="screen-shell">
          {tab === 'home' ? (
            <HomeScreen
              monthlyTotal={monthlyTotal}
              monthlyHours={monthlyHours}
              averageHourly={averageHourly}
              rate={rate}
              workplaces={workplaceSummary}
              recentShifts={recentShifts}
              allShifts={monthShifts}
              onRefresh={() => void refreshRate()}
              onOpenAdd={openAddToday}
              onEditShift={handleEditShift}
              onDeleteShift={(id) => void deleteShift(id)}
              venueColors={venueColors}
              currentMonth={calendarMonth}
              onPrevMonth={() => { const nextMonth = shiftMonth(calendarMonth, -1); setCalendarMonth(nextMonth); }}
              onNextMonth={() => { const nextMonth = shiftMonth(calendarMonth, 1); setCalendarMonth(nextMonth); }}
              onOpenNotifications={() => setShowNotifications(true)}
            />
          ) : null}
          {tab === 'calendar' ? <CalendarScreen shifts={shifts} selectedDate={selectedDate} month={calendarMonth} venueSuggestions={[...new Set(workplaceSummary.map((item) => item.label))].slice(0, 4)} draft={draft} setDraft={setDraft} editingShiftId={editingShiftId} setEditingShiftId={setEditingShiftId} isSheetOpen={isDaySheetOpen} onCloseSheet={() => setIsDaySheetOpen(false)} onPrevMonth={() => { const nextMonth = shiftMonth(calendarMonth, -1); setCalendarMonth(nextMonth); setSelectedDate(nextMonth); setDraft((current) => ({ ...current, date: nextMonth })); }} onNextMonth={() => { const nextMonth = shiftMonth(calendarMonth, 1); setCalendarMonth(nextMonth); setSelectedDate(nextMonth); setDraft((current) => ({ ...current, date: nextMonth })); }} onSetMonth={(nextMonth) => { setCalendarMonth(nextMonth); setSelectedDate(nextMonth); setDraft((current) => ({ ...current, date: nextMonth })); }} onSelectDate={(date) => { setEditingShiftId(null); setSelectedDate(date); setDraft((current) => ({ ...current, date, note: '' })); setIsDaySheetOpen(true); }} onQuickSave={() => void addShift('calendar')} onUpdateShift={(shift) => void updateShift(shift)} onDeleteShift={(id) => void deleteShift(id)} venueColors={venueColors} onSetVenueColor={setVenueColor} /> : null}
          {tab === 'income' ? (
            <IncomeScreen
              minimumWage={MINIMUM_WAGE_2026}
              monthlyTotal={monthlyTotal}
              monthlyHours={monthlyHours}
              averageHourly={averageHourly}
              workplaces={workplaceSummary}
              rate={rate}
              shifts={monthShifts}
              venueColors={venueColors}
              expenses={expenses}
              onAddExpense={addExpense}
              onDeleteExpense={deleteExpense}
              target={incomeTarget}
              onSetTarget={setIncomeTarget}
            />
          ) : null}
          {tab === 'friends' ? <CommunityScreen profile={profile} companions={companions} requested={requested} onRequest={(id) => void requestConnection(id)} session={session} onOpenNotifications={() => setShowNotifications(true)} /> : null}
          {tab === 'profile' ? (
            <ProfileScreen
              profile={profile}
              setProfile={setProfile}
              saveProfile={(draft) => void saveProfile(draft)}
              savingProfile={savingProfile}
              session={session}
              isDarkMode={isDarkMode}
              onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
              wallpaper={wallpaper}
              onChangeWallpaper={setWallpaper}
              lang={lang}
              onChangeLang={setLang}
            />
          ) : null}
        </main>

        <nav className="bottom-tabs" aria-label="Điều hướng chính">
          {tabIcons.map(({ id, icon: Icon }) => (
            <button key={id} type="button" onClick={() => changeTab(id)} className={tab === id ? 'tab-item active' : 'tab-item'}>
              <span className="tab-icon-wrap">
                <Icon size={20} />
              </span>
              <span>{tabLabels[lang][id]}</span>
            </button>
          ))}
        </nav>

        {/* Global Notification Popover */}
        <AnimatePresence>
          {showNotifications && (
            <motion.div 
              className="cm-notif-popover"
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
            >
              <div className="cm-notif-popover-head">
                <strong>Thông báo & Hoạt động</strong>
                <button onClick={() => setShowNotifications(false)}><X size={16} /></button>
              </div>
              <div className="cm-notif-popover-body">
                {demoNotifications.map(n => (
                  <div key={`global-act-${n.id}`} className="cm-notif-item">
                    <div className={`cm-notif-icon-circle ${n.type}`}>
                      {n.type === 'like' ? <ThumbsUp size={12} /> : <MessageCircle size={12} />}
                    </div>
                    <div className="cm-notif-item-content">
                      <p><strong>{n.user}</strong> {n.type === 'like' ? 'đã thích' : 'đã bình luận vào'} bài viết <span>"{n.post}"</span></p>
                      {n.content && <p className="cm-notif-comment-snippet">"{n.content}"</p>}
                      <span className="cm-notif-time">{n.time}</span>
                    </div>
                  </div>
                ))}
                
                {/* Community News */}
                <div className="cm-notif-item">
                  <div className="cm-notif-icon-circle" style={{ background: 'rgba(255, 171, 0, 0.1)', color: '#ffab00' }}>
                    <Flame size={14} />
                  </div>
                  <div className="cm-notif-item-content">
                    <p><strong>Cộng đồng:</strong> Bài viết <span>"Mẹo tiết kiệm chi phí..."</span> đang rất Hot!</p>
                    <span className="cm-notif-time">1 ngày trước</span>
                  </div>
                </div>
                <div className="cm-notif-item">
                  <div className="cm-notif-icon-circle" style={{ background: 'rgba(13, 155, 114, 0.1)', color: 'var(--green-600)' }}>
                    <ShieldCheck size={14} />
                  </div>
                  <div className="cm-notif-item-content">
                    <p><strong>Quy định:</strong> Cập nhật điều khoản cộng đồng mới nhất.</p>
                    <span className="cm-notif-time">3 ngày trước</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
