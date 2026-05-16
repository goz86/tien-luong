import { hasSupabaseConfig, supabase } from './supabase';
import {
  CommunityCategory,
  CommunityComment,
  CommunityNotification,
  CommunityPost,
  CommunityReactionType,
} from '../data/communityData';

type DbPost = {
  id: string;
  user_id: string | null;
  guest_session_id: string | null;
  expires_at: string | null;
  category: CommunityCategory | string | null;
  title: string | null;
  content: string | null;
  is_anonymous: boolean | null;
  display_name: string | null;
  likes_count: number | null;
  dislikes_count: number | null;
  comments_count: number | null;
  views_count: number | null;
  image_urls: string[] | null;
  created_at: string | null;
};

type DbComment = {
  id: string;
  post_id: string;
  parent_id: string | null;
  user_id: string | null;
  guest_session_id: string | null;
  expires_at: string | null;
  content: string | null;
  is_anonymous: boolean | null;
  display_name: string | null;
  is_author: boolean | null;
  likes_count: number | null;
  created_at: string | null;
};

type DbNotification = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  type: CommunityNotification['type'] | string | null;
  title: string | null;
  body: string | null;
  is_read: boolean | null;
  created_at: string | null;
};

const REQUIRED_QUERY_TIMEOUT_MS = 22000;
const OPTIONAL_QUERY_TIMEOUT_MS = 9000;

