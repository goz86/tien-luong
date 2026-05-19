import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type {
  Tab, StoredState, ShiftDraft, VenueColors,
  Expense, ProfileDraft, CompanionProfile, Shift, RateState, PersonalGoal, CurrencyMode,
} from '../lib/types';
import type { CommunityNotification } from '../data/communityData';
import type { AppLang, WallpaperKey } from '../components/ProfileScreen';
import { DEFAULT_KRW_TO_VND, calculateShiftPay, shiftHours, getMonthlyWageTotal } from '../lib/salary';
import { startOfMonth } from '../utils/helpers';
import {
  getGuestPendingLikes,
  getGuestPendingBookmarks,
  clearGuestPending,
} from '../lib/guestSession';
import { togglePostReaction, toggleCommunityBookmark } from '../lib/communityStore';

const LEGACY_STORAGE_KEY = 'duhoc-mate-redesign-state';
const GUEST_STORAGE_KEY = 'duhoc-mate-guest-state';
const USER_STORAGE_PREFIX = 'duhoc-mate-user-state';
const NOTIFICATION_SEEN_KEY = 'duhoc-mate-notifications-seen-at';
const getLocalDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todayIso = getLocalDateString();

/* ── helpers ── */

function notificationSeenStorageKey(userId: string) {
  return `${NOTIFICATION_SEEN_KEY}:${userId}`;
}

function getNotificationSeenAt(userId?: string | null) {
  if (!userId || typeof window === 'undefined') return null;
  return window.localStorage.getItem(notificationSeenStorageKey(userId));
}

function rememberNotificationsSeen(userId?: string | null) {
  if (!userId || typeof window === 'undefined') return;
  window.localStorage.setItem(notificationSeenStorageKey(userId), new Date().toISOString());
}

function applyLocalNotificationReads(notifications: CommunityNotification[], userId?: string | null) {
  const seenAt = getNotificationSeenAt(userId);
  if (!seenAt) return notifications;
  const seenTime = new Date(seenAt).getTime();
  if (!Number.isFinite(seenTime)) return notifications;

  return notifications.map((notification) => {
    const createdTime = new Date(notification.created_at).getTime();
    return Number.isFinite(createdTime) && createdTime <= seenTime
      ? { ...notification, is_read: true }
      : notification;
  });
}

function fallbackState(): StoredState {
  return {
    shifts: [],
    profile: { displayName: '', school: '', region: '', note: '', tags: [] },
    companions: [],
    requested: [],
    rate: { value: DEFAULT_KRW_TO_VND, source: 'cached', updatedAt: new Date().toISOString() },
    venueColors: {},
    incomeTarget: 2000000,
    expenses: [],
    personalGoals: [],
    currencyMode: 'krw-vnd',
  };
}

function clearUserScopedState() {
  return {
    shifts: [],
    profile: fallbackState().profile,
    companions: [],
    requested: [],
    friendships: [],
    expenses: [],
    personalGoals: [],
    notifications: [],
    showNotifications: false,
    toastNotification: null,
    earnedBadges: [],
    rankings: [],
    userStats: { postsCount: 0, commentsCount: 0, likesCount: 0 },
    savingProfile: false,
    adminRole: null,
  };
}

function storageKeyForUser(userId?: string | null) {
  return userId ? `${USER_STORAGE_PREFIX}:${userId}` : GUEST_STORAGE_KEY;
}

function normalizeStoredState(parsed: Partial<StoredState>): StoredState {
  return {
    shifts: Array.isArray(parsed.shifts) ? parsed.shifts : [],
    profile: parsed.profile ? { ...fallbackState().profile, ...parsed.profile } : fallbackState().profile,
    companions: Array.isArray(parsed.companions) ? parsed.companions : [],
    requested: Array.isArray(parsed.requested) ? parsed.requested : [],
    rate: parsed.rate
      ? { ...parsed.rate, source: parsed.rate.source === 'live' ? 'live' : 'cached' }
      : fallbackState().rate,
    venueColors:
      typeof parsed.venueColors === 'object' && parsed.venueColors !== null
        ? (parsed.venueColors as VenueColors)
        : {},
    incomeTarget: typeof parsed.incomeTarget === 'number' ? parsed.incomeTarget : 2000000,
    expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    personalGoals: Array.isArray(parsed.personalGoals) ? parsed.personalGoals : [],
    currencyMode: ['krw-vnd', 'vnd-vnd', 'vnd-krw'].includes(parsed.currencyMode as string)
      ? (parsed.currencyMode as CurrencyMode)
      : 'krw-vnd',
  };
}

