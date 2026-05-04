import { useCallback, useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, House, MessageCircleMore, UserRound, WalletCards, Cloud, CloudOff, Bell, ThumbsUp, MessageCircle, X, Flame, ShieldCheck } from 'lucide-react';
import { regions } from './data';
import { DEFAULT_KRW_TO_VND, MINIMUM_WAGE_2026, calculateShiftPay, shiftHours, Shift } from './lib/salary';
import { hasSupabaseConfig, supabase } from './lib/supabase';
import { Tab, StoredState, ShiftDraft, VenueColors, Expense, ProfileDraft, CompanionProfile } from './lib/types';
import { startOfMonth, shiftMonth, formatMonthHeader } from './utils/helpers';
import { HomeScreen } from './components/HomeScreen';
import { CalendarScreen } from './components/CalendarScreen';
import { IncomeScreen } from './components/IncomeScreen';
import { CommunityScreen } from './components/CommunityScreen';
import { AdminScreen } from './components/AdminScreen';
import { ProfileScreen, WALLPAPERS, type WallpaperKey, type AppLang } from './components/ProfileScreen';
import { type CommunityNotification, timeAgo } from './data/communityData';
import { BADGES } from './data/badgeData';


const STORAGE_KEY = 'duhoc-mate-redesign-state';
const getLocalDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todayIso = getLocalDateString();
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const ADMIN_EMAILS = new Set(['michintashop@gmail.com']);

type FriendshipRow = {
  id?: string;
  requester_id: string;
  target_profile_id: string;
  status: string;
  created_at?: string;
  updated_at?: string;
};

function optionalNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function isRecentlyOnline(lastSeenAt?: string | null) {
  if (!lastSeenAt) return false;
  const timestamp = new Date(lastSeenAt).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= ONLINE_WINDOW_MS;
}

function profilePatchFromRow(row: any): Partial<ProfileDraft> {
  return {
    displayName: row.display_name || '',
    school: row.school || '',
    region: row.region || '',
    note: row.note || '',
    avatarUrl: row.avatar_url || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    latitude: optionalNumber(row.latitude),
    longitude: optionalNumber(row.longitude),
    locationUpdatedAt: row.location_updated_at || null,
    lastSeenAt: row.last_seen_at || null,
  };
}

function companionFromRow(row: any): CompanionProfile {
  const lastSeenAt = row.last_seen_at || null;
  return {
    id: row.id,
    displayName: row.display_name || 'Người dùng ẩn danh',
    school: row.school || 'Chưa cập nhật',
    region: row.region || 'Chưa cập nhật',
    focus: row.note || '',
    availability: isRecentlyOnline(lastSeenAt)
      ? 'Đang online'
      : lastSeenAt
        ? `Hoạt động ${timeAgo(lastSeenAt)}`
        : 'Chưa cập nhật online',
    tags: Array.isArray(row.tags) ? row.tags : [],
    latitude: optionalNumber(row.latitude),
    longitude: optionalNumber(row.longitude),
    locationUpdatedAt: row.location_updated_at || null,
    lastSeenAt,
    isOnline: isRecentlyOnline(lastSeenAt),
  };
}

function getPendingOutgoingIds(rows: FriendshipRow[], userId: string) {
  return rows
    .filter((friendship) => friendship.requester_id === userId && friendship.status === 'pending')
    .map((friendship) => friendship.target_profile_id);
}

function isFriendshipForUser(row: FriendshipRow | null | undefined, userId: string) {
  return Boolean(row && (row.requester_id === userId || row.target_profile_id === userId));
}

const tabLabels: Record<AppLang, Record<Tab, string>> = {
  vi: { home: 'Trang chủ', calendar: 'Lịch', income: 'Thu nhập', friends: 'Cộng đồng', profile: 'Hồ sơ', admin: 'Quản trị' },
  ko: { home: '홈', calendar: '캘린더', income: '수입', friends: '커뮤니티', profile: '프로필', admin: '관리자' },
};

