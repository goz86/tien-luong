/**
 * App Visit Tracking
 * Gửi 1 ping lên Supabase mỗi khi người dùng mở app (tối đa 1 lần/giờ/session).
 */

import { supabase } from './supabase';
import { getGuestSessionId } from './guestSession';

const VISIT_TS_KEY = 'duhocmate-last-visit-ping';
const MIN_INTERVAL_MS = 60 * 60 * 1000; // ping lại sau 1 giờ

export async function recordAppVisit(userId: string | null): Promise<void> {
  if (!supabase) return;

  // Throttle: không ping quá 1 lần/giờ để tránh spam
  try {
    const lastPing = Number(localStorage.getItem(VISIT_TS_KEY) ?? '0');
    if (Date.now() - lastPing < MIN_INTERVAL_MS) return;
  } catch {
    // localStorage không khả dụng → bỏ qua
    return;
  }

  const sessionId = userId ?? getGuestSessionId();
  const isGuest   = !userId;

  try {
    await supabase.rpc('record_app_visit', {
      p_session_id: sessionId,
      p_is_guest:   isGuest,
    });
    localStorage.setItem(VISIT_TS_KEY, String(Date.now()));
  } catch (error) {
    // Không critical — bỏ qua lỗi tracking
    console.warn('[appVisits] ping failed:', error);
  }
}
