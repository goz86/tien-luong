import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Activity,
  ArrowLeft,
  Ban,
  Bell,
  CheckCircle2,
  FileText,
  Loader2,
  Megaphone,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Star,
  Trash2,
  UserX,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AppLang } from './ProfileScreen';
import { timeAgo } from '../data/communityData';

type AdminTab = 'overview' | 'users' | 'content' | 'announcements' | 'logs';
type ModerationStatus = 'active' | 'muted' | 'suspended' | 'banned';
type AnnouncementSeverity = 'info' | 'success' | 'warning' | 'danger';

type AdminUser = {
  id: string;
  display_name: string | null;
  school: string | null;
  region: string | null;
  avatar_url: string | null;
  status: string | null;
  last_seen_at: string | null;
  created_at: string | null;
  moderation?: UserModeration | null;
};

type UserModeration = {
  user_id: string;
  status: ModerationStatus;
  reason: string | null;
  muted_until: string | null;
  banned_until: string | null;
  updated_at: string | null;
};

type AdminPost = {
  id: string;
  user_id: string;
  category: string;
  title: string;
  content: string;
  display_name: string;
  likes_count: number | null;
  comments_count: number | null;
  created_at: string;
};

type AdminReview = {
  id: string;
  user_id: string;
  display_name: string;
  place_name: string;
  category: string;
  title: string;
  content: string;
  rating: number;
  upvotes_count: number | null;
  downvotes_count: number | null;
  created_at: string;
};

type AdminComment = {
  id: string;
  post_id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  display_name: string;
  is_anonymous: boolean | null;
  likes_count: number | null;
  created_at: string;
};

type AdminLog = {
  id: string;
  admin_id: string | null;
  action_type: string;
  target_table: string | null;
  target_id: string | null;
  target_user_id: string | null;
  reason: string | null;
  created_at: string;
};

type AdminAnnouncement = {
  id: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  is_published: boolean;
  created_at: string;
};

type DashboardStats = {
  users: number;
  posts: number;
  comments: number;
  reviews: number;
  notifications: number;
};

const ADMIN_TABS: Array<{ id: AdminTab; icon: typeof ShieldCheck }> = [
  { id: 'overview', icon: Activity },
  { id: 'users', icon: Users },
  { id: 'content', icon: FileText },
  { id: 'announcements', icon: Megaphone },
  { id: 'logs', icon: ShieldCheck },
];