const tabIcons: Array<{ id: Exclude<Tab, 'admin'>; icon: typeof House }> = [
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
    shifts: [],
    profile: { displayName: '', school: '', region: '', note: '', tags: [] },
    companions: [],
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
      shifts: Array.isArray(parsed.shifts) ? parsed.shifts : [],
      profile: parsed.profile ? { ...fallbackState().profile, ...parsed.profile } : fallbackState().profile,
      companions: Array.isArray(parsed.companions) ? parsed.companions : [],
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

const VALID_TABS: Tab[] = ['home', 'calendar', 'income', 'friends', 'profile', 'admin'];

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
  const [companions, setCompanions] = useState<CompanionProfile[]>(initial.companions);
  const [requested, setRequested] = useState(initial.requested);
  const [friendships, setFriendships] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [toastNotification, setToastNotification] = useState<CommunityNotification | null>(null);

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  const [rate, setRate] = useState(initial.rate);
  const [venueColors, setVenueColors] = useState<VenueColors>(initial.venueColors);
  const [incomeTarget, setIncomeTarget] = useState(initial.incomeTarget ?? 2000000);
  const [expenses, setExpenses] = useState(initial.expenses ?? []);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [isAnonymousRank, setIsAnonymousRank] = useState(false);
  const [rankings, setRankings] = useState<any[]>([]);
  const [userStats, setUserStats] = useState({ postsCount: 0, commentsCount: 0, likesCount: 0 });
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const isAdmin = useMemo(() => {
    const email = (session?.user.email || '').toLowerCase();
    return ADMIN_EMAILS.has(email) || Boolean(adminRole);
  }, [adminRole, session]);

  const refreshRankings = useCallback(async () => {
    if (!supabase) return;
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    
    // 1. Get Top 3
    const { data: top3Data, error: top3Error } = await supabase
      .from('monthly_rankings')
      .select('*')
      .eq('month_key', currentMonthKey)
      .order('total_income', { ascending: false })
      .limit(3);

    if (top3Error) {
      console.error('Error fetching top 3:', top3Error);
      return;
    }

    let finalRankings = (top3Data || []).map((r, i) => ({ ...r, rank: i + 1 }));

    // 2. If user is logged in, check if they are in top 3
    if (session) {
      const myId = session.user.id;
      const isInTop3 = finalRankings.some(r => r.user_id === myId);

      if (!isInTop3) {
        // 3. Get user's own ranking info
        const { data: userData, error: userError } = await supabase
          .from('monthly_rankings')
          .select('*')
          .eq('month_key', currentMonthKey)
          .eq('user_id', myId)
          .maybeSingle();

        if (userData) {
          // 4. Calculate actual rank
          const { count, error: countError } = await supabase
            .from('monthly_rankings')
            .select('*', { count: 'exact', head: true })
            .eq('month_key', currentMonthKey)
            .gt('total_income', userData.total_income);
          
          if (!countError) {
            finalRankings = [...finalRankings, { ...userData, rank: (count || 0) + 1 }];
          }
        }
      }
    }

    // 5. Fetch anonymity status for these users
    const userIds = finalRankings.map(r => r.user_id);
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, is_anonymous_rank')
        .in('id', userIds);
        
      const profileMap = (profilesData || []).reduce((acc: any, p: any) => {
        acc[p.id] = p.is_anonymous_rank;
        return acc;
      }, {});

      const flattened = finalRankings.map((item: any) => ({
        ...item,
        is_anonymous_rank: profileMap[item.user_id] ?? item.is_anonymous_rank
      }));
      
      setRankings(flattened);
    } else {
      setRankings([]);
    }
  }, [session]);



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

  // Fetch notifications and subscribe to realtime
  useEffect(() => {
    if (!session || !supabase) return;
    const userId = session.user.id;

    // Fetch initial notifications
    const fetchNotifications = async () => {
      const { data, error } = await supabase!.from('community_notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      if (data) {
        setNotifications(data.map(row => ({
          ...row,
          is_read: row.is_read === true, // Explicit boolean check
          type: (row.type ?? 'system') as CommunityNotification['type']
        } as CommunityNotification)));
      }
    };

    void fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase!.channel('public:community_notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'community_notifications'
      }, (payload) => {
        console.log('Realtime payload received:', payload);
        
        // Filter manually here
        if (payload.new.recipient_id !== userId) return;

        const newNotif = {
          ...payload.new,
          is_read: false,
          type: (payload.new.type ?? 'system') as CommunityNotification['type']
        } as CommunityNotification;
        
        setNotifications(prev => [newNotif, ...prev]);
        
        // Show push toast
        setToastNotification(newNotif);
        setTimeout(() => {
          setToastNotification(null);
        }, 5000);
      })
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      void supabase!.removeChannel(channel);
    };
  }, [session]);

  const markAllAsRead = async () => {
    if (!session || !supabase || unreadCount === 0) return;
    
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    
    await supabase!.from('community_notifications')
      .update({ is_read: true })
      .eq('recipient_id', session.user.id)
      .eq('is_read', false);
  };

  const handleOpenNotifications = () => {
    setShowNotifications(true);
    void markAllAsRead();
  };

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
      void refreshRankings();
    }
  }

  async function deleteExpense(id: string) {
    setExpenses((current) => current.filter((e) => e.id !== id));
    if (supabase && session) {
      await supabase!.from('expenses').delete().eq('id', id);
      void refreshRankings();
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
    
    // Initial session check
    client.auth.getSession().then(({ data }) => setSession(data.session));

    // Listen for changes
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setAdminRole(null);
      return;
    }

    let isMounted = true;
    supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (isMounted) setAdminRole(data?.role || null);
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  useEffect(() => {
    if (!supabase || !session) return;
    const client = supabase;
    
    // Fetch profile extras (badges and anonymity)
    client.from('profiles').select('is_anonymous_rank').eq('id', session.user.id).single()
      .then(({ data }) => {
        if (data) setIsAnonymousRank(!!data.is_anonymous_rank);
      });

    client.from('user_badges').select('badge_id').eq('user_id', session.user.id)
      .then(({ data }) => {
        if (data) setEarnedBadges(data.map(b => b.badge_id));
      });

    client.from('expenses').select('*').eq('user_id', session.user.id).order('date', { ascending: false })
      .then(({ data }) => {
        if (data) setExpenses(data);
      });

    // Fetch community stats for badges
    const fetchUserStats = async () => {
      const userId = session.user.id;
      
      const { count: pCount } = await client.from('community_posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
        
      const { count: cCount } = await client.from('community_comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
        
      const { data: likesData } = await client.from('community_posts')
        .select('likes_count')
        .eq('user_id', userId);
        
      const lCount = likesData?.reduce((acc, curr) => acc + Number(curr.likes_count || 0), 0) || 0;
      
      setUserStats({
        postsCount: pCount || 0,
        commentsCount: cCount || 0,
        likesCount: lCount
      });
    };
    
    void fetchUserStats();
  }, [session]);

  // Fetch monthly rankings - Publicly available
  useEffect(() => {
    void refreshRankings();
  }, [refreshRankings]);


  // Logic to check and award badges
  useEffect(() => {
    if (!session || !supabase) return;
    
    const checkAndAwardBadges = async () => {
      const stats = {
        shifts,
        expenses,
        posts: [], // Legacy
        comments: { length: userStats.commentsCount }, // Map for requirement function
        companionsCount: companions.length,
        likesCount: userStats.likesCount
      };

      const newBadges: string[] = [];
      for (const badge of BADGES) {
        if (earnedBadges.includes(badge.id)) continue;
        
        if (badge.requirement(stats as any)) {
          newBadges.push(badge.id);
        }
      }

      if (newBadges.length > 0) {
        setEarnedBadges(prev => [...prev, ...newBadges]);
        
        // Save to DB
        for (const bid of newBadges) {
          await supabase!.from('user_badges').insert({
            user_id: session.user.id,
            badge_id: bid
          });
        }
      }
    };

    void checkAndAwardBadges();
  }, [shifts, expenses, companions, session, earnedBadges]);


  useEffect(() => {
    if (!supabase || !session) return;
    const client = supabase;
    let isMounted = true;
    Promise.all([
      client.from('shift_entries').select('*').eq('user_id', session.user.id),
      client.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      client.from('expenses').select('*').eq('user_id', session.user.id),
      client.from('profiles').select('*').neq('id', session.user.id),
      client.from('friend_requests').select('*').or(`requester_id.eq.${session.user.id},target_profile_id.eq.${session.user.id}`)
    ]).then(([shiftsRes, profileRes, expensesRes, companionsRes, friendsRes]) => {
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
        setProfile((current) => ({ ...current, ...profilePatchFromRow(profileRes.data) }));
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
      if (companionsRes.data) {
        setCompanions(companionsRes.data.map(companionFromRow));
      }
      if (friendsRes.data) {
        const rows = friendsRes.data as FriendshipRow[];
        setFriendships(rows);
        setRequested(getPendingOutgoingIds(rows, session.user.id));
      }
    });
    return () => { isMounted = false; };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    setRequested(getPendingOutgoingIds(friendships as FriendshipRow[], session.user.id));
  }, [friendships, session]);

  useEffect(() => {
    if (!supabase || !session) return;
    const client = supabase;
    const userId = session.user.id;
    let cancelled = false;

    const touchPresence = async (coords?: GeolocationCoordinates) => {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {
        id: userId,
        last_seen_at: now,
      };

      if (coords) {
        patch.latitude = coords.latitude;
        patch.longitude = coords.longitude;
        patch.location_updated_at = now;
      }

      const { error } = await client.from('profiles').upsert(patch);
      if (error) {
        console.warn('Unable to update presence/location:', error);
        return;
      }

      if (!cancelled) {
        setProfile((current) => ({
          ...current,
          ...(coords
            ? {
                latitude: coords.latitude,
                longitude: coords.longitude,
                locationUpdatedAt: now,
              }
            : {}),
          lastSeenAt: now,
        }));
      }
    };

    const updateWithLocation = () => {
      if (!navigator.geolocation) {
        void touchPresence();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => void touchPresence(position.coords),
        () => void touchPresence(),
        { enableHighAccuracy: true, maximumAge: 120000, timeout: 8000 }
      );
    };

    updateWithLocation();
    const intervalId = window.setInterval(() => void touchPresence(), 60000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') updateWithLocation();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [session]);

  useEffect(() => {
    if (!supabase || !session) return;
    const client = supabase;
    const userId = session.user.id;

    const profilesChannel = client
      .channel(`profiles-community-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        const row = ((payload as any).new ?? (payload as any).old) as any;
        if (!row?.id) return;

        if (row.id === userId) {
          if ((payload as any).eventType !== 'DELETE') {
            setProfile((current) => ({ ...current, ...profilePatchFromRow(row) }));
          }
          return;
        }

        if ((payload as any).eventType === 'DELETE') {
          setCompanions((current) => current.filter((companion) => companion.id !== row.id));
          return;
        }

        const nextCompanion = companionFromRow(row);
        setCompanions((current) => {
          const exists = current.some((companion) => companion.id === nextCompanion.id);
          return exists
            ? current.map((companion) => (companion.id === nextCompanion.id ? { ...companion, ...nextCompanion } : companion))
            : [nextCompanion, ...current];
        });
      })
      .subscribe();

    const friendshipsChannel = client
      .channel(`friend-requests-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, (payload) => {
        const row = (((payload as any).new ?? (payload as any).old) || null) as FriendshipRow | null;
        if (!row || !isFriendshipForUser(row, userId)) return;

        if ((payload as any).eventType === 'DELETE') {
          setFriendships((current) => current.filter((friendship) => friendship.id !== row.id));
          return;
        }

        setFriendships((current) => {
          const exists = current.some((friendship) => friendship.id === row.id);
          return exists
            ? current.map((friendship) => (friendship.id === row.id ? row : friendship))
            : [row, ...current];
        });
      })
      .subscribe();

    return () => {
      void client.removeChannel(profilesChannel);
      void client.removeChannel(friendshipsChannel);
    };
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
        avatar_url: toSave.avatarUrl,
        tags: toSave.tags
      });
      if (error) console.error('Lỗi lưu hồ sơ:', error);
    }
    setSavingProfile(false);
  }

  const handleToggleAnonymous = async (val: boolean) => {
    if (!session || !supabase) return;
    setIsAnonymousRank(val);
    await supabase.from('profiles').update({ is_anonymous_rank: val }).eq('id', session.user.id);
  };


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
      void refreshRankings();
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
      void refreshRankings();
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
      void refreshRankings();
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
    if (!supabase || !session) return;
    const client = supabase;
    const userId = session.user.id;
    const actorName = profile.displayName?.trim() || session.user.email?.split('@')[0] || 'Một người bạn';
    const localExisting = (friendships as FriendshipRow[]).find((friendship) =>
      (friendship.requester_id === userId && friendship.target_profile_id === id) ||
      (friendship.requester_id === id && friendship.target_profile_id === userId)
    );

    const mergeFriendship = (row: FriendshipRow) => {
      setFriendships((current) => {
        const exists = current.some((friendship) => friendship.id === row.id);
        return exists
          ? current.map((friendship) => (friendship.id === row.id ? row : friendship))
          : [row, ...current];
      });
    };

    const notify = async (recipientId: string, type: string, title: string, body: string) => {
      const { error } = await client.from('community_notifications').insert({
        recipient_id: recipientId,
        actor_id: userId,
        type,
        title,
        body,
      });
      if (error) console.warn('Unable to send social notification:', error);
    };

    const acceptFriendship = async (existing: FriendshipRow) => {
      const acceptedFriendship: FriendshipRow = {
        ...existing,
        status: 'accepted',
        updated_at: new Date().toISOString(),
      };
      mergeFriendship(acceptedFriendship);
      setRequested((current) => current.filter((requestId) => requestId !== id));

      let acceptedRow: FriendshipRow | null = null;
      const { data: rpcData, error: rpcError } = await client.rpc('accept_friend_request', { other_user_id: id });

      if (!rpcError) {
        acceptedRow = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as FriendshipRow | null;
      } else {
        console.warn('accept_friend_request RPC unavailable, falling back to direct update:', rpcError);
      }

      if (!acceptedRow) {
        if (!existing.id) {
          mergeFriendship(existing);
          throw new Error('Missing friend request id');
        }

        const { data, error } = await client
          .from('friend_requests')
          .update({ status: 'accepted', updated_at: acceptedFriendship.updated_at })
          .eq('id', existing.id)
          .select()
          .maybeSingle();

        if (error || !data) {
          if (error) console.error('Unable to accept friend request:', error);
          mergeFriendship(existing);
          throw error ?? new Error('Friend request not found');
        }

        acceptedRow = data as FriendshipRow;
      }

      mergeFriendship(acceptedRow);
      await notify(id, 'friend_accept', 'Đã trở thành bạn bè', `${actorName} đã chấp nhận lời mời kết bạn.`);
    };

    if (localExisting?.requester_id === id && localExisting.target_profile_id === userId && localExisting.status === 'pending') {
      await acceptFriendship(localExisting);
      return;
    }

    const { data: existingFromDb, error: existingError } = await client
      .from('friend_requests')
      .select('*')
      .or(`and(requester_id.eq.${userId},target_profile_id.eq.${id}),and(requester_id.eq.${id},target_profile_id.eq.${userId})`)
      .limit(1)
      .maybeSingle();
    const existing = (existingFromDb as FriendshipRow | null) ?? localExisting;

    if (existingError && !existing) {
      console.error('Unable to read friend request:', existingError);
      throw existingError;
    }

    if (existing?.status === 'accepted') {
      mergeFriendship(existing as FriendshipRow);
      return;
    }

    if (existing && existing.requester_id === id && existing.target_profile_id === userId) {
      await acceptFriendship(existing);
      return;
    }

    setRequested((current) => [...new Set([...current, id])]);

    if (existing && existing.requester_id === userId) {
      if (existing.status === 'pending') return;
      const { data, error } = await client
        .from('friend_requests')
        .update({ status: 'pending' })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      if (data) mergeFriendship(data as FriendshipRow);
      return;
    }

    const { data: newReq, error } = await client.from('friend_requests').insert({
      requester_id: userId,
      target_profile_id: id,
      status: 'pending',
    }).select().single();

    if (!error && newReq) {
      mergeFriendship(newReq as FriendshipRow);
      await notify(id, 'friend_request', 'Lời mời kết bạn mới', `${actorName} muốn kết bạn với bạn.`);
    } else if (error) {
      console.error('Unable to create friend request:', error);
      setRequested((current) => current.filter((requestId) => requestId !== id));
      throw error;
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
              onNextMonth={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}
              onOpenNotifications={handleOpenNotifications}
              unreadCount={unreadCount}
              profile={profile}
              lang={lang}
              isAnonymousRank={isAnonymousRank}
              onToggleAnonymous={handleToggleAnonymous}
              rankings={rankings}
              myId={session?.user.id || ''}
            />



          ) : null}
          {tab === 'calendar' ? <CalendarScreen shifts={shifts} selectedDate={selectedDate} month={calendarMonth} venueSuggestions={[...new Set(workplaceSummary.map((item) => item.label))].slice(0, 4)} draft={draft} setDraft={setDraft} editingShiftId={editingShiftId} setEditingShiftId={setEditingShiftId} isSheetOpen={isDaySheetOpen} onCloseSheet={() => setIsDaySheetOpen(false)} onPrevMonth={() => { const nextMonth = shiftMonth(calendarMonth, -1); setCalendarMonth(nextMonth); setSelectedDate(nextMonth); setDraft((current) => ({ ...current, date: nextMonth })); }} onNextMonth={() => { const nextMonth = shiftMonth(calendarMonth, 1); setCalendarMonth(nextMonth); setSelectedDate(nextMonth); setDraft((current) => ({ ...current, date: nextMonth })); }} onSetMonth={(nextMonth) => { setCalendarMonth(nextMonth); setSelectedDate(nextMonth); setDraft((current) => ({ ...current, date: nextMonth })); }} onSelectDate={(date) => { setEditingShiftId(null); setSelectedDate(date); setDraft((current) => ({ ...current, date, note: '' })); setIsDaySheetOpen(true); }} onQuickSave={() => void addShift('calendar')} onUpdateShift={(shift) => void updateShift(shift)} onDeleteShift={(id) => void deleteShift(id)} venueColors={venueColors} onSetVenueColor={setVenueColor} lang={lang} /> : null}
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
              lang={lang}
            />
          ) : null}
          {tab === 'friends' ? (
            <CommunityScreen
              profile={profile}
              companions={companions}
              requested={requested}
              friendships={friendships}
              onRequest={requestConnection}
              session={session}
              onOpenNotifications={handleOpenNotifications}
              unreadCount={unreadCount}
              onNavigateToProfile={() => setTab('profile')}
              lang={lang}
            />
          ) : null}
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
              earnedBadges={earnedBadges}
              isAdmin={isAdmin}
              onOpenAdmin={() => changeTab('admin')}
            />
          ) : null}
          {tab === 'admin' ? (
            <AdminScreen
              session={session}
              isAdmin={isAdmin}
              lang={lang}
              onBack={() => changeTab('profile')}
            />
          ) : null}

        </main>

        <nav className="bottom-tabs" aria-label={lang === 'ko' ? '주요 내비게이션' : 'Điều hướng chính'}>
          {tabIcons.map(({ id, icon: Icon }) => (
            <button key={id} type="button" onClick={() => changeTab(id)} className={tab === id ? 'tab-item active' : 'tab-item'}>
              <span className="tab-icon-wrap">
                <Icon size={20} />
              </span>
              <span>{tabLabels[lang][id]}</span>
            </button>
          ))}
        </nav>

        {/* Push Toast Notification */}
        <AnimatePresence>
          {toastNotification && (
            <motion.div
              className="cm-push-toast"
              initial={{ opacity: 0, y: -50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              onClick={handleOpenNotifications}
            >
              <div className={`cm-notif-icon-circle ${toastNotification.type}`}>
                {toastNotification.type === 'like' ? <ThumbsUp size={14} /> : <MessageCircle size={14} />}
              </div>
              <div className="cm-push-toast-content">
                <strong>{toastNotification.title}</strong>
                <p>{toastNotification.body}</p>
              </div>
              <button className="cm-push-toast-close" onClick={(e) => {
                e.stopPropagation();
                setToastNotification(null);
              }}>
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Notification Popover */}
        <AnimatePresence>
          {showNotifications && (
            <>
              <motion.div 
                className="cm-notif-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowNotifications(false)}
              />
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
                {notifications.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                    <Bell size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <p>Bạn chưa có thông báo nào</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={`global-act-${n.id}`} className={`cm-notif-item ${!n.is_read ? 'unread' : ''}`} style={{ cursor: 'pointer' }}>
                      <div className={`cm-notif-icon-circle ${n.type}`}>
                        {n.type === 'like' ? <ThumbsUp size={12} /> : <MessageCircle size={12} />}
                      </div>
                      <div className="cm-notif-item-content">
                        <p>{n.body}</p>
                        <span className="cm-notif-time">{timeAgo(n.created_at)}</span>
                      </div>
                      {!n.is_read && <div className="cm-notif-unread-dot" style={{ width: '8px', height: '8px', background: '#2752ff', borderRadius: '50%', flexShrink: 0 }} />}
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
