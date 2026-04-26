import { useEffect, useMemo, useState, FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, House, MessageCircleMore, UserRound, WalletCards, Cloud, CloudOff } from 'lucide-react';
import { demoCompanions, demoProfile, demoShifts } from './data';
import { DEFAULT_KRW_TO_VND, MINIMUM_WAGE_2026, calculateShiftPay, shiftHours, Shift } from './lib/salary';
import { hasSupabaseConfig, supabase } from './lib/supabase';
import { Tab, StoredState, ShiftDraft, VenueColors, Expense } from './lib/types';
import { startOfMonth, shiftMonth, formatMonthHeader } from './utils/helpers';
import { HomeScreen } from './components/HomeScreen';
import { CalendarScreen } from './components/CalendarScreen';
import { IncomeScreen } from './components/IncomeScreen';
import { CommunityScreen } from './components/CommunityScreen';
import { ProfileScreen } from './components/ProfileScreen';

const STORAGE_KEY = 'duhoc-mate-redesign-state';
const todayIso = new Date().toISOString().slice(0, 10);
const tabs: Array<{ id: Tab; label: string; icon: typeof House }> = [
  { id: 'home', label: 'Trang chủ', icon: House },
  { id: 'calendar', label: 'Lịch', icon: CalendarDays },
  { id: 'income', label: 'Thu nhập', icon: WalletCards },
  { id: 'friends', label: 'Cộng đồng', icon: MessageCircleMore },
  { id: 'profile', label: 'Hồ sơ', icon: UserRound }
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

export default function App() {
  const initial = loadState();
  const [tab, setTab] = useState<Tab>('home');
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
  const [rate, setRate] = useState(initial.rate);
  const [venueColors, setVenueColors] = useState<VenueColors>(initial.venueColors);
  const [incomeTarget, setIncomeTarget] = useState(initial.incomeTarget ?? 2000000);
  const [expenses, setExpenses] = useState(initial.expenses ?? []);
  const [draft, setDraft] = useState<ShiftDraft>(defaultDraft);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(todayIso));
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [isDaySheetOpen, setIsDaySheetOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('duhoc-mate-dark') === 'true';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    window.localStorage.setItem('duhoc-mate-dark', isDarkMode.toString());
  }, [isDarkMode]);

  function addExpense(expense: Omit<Expense, 'id'>) {
    const next: Expense = { ...expense, id: crypto.randomUUID() };
    setExpenses((current) => [...current, next]);
  }

  function deleteExpense(id: string) {
    setExpenses((current) => current.filter((e) => e.id !== id));
  }

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ shifts, profile, companions, requested, rate, venueColors, incomeTarget, expenses } as StoredState));
  }, [companions, profile, rate, requested, shifts, venueColors, incomeTarget, expenses]);

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
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const monthKey = calendarMonth.slice(0, 7);
  const monthShifts = useMemo(() => shifts.filter((shift) => shift.date.startsWith(monthKey)), [monthKey, shifts]);
  const monthlyTotal = useMemo(() => monthShifts.reduce((sum, shift) => sum + calculateShiftPay(shift).total, 0), [monthShifts]);
  const monthlyHours = useMemo(() => monthShifts.reduce((sum, shift) => sum + shiftHours(shift), 0), [monthShifts]);
  const averageHourly = monthlyHours ? monthlyTotal / monthlyHours : MINIMUM_WAGE_2026;
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
    () => [...shifts].sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`)).slice(0, 4),
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
    const { error } = await supabase.auth.signInWithOtp({ email: authEmail, options: { emailRedirectTo: window.location.origin } });
    setSendingAuth(false);
    setAuthMessage(error ? 'Chưa gửi được link đăng nhập.' : 'Mình đã gửi magic link vào email của bạn.');
  }

  async function saveProfile() {
    setSavingProfile(true);
    if (supabase && session) {
      await supabase.from('profiles').upsert({
        id: session.user.id,
        display_name: profile.displayName,
        school: profile.school,
        region: profile.region,
        note: profile.note
      });
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
      await supabase.from('shift_entries').upsert({
        id: shift.id,
        user_id: session.user.id,
        work_date: shift.date,
        venue: shift.label,
        start_time: shift.startTime,
        end_time: shift.endTime,
        hourly_wage: shift.hourlyWage,
        break_minutes: shift.breakMinutes,
        notes: shift.notes
      });
    }
    setTab(nextTab);
  }

  async function updateShift(nextShift: Shift) {
    setShifts((current) => current.map((shift) => (shift.id === nextShift.id ? nextShift : shift)));
    setSelectedDate(nextShift.date);
    setCalendarMonth(startOfMonth(nextShift.date));
    if (supabase && session) {
      await supabase.from('shift_entries').upsert({
        id: nextShift.id,
        user_id: session.user.id,
        work_date: nextShift.date,
        venue: nextShift.label,
        start_time: nextShift.startTime,
        end_time: nextShift.endTime,
        hourly_wage: nextShift.hourlyWage,
        break_minutes: nextShift.breakMinutes,
        notes: nextShift.notes
      });
    }
  }

  async function deleteShift(id: string) {
    setShifts((current) => current.filter((shift) => shift.id !== id));
    if (supabase && session) {
      await supabase.from('shift_entries').delete().eq('id', id);
    }
  }

  async function requestConnection(id: string) {
    setRequested((current) => [...new Set([...current, id])]);
    if (supabase && session) {
      await supabase.from('companion_requests').insert({ requester_id: session.user.id, companion_id: id });
    }
  }

  function openAddToday() {
    navigateToDate(todayIso);
  }

  function navigateToDate(date: string) {
    setSelectedDate(date);
    setCalendarMonth(startOfMonth(date));
    setDraft((current) => ({ ...current, date }));
    setIsDaySheetOpen(true);
    setTab('calendar');
  }

  function setVenueColor(venue: string, color: string) {
    setVenueColors((current) => ({ ...current, [venue]: color }));
  }

  function changeTab(nextTab: Tab) {
    if (nextTab !== 'calendar') setIsDaySheetOpen(false);
    setTab(nextTab);
  }

  return (
    <div className="app-stage">
      <div className="phone-shell">
        <main key={tab} className="screen-shell">
          {tab === 'home' ? (
            <HomeScreen 
              monthlyTotal={monthlyTotal} 
              monthlyHours={monthlyHours} 
              averageHourly={averageHourly} 
              rate={rate} 
              workplaces={workplaceSummary} 
              recentShifts={recentShifts} 
              onRefresh={() => void refreshRate()} 
              onOpenAdd={openAddToday} 
              venueColors={venueColors}
              currentMonth={calendarMonth}
              onPrevMonth={() => { const nextMonth = shiftMonth(calendarMonth, -1); setCalendarMonth(nextMonth); }}
              onNextMonth={() => { const nextMonth = shiftMonth(calendarMonth, 1); setCalendarMonth(nextMonth); }}
            />
          ) : null}
          {tab === 'calendar' ? <CalendarScreen shifts={shifts} selectedDate={selectedDate} month={calendarMonth} venueSuggestions={[...new Set([...workplaceSummary.map((item) => item.label), 'Việc làm thêm', 'Cafe'])].slice(0, 4)} draft={draft} setDraft={setDraft} isSheetOpen={isDaySheetOpen} onCloseSheet={() => setIsDaySheetOpen(false)} onPrevMonth={() => { const nextMonth = shiftMonth(calendarMonth, -1); setCalendarMonth(nextMonth); setSelectedDate(nextMonth); setDraft((current) => ({ ...current, date: nextMonth })); }} onNextMonth={() => { const nextMonth = shiftMonth(calendarMonth, 1); setCalendarMonth(nextMonth); setSelectedDate(nextMonth); setDraft((current) => ({ ...current, date: nextMonth })); }} onSetMonth={(nextMonth) => { setCalendarMonth(nextMonth); setSelectedDate(nextMonth); setDraft((current) => ({ ...current, date: nextMonth })); }} onSelectDate={(date) => { setSelectedDate(date); setDraft((current) => ({ ...current, date })); setIsDaySheetOpen(true); }} onQuickSave={() => void addShift('calendar')} onUpdateShift={(shift) => void updateShift(shift)} onDeleteShift={(id) => void deleteShift(id)} venueColors={venueColors} onSetVenueColor={setVenueColor} /> : null}
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
          {tab === 'friends' ? <CommunityScreen companions={companions} requested={requested} onRequest={(id) => void requestConnection(id)} /> : null}
          {tab === 'profile' ? (
            <ProfileScreen 
              authEmail={authEmail} 
              authMessage={authMessage} 
              sendingAuth={sendingAuth} 
              onAuthEmailChange={setAuthEmail} 
              onSendMagicLink={(event) => void sendMagicLink(event)} 
              profile={profile} 
              setProfile={setProfile} 
              saveProfile={() => void saveProfile()} 
              savingProfile={savingProfile} 
              session={session} 
              isDarkMode={isDarkMode}
              onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            />
          ) : null}
        </main>

        <nav className="bottom-tabs" aria-label="Điều hướng chính">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => changeTab(id)} className={tab === id ? 'tab-item active' : 'tab-item'}>
              <span className="tab-icon-wrap">
                <Icon size={20} />
              </span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