function loadStoredState(key: string): StoredState {
  if (typeof window === 'undefined') return fallbackState();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallbackState();
    return normalizeStoredState(JSON.parse(raw) as Partial<StoredState>);
  } catch {
    return fallbackState();
  }
}

function loadState(userId?: string | null): StoredState {
  if (typeof window === 'undefined') return fallbackState();
  const key = storageKeyForUser(userId);
  const scoped = loadStoredState(key);
  if (key === GUEST_STORAGE_KEY && !window.localStorage.getItem(GUEST_STORAGE_KEY)) {
    const legacy = loadStoredState(LEGACY_STORAGE_KEY);
    if (legacy.shifts.length || legacy.expenses.length || legacy.personalGoals?.length) return legacy;
  }
  return scoped;
}

function storedStatePatch(stored: StoredState) {
  return {
    shifts: stored.shifts,
    profile: stored.profile,
    companions: stored.companions,
    requested: stored.requested,
    rate: stored.rate,
    venueColors: stored.venueColors,
    incomeTarget: stored.incomeTarget ?? 2000000,
    expenses: stored.expenses,
    personalGoals: stored.personalGoals ?? [],
    currencyMode: stored.currencyMode ?? 'krw-vnd',
  };
}

const defaultDraft: ShiftDraft = {
  venue: 'Việc làm thêm',
  date: todayIso,
  startTime: '18:00',
  endTime: '22:00',
  breakMinutes: 0,
  hourlyWage: 11000,
  label: 'Ca tối',
  note: '',
};

const VALID_TABS: Tab[] = ['home', 'calendar', 'income', 'friends', 'profile', 'admin'];
function getTabFromHash(): Tab {
  const hash = window.location.hash.replace('#', '');
  return VALID_TABS.includes(hash as Tab) ? (hash as Tab) : 'home';
}

/* ── store type ── */

export interface AppState {
  // Persisted data
  shifts: Shift[];
  profile: ProfileDraft;
  companions: CompanionProfile[];
  requested: string[];
  friendships: any[];
  rate: RateState;
  venueColors: VenueColors;
  incomeTarget: number;
  expenses: Expense[];
  personalGoals: PersonalGoal[];
  currencyMode: CurrencyMode;

  // Auth
  session: Session | null;
  authEmail: string;
  authMessage: string;
  sendingAuth: boolean;
  savingProfile: boolean;
  adminRole: string | null;

  // Social
  notifications: CommunityNotification[];
  showNotifications: boolean;
  toastNotification: CommunityNotification | null;
  earnedBadges: string[];
  isAnonymousRank: boolean;
  rankings: any[];
  userStats: { postsCount: number; commentsCount: number; likesCount: number };

  // UI state
  tab: Tab;
  draft: ShiftDraft;
  editingShiftId: string | null;
  calendarMonth: string;
  selectedDate: string;
  isDaySheetOpen: boolean;
  online: boolean;
  isDarkMode: boolean;
  wallpaper: WallpaperKey;
  lang: AppLang;

  // Computed (recalculated on read — set via recalc)
  monthlyTotal: number;
  monthlyHours: number;
  averageHourly: number;
  workplaceSummary: Array<{ label: string; total: number; count: number; hours: number; isMonthly?: boolean }>;
  recentShifts: Shift[];
  monthShifts: Shift[];
  unreadCount: number;
  isAdmin: boolean;

  // ── Actions ──

  // Persistence
  persist: () => void;

  // Tab / navigation
  setTab: (t: Tab) => void;
  changeTab: (t: Tab) => void;
  openAddToday: (venue?: string) => void;
  navigateToDate: (date: string, venue?: string) => void;

  // Auth
  setSession: (s: Session | null) => void;
  setAdminRole: (r: string | null) => void;
  setAuthEmail: (e: string) => void;
  setAuthMessage: (m: string) => void;
  setSendingAuth: (v: boolean) => void;
  setSavingProfile: (v: boolean) => void;

  // Shifts
  setShifts: (s: Shift[]) => void;
  addShift: (shift: Shift, nextTab?: Tab) => void;
  updateShift: (shift: Shift) => void;
  deleteShift: (id: string) => void;

