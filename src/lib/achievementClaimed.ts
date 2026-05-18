export const ACHIEVEMENT_CLAIMED_CHANGE_EVENT = 'duhoc-mate-ach-claimed-change';

export function achievementClaimedKey(uid?: string | null) {
  return `ach-claimed-${uid || 'guest'}`;
}

export function loadAchievementClaimed(uid?: string | null): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(achievementClaimedKey(uid)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function saveAchievementClaimed(keys: string[], uid?: string | null) {
  if (typeof window === 'undefined') return;
  const uniqueKeys = [...new Set(keys)];
  window.localStorage.setItem(achievementClaimedKey(uid), JSON.stringify(uniqueKeys));
  window.dispatchEvent(
    new CustomEvent(ACHIEVEMENT_CLAIMED_CHANGE_EVENT, {
      detail: { uid: uid || 'guest', keys: uniqueKeys },
    }),
  );
}