const UI = {
  vi: {
    title: 'Quản trị',
    subtitle: 'Theo dõi hoạt động, xử lý nội dung và gửi thông báo hệ thống.',
    back: 'Hồ sơ',
    online: 'Admin online',
    refresh: 'Làm mới',
    noAccess: 'Tài khoản này chưa có quyền quản trị.',
    patchHint: 'Chưa đọc được bảng admin. Hãy chạy file supabase/admin_dashboard_patch.sql trong Supabase.',
    tabs: {
      overview: 'Tổng quan',
      users: 'Người dùng',
      content: 'Nội dung',
      announcements: 'Thông báo',
      logs: 'Nhật ký',
    },
    stats: {
      users: 'Người dùng',
      posts: 'Bài viết',
      comments: 'Bình luận',
      reviews: 'Review',
      notifications: 'Thông báo',
    },
    recentPosts: 'Bài viết mới',
    recentReviews: 'Review mới',
    recentComments: 'Bình luận mới',
    usersTitle: 'Quản lý người dùng',
    contentTitle: 'Duyệt nội dung',
    commentsTitle: 'Bình luận cần theo dõi',
    logsTitle: 'Nhật ký quản trị',
    announceTitle: 'Viết thông báo',
    empty: 'Chưa có dữ liệu.',
    reasonPrompt: 'Lý do xử lý:',
    deletePostConfirm: 'Xoá bài viết này?',
    deleteReviewConfirm: 'Xoá review này?',
    deleteCommentConfirm: 'Xoá bình luận này?',
    deleted: 'Đã xoá nội dung.',
    statusSaved: 'Đã cập nhật trạng thái người dùng.',
    announcementSent: 'Đã gửi thông báo tới người dùng.',
    actionError: 'Thao tác chưa thành công. Kiểm tra SQL patch/RLS rồi thử lại.',
    formTitle: 'Tiêu đề',
    formBody: 'Nội dung',
    formSeverity: 'Mức độ',
    publish: 'Gửi thông báo',
    delete: 'Xoá',
    mute: 'Mute 7 ngày',
    ban: 'Ban',
    restore: 'Mở lại',
    suspended: 'Tạm khoá',
    active: 'Hoạt động',
    muted: 'Muted',
    banned: 'Banned',
    unknownUser: 'Người dùng',
  },
  ko: {
    title: '관리자',
    subtitle: '사용자 활동, 콘텐츠 삭제, 시스템 공지를 관리합니다.',
    back: '프로필',
    online: '관리자 온라인',
    refresh: '새로고침',
    noAccess: '이 계정에는 관리자 권한이 없습니다.',
    patchHint: '관리자 테이블을 읽을 수 없습니다. Supabase에서 supabase/admin_dashboard_patch.sql을 실행해주세요.',
    tabs: {
      overview: '개요',
      users: '사용자',
      content: '콘텐츠',
      announcements: '공지',
      logs: '로그',
    },
    stats: {
      users: '사용자',
      posts: '게시글',
      comments: '댓글',
      reviews: '리뷰',
      notifications: '알림',
    },
    recentPosts: '최근 게시글',
    recentReviews: '최근 리뷰',
    recentComments: '최근 댓글',
    usersTitle: '사용자 관리',
    contentTitle: '콘텐츠 관리',
    commentsTitle: '댓글 관리',
    logsTitle: '관리 로그',
    announceTitle: '공지 작성',
    empty: '데이터가 없습니다.',
    reasonPrompt: '처리 사유:',
    deletePostConfirm: '이 게시글을 삭제할까요?',
    deleteReviewConfirm: '이 리뷰를 삭제할까요?',
    deleteCommentConfirm: '이 댓글을 삭제할까요?',
    deleted: '콘텐츠를 삭제했습니다.',
    statusSaved: '사용자 상태를 업데이트했습니다.',
    announcementSent: '사용자에게 공지를 보냈습니다.',
    actionError: '작업에 실패했습니다. SQL patch/RLS를 확인해주세요.',
    formTitle: '제목',
    formBody: '내용',
    formSeverity: '중요도',
    publish: '공지 보내기',
    delete: '삭제',
    mute: '7일 뮤트',
    ban: '차단',
    restore: '복구',
    suspended: '정지',
    active: '활성',
    muted: '뮤트',
    banned: '차단',
    unknownUser: '사용자',
  },
};

const STATUS_LABELS: Record<ModerationStatus, 'active' | 'muted' | 'suspended' | 'banned'> = {
  active: 'active',
  muted: 'muted',
  suspended: 'suspended',
  banned: 'banned',
};

function shortText(value: string | null | undefined, limit = 90) {
  const text = (value || '').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function displayUser(user: Pick<AdminUser, 'display_name' | 'school' | 'region'>, fallback: string) {
  return user.display_name?.trim() || user.school?.trim() || user.region?.trim() || fallback;
}

function getInitials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || 'AD';
}

