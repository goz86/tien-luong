import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { CompanionProfile, ProfileDraft } from '../lib/types';
import type { CommunityNotification } from '../data/communityData';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function isFriendshipForUser(row: any, userId: string) {
  return Boolean(row && (row.requester_id === userId || row.target_profile_id === userId));
}

function profilePatchFromRow(row: any): Partial<ProfileDraft> {
  return {
    displayName: row.display_name || '',
    school: row.school || '',
    region: row.region || '',
    note: row.note || '',
    avatarUrl: row.avatar_url || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
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
    availability: lastSeenAt ? `Hoạt động gần đây` : 'Chưa cập nhật online',
    tags: Array.isArray(row.tags) ? row.tags : [],
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    lastSeenAt,
  };
}

/**
 * Only handles real-time subscriptions + presence updates.
 * Data fetching is done by React Query (useQueries.ts).
 */
export function useDataSync() {
  const session = useAppStore((s) => s.session);
  const setProfile = useAppStore((s) => s.setProfile);
  const setCompanions = useAppStore((s) => s.setCompanions);
  const setFriendships = useAppStore((s) => s.setFriendships);
  const setNotifications = useAppStore((s) => s.setNotifications);
  const setToastNotification = useAppStore((s) => s.setToastNotification);

  // ── realtime subscriptions: profiles & friend_requests ──
  useEffect(() => {
    if (!supabase || !session) return;
    const client = supabase;
    const uid = session.user.id;

    const profilesChannel = client
      .channel(`profiles-cm-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        const row = ((payload as any).new ?? (payload as any).old) as any;
        if (!row?.id) return;

        if (row.id === uid) {
          if ((payload as any).eventType !== 'DELETE') {
            setProfile((current) => ({ ...current, ...profilePatchFromRow(row) }));
          }
          return;
        }

        if ((payload as any).eventType === 'DELETE') {
          setCompanions((prev: CompanionProfile[]) => prev.filter((c) => c.id !== row.id));
          return;
        }

        const next = companionFromRow(row);
        setCompanions((prev: CompanionProfile[]) => {
          const exists = prev.some((c) => c.id === next.id);
          return exists
            ? prev.map((c) => (c.id === next.id ? { ...c, ...next } : c))
            : [next, ...prev];
        });
      })
      .subscribe();

    const friendsChannel = client
      .channel(`friend-reqs-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, (payload) => {
        const row = (((payload as any).new ?? (payload as any).old) || null) as any;
        if (!row || !isFriendshipForUser(row, uid)) return;

        if ((payload as any).eventType === 'DELETE') {
          setFriendships((prev: any[]) => prev.filter((f: any) => f.id !== row.id));
          return;
        }

        setFriendships((prev: any[]) => {
          const exists = prev.some((f: any) => f.id === row.id);
          return exists ? prev.map((f: any) => (f.id === row.id ? row : f)) : [row, ...prev];
        });
      })
      .subscribe();

    return () => {
      void client.removeChannel(profilesChannel);
      void client.removeChannel(friendsChannel);
    };
  }, [session, setProfile, setCompanions, setFriendships]);

  // ── notifications realtime ──
  useEffect(() => {
    if (!supabase || !session) return;
    const client = supabase;
    const uid = session.user.id;

    const channel = client
      .channel(`notifications-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_notifications' }, (payload) => {
        if ((payload.new as any).recipient_id !== uid) return;
        const n = {
          ...payload.new,
          is_read: false,
          type: ((payload.new as any).type ?? 'system') as CommunityNotification['type'],
        } as CommunityNotification;
        setNotifications((prev: CommunityNotification[]) => [n, ...prev]);
        setToastNotification(n);
        setTimeout(() => setToastNotification(null), 5000);
      })
      .subscribe();

    return () => { void client.removeChannel(channel); };
  }, [session, setNotifications, setToastNotification]);

  // ── presence: update last_seen_at + location ──
  useEffect(() => {
    const client = supabase;
    if (!client || !session) return;
    const uid = session.user.id;
    let cancelled = false;

    const touch = async (coords?: GeolocationCoordinates) => {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { id: uid, last_seen_at: now };
      if (coords) {
        patch.latitude = coords.latitude;
        patch.longitude = coords.longitude;
        patch.location_updated_at = now;
      }
      await client.from('profiles').upsert(patch);
      if (!cancelled) {
        setProfile((cur) => ({
          ...cur,
          ...(coords ? { latitude: coords.latitude, longitude: coords.longitude, locationUpdatedAt: now } : {}),
          lastSeenAt: now,
        }));
      }
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
    const visHandler = () => { if (document.visibilityState === 'visible') update(); };
    document.addEventListener('visibilitychange', visHandler);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', visHandler);
    };
  }, [session, setProfile]);
}