  // Profile
  setProfile: (p: ProfileDraft | ((prev: ProfileDraft) => ProfileDraft)) => void;

  // Expenses
  setExpenses: (e: Expense[]) => void;
  addExpenseLocally: (expense: Expense) => void;
  removeExpenseLocally: (id: string) => void;

  // Friends / companions
  setCompanions: (c: CompanionProfile[] | ((prev: CompanionProfile[]) => CompanionProfile[])) => void;
  setFriendships: (f: any[] | ((prev: any[]) => any[])) => void;
  setRequested: (r: string[] | ((prev: string[]) => string[])) => void;
  addRequested: (id: string) => void;

  // Rate
  setRate: (r: RateState | ((prev: RateState) => RateState)) => void;

  // Venue colors
  setVenueColors: (c: VenueColors) => void;
  setVenueColor: (venue: string, color: string) => void;

  // Income target
  setIncomeTarget: (n: number) => void;

  // Personal goals
  addPersonalGoal: (goal: Omit<PersonalGoal, 'id' | 'createdAt'>) => void;
  updatePersonalGoal: (id: string, patch: Partial<Omit<PersonalGoal, 'id' | 'createdAt'>>) => void;
  removePersonalGoal: (id: string) => void;
  togglePersonalGoalDone: (id: string) => void;

  // UI
  setDraft: (d: ShiftDraft | ((prev: ShiftDraft) => ShiftDraft)) => void;
  setEditingShiftId: (id: string | null) => void;
  setCalendarMonth: (m: string) => void;
  setSelectedDate: (d: string) => void;
  setIsDaySheetOpen: (v: boolean) => void;
  setOnline: (v: boolean) => void;
  setIsDarkMode: (v: boolean) => void;
  setWallpaper: (w: WallpaperKey) => void;
  setLang: (l: AppLang) => void;
  setCurrencyMode: (m: CurrencyMode) => void;

  // Notifications
  setNotifications: (n: CommunityNotification[] | ((prev: CommunityNotification[]) => CommunityNotification[])) => void;
  setShowNotifications: (v: boolean) => void;
  setToastNotification: (n: CommunityNotification | null) => void;
  handleOpenNotifications: () => void;
  markAllAsRead: () => void;

  // Badges / rankings / social
  setEarnedBadges: (b: string[] | ((prev: string[]) => string[])) => void;
  setIsAnonymousRank: (v: boolean) => void;
  setRankings: (r: any[]) => void;
  setUserStats: (s: { postsCount: number; commentsCount: number; likesCount: number }) => void;

  // Recalc derived values
  recalc: () => void;
}