function localTime(value: string | null | undefined, lang: AppLang) {
  if (!value) return '';
  const locale = lang === 'ko' ? 'ko-KR' : 'vi-VN';
  return new Date(value).toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminScreen({
  session,
  isAdmin,
  lang,
  onBack,
}: {
  session: Session | null;
  isAdmin: boolean;
  lang: AppLang;
  onBack: () => void;
}) {
  const ui = UI[lang];
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({ users: 0, posts: 0, comments: 0, reviews: 0, notifications: 0 });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementSeverity, setAnnouncementSeverity] = useState<AnnouncementSeverity>('info');

  const loadDashboard = useCallback(async () => {
    if (!supabase || !session || !isAdmin) return;
    setLoading(true);
    setNotice(null);

    const [
      usersCount,
      postsCount,
      commentsCount,
      reviewsCount,
      notificationsCount,
      profilesRes,
      postsRes,
      reviewsRes,
      commentsRes,
      moderationsRes,
      logsRes,
      announcementsRes,
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('community_posts').select('id', { count: 'exact', head: true }),
      supabase.from('community_comments').select('id', { count: 'exact', head: true }),
      supabase.from('place_reviews').select('id', { count: 'exact', head: true }),
      supabase.from('community_notifications').select('id', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select('id, display_name, school, region, avatar_url, status, last_seen_at, created_at')
        .order('last_seen_at', { ascending: false, nullsFirst: false })
        .limit(24),
      supabase
        .from('community_posts')
        .select('id, user_id, category, title, content, display_name, likes_count, comments_count, created_at')
        .order('created_at', { ascending: false })
        .limit(18),
      supabase
        .from('place_reviews')
        .select('id, user_id, display_name, place_name, category, title, content, rating, upvotes_count, downvotes_count, created_at')
        .order('created_at', { ascending: false })
        .limit(24),
      supabase
        .from('community_comments')
        .select('id, post_id, parent_id, user_id, content, display_name, is_anonymous, likes_count, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('user_moderation').select('user_id, status, reason, muted_until, banned_until, updated_at'),
      supabase
        .from('admin_action_logs')
        .select('id, admin_id, action_type, target_table, target_id, target_user_id, reason, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('admin_announcements')
        .select('id, title, body, severity, is_published, created_at')
        .order('created_at', { ascending: false })
        .limit(12),
    ]);

    setStats({
      users: usersCount.count || 0,
      posts: postsCount.count || 0,
      comments: commentsCount.count || 0,
      reviews: reviewsCount.count || 0,
      notifications: notificationsCount.count || 0,
    });

    const moderationMap = new Map<string, UserModeration>();
    (moderationsRes.data as UserModeration[] | null)?.forEach((row) => moderationMap.set(row.user_id, row));

    setUsers(((profilesRes.data as AdminUser[] | null) || []).map((user) => ({
      ...user,
      moderation: moderationMap.get(user.id) || null,
    })));
    setPosts((postsRes.data as AdminPost[] | null) || []);
    setReviews((reviewsRes.data as AdminReview[] | null) || []);
    setComments((commentsRes.data as AdminComment[] | null) || []);
    setLogs((logsRes.data as AdminLog[] | null) || []);
    setAnnouncements((announcementsRes.data as AdminAnnouncement[] | null) || []);

    if (commentsRes.error || moderationsRes.error || logsRes.error || announcementsRes.error) {
      setNotice(ui.patchHint);
    }
    setLoading(false);
  }, [isAdmin, session, ui.patchHint]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!supabase || !session || !isAdmin) return;
    const client = supabase;
    const channel = client
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, () => void loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_comments' }, () => void loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'place_reviews' }, () => void loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_moderation' }, () => void loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_action_logs' }, () => void loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_announcements' }, () => void loadDashboard())
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [isAdmin, loadDashboard, session]);

  const visibleLogs = useMemo(() => logs.slice(0, 20), [logs]);

  async function safeLog(actionType: string, targetTable: string, targetId: string, targetUserId?: string | null, reason?: string | null) {
    if (!supabase) return;
    const { error } = await supabase.rpc('admin_log_action', {
      action_type_input: actionType,
      target_table_input: targetTable,
      target_id_input: targetId,
      target_user_id_input: targetUserId || null,
      reason_text: reason || null,
      metadata_input: {},
    });
    if (error) {
      console.warn('Admin log skipped:', error);
    }
  }

  async function deletePost(post: AdminPost) {
    if (!supabase || !window.confirm(ui.deletePostConfirm)) return;
    const reason = window.prompt(ui.reasonPrompt, '') ?? '';
    setBusyId(`post-${post.id}`);
    try {
      const { error } = await supabase.rpc('admin_delete_community_post', { row_id: post.id, reason_text: reason });
      if (error) {
        const fallback = await supabase.from('community_posts').delete().eq('id', post.id);
        if (fallback.error) throw error;
        await safeLog('delete_post', 'community_posts', post.id, post.user_id, reason);
      }
      setNotice(ui.deleted);
      await loadDashboard();
    } catch (error) {
      console.error('Admin delete post failed:', error);
      setNotice(ui.actionError);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteReview(review: AdminReview) {
    if (!supabase || !window.confirm(ui.deleteReviewConfirm)) return;
    const reason = window.prompt(ui.reasonPrompt, '') ?? '';
    setBusyId(`review-${review.id}`);
    try {
      const { error } = await supabase.rpc('admin_delete_place_review', { row_id: review.id, reason_text: reason });
      if (error) {
        const fallback = await supabase.from('place_reviews').delete().eq('id', review.id);
        if (fallback.error) throw error;
        await safeLog('delete_review', 'place_reviews', review.id, review.user_id, reason);
      }
      setNotice(ui.deleted);
      await loadDashboard();
    } catch (error) {
      console.error('Admin delete review failed:', error);
      setNotice(ui.actionError);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteComment(comment: AdminComment) {
    if (!supabase || !window.confirm(ui.deleteCommentConfirm)) return;
    const reason = window.prompt(ui.reasonPrompt, '') ?? '';
    setBusyId(`comment-${comment.id}`);
    const previousComments = comments;
    const previousStats = stats;
    const affectedIds = new Set([comment.id, ...comments.filter((item) => item.parent_id === comment.id).map((item) => item.id)]);
    setComments((current) => current.filter((item) => !affectedIds.has(item.id)));
    setStats((current) => ({ ...current, comments: Math.max(current.comments - affectedIds.size, 0) }));
    try {
      const { error } = await supabase.rpc('admin_delete_community_comment', { row_id: comment.id, reason_text: reason });
      if (error) {
        const childDelete = await supabase
          .from('community_comments')
          .delete()
          .eq('parent_id', comment.id)
          .select('id');

        if (childDelete.error) throw error;

        const fallback = await supabase
          .from('community_comments')
          .delete()
          .eq('id', comment.id)
          .select('id');

        if (fallback.error || (fallback.data || []).length === 0) throw error;
        await safeLog('delete_comment', 'community_comments', comment.id, comment.user_id, reason);
      }
      setNotice(ui.deleted);
      await loadDashboard();
    } catch (error) {
      console.error('Admin delete comment failed:', error);
      setComments(previousComments);
      setStats(previousStats);
      setNotice(ui.actionError);
    } finally {
      setBusyId(null);
    }
  }

  async function setUserStatus(user: AdminUser, nextStatus: ModerationStatus) {
    if (!supabase) return;
    const reason = nextStatus === 'active' ? 'Restored by admin' : window.prompt(ui.reasonPrompt, '') ?? null;
    if (reason === null) return;
    const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const untilAt = nextStatus === 'muted' || nextStatus === 'suspended' ? sevenDays : null;

    setBusyId(`user-${user.id}`);
    try {
      const { error } = await supabase.rpc('admin_set_user_status', {
        target_user_id_input: user.id,
        next_status: nextStatus,
        reason_text: reason,
        until_at: untilAt,
      });
      if (error) throw error;
      setNotice(ui.statusSaved);
      await loadDashboard();
    } catch (error) {
      console.error('Admin moderation failed:', error);
      setNotice(ui.actionError);
    } finally {
      setBusyId(null);
    }
  }

  async function publishAnnouncement(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !announcementTitle.trim() || !announcementBody.trim()) return;
    setBusyId('announcement');
    try {
      const { error } = await supabase.rpc('admin_publish_announcement', {
        announcement_title: announcementTitle.trim(),
        announcement_body: announcementBody.trim(),
        announcement_severity: announcementSeverity,
      });
      if (error) {
        const fallback = await supabase.from('admin_announcements').insert({
          admin_id: session?.user.id,
          title: announcementTitle.trim(),
          body: announcementBody.trim(),
          severity: announcementSeverity,
          is_published: true,
        });
        if (fallback.error) throw error;
      }
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setAnnouncementSeverity('info');
      setNotice(ui.announcementSent);
      await loadDashboard();
    } catch (error) {
      console.error('Admin announcement failed:', error);
      setNotice(ui.actionError);
    } finally {
      setBusyId(null);
    }
  }

  if (!isAdmin) {
    return (
      <section className="admin-screen admin-access">
        <button type="button" className="admin-back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
          {ui.back}
        </button>
        <div className="admin-access-card">
          <ShieldCheck size={36} />
          <h1>{ui.title}</h1>
          <p>{ui.noAccess}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-screen">
      <header className="admin-header">
        <button type="button" className="admin-back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
          {ui.back}
        </button>
        <button type="button" className="admin-refresh-btn" onClick={() => void loadDashboard()} disabled={loading}>
          {loading ? <Loader2 size={16} className="cm-spin" /> : <RefreshCw size={16} />}
          {ui.refresh}
        </button>
      </header>

      <div className="admin-title-row">
        <div>
          <h1>{ui.title}</h1>
          <p>{ui.subtitle}</p>
        </div>
        <span className="admin-live-pill">
          <ShieldCheck size={15} />
          {ui.online}
        </span>
      </div>

      {notice ? (
        <div className="admin-notice">
          <Bell size={16} />
          <span>{notice}</span>
        </div>
      ) : null}

      <div className="admin-stats-grid">
        <StatCard label={ui.stats.users} value={stats.users} icon={Users} />
        <StatCard label={ui.stats.posts} value={stats.posts} icon={FileText} />
        <StatCard label={ui.stats.comments} value={stats.comments} icon={MessageCircle} />
        <StatCard label={ui.stats.reviews} value={stats.reviews} icon={Star} />
        <StatCard label={ui.stats.notifications} value={stats.notifications} icon={Bell} />
      </div>

      <nav className="admin-tabbar" aria-label="Admin sections">
        {ADMIN_TABS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={activeTab === id ? 'active' : ''}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={16} />
            <span>{ui.tabs[id]}</span>
          </button>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <div className="admin-panel-stack">
          <ContentPanel title={ui.recentPosts} scroll>
            {posts.map((post) => (
              <ContentRow
                key={post.id}
                title={post.title}
                meta={`${post.display_name || ui.unknownUser} • ${timeAgo(post.created_at)}`}
                body={post.content}
                badge={post.category}
                actionLabel={ui.delete}
                busy={busyId === `post-${post.id}`}
                onAction={() => void deletePost(post)}
              />
            ))}
            {posts.length === 0 ? <EmptyText text={ui.empty} /> : null}
          </ContentPanel>
          <ContentPanel title={ui.recentReviews} scroll>
            {reviews.map((review) => (
              <ContentRow
                key={review.id}
                title={`${review.place_name} · ${Number(review.rating).toFixed(1)}`}
                meta={`${review.display_name || ui.unknownUser} • ${timeAgo(review.created_at)}`}
                body={`${review.title} - ${review.content}`}
                badge={review.category}
                actionLabel={ui.delete}
                busy={busyId === `review-${review.id}`}
                onAction={() => void deleteReview(review)}
              />
            ))}
            {reviews.length === 0 ? <EmptyText text={ui.empty} /> : null}
          </ContentPanel>
          <ContentPanel title={ui.recentComments} scroll>
            {comments.map((comment) => (
              <ContentRow
                key={comment.id}
                title={comment.display_name || ui.unknownUser}
                meta={`${timeAgo(comment.created_at)} • post ${comment.post_id.slice(0, 8)}`}
                body={comment.content}
                badge={comment.parent_id ? 'reply' : 'comment'}
                actionLabel={ui.delete}
                busy={busyId === `comment-${comment.id}`}
                onAction={() => void deleteComment(comment)}
              />
            ))}
            {comments.length === 0 ? <EmptyText text={ui.empty} /> : null}
          </ContentPanel>
        </div>
      ) : null}

      {activeTab === 'users' ? (
        <ContentPanel title={ui.usersTitle} scroll>
          <div className="admin-user-list">
            {users.map((user) => {
              const name = displayUser(user, ui.unknownUser);
              const status = (user.moderation?.status || user.status || 'active') as ModerationStatus;
              return (
                <article key={user.id} className="admin-user-row">
                  <div className="admin-avatar">{getInitials(name)}</div>
                  <div className="admin-row-main">
                    <div className="admin-row-head">
                      <h3>{name}</h3>
                      <span className={`admin-status ${status}`}>{ui[STATUS_LABELS[status] || 'active']}</span>
                    </div>
                    <p>{[user.school, user.region].filter(Boolean).join(' • ') || user.id}</p>
                    <small>{user.last_seen_at ? `${timeAgo(user.last_seen_at)} · ${localTime(user.last_seen_at, lang)}` : user.id}</small>
                    {user.moderation?.reason ? <em>{user.moderation.reason}</em> : null}
                  </div>
                  <div className="admin-row-actions">
                    {status !== 'active' ? (
                      <button type="button" onClick={() => void setUserStatus(user, 'active')} disabled={busyId === `user-${user.id}`}>
                        <CheckCircle2 size={14} />
                        {ui.restore}
                      </button>
                    ) : null}
                    <button type="button" onClick={() => void setUserStatus(user, 'muted')} disabled={busyId === `user-${user.id}`}>
                      <Ban size={14} />
                      {ui.mute}
                    </button>
                    <button type="button" className="danger" onClick={() => void setUserStatus(user, 'banned')} disabled={busyId === `user-${user.id}`}>
                      <UserX size={14} />
                      {ui.ban}
                    </button>
                  </div>
                </article>
              );
            })}
            {users.length === 0 ? <EmptyText text={ui.empty} /> : null}
          </div>
        </ContentPanel>
      ) : null}

      {activeTab === 'content' ? (
        <div className="admin-panel-stack">
          <ContentPanel title={ui.contentTitle} scroll>
            {posts.map((post) => (
              <ContentRow
                key={post.id}
                title={post.title}
                meta={`${post.display_name || ui.unknownUser} • ${timeAgo(post.created_at)} • ${post.comments_count || 0} comments`}
                body={post.content}
                badge={post.category}
                actionLabel={ui.delete}
                busy={busyId === `post-${post.id}`}
                onAction={() => void deletePost(post)}
              />
            ))}
            {posts.length === 0 ? <EmptyText text={ui.empty} /> : null}
          </ContentPanel>
          <ContentPanel title={ui.recentReviews} scroll>
            {reviews.map((review) => (
              <ContentRow
                key={review.id}
                title={`${review.place_name} · ${Number(review.rating).toFixed(1)}`}
                meta={`${review.display_name || ui.unknownUser} • ${timeAgo(review.created_at)} • ${review.upvotes_count || 0}/${review.downvotes_count || 0}`}
                body={`${review.title} - ${review.content}`}
                badge={review.category}
                actionLabel={ui.delete}
                busy={busyId === `review-${review.id}`}
                onAction={() => void deleteReview(review)}
              />
            ))}
            {reviews.length === 0 ? <EmptyText text={ui.empty} /> : null}
          </ContentPanel>
          <ContentPanel title={ui.commentsTitle} scroll>
            {comments.map((comment) => (
              <ContentRow
                key={comment.id}
                title={comment.display_name || ui.unknownUser}
                meta={`${timeAgo(comment.created_at)} • post ${comment.post_id.slice(0, 8)} • ${comment.likes_count || 0} likes`}
                body={comment.content}
                badge={comment.parent_id ? 'reply' : 'comment'}
                actionLabel={ui.delete}
                busy={busyId === `comment-${comment.id}`}
                onAction={() => void deleteComment(comment)}
              />
            ))}
            {comments.length === 0 ? <EmptyText text={ui.empty} /> : null}
          </ContentPanel>
        </div>
      ) : null}

      {activeTab === 'announcements' ? (
        <ContentPanel title={ui.announceTitle}>
          <form className="admin-announce-form" onSubmit={publishAnnouncement}>
            <label>
              <span>{ui.formTitle}</span>
              <input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} maxLength={120} />
            </label>
            <label>
              <span>{ui.formBody}</span>
              <textarea value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} rows={4} maxLength={1000} />
            </label>
            <label>
              <span>{ui.formSeverity}</span>
              <select value={announcementSeverity} onChange={(event) => setAnnouncementSeverity(event.target.value as AnnouncementSeverity)}>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="danger">Danger</option>
              </select>
            </label>
            <button type="submit" disabled={busyId === 'announcement' || !announcementTitle.trim() || !announcementBody.trim()}>
              {busyId === 'announcement' ? <Loader2 size={16} className="cm-spin" /> : <Megaphone size={16} />}
              {ui.publish}
            </button>
          </form>

          <div className="admin-announcement-list">
            {announcements.map((item) => (
              <article key={item.id} className={`admin-announcement ${item.severity}`}>
                <strong>{item.title}</strong>
                <p>{shortText(item.body, 130)}</p>
                <small>{localTime(item.created_at, lang)}</small>
              </article>
            ))}
            {announcements.length === 0 ? <EmptyText text={ui.empty} /> : null}
          </div>
        </ContentPanel>
      ) : null}

      {activeTab === 'logs' ? (
        <ContentPanel title={ui.logsTitle} scroll>
          <div className="admin-log-list">
            {visibleLogs.map((log) => (
              <article key={log.id} className="admin-log-row">
                <span className="admin-log-dot" />
                <div>
                  <strong>{log.action_type}</strong>
                  <p>{[log.target_table, log.target_id].filter(Boolean).join(' · ') || log.target_user_id}</p>
                  {log.reason ? <small>{log.reason}</small> : null}
                </div>
                <time>{localTime(log.created_at, lang)}</time>
              </article>
            ))}
            {visibleLogs.length === 0 ? <EmptyText text={ui.empty} /> : null}
          </div>
        </ContentPanel>
      ) : null}
    </section>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof ShieldCheck }) {
  return (
    <div className="admin-stat-card">
      <Icon size={17} />
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}

function ContentPanel({ title, children, scroll = false }: { title: string; children: React.ReactNode; scroll?: boolean }) {
  return (
    <section className={`admin-content-panel ${scroll ? 'is-scrollable' : ''}`}>
      <h2>{title}</h2>
      {scroll ? <div className="admin-panel-scroll">{children}</div> : children}
    </section>
  );
}

function ContentRow({
  title,
  meta,
  body,
  badge,
  actionLabel,
  busy,
  onAction,
}: {
  title: string;
  meta: string;
  body: string;
  badge: string;
  actionLabel: string;
  busy: boolean;
  onAction: () => void;
}) {
  return (
    <article className="admin-content-row">
      <div>
        <span className="admin-row-badge">{badge}</span>
        <h3>{title}</h3>
        <p>{shortText(body)}</p>
        <small>{meta}</small>
      </div>
      <button type="button" className="admin-delete-btn" disabled={busy} onClick={onAction}>
        {busy ? <Loader2 size={15} className="cm-spin" /> : <Trash2 size={15} />}
        {actionLabel}
      </button>
    </article>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="admin-empty">{text}</p>;
}
