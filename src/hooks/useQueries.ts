import { useQuery, useMutation, useQueryClient, useIsFetching } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { Shift, Expense, ProfileDraft, CompanionProfile } from '../lib/types';
import { useEffect } from 'react';
import type { CommunityNotification } from '../data/communityData';
import { BADGES } from '../data/badgeData';
import { calculateShiftPay } from '../lib/salary';

/* ── query key factories ── */
export const queryKeys = {
  shifts: (userId: string) => ['shifts', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  companions: (userId: string) => ['companions', userId] as const,
  expenses: (userId: string) => ['expenses', userId] as const,
  friendships: (userId: string) => ['friendships', userId] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  rankings: (monthKey: string) => ['rankings', monthKey] as const,
  badges: (userId: string) => ['badges', userId] as const,
};

/* ── helpers ── */
function rowToShift(row: any): Shift {
  return {
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
    holidayAllowance: row.holiday_allowance,
  };
}

function getLocalDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getLocalMonthRange() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    monthKey,
    startDate: `${monthKey}-01`,
    todayDate: getLocalDateString(now),
  };
}

function shiftToRow(shift: Shift, userId: string) {
  return {
    id: shift.id,
    user_id: userId,
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
  };
}

/* ── Shifts ── */
export function useShiftsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.shifts(userId!),
    queryFn: async () => {
      const { data } = await supabase!
        .from('shift_entries')
        .select('*')
        .eq('user_id', userId!)
        .order('work_date', { ascending: false });
      return (data || []).map(rowToShift);
    },
    enabled: !!supabase && !!userId,
    staleTime: 30_000,
  });
}

export function useUpsertShift() {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (shift: Shift) => {
      if (!supabase || !userId) throw new Error('No session');
      await supabase.from('shift_entries').upsert(shiftToRow(shift, userId));
      return shift;
    },
    onSuccess: (_, shift) => {
      qc.invalidateQueries({ queryKey: queryKeys.shifts(userId!) });
      // Update local store immediately
      const store = useAppStore.getState();
      store.addShift(shift);
    },
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase || !userId) throw new Error('No session');
      await supabase.from('shift_entries').delete().eq('id', id);
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: queryKeys.shifts(userId!) });
      useAppStore.getState().deleteShift(id);
    },
  });
}

/* ── Expenses ── */
export function useExpensesQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.expenses(userId!),
    queryFn: async () => {
      const { data } = await supabase!
        .from('expenses')
        .select('*')
        .eq('user_id', userId!);
      return (data || []).map((row: any): Expense => ({
        id: row.id,
        category: row.category,
        amount: row.amount,
        date: row.date,
        note: row.note || '',
      }));
    },
    enabled: !!supabase && !!userId,
    staleTime: 30_000,
  });
}

export function useAddExpense() {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (expense: Omit<Expense, 'id'>) => {
      if (!supabase || !userId) throw new Error('No session');
      const id = crypto.randomUUID();
      await supabase.from('expenses').insert({ ...expense, id, user_id: userId });
      return { ...expense, id } as Expense;
    },
    onSuccess: (expense) => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses(userId!) });
      useAppStore.getState().addExpenseLocally(expense);
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase || !userId) throw new Error('No session');
      await supabase.from('expenses').delete().eq('id', id);
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses(userId!) });
      useAppStore.getState().removeExpenseLocally(id);
    },
  });
}

/* ── Profile ── */
export function useProfileQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profile(userId!),
    queryFn: async () => {
      const { data } = await supabase!
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .maybeSingle();
      return data ? {
        displayName: data.display_name || '',
        school: data.school || '',
        region: data.region || '',
        note: data.note || '',
        avatarUrl: data.avatar_url || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        isAnonymousRank: !!data.is_anonymous_rank,
      } : null;
    },
    enabled: !!supabase && !!userId,
    staleTime: 60_000,
  });
}

