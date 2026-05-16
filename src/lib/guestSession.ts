/**
 * Guest Session Management
 *
 * Mỗi thiết bị chưa đăng nhập được cấp 1 UUID duy nhất lưu trong localStorage.
 * UUID này dùng để:
 * - Nhận diện bài viết / bình luận của khách trên Supabase
 * - Cho phép khách xóa nội dung của mình
 * - Track expires_at để hiển thị đếm ngược
 */

const GUEST_SESSION_KEY  = 'duhocmate-guest-session-id';
const GUEST_CONTENT_KEY  = 'duhocmate-guest-content';  // danh sách { id, type, expiresAt }
const GUEST_PENDING_KEY  = 'duhocmate-guest-pending';   // likes/saves chờ sync

export type GuestContentType = 'post' | 'comment';

export type GuestContentRecord = {
  id: string;
  type: GuestContentType;
  expiresAt: string; // ISO string
  postId?: string;   // với comment: postId cha
};

export type GuestPendingLike = {
  postId: string;
  reaction: 'like' | 'dislike' | null; // null = đã bỏ
};

export type GuestPendingBookmark = {
  postId: string;
  bookmarked: boolean;
};

// ── Session ID ───────────────────────────────────────────────────────────────

export function getGuestSessionId(): string {
  let id = localStorage.getItem(GUEST_SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_SESSION_KEY, id);
  }
  return id;
}

// ── Guest Content Records ────────────────────────────────────────────────────

export function getGuestContent(): GuestContentRecord[] {
  try {
    const raw = localStorage.getItem(GUEST_CONTENT_KEY);
    if (!raw) return [];
    const all: GuestContentRecord[] = JSON.parse(raw);
    // Lọc bỏ những cái đã hết hạn khỏi localStorage luôn
    const valid = all.filter((r) => new Date(r.expiresAt) > new Date());
    if (valid.length !== all.length) {
      localStorage.setItem(GUEST_CONTENT_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return [];
  }
}

export function addGuestContent(record: GuestContentRecord): void {
  const existing = getGuestContent();
  existing.push(record);
  localStorage.setItem(GUEST_CONTENT_KEY, JSON.stringify(existing));
}

export function removeGuestContent(id: string): void {
  const existing = getGuestContent().filter((r) => r.id !== id);
  localStorage.setItem(GUEST_CONTENT_KEY, JSON.stringify(existing));
}

/** Trả về expires_at sớm nhất trong số bài/cmt của khách (để đếm ngược) */
export function getEarliestGuestExpiry(): Date | null {
  const records = getGuestContent();
  if (records.length === 0) return null;
  const times = records.map((r) => new Date(r.expiresAt).getTime());
  return new Date(Math.min(...times));
}

/** true nếu khách có ít nhất 1 bài/cmt chưa hết hạn */
export function hasActiveGuestContent(): boolean {
  return getGuestContent().length > 0;
}

// ── Guest Reactions (lưu thẳng vào localStorage, restore khi reload) ─────────

const GUEST_LIKED_KEY     = 'duhocmate-guest-liked';      // postId[]
const GUEST_DISLIKED_KEY  = 'duhocmate-guest-disliked';   // postId[]
const GUEST_BOOKMARKS_KEY2 = 'duhocmate-guest-bookmarked'; // postId[]

function readSet(key: string): Set<string> {
  try { return new Set<string>(JSON.parse(localStorage.getItem(key) ?? '[]')); }
  catch { return new Set(); }
}
function writeSet(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

export function getGuestLikedIds():    Set<string> { return readSet(GUEST_LIKED_KEY); }
export function getGuestDislikedIds(): Set<string> { return readSet(GUEST_DISLIKED_KEY); }
export function getGuestBookmarkedIds(): Set<string> { return readSet(GUEST_BOOKMARKS_KEY2); }

/** Toggle like/dislike cho guest và lưu ngay vào localStorage */
export function toggleGuestReaction(postId: string, reaction: 'like' | 'dislike'): {
  liked: Set<string>; disliked: Set<string>;
} {
  const liked    = readSet(GUEST_LIKED_KEY);
  const disliked = readSet(GUEST_DISLIKED_KEY);

  if (reaction === 'like') {
    if (liked.has(postId)) { liked.delete(postId); }
    else { liked.add(postId); disliked.delete(postId); }
  } else {
    if (disliked.has(postId)) { disliked.delete(postId); }
    else { disliked.add(postId); liked.delete(postId); }
  }

  writeSet(GUEST_LIKED_KEY, liked);
  writeSet(GUEST_DISLIKED_KEY, disliked);
  return { liked, disliked };
}

/** Toggle bookmark cho guest và lưu ngay vào localStorage */
export function toggleGuestBookmark(postId: string): boolean {
  const bookmarks = readSet(GUEST_BOOKMARKS_KEY2);
  if (bookmarks.has(postId)) { bookmarks.delete(postId); writeSet(GUEST_BOOKMARKS_KEY2, bookmarks); return false; }
  bookmarks.add(postId);
  writeSet(GUEST_BOOKMARKS_KEY2, bookmarks);
  return true;
}

// ── Pending Likes / Bookmarks (đợi sync khi đăng nhập lên Supabase) ──────────

export function getGuestPendingLikes(): GuestPendingLike[] {
  try {
    const raw = localStorage.getItem(GUEST_PENDING_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as { likes?: GuestPendingLike[] }).likes ?? [];
  } catch { return []; }
}

export function getGuestPendingBookmarks(): GuestPendingBookmark[] {
  try {
    const raw = localStorage.getItem(GUEST_PENDING_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as { bookmarks?: GuestPendingBookmark[] }).bookmarks ?? [];
  } catch { return []; }
}

function savePending(likes: GuestPendingLike[], bookmarks: GuestPendingBookmark[]) {
  localStorage.setItem(GUEST_PENDING_KEY, JSON.stringify({ likes, bookmarks }));
}

export function upsertGuestPendingLike(postId: string, reaction: 'like' | 'dislike' | null): void {
  const likes = getGuestPendingLikes().filter((l) => l.postId !== postId);
  if (reaction !== null) likes.push({ postId, reaction });
  savePending(likes, getGuestPendingBookmarks());
}

export function upsertGuestPendingBookmark(postId: string, bookmarked: boolean): void {
  const bookmarks = getGuestPendingBookmarks().filter((b) => b.postId !== postId);
  bookmarks.push({ postId, bookmarked });
  savePending(getGuestPendingLikes(), bookmarks);
}

export function clearGuestPending(): void {
  localStorage.removeItem(GUEST_PENDING_KEY);
  localStorage.removeItem(GUEST_LIKED_KEY);
  localStorage.removeItem(GUEST_DISLIKED_KEY);
  localStorage.removeItem(GUEST_BOOKMARKS_KEY2);
}

/** Tính expires_at cho nội dung guest: now + N tiếng (mặc định 3h) */
export function guestExpiresAt(hours = 3): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}