async function withQueryTimeout<T>(query: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  });

  return Promise.race([Promise.resolve(query), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function optionalQuery<T>(query: PromiseLike<unknown>, fallback: T, label: string): Promise<T> {
  try {
    return await withQueryTimeout(query, OPTIONAL_QUERY_TIMEOUT_MS, label) as T;
  } catch (error) {
    console.warn(label, error);
    return fallback;
  }
}

export type CommunityState = {
  posts: CommunityPost[];
  comments: CommunityComment[];
  likedPostIds: string[];
  dislikedPostIds: string[];
  bookmarkedPostIds: string[];
  likedCommentIds: string[];
  notifications: CommunityNotification[];
  source: 'supabase' | 'demo';
};

export type PostDraft = {
  userId: string | null;          // null nếu là guest
  guestSessionId?: string;        // UUID của guest
  expiresAt?: string;             // ISO: now + 3h, chỉ có khi là guest
  category: CommunityCategory;
  title: string;
  content: string;
  isAnonymous: boolean;
  displayName: string;
  imageUrls?: string[];           // URLs đã upload lên Storage
};

export type CommentDraft = {
  postId: string;
  parentId: string | null;
  userId: string | null;          // null nếu là guest
  guestSessionId?: string;
  expiresAt?: string;
  content: string;
  isAnonymous: boolean;
  displayName: string;
  isAuthor: boolean;
  recipientId?: string;
  postTitle?: string;
};

function canUseSupabase() {
  return hasSupabaseConfig && Boolean(supabase);
}

function normalizePost(row: DbPost): CommunityPost {
  return {
    id: row.id,
    user_id: row.user_id ?? '',
    guest_session_id: row.guest_session_id ?? null,
    category: (row.category ?? 'free') as CommunityCategory,
    title: row.title ?? '',
    content: row.content ?? '',
    is_anonymous: row.is_anonymous ?? true,
    display_name: row.display_name ?? 'Ẩn danh',
    likes_count: Number(row.likes_count ?? 0),
    dislikes_count: Number(row.dislikes_count ?? 0),
    comments_count: Number(row.comments_count ?? 0),
    views_count: Number(row.views_count ?? 0),
    image_urls: row.image_urls ?? [],
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function normalizeComment(row: DbComment): CommunityComment {
  return {
    id: row.id,
    post_id: row.post_id,
    parent_id: row.parent_id,
    user_id: row.user_id ?? '',
    guest_session_id: row.guest_session_id ?? null,
    expires_at: row.expires_at ?? null,
    content: row.content ?? '',
    is_anonymous: row.is_anonymous ?? true,
    display_name: row.display_name ?? 'Ẩn danh',
    is_author: row.is_author ?? false,
    likes_count: Number(row.likes_count ?? 0),
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function normalizeNotification(row: DbNotification): CommunityNotification {
  return {
    id: row.id,
    recipient_id: row.recipient_id,
    actor_id: row.actor_id,
    post_id: row.post_id,
    comment_id: row.comment_id,
    type: (row.type ?? 'system') as CommunityNotification['type'],
    title: row.title ?? 'Thông báo',
    body: row.body ?? '',
    is_read: row.is_read ?? false,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function emptyState(): CommunityState {
  return {
    posts: [],
    comments: [],
    likedPostIds: [],
    dislikedPostIds: [],
    bookmarkedPostIds: [],
    likedCommentIds: [],
    notifications: [],
    source: 'supabase',
  };
}

export async function loadCommunityState(userId?: string): Promise<CommunityState> {
  if (!canUseSupabase()) return emptyState();
  const client = supabase!;

  const { data: postRows, error: postsError } = await withQueryTimeout(
    client
      .from('community_posts')
      .select('id,user_id,guest_session_id,category,title,content,is_anonymous,display_name,likes_count,dislikes_count,comments_count,views_count,created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    REQUIRED_QUERY_TIMEOUT_MS,
    'loadCommunityState posts',
  );

  if (postsError) {
    console.error('loadCommunityState posts', postsError);
    return emptyState();
  }

  // Lọc bỏ bài guest đã hết hạn (expires_at < now)
  const now = new Date();
  let posts = ((postRows as DbPost[] | null) ?? [])
    .filter((row) => !row.expires_at || new Date(row.expires_at) > now)
    .map(normalizePost);

  if (posts.length > 0) {
    const { data: countRows, error: countError } = await optionalQuery(
      client
        .from('community_comments')
        .select('post_id')
        .in('post_id', posts.map((post) => post.id)),
      { data: null, error: null },
      'loadCommunityState comment counts',
    );

    if (!countError && countRows) {
      const actualCounts = new Map<string, number>();
      (countRows as Array<{ post_id: string }>).forEach((row) => {
        actualCounts.set(row.post_id, (actualCounts.get(row.post_id) || 0) + 1);
      });
      posts = posts.map((post) => ({
        ...post,
        comments_count: Math.max(post.comments_count || 0, actualCounts.get(post.id) || 0),
      }));
    } else if (countError) {
      console.warn('loadCommunityState comment counts', countError);
    }
  }

  let likedPostIds: string[] = [];
  let dislikedPostIds: string[] = [];
  let likedCommentIds: string[] = [];
  let bookmarkedPostIds: string[] = [];
  let notifications: CommunityNotification[] = [];

  if (userId) {
    const [{ data: likeRows }, { data: bookmarkRows }, { data: notificationRows }] = await Promise.all([
      optionalQuery(
        client.from('community_likes').select('post_id, comment_id, is_like').eq('user_id', userId),
        { data: null, error: null },
        'loadCommunityState likes',
      ),
      optionalQuery(
        client.from('community_bookmarks').select('post_id').eq('user_id', userId),
        { data: null, error: null },
        'loadCommunityState bookmarks',
      ),
      optionalQuery(
        client
          .from('community_notifications')
          .select('*')
          .eq('recipient_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
        { data: null, error: null },
        'loadCommunityState notifications',
      ),
    ]);

    const reactions = (likeRows as Array<{ post_id: string | null; comment_id: string | null; is_like: boolean | null }> | null) ?? [];
    likedPostIds = reactions.filter((row) => row.post_id && row.is_like !== false).map((row) => row.post_id!);
    dislikedPostIds = reactions.filter((row) => row.post_id && row.is_like === false).map((row) => row.post_id!);
    likedCommentIds = reactions.filter((row) => row.comment_id && row.is_like !== false).map((row) => row.comment_id!);
    bookmarkedPostIds = ((bookmarkRows as Array<{ post_id: string }> | null) ?? []).map((row) => row.post_id);
    notifications = ((notificationRows as DbNotification[] | null) ?? []).map(normalizeNotification);
  }

  return {
    posts,
    comments: [],
    likedPostIds,
    dislikedPostIds,
    bookmarkedPostIds,
    likedCommentIds,
    notifications,
    source: 'supabase',
  };
}

export async function loadCommunityComments(postId: string): Promise<CommunityComment[]> {
  if (!canUseSupabase()) return [];
  const { data, error } = await supabase!
    .from('community_comments')
    .select('id,post_id,parent_id,user_id,guest_session_id,content,is_anonymous,display_name,is_author,likes_count,created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('loadCommunityComments', error);
    return [];
  }

  const nowTs = new Date();
  return ((data as DbComment[] | null) ?? [])
    .filter((row) => !row.expires_at || new Date(row.expires_at) > nowTs)
    .map(normalizeComment);
}

export async function createCommunityPost(draft: PostDraft): Promise<CommunityPost> {
  if (!canUseSupabase()) throw new Error('Supabase chưa được cấu hình.');
  const { data, error } = await supabase!
    .from('community_posts')
    .insert({
      user_id: draft.userId ?? null,
      guest_session_id: draft.guestSessionId ?? null,
      expires_at: draft.expiresAt ?? null,
      category: draft.category,
      title: draft.title,
      content: draft.content,
      is_anonymous: draft.isAnonymous,
      display_name: draft.displayName,
      image_urls: draft.imageUrls && draft.imageUrls.length > 0 ? draft.imageUrls : [],
    })
    .select('*')
    .single();

  if (error) throw error;
  return normalizePost(data as DbPost);
}

export async function updateCommunityPost(postId: string, draft: Omit<PostDraft, 'userId'>): Promise<CommunityPost> {
  if (!canUseSupabase()) throw new Error('Supabase chưa được cấu hình.');
  const { data, error } = await supabase!
    .from('community_posts')
    .update({
      category: draft.category,
      title: draft.title,
      content: draft.content,
      is_anonymous: draft.isAnonymous,
      display_name: draft.displayName,
      image_urls: draft.imageUrls && draft.imageUrls.length > 0 ? draft.imageUrls : [],
    })
    .eq('id', postId)
    .select('*')
    .single();

  if (error) throw error;
  return normalizePost(data as DbPost);
}

export async function deleteCommunityPost(postId: string): Promise<void> {
  if (!canUseSupabase()) return;
  const { error } = await supabase!.from('community_posts').delete().eq('id', postId);
  if (error) throw error;
}

export async function createCommunityComment(draft: CommentDraft): Promise<CommunityComment> {
  if (!canUseSupabase()) throw new Error('Supabase chưa được cấu hình.');
  const client = supabase!;
  const { data, error } = await client
    .from('community_comments')
    .insert({
      post_id: draft.postId,
      parent_id: draft.parentId,
      user_id: draft.userId ?? null,
      guest_session_id: draft.guestSessionId ?? null,
      expires_at: draft.expiresAt ?? null,
      content: draft.content,
      is_anonymous: draft.isAnonymous,
      display_name: draft.displayName,
      is_author: draft.isAuthor,
    })
    .select('*')
    .single();

  if (error) throw error;

  const comment = normalizeComment(data as DbComment);
  await bumpPostCounter(draft.postId, 'comments_count', 1);

  if (draft.recipientId && draft.recipientId !== draft.userId) {
    await createCommunityNotification({
      recipientId: draft.recipientId,
      actorId: draft.userId,
      postId: draft.postId,
      commentId: comment.id,
      type: draft.parentId ? 'reply' : 'comment',
      title: draft.parentId ? 'Có trả lời mới' : 'Có bình luận mới',
      body: `${draft.displayName} đã bình luận trong "${draft.postTitle ?? 'bài viết của bạn'}".`,
    });
  }

  return comment;
}

async function bumpPostCounter(postId: string, field: 'likes_count' | 'dislikes_count' | 'comments_count' | 'views_count', delta: number) {
  if (!canUseSupabase()) return;
  const client = supabase!;
  const { error: rpcError } = await client.rpc('increment_community_post_counter', {
    row_id: postId,
    column_name: field,
    delta_value: delta,
  });
  if (!rpcError) return;

  const { data } = await client.from('community_posts').select(field).eq('id', postId).maybeSingle();
  const current = Number((data as Record<string, unknown> | null)?.[field] ?? 0);
  await client.from('community_posts').update({ [field]: Math.max(current + delta, 0) }).eq('id', postId);
}

async function bumpCommentCounter(commentId: string, delta: number) {
  if (!canUseSupabase()) return;
  const client = supabase!;
  const { error: rpcError } = await client.rpc('increment_community_comment_likes', {
    row_id: commentId,
    delta_value: delta,
  });
  if (!rpcError) return;

  const { data } = await client.from('community_comments').select('likes_count').eq('id', commentId).maybeSingle();
  const current = Number((data as { likes_count?: number } | null)?.likes_count ?? 0);
  await client.from('community_comments').update({ likes_count: Math.max(current + delta, 0) }).eq('id', commentId);
}

export async function incrementPostView(postId: string): Promise<void> {
  await bumpPostCounter(postId, 'views_count', 1);
}

export async function togglePostReaction(
  userId: string,
  postId: string,
  reaction: CommunityReactionType
): Promise<{ state: 'added' | 'removed' | 'switched'; reaction: CommunityReactionType }> {
  if (!canUseSupabase()) throw new Error('Supabase chưa được cấu hình.');
  const client = supabase!;
  const nextIsLike = reaction === 'like';
  const { data: existing } = await client
    .from('community_likes')
    .select('id, is_like')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .maybeSingle();

  const current = existing as { id: string; is_like: boolean | null } | null;

  if (current && current.is_like === nextIsLike) {
    const { error } = await client.from('community_likes').delete().eq('id', current.id);
    if (error) throw error;
    await bumpPostCounter(postId, nextIsLike ? 'likes_count' : 'dislikes_count', -1);
    return { state: 'removed', reaction };
  }

  if (current) {
    const { error } = await client.from('community_likes').update({ is_like: nextIsLike }).eq('id', current.id);
    if (error) throw error;
    await bumpPostCounter(postId, nextIsLike ? 'likes_count' : 'dislikes_count', 1);
    await bumpPostCounter(postId, nextIsLike ? 'dislikes_count' : 'likes_count', -1);
    return { state: 'switched', reaction };
  }

  const { error } = await client.from('community_likes').insert({
    user_id: userId,
    post_id: postId,
    is_like: nextIsLike,
  });
  if (error) throw error;
  await bumpPostCounter(postId, nextIsLike ? 'likes_count' : 'dislikes_count', 1);
  return { state: 'added', reaction };
}

export async function toggleCommentLike(
  userId: string,
  commentId: string
): Promise<{ state: 'added' | 'removed' }> {
  if (!canUseSupabase()) throw new Error('Supabase chưa được cấu hình.');
  const client = supabase!;
  const { data: existing } = await client
    .from('community_likes')
    .select('id')
    .eq('user_id', userId)
    .eq('comment_id', commentId)
    .maybeSingle();

  const current = existing as { id: string } | null;
  if (current) {
    const { error } = await client.from('community_likes').delete().eq('id', current.id);
    if (error) throw error;
    await bumpCommentCounter(commentId, -1);
    return { state: 'removed' };
  }

  const { error } = await client.from('community_likes').insert({
    user_id: userId,
    comment_id: commentId,
    is_like: true,
  });
  if (error) throw error;
  await bumpCommentCounter(commentId, 1);
  return { state: 'added' };
}

export async function toggleCommunityBookmark(
  userId: string,
  postId: string
): Promise<{ state: 'added' | 'removed' }> {
  if (!canUseSupabase()) throw new Error('Supabase chưa được cấu hình.');
  const client = supabase!;
  const { data: existing } = await client
    .from('community_bookmarks')
    .select('id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .maybeSingle();

  const current = existing as { id: string } | null;
  if (current) {
    const { error } = await client.from('community_bookmarks').delete().eq('id', current.id);
    if (error) throw error;
    return { state: 'removed' };
  }

  const { error } = await client.from('community_bookmarks').insert({ user_id: userId, post_id: postId });
  if (error) throw error;
  return { state: 'added' };
}

export async function createCommunityNotification(input: {
  recipientId: string;
  actorId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  type: CommunityNotification['type'];
  title: string;
  body: string;
}): Promise<void> {
  if (!canUseSupabase()) return;
  const { error } = await supabase!.from('community_notifications').insert({
    recipient_id: input.recipientId,
    actor_id: input.actorId ?? null,
    post_id: input.postId ?? null,
    comment_id: input.commentId ?? null,
    type: input.type,
    title: input.title,
    body: input.body,
  });
  if (error) console.error('createCommunityNotification', error);
}

export async function loadBlockedUserIds(userId?: string): Promise<string[]> {
  if (!canUseSupabase() || !userId) return [];
  const { data, error } = await supabase!
    .from('user_blocks')
    .select('blocked_user_id')
    .eq('blocker_id', userId);

  if (error) {
    console.warn('loadBlockedUserIds', error);
    return [];
  }

  return ((data as Array<{ blocked_user_id: string }> | null) ?? [])
    .map((row) => row.blocked_user_id)
    .filter(Boolean);
}

export async function blockCommunityUser(blockedUserId: string): Promise<void> {
  if (!canUseSupabase()) throw new Error('Supabase is not configured.');
  const { error } = await supabase!.from('user_blocks').upsert({
    blocked_user_id: blockedUserId,
  }, { onConflict: 'blocker_id,blocked_user_id' });
  if (error) throw error;
}

export async function reportCommunityContent(input: {
  targetType: 'post' | 'comment' | 'review' | 'profile' | 'chat';
  targetId?: string | null;
  targetUserId?: string | null;
  reason: string;
  details?: string;
}): Promise<void> {
  if (!canUseSupabase()) throw new Error('Supabase is not configured.');
  const { error } = await supabase!.from('content_reports').insert({
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    target_user_id: input.targetUserId ?? null,
    reason: input.reason,
    details: input.details ?? null,
  });
  if (error) throw error;
}