export function useUpsertProfile() {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      if (!supabase || !userId) throw new Error('No session');
      await supabase.from('profiles').upsert({ id: userId, ...patch });
      return patch;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.profile(userId!) }),
  });
}

/* ── Companions ── */
export function useCompanionsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.companions(userId!),
    queryFn: async () => {
      const { data } = await supabase!
        .from('profiles')
        .select('*')
        .neq('id', userId!);
      return (data || []).map((row: any): CompanionProfile => ({
        id: row.id,
        displayName: row.display_name || 'Người dùng ẩn danh',
        school: row.school || 'Chưa cập nhật',
        region: row.region || 'Chưa cập nhật',
        focus: row.note || '',
        availability: 'Đang hoạt động',
        tags: Array.isArray(row.tags) ? row.tags : [],
        latitude: row.latitude ? Number(row.latitude) : null,
        longitude: row.longitude ? Number(row.longitude) : null,
        lastSeenAt: row.last_seen_at || null,
      }));
    },
    enabled: !!supabase && !!userId,
    staleTime: 60_000,
  });
}

/* ── Friendships ── */
export function useFriendshipsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.friendships(userId!),
    queryFn: async () => {
      const { data } = await supabase!
        .from('friend_requests')
        .select('*')
        .or(`requester_id.eq.${userId!},target_profile_id.eq.${userId!}`);
      return data || [];
    },
    enabled: !!supabase && !!userId,
    staleTime: 15_000,
  });
}

/* ── Notifications ── */
export function useNotificationsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notifications(userId!),
    queryFn: async () => {
      const { data } = await supabase!
        .from('community_notifications')
        .select('*')
        .eq('recipient_id', userId!)
        .order('created_at', { ascending: false })
        .limit(20);
      return (data || []).map((row: any): CommunityNotification => ({
        ...row,
        is_read: row.is_read === true,
        type: row.type ?? 'system',
      }));
    },
    enabled: !!supabase && !!userId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