export const useAppStore = create<AppState>((set, get) => {
  const initial = loadState();

  const derive = (state: Partial<AppState> & { shifts?: Shift[]; profile?: ProfileDraft; session?: Session | null; adminRole?: string | null; notifications?: CommunityNotification[]; calendarMonth?: string }) => {
    const current = get() as Partial<AppState> | undefined;
    const shifts = state.shifts ?? current?.shifts ?? initial.shifts ?? [];
    const monthKey = (state.calendarMonth ?? current?.calendarMonth ?? startOfMonth(todayIso)).slice(0, 7);
    const monthShifts = shifts.filter((s) => s.date.startsWith(monthKey));
    const shiftPayTotal = monthShifts.reduce((sum, s) => sum + calculateShiftPay(s).total, 0);
    const monthlyTotal = shiftPayTotal + getMonthlyWageTotal(monthShifts, monthKey);
    // Hours and avg-hourly only from hourly/daily shifts (monthly wage is not per-hour)
    const monthlyHours = monthShifts
      .filter(s => s.wageType !== 'monthly')
      .reduce((sum, s) => sum + shiftHours(s), 0);
    const hourlyOnlyTotal = monthShifts
      .filter(s => s.wageType !== 'monthly')
      .reduce((sum, s) => sum + calculateShiftPay(s).total, 0);
    const averageHourly = monthlyHours ? hourlyOnlyTotal / monthlyHours : 0;

    const map = new Map<string, { label: string; total: number; count: number; hours: number; isMonthly?: boolean }>();
    monthShifts.forEach((s) => {
      const cur = map.get(s.label) ?? { label: s.label, total: 0, count: 0, hours: 0 };
      const pay = calculateShiftPay(s);
      if (s.wageType === 'monthly') {
        // Monthly venue: total = fixed monthly wage (overwrite, same across shifts in month)
        map.set(s.label, { label: s.label, total: s.monthlyWage ?? 0, count: cur.count + 1, hours: cur.hours + pay.hours, isMonthly: true });
      } else {
        cur.total += pay.total;
        cur.count += 1;
        cur.hours += pay.hours;
        map.set(s.label, cur);
      }
    });
    const workplaceSummary = [...map.values()].sort((a, b) => b.total - a.total);

    const recentShifts = [...shifts]
      .sort((a, b) => {
        const strA = `${a.date}T${a.startTime || '00:00'}`;
        const strB = `${b.date}T${b.startTime || '00:00'}`;
        return strA < strB ? 1 : strA > strB ? -1 : 0;
      })
      .slice(0, 4);

    const session = state.session ?? current?.session ?? null;
    const adminRole = state.adminRole ?? current?.adminRole ?? null;
    const notifications = applyLocalNotificationReads(state.notifications ?? current?.notifications ?? [], session?.user.id);
    const unreadCount = notifications.filter((n) => !n.is_read).length;
    const email = (session?.user.email || '').toLowerCase();
    const isAdmin = email === 'michintashop@gmail.com' || Boolean(adminRole);

    return { monthlyTotal, monthlyHours, averageHourly, workplaceSummary, recentShifts, monthShifts, unreadCount, isAdmin };
  };

  return {
    // ── initial persisted state ──
    shifts: initial.shifts,
    profile: initial.profile,
    companions: initial.companions,
    requested: initial.requested,
    friendships: [],
    rate: initial.rate,
    venueColors: initial.venueColors,
    incomeTarget: initial.incomeTarget ?? 2000000,
    expenses: initial.expenses ?? [],
    personalGoals: initial.personalGoals ?? [],
    currencyMode: initial.currencyMode ?? 'krw-vnd',

    // ── auth ──
    session: null,
    authEmail: '',
    authMessage: '',
    sendingAuth: false,
    savingProfile: false,
    adminRole: null,

    // ── social ──
    notifications: [],
    showNotifications: false,
    toastNotification: null,
    earnedBadges: [],
    isAnonymousRank: false,
    rankings: [],
    userStats: { postsCount: 0, commentsCount: 0, likesCount: 0 },

    // ── UI ──
    tab: getTabFromHash(),
    draft: defaultDraft,
    editingShiftId: null,
    calendarMonth: startOfMonth(todayIso),
    selectedDate: todayIso,
    isDaySheetOpen: false,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isDarkMode: typeof window !== 'undefined' ? window.localStorage.getItem('duhoc-mate-dark') === 'true' : false,
    wallpaper: (typeof window !== 'undefined'
      ? (window.localStorage.getItem('duhoc-mate-wallpaper') as WallpaperKey)
      : 'default') || 'default',
    lang: (typeof window !== 'undefined'
      ? (window.localStorage.getItem('duhoc-mate-lang') as AppLang)
      : 'vi') || 'vi',

    // ── computed (initial) ──
    ...derive({ shifts: initial.shifts, calendarMonth: startOfMonth(todayIso) }),

    // ══════════════════════════════════════════
    // ACTIONS
    // ══════════════════════════════════════════

    persist: () => {
      const s = get();
      window.localStorage.setItem(
        storageKeyForUser(s.session?.user.id),
        JSON.stringify({
          shifts: s.shifts,
          profile: s.profile,
          companions: s.companions,
          requested: s.requested,
          rate: s.rate,
          venueColors: s.venueColors,
          incomeTarget: s.incomeTarget,
          expenses: s.expenses,
          personalGoals: s.personalGoals,
          currencyMode: s.currencyMode,
        } as StoredState),
      );
    },

    setTab: (t) => set({ tab: t }),
    changeTab: (nextTab) => {
      set((s) => {
        if (nextTab !== 'calendar') s.isDaySheetOpen = false;
        s.tab = nextTab;
        window.location.hash = nextTab === 'home' ? '' : nextTab;
        return { tab: nextTab, isDaySheetOpen: nextTab !== 'calendar' ? false : s.isDaySheetOpen };
      });
    },
    openAddToday: (venue) => {
      get().navigateToDate(todayIso, venue);
    },
    navigateToDate: (date, venue) => {
      const trimmedVenue = venue?.trim();
      const nextDraft = {
        ...get().draft,
        date,
        note: '',
        ...(trimmedVenue ? { venue: trimmedVenue } : {}),
      };
      set({
        selectedDate: date,
        calendarMonth: startOfMonth(date),
        draft: nextDraft,
        isDaySheetOpen: true,
        tab: 'calendar',
        editingShiftId: null,
      });
      window.location.hash = 'calendar';
    },

    // Auth
    setSession: (nextSession) => {
      set((state) => {
        const previousUserId = state.session?.user.id ?? null;
        const nextUserId = nextSession?.user.id ?? null;
        const userChanged = previousUserId !== nextUserId;
        const wasGuest = !previousUserId && Boolean(nextUserId);
        const nextStored = userChanged ? loadState(nextUserId) : null;
        const scopedPatch = nextStored ? storedStatePatch(nextStored) : {};
        const cleared = userChanged ? clearUserScopedState() : {};
        const nextNotifications = userChanged ? [] : state.notifications;
        const nextAdminRole = userChanged ? null : state.adminRole;

        // Sync pending guest likes/bookmarks khi đăng nhập lần đầu
        if (wasGuest && nextUserId) {
          const pendingLikes = getGuestPendingLikes();
          const pendingBookmarks = getGuestPendingBookmarks();
          if (pendingLikes.length > 0 || pendingBookmarks.length > 0) {
            // Chạy async sync sau khi state đã cập nhật
            void Promise.allSettled([
              ...pendingLikes
                .filter((l) => l.reaction !== null)
                .map((l) => togglePostReaction(nextUserId, l.postId, l.reaction!)),
              ...pendingBookmarks
                .filter((b) => b.bookmarked)
                .map((b) => toggleCommunityBookmark(nextUserId, b.postId)),
            ]).then(() => clearGuestPending());
          }
        }

        return {
          ...cleared,
          ...scopedPatch,
          session: nextSession,
          ...derive({
            session: nextSession,
            adminRole: nextAdminRole,
            notifications: nextNotifications,
            shifts: nextStored ? nextStored.shifts : state.shifts,
          }),
        };
      });
    },
    setAdminRole: (role) => set((state) => ({
      adminRole: role,
      ...derive({ session: state.session, adminRole: role, notifications: state.notifications }),
    })),
    setAuthEmail: (e) => set({ authEmail: e }),
    setAuthMessage: (m) => set({ authMessage: m }),
    setSendingAuth: (v) => set({ sendingAuth: v }),
    setSavingProfile: (v) => set({ savingProfile: v }),

    // Shifts
    setShifts: (shifts) => {
      set((state) => ({
        shifts,
        ...derive({ shifts, calendarMonth: state.calendarMonth }),
      }));
      get().persist();
    },
    addShift: (shift, nextTab = 'calendar') => {
      set((state) => {
        const nextShifts = [shift, ...state.shifts];
        const next = derive({ shifts: nextShifts, calendarMonth: startOfMonth(shift.date) });
        return {
          shifts: nextShifts,
          selectedDate: shift.date,
          calendarMonth: startOfMonth(shift.date),
          isDaySheetOpen: false,
          tab: nextTab,
          ...next,
        };
      });
      get().persist();
    },
    updateShift: (nextShift) => {
      set((state) => {
        const nextShifts = state.shifts.map((s) => (s.id === nextShift.id ? nextShift : s));
        return { shifts: nextShifts, ...derive({ shifts: nextShifts, calendarMonth: state.calendarMonth }) };
      });
      get().persist();
    },
    deleteShift: (id) => {
      set((state) => {
        const nextShifts = state.shifts.filter((s) => s.id !== id);
        return {
          shifts: nextShifts,
          editingShiftId: state.editingShiftId === id ? null : state.editingShiftId,
          isDaySheetOpen: state.editingShiftId === id ? false : state.isDaySheetOpen,
          ...derive({ shifts: nextShifts, calendarMonth: state.calendarMonth }),
        };
      });
      get().persist();
    },

    // Profile
    setProfile: (p) => {
      set((s) => ({ profile: typeof p === 'function' ? p(s.profile) : p }));
      get().persist();
    },

    // Expenses
    setExpenses: (expenses) => {
      set({ expenses });
      get().persist();
    },
    addExpenseLocally: (expense) => {
      set((s) => ({ expenses: [...s.expenses, expense] }));
      get().persist();
    },
    removeExpenseLocally: (id) => {
      set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
      get().persist();
    },

    // Friends
    setCompanions: (c) => set((s) => ({ companions: typeof c === 'function' ? c(s.companions) : c })),
    setFriendships: (f) => set((s) => ({ friendships: typeof f === 'function' ? f(s.friendships) : f })),
    setRequested: (r) => set((s) => ({ requested: typeof r === 'function' ? r(s.requested) : r })),
    addRequested: (id) => set((s) => ({ requested: [...new Set([...s.requested, id])] })),

    // Rate
    setRate: (r) => set((s) => ({ rate: typeof r === 'function' ? r(s.rate) : r })),

    setVenueColors: (c) => set({ venueColors: c }),
    setVenueColor: (venue, color) => {
      set((s) => ({ venueColors: { ...s.venueColors, [venue]: color } }));
      get().persist();
    },

    // Income target
    setIncomeTarget: (n) => {
      set({ incomeTarget: n });
      get().persist();
    },

    addPersonalGoal: (goal) => {
      set((s) => ({
        personalGoals: [
          {
            ...goal,
            id: `goal-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            createdAt: new Date().toISOString(),
          },
          ...s.personalGoals,
        ],
      }));
      get().persist();
    },
    updatePersonalGoal: (id, patch) => {
      set((s) => ({
        personalGoals: s.personalGoals.map((goal) => (
          goal.id === id ? { ...goal, ...patch } : goal
        )),
      }));
      get().persist();
    },
    removePersonalGoal: (id) => {
      set((s) => ({ personalGoals: s.personalGoals.filter((goal) => goal.id !== id) }));
      get().persist();
    },
    togglePersonalGoalDone: (id) => {
      set((s) => ({
        personalGoals: s.personalGoals.map((goal) => (
          goal.id === id
            ? { ...goal, completedAt: goal.completedAt ? null : new Date().toISOString() }
            : goal
        )),
      }));
      get().persist();
    },

    // UI
    setDraft: (d) => set((s) => ({ draft: typeof d === 'function' ? d(s.draft) : d })),
    setEditingShiftId: (id) => set({ editingShiftId: id }),
    setCalendarMonth: (m) => set((s) => ({ calendarMonth: m, ...derive({ calendarMonth: m, shifts: s.shifts }) })),
    setSelectedDate: (d) => set({ selectedDate: d }),
    setIsDaySheetOpen: (v) => set({ isDaySheetOpen: v }),
    setOnline: (v) => set({ online: v }),
    setIsDarkMode: (v) => {
      window.localStorage.setItem('duhoc-mate-dark', v.toString());
      document.documentElement.classList.toggle('dark', v);
      set({ isDarkMode: v });
    },
    setWallpaper: (w) => {
      window.localStorage.setItem('duhoc-mate-wallpaper', w);
      set({ wallpaper: w });
    },
    setLang: (l) => {
      window.localStorage.setItem('duhoc-mate-lang', l);
      set({ lang: l });
    },
    setCurrencyMode: (m) => {
      set({ currencyMode: m });
      get().persist();
    },

    // Notifications
    setNotifications: (n) => set((s) => {
      const next = typeof n === 'function' ? n(s.notifications) : n;
      const withLocalReads = applyLocalNotificationReads(next, s.session?.user.id);
      return { notifications: withLocalReads, ...derive({ notifications: withLocalReads }) };
    }),
    setShowNotifications: (v) => set({ showNotifications: v }),
    setToastNotification: (n) => set({ toastNotification: n }),
    handleOpenNotifications: () => {
      get().markAllAsRead();
      set({ showNotifications: true });
    },
    markAllAsRead: () => {
      rememberNotificationsSeen(get().session?.user.id);
      set((s) => {
        const next = s.notifications.map((n) => ({ ...n, is_read: true }));
        return { notifications: next, ...derive({ notifications: next }) };
      });
    },

    // Badges / rankings
    setEarnedBadges: (b) => set((s) => ({ earnedBadges: typeof b === 'function' ? b(s.earnedBadges) : b })),
    setIsAnonymousRank: (v) => set({ isAnonymousRank: v }),
    setRankings: (r) => set({ rankings: r }),
    setUserStats: (s) => set({ userStats: s }),

    recalc: () => set((s) => derive({ shifts: s.shifts, calendarMonth: s.calendarMonth, notifications: s.notifications, session: s.session, adminRole: s.adminRole })),
  };
});