/* ── Rankings ── */
export function useRankingsQuery(userId: string | undefined) {
  const range = getLocalMonthRange();
  return useQuery({
    queryKey: queryKeys.rankings(`${range.monthKey}:${range.todayDate}`),
    queryFn: async () => {
      const { monthKey, startDate, todayDate } = getLocalMonthRange();
      const { data: shiftRows, error: shiftError } = await supabase!
        .from('shift_entries')
        .select('*')
        .gte('work_date', startDate)
        .lte('work_date', todayDate);

      if (!shiftError && shiftRows) {
        const totals = new Map<string, number>();

        shiftRows.forEach((row: any) => {
          if (!row.user_id) return;
          const shift = rowToShift(row);
          const income = Math.max(0, Number(calculateShiftPay(shift).total) || 0);
          totals.set(row.user_id, (totals.get(row.user_id) || 0) + income);
        });

        const sorted = [...totals.entries()]
          .map(([rowUserId, totalIncome]) => ({ user_id: rowUserId, total_income: Math.max(0, Math.round(totalIncome)) }))
          .filter((item) => item.total_income > 0)
          .sort((a, b) => b.total_income - a.total_income);

        const uids = sorted.map((item) => item.user_id);
        let profileMap: Record<string, { display_name?: string; is_anonymous_rank?: boolean }> = {};
        if (uids.length > 0) {
          const { data: profiles } = await supabase!
            .from('profiles')
            .select('id, display_name, is_anonymous_rank')
            .in('id', uids);
          profileMap = (profiles || []).reduce((acc: Record<string, { display_name?: string; is_anonymous_rank?: boolean }>, p: any) => {
            acc[p.id] = { display_name: p.display_name, is_anonymous_rank: p.is_anonymous_rank };
            return acc;
          }, {});
        }

        const ranked = sorted.map((item, index) => ({
          ...item,
          month_key: monthKey,
          rank: index + 1,
          display_name: profileMap[item.user_id]?.display_name || 'Ẩn danh',
          is_anonymous_rank: profileMap[item.user_id]?.is_anonymous_rank ?? false,
        }));

        if (ranked.length > 0) {
          const top3 = ranked.slice(0, 3);
          if (!userId || top3.some((item) => item.user_id === userId)) return top3;
          const me = ranked.find((item) => item.user_id === userId);
          return me ? [...top3, me] : top3;
        }
      }

      const { data: topRows } = await supabase!
        .from('monthly_rankings')
        .select('*')
        .eq('month_key', monthKey)
        .gte('total_income', 0)
        .order('total_income', { ascending: false })
        .limit(3);

      let final: any[] = (topRows || [])
        .filter((r: any) => Number(r.total_income) > 0)
        .map((r: any, i: number) => ({ ...r, total_income: Math.max(0, Number(r.total_income) || 0), rank: i + 1 }));

      if (userId) {
        const inTop3 = final.some((r: any) => r.user_id === userId);
        if (!inTop3) {
          const { data: me } = await supabase!
            .from('monthly_rankings')
            .select('*')
            .eq('month_key', monthKey)
            .eq('user_id', userId)
            .gte('total_income', 0)
            .maybeSingle();
          if (me && Number(me.total_income) > 0) {
            const { count } = await supabase!
              .from('monthly_rankings')
              .select('*', { count: 'exact', head: true })
              .eq('month_key', monthKey)
              .gte('total_income', 0)
              .gt('total_income', me.total_income);
            final = [...final, { ...me, total_income: Math.max(0, Number(me.total_income) || 0), rank: (count || 0) + 1 }];
          }
        }
      }

      const uids = final.map((r: any) => r.user_id);
      if (uids.length > 0) {
        const { data: profiles } = await supabase!
          .from('profiles')
          .select('id, is_anonymous_rank')
          .in('id', uids);
        const pmap = (profiles || []).reduce((acc: any, p: any) => { acc[p.id] = p.is_anonymous_rank; return acc; }, {});
        final = final.map((item: any) => ({ ...item, is_anonymous_rank: pmap[item.user_id] ?? item.is_anonymous_rank }));
      }
      return final;
    },
    enabled: !!supabase,
    staleTime: 60_000,
  });
}

/* ── Badges ── */
export function useBadgesQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.badges(userId!),
    queryFn: async () => {
      const { data } = await supabase!
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId!);
      return (data || []).map((b: any) => b.badge_id);
    },
    enabled: !!supabase && !!userId,
    staleTime: 120_000,
  });
}

/* ── Hub: syncs RQ data → Zustand store ── */
export function useSyncQueriesToStore() {
  const userId = useAppStore((s) => s.session?.user.id);
  const setShifts = useAppStore((s) => s.setShifts);
  const setExpenses = useAppStore((s) => s.setExpenses);
  const setCompanions = useAppStore((s) => s.setCompanions);
  const setFriendships = useAppStore((s) => s.setFriendships);
  const setNotifications = useAppStore((s) => s.setNotifications);
  const setRankings = useAppStore((s) => s.setRankings);
  const setEarnedBadges = useAppStore((s) => s.setEarnedBadges);
  const setUserStats = useAppStore((s) => s.setUserStats);
  const setRate = useAppStore((s) => s.setRate);
  const setRequested = useAppStore((s) => s.setRequested);
  const setIsAnonymousRank = useAppStore((s) => s.setIsAnonymousRank);

  const { data: shifts } = useShiftsQuery(userId);
  const { data: expenses } = useExpensesQuery(userId);
  const { data: companions } = useCompanionsQuery(userId);
  const { data: friendships } = useFriendshipsQuery(userId);
  const { data: notifications } = useNotificationsQuery(userId);
  const { data: rankings } = useRankingsQuery(userId);
  const { data: earnedBadges } = useBadgesQuery(userId);

  const { data: profileData } = useProfileQuery(userId);

  // Sync all query data to Zustand via useEffect (NOT during render)
  useEffect(() => {
    if (shifts) setShifts(shifts);
  }, [shifts, setShifts]);

  useEffect(() => {
    if (expenses) setExpenses(expenses);
  }, [expenses, setExpenses]);

  useEffect(() => {
    if (companions) setCompanions(companions);
  }, [companions, setCompanions]);

  useEffect(() => {
    if (friendships) {
      setFriendships(friendships);
      const pendingIds = friendships
        .filter((r: any) => r.requester_id === userId && r.status === 'pending')
        .map((r: any) => r.target_profile_id);
      setRequested(pendingIds);
    }
  }, [friendships, userId, setFriendships, setRequested]);

  useEffect(() => {
    if (notifications) setNotifications(notifications);
  }, [notifications, setNotifications]);

  useEffect(() => {
    if (rankings) {
      setRankings(rankings);
      if (userId) {
        const me = rankings.find((r: any) => r.user_id === userId);
        if (me) setIsAnonymousRank(!!me.is_anonymous_rank);
      }
    }
  }, [rankings, userId, setRankings, setIsAnonymousRank]);

  useEffect(() => {
    if (earnedBadges) setEarnedBadges(earnedBadges);
  }, [earnedBadges, setEarnedBadges]);

  useEffect(() => {
    if (profileData) {
      useAppStore.getState().setProfile((prev) => ({
        ...prev,
        displayName: profileData.displayName,
        school: profileData.school,
        region: profileData.region,
        note: profileData.note,
        avatarUrl: profileData.avatarUrl,
        tags: profileData.tags,
      }));
    }
  }, [profileData]);

  // Badges → check for new ones
  useEffect(() => {
    const client = supabase;
    if (!earnedBadges || !client || !userId) return;
    const checkBadges = async () => {
      const state = useAppStore.getState();
      const stats = {
        shifts: state.shifts,
        expenses: state.expenses,
        posts: [],
        comments: { length: state.userStats.commentsCount },
        companionsCount: state.companions.length,
        likesCount: state.userStats.likesCount,
      };
      const newBadges: string[] = [];
      for (const badge of BADGES) {
        if (earnedBadges.includes(badge.id)) continue;
        if (badge.requirement(stats as any)) newBadges.push(badge.id);
      }
      if (newBadges.length > 0) {
        setEarnedBadges((prev) => [...prev, ...newBadges]);
        for (const bid of newBadges) {
          await client.from('user_badges').insert({ user_id: userId, badge_id: bid });
        }
      }
    };
    void checkBadges();
  }, [earnedBadges, userId]);

  // Exchange rate
  useEffect(() => {
    let cancelled = false;
    fetch('https://open.er-api.com/v6/latest/KRW')
      .then((r) => r.json())
      .then((p: any) => {
        const v = Number(p.rates?.VND);
        if (Number.isFinite(v) && !cancelled) {
          setRate({ value: v, source: 'live', updatedAt: new Date().toISOString() });
        }
      })
      .catch(() => { if (!cancelled) setRate((prev) => ({ ...prev, source: 'cached' })); });
    return () => { cancelled = true; };
  }, [setRate]);

  // Presence
  useEffect(() => {
    const client = supabase;
    if (!client || !userId) return;
    let cancelled = false;
    const touch = async (coords?: GeolocationCoordinates) => {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { id: userId, last_seen_at: now };
      if (coords) {
        patch.latitude = coords.latitude;
        patch.longitude = coords.longitude;
        patch.location_updated_at = now;
      }
      await client.from('profiles').upsert(patch);
    };
    const update = () => {
      if (!navigator.geolocation) { void touch(); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => void touch(pos.coords),
        () => void touch(),
        { enableHighAccuracy: true, maximumAge: 120000, timeout: 8000 },
      );
    };
    update();
    const interval = setInterval(() => void touch(), 60000);
    document.addEventListener('visibilitychange', update);
    return () => { cancelled = true; clearInterval(interval); document.removeEventListener('visibilitychange', update); };
  }, [userId]);
}
