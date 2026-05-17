import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Activity,
  AlertTriangle,
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
  ShieldOff,
  Star,
  TrendingUp,
  Trash2,
  UserX,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AppLang } from './ProfileScreen';
import { timeAgo } from '../data/communityData';

type AdminTab = 'overview' | 'users' | 'content' | 'reports' | 'announcements' | 'logs';
type AdminContentView = 'posts' | 'reviews' | 'comments';
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
  is_anonymous: boolean | null;
  likes_count: number | null;
  comments_count: number | null;
  image_urls: string[] | null;
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

type AdminNotification = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  type: string;
  title: string;
  body: string;
  is_read: boolean | null;
  created_at: string;
};

type CommunityReport = {
  id: string;
  reporter_id: string | null;
  target_type: 'post' | 'comment' | 'review' | 'profile' | 'chat';
  target_id: string | null;
  target_user_id: string | null;
  reason: string;
  details: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

type ReportFilter = 'pending' | 'resolved' | 'dismissed' | 'all';

type VisitStats = {
  total_sessions_ever: number;
  total_guests_ever: number;
  total_users_ever: number;
  sessions_today: number;
  guests_today: number;
  sessions_week: number;
  guests_week: number;
  sessions_month: number;
  guests_month: number;
};

type DailyVisit = {
  day: string;
  total_sessions: number;
  guest_sessions: number;
  user_sessions: number;
};

type MonthlyVisit = {
  month: string; // 'YYYY-MM'
  total_sessions: number;
  guest_sessions: number;
  user_sessions: number;
};

type DashboardStats = {
  users: number;
  newUsersWeek: number;
  activeUsersWeek: number;
  posts: number;
  comments: number;
  reviews: number;
  notifications: number;
  reports: number;
};

type AdminSeenState = {
  comments: string;
  notifications: string;
};

const ADMIN_TABS: Array<{ id: AdminTab; icon: typeof ShieldCheck }> = [
  { id: 'overview',      icon: Activity },
  { id: 'users',         icon: Users },
  { id: 'content',       icon: FileText },
  { id: 'reports',       icon: AlertTriangle },
  { id: 'announcements', icon: Megaphone },
  { id: 'logs',          icon: ShieldCheck },
];

const ADMIN_SEEN_KEY = 'duhoc-mate-admin-seen-v1';
const ADMIN_SEEN_FALLBACK: AdminSeenState = {
  comments: '1970-01-01T00:00:00.000Z',
  notifications: '1970-01-01T00:00:00.000Z',
};

const UI = {
  vi: {
    title: 'Quản trị',
    subtitle: 'Theo dõi hoạt động, xử lý nội dung và gửi thông báo hệ thống.',
    back: 'Hồ sơ',
    online: 'Admin online',
    refresh: 'Làm mới',
    noAccess: 'Tài khoản này chưa có quyền quản trị.',
    patchHint: 'Chưa đọc được bảng admin. Hãy chạy file supabase/admin_dashboard_rebuild.sql trong Supabase.',
    tabs: {
      overview:      'Tổng quan',
      users:         'Người dùng',
      content:       'Nội dung',
      reports:       'Báo cáo',
      announcements: 'Thông báo',
      logs:          'Nhật ký',
    },
    stats: {
      users:         'Người dùng',
      posts:         'Bài viết',
      comments:      'Bình luận',
      reviews:       'Review',
      notifications: 'Thông báo',
      reports:       'Báo cáo',
      newUsersWeek:  'Mới tuần này',
      activeWeek:    'Hoạt động 7 ngày',
    },
    recentPosts: 'Bài viết mới',
    recentReviews: 'Review mới',
    recentComments: 'Bình luận mới',
    usersTitle: 'Quản lý người dùng',
    contentTitle: 'Duyệt nội dung',
    commentsTitle: 'Bình luận cần theo dõi',
    commentsHistoryTitle: 'Lịch sử bình luận',
    notificationsTitle: 'Lịch sử thông báo',
    sentAnnouncements: 'Thông báo đã gửi',
    openHistory: 'Xem lịch sử',
    newSinceSeen: 'mới',
    backToContent: 'Tất cả nội dung',
    backToAnnouncements: 'Viết thông báo',
    logsTitle: 'Nhật ký quản trị',
    announceTitle: 'Viết thông báo',
    reportsTitle: 'Xử lý báo cáo vi phạm',
    reportsPending: 'Chờ xử lý',
    reportsResolved: 'Đã xử lý',
    reportsDismissed: 'Đã bỏ qua',
    reportsAll: 'Tất cả',
    resolveReport: 'Đã xử lý',
    dismissReport: 'Bỏ qua',
    deleteAndResolve: 'Xoá & đóng',
    reportResolved: 'Đã đánh dấu xử lý.',
    reportDismissed: 'Đã bỏ qua báo cáo.',
    noReports: 'Không có báo cáo nào.',
    reportTarget: 'Mục tiêu',
    reportBy: 'Người báo cáo',
    reportDetail: 'Chi tiết',
    reportStatus: 'Trạng thái',
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
    patchHint: '관리자 테이블을 읽을 수 없습니다. Supabase에서 supabase/admin_dashboard_rebuild.sql을 실행해주세요.',
    tabs: {
      overview:      '개요',
      users:         '사용자',
      content:       '콘텐츠',
      reports:       '신고',
      announcements: '공지',
      logs:          '로그',
    },
    stats: {
      users:         '사용자',
      posts:         '게시글',
      comments:      '댓글',
      reviews:       '리뷰',
      notifications: '알림',
      reports:       '신고',
      newUsersWeek:  '이번 주 신규',
      activeWeek:    '7일 활성',
    },
    recentPosts: '최근 게시글',
    recentReviews: '최근 리뷰',
    recentComments: '최근 댓글',
    usersTitle: '사용자 관리',
    contentTitle: '콘텐츠 관리',
    commentsTitle: '댓글 관리',
    commentsHistoryTitle: '댓글 내역',
    notificationsTitle: '알림 내역',
    sentAnnouncements: '보낸 공지',
    openHistory: '내역 보기',
    newSinceSeen: '신규',
    backToContent: '전체 콘텐츠',
    backToAnnouncements: '공지 작성',
    logsTitle: '관리 로그',
    announceTitle: '공지 작성',
    reportsTitle: '신고 처리',
    reportsPending: '처리 대기',
    reportsResolved: '처리 완료',
    reportsDismissed: '무시됨',
    reportsAll: '전체',
    resolveReport: '처리 완료',
    dismissReport: '무시',
    deleteAndResolve: '삭제 & 처리',
    reportResolved: '신고가 처리되었습니다.',
    reportDismissed: '신고를 무시했습니다.',
    noReports: '신고 없음.',
    reportTarget: '대상',
    reportBy: '신고자',
    reportDetail: '상세',
    reportStatus: '상태',
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

function loadAdminSeen(): AdminSeenState {
  if (typeof window === 'undefined') return ADMIN_SEEN_FALLBACK;
  try {
    const stored = JSON.parse(window.localStorage.getItem(ADMIN_SEEN_KEY) || '{}') as Partial<AdminSeenState>;
    return {
      comments: typeof stored.comments === 'string' ? stored.comments : ADMIN_SEEN_FALLBACK.comments,
      notifications: typeof stored.notifications === 'string' ? stored.notifications : ADMIN_SEEN_FALLBACK.notifications,
    };
  } catch {
    return ADMIN_SEEN_FALLBACK;
  }
}

function newestIso(current: string, next: string | null | undefined) {
  if (!next) return current;
  return new Date(next).getTime() > new Date(current).getTime() ? next : current;
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '');
  }
  return '';
}

function combineErrors(...errors: Array<unknown>) {
  const details = errors.map(getErrorMessage).filter(Boolean);
  return details.length ? details.join(' | ') : '';
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
  const isKo = lang === 'ko';
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [contentView, setContentView] = useState<AdminContentView>('posts');
  const [contentFocus, setContentFocus] = useState<'comments' | null>(null);
  const [announcementFocus, setAnnouncementFocus] = useState<'notifications' | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [seen, setSeen] = useState<AdminSeenState>(() => loadAdminSeen());
  const [stats, setStats] = useState<DashboardStats>({ users: 0, newUsersWeek: 0, activeUsersWeek: 0, posts: 0, comments: 0, reviews: 0, notifications: 0, reports: 0 });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [reportFilter, setReportFilter] = useState<ReportFilter>('pending');
  const [visitStats, setVisitStats] = useState<VisitStats | null>(null);
  const [dailyVisits, setDailyVisits] = useState<DailyVisit[]>([]);
  const [monthlyVisits, setMonthlyVisits] = useState<MonthlyVisit[]>([]);
  const [imgLightbox, setImgLightbox] = useState<{ urls: string[]; idx: number } | null>(null);
  // Styled confirm/prompt modal
  type ConfirmState = { message: string; resolve: (ok: boolean, reason: string) => void };
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmReason, setConfirmReason] = useState('');
  const adminConfirm = useCallback((message: string): Promise<{ ok: boolean; reason: string }> =>
    new Promise(resolve => {
      setConfirmReason('');
      setConfirmState({ message, resolve: (ok, reason) => { setConfirmState(null); resolve({ ok, reason }); } });
    }), []);

  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementSeverity, setAnnouncementSeverity] = useState<AnnouncementSeverity>('info');

  const loadDashboard = useCallback(async () => {
    if (!supabase || !session || !isAdmin) return;
    setLoading(true);
    setNotice(null);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      statsRes,
      profilesRes,
      postsRes,
      reviewsRes,
      commentsRes,
      moderationsRes,
      logsRes,
      announcementsRes,
      notificationsRes,
      reportsRes,
      newUsersRes,
      activeUsersRes,
    ] = await Promise.all([
      supabase.rpc('admin_get_dashboard_stats', {
        comments_seen_at: seen.comments,
        notifications_seen_at: seen.notifications,
      }),
      supabase
        .from('profiles')
        .select('id, display_name, school, region, avatar_url, status, last_seen_at, created_at')
        .order('created_at', { ascending: false })
        .limit(24),
      supabase
        .from('community_posts')
        .select('id, user_id, category, title, content, display_name, is_anonymous, likes_count, comments_count, image_urls, created_at')
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
      supabase
        .from('community_notifications')
        .select('id, recipient_id, actor_id, post_id, comment_id, type, title, body, is_read, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('community_reports')
        .select('id, reporter_id, target_type, target_id, target_user_id, reason, details, status, admin_note, created_at, resolved_at')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', weekAgo),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('updated_at', weekAgo),   // dùng updated_at thay last_seen_at để an toàn
    ]);

    let nextStats: DashboardStats | null = null;
    const statsRow = Array.isArray(statsRes.data) ? statsRes.data[0] : null;
    const pendingCount = (reportsRes.data as CommunityReport[] | null)?.filter(r => r.status === 'pending').length ?? 0;
    const newUsersWeek = newUsersRes.count ?? 0;
    const activeUsersWeek = activeUsersRes.count ?? 0;

    if (!statsRes.error && statsRow) {
      nextStats = {
        users:          Number(statsRow.users_count || 0),
        newUsersWeek,
        activeUsersWeek,
        posts:          Number(statsRow.posts_count || 0),
        comments:       Number(statsRow.comments_new_count || 0),
        reviews:        Number(statsRow.reviews_count || 0),
        notifications:  Number(statsRow.notifications_new_count || 0),
        reports:        pendingCount,
      };
    } else {
      const [usersCount, postsCount, commentsCount, reviewsCount, notificationsCount] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('community_posts').select('id', { count: 'exact', head: true }),
        supabase.from('community_comments').select('id', { count: 'exact', head: true }).gt('created_at', seen.comments),
        supabase.from('place_reviews').select('id', { count: 'exact', head: true }),
        supabase.from('community_notifications').select('id', { count: 'exact', head: true }).gt('created_at', seen.notifications),
      ]);

      nextStats = {
        users:          usersCount.count || 0,
        newUsersWeek,
        activeUsersWeek,
        posts:          postsCount.count || 0,
        comments:       commentsCount.count || 0,
        reviews:        reviewsCount.count || 0,
        notifications:  notificationsCount.count || 0,
        reports:        pendingCount,
      };
    }

    setStats(nextStats);
    setReports((reportsRes.data as CommunityReport[] | null) || []);

    // Visitor stats (non-critical — bỏ qua lỗi nếu bảng chưa tạo)
    const [visitStatsRes, dailyVisitsRes] = await Promise.all([
      supabase.rpc('admin_get_visit_stats'),
      supabase.rpc('admin_get_daily_visits', { days_back: 180 }),
    ]);
    if (!visitStatsRes.error && visitStatsRes.data) {
      const row = Array.isArray(visitStatsRes.data) ? visitStatsRes.data[0] : visitStatsRes.data;
      if (row) {
        setVisitStats({
          total_sessions_ever: Number(row.total_sessions_ever || 0),
          total_guests_ever:   Number(row.total_guests_ever   || 0),
          total_users_ever:    Number(row.total_users_ever    || 0),
          sessions_today:      Number(row.sessions_today      || 0),
          guests_today:        Number(row.guests_today        || 0),
          sessions_week:       Number(row.sessions_week       || 0),
          guests_week:         Number(row.guests_week         || 0),
          sessions_month:      Number(row.sessions_month      || 0),
          guests_month:        Number(row.guests_month        || 0),
        });
      }
    }
    if (!dailyVisitsRes.error && Array.isArray(dailyVisitsRes.data)) {
      const rawVisits = dailyVisitsRes.data as DailyVisit[];
      const today = new Date();

      // Pad last 14 days for chart (fill missing days with 0)
      const padded: DailyVisit[] = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (13 - i));
        const dayStr = d.toISOString().slice(0, 10);
        return rawVisits.find(v => v.day === dayStr)
          ?? { day: dayStr, total_sessions: 0, guest_sessions: 0, user_sessions: 0 };
      });
      setDailyVisits(padded);

      // Group by month for monthly stats
      const monthMap = new Map<string, MonthlyVisit>();
      rawVisits.forEach(v => {
        const month = v.day.slice(0, 7); // 'YYYY-MM'
        const prev = monthMap.get(month) ?? { month, total_sessions: 0, guest_sessions: 0, user_sessions: 0 };
        monthMap.set(month, {
          month,
          total_sessions: prev.total_sessions + (v.total_sessions || 0),
          guest_sessions:  prev.guest_sessions  + (v.guest_sessions  || 0),
          user_sessions:   prev.user_sessions   + (v.user_sessions   || 0),
        });
      });
      const sortedMonths = Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month));
      setMonthlyVisits(sortedMonths);
    }

    const moderationMap = new Map<string, UserModeration>();
    (moderationsRes.data as UserModeration[] | null)?.forEach((row) => moderationMap.set(row.user_id, row));

    // Nếu profiles query bị RLS chặn → thử qua RPC admin_get_users
    let profileRows = (profilesRes.data as AdminUser[] | null) || [];
    if (profilesRes.error || profileRows.length === 0) {
      console.warn('[Admin] profiles direct select failed, trying admin_get_users RPC:', profilesRes.error);
      const rpcFallback = await supabase.rpc('admin_get_users', { limit_count: 24 });
      if (!rpcFallback.error && Array.isArray(rpcFallback.data) && rpcFallback.data.length > 0) {
        profileRows = rpcFallback.data as AdminUser[];
      }
    }

    setUsers(profileRows.map((user) => ({
      ...user,
      moderation: moderationMap.get(user.id) || null,
    })));
    setPosts((postsRes.data as AdminPost[] | null) || []);
    setReviews((reviewsRes.data as AdminReview[] | null) || []);
    setComments((commentsRes.data as AdminComment[] | null) || []);
    setLogs((logsRes.data as AdminLog[] | null) || []);
    setAnnouncements((announcementsRes.data as AdminAnnouncement[] | null) || []);
    setNotifications((notificationsRes.data as AdminNotification[] | null) || []);

    if (commentsRes.error || moderationsRes.error || logsRes.error || announcementsRes.error || notificationsRes.error) {
      setNotice(ui.patchHint);
    }
    setLoading(false);
  }, [isAdmin, seen.comments, seen.notifications, session, ui.patchHint]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!supabase || !session || !isAdmin) return;
    let isMounted = true;
    supabase
      .from('admin_dashboard_seen_state')
      .select('comments_seen_at, notifications_seen_at')
      .eq('admin_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted || error || !data) return;
        setSeen((current) => {
          const next = {
            comments: newestIso(current.comments, (data as { comments_seen_at?: string | null }).comments_seen_at),
            notifications: newestIso(current.notifications, (data as { notifications_seen_at?: string | null }).notifications_seen_at),
          };
          window.localStorage.setItem(ADMIN_SEEN_KEY, JSON.stringify(next));
          return next;
        });
      });

    return () => {
      isMounted = false;
    };
  }, [isAdmin, session]);

  useEffect(() => {
    if (!supabase || !session || !isAdmin) return;
    const client = supabase;
    let reloadTimer: number | undefined;
    const queueReload = () => {
      window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => void loadDashboard(), 250);
    };
    const channel = client
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, queueReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, queueReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_comments' }, queueReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'place_reviews' }, queueReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_notifications' }, queueReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_moderation' }, queueReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_action_logs' }, queueReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_announcements' }, queueReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_reports' }, queueReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_visits' }, queueReload)
      .subscribe();

    return () => {
      window.clearTimeout(reloadTimer);
      void client.removeChannel(channel);
    };
  }, [isAdmin, loadDashboard, session]);

  const visibleLogs = useMemo(() => logs.slice(0, 20), [logs]);

  useEffect(() => {
    const targetId =
      activeTab === 'content' && contentFocus === 'comments'
        ? 'admin-comments-history'
        : activeTab === 'announcements' && announcementFocus === 'notifications'
          ? 'admin-notifications-history'
          : null;
    if (!targetId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [activeTab, announcementFocus, contentFocus]);

  function openTab(tab: AdminTab) {
    setActiveTab(tab);
    if (tab !== 'content') setContentFocus(null);
    if (tab !== 'announcements') setAnnouncementFocus(null);
  }

  async function persistSeen(kind: keyof AdminSeenState, seenAt: string) {
    if (!supabase || !session) return;
    const { error } = await supabase.rpc('admin_mark_dashboard_seen', {
      seen_kind: kind,
      seen_at: seenAt,
    });
    if (error) {
      console.warn('Admin seen state stored locally only:', error);
    }
  }

  function markSeen(kind: keyof AdminSeenState) {
    const nextSeenAt = new Date().toISOString();
    setSeen((current) => {
      const next = { ...current, [kind]: nextSeenAt };
      window.localStorage.setItem(ADMIN_SEEN_KEY, JSON.stringify(next));
      return next;
    });
    setStats((current) => ({ ...current, [kind]: 0 }));
    void persistSeen(kind, nextSeenAt);
  }

  function openCommentHistory() {
    setContentView('comments');
    setContentFocus('comments');
    openTab('content');
    markSeen('comments');
  }

  function openNotificationHistory() {
    setAnnouncementFocus('notifications');
    openTab('announcements');
    markSeen('notifications');
  }

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
    if (!supabase) return;
    const { ok, reason } = await adminConfirm(ui.deletePostConfirm);
    if (!ok) return;
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
      const detail = getErrorMessage(error);
      setNotice(detail ? `${ui.actionError} ${detail}` : ui.actionError);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteReview(review: AdminReview) {
    if (!supabase) return;
    const { ok, reason } = await adminConfirm(ui.deleteReviewConfirm);
    if (!ok) return;
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
      const detail = getErrorMessage(error);
      setNotice(detail ? `${ui.actionError} ${detail}` : ui.actionError);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteComment(comment: AdminComment) {
    if (!supabase) return;
    const { ok, reason } = await adminConfirm(ui.deleteCommentConfirm);
    if (!ok) return;
    setBusyId(`comment-${comment.id}`);
    const previousComments = comments;
    const previousStats = stats;
    const affectedIds = new Set([comment.id, ...comments.filter((item) => item.parent_id === comment.id).map((item) => item.id)]);
    setComments((current) => current.filter((item) => !affectedIds.has(item.id)));
    setStats((current) => ({ ...current, comments: Math.max(current.comments - affectedIds.size, 0) }));
    try {
      const hardDelete = await supabase.rpc('admin_delete_community_comment_hard', { row_id: comment.id, reason_text: reason });
      const legacyDelete = hardDelete.error
        ? await supabase.rpc('admin_delete_community_comment', { row_id: comment.id, reason_text: reason })
        : null;
      const deletedByRpc = !hardDelete.error
        ? Number(hardDelete.data || 0) > 0
        : Boolean(legacyDelete && !legacyDelete.error && legacyDelete.data !== false);

      if (!deletedByRpc) {
        const childDelete = await supabase
          .from('community_comments')
          .delete()
          .eq('parent_id', comment.id)
          .select('id');

        if (childDelete.error) {
          throw new Error(combineErrors(hardDelete.error, legacyDelete?.error, childDelete.error) || ui.actionError);
        }

        const fallback = await supabase
          .from('community_comments')
          .delete()
          .eq('id', comment.id)
          .select('id');

        if (fallback.error || (fallback.data || []).length === 0) {
          throw new Error(
            combineErrors(hardDelete.error, legacyDelete?.error, fallback.error) ||
              'Không xoá được bình luận. Hãy chạy supabase/admin_comment_delete_fix.sql rồi refresh lại app.',
          );
        }
        await safeLog('delete_comment', 'community_comments', comment.id, comment.user_id, reason);
      }
      setNotice(ui.deleted);
      await loadDashboard();
    } catch (error) {
      console.error('Admin delete comment failed:', error);
      setComments(previousComments);
      setStats(previousStats);
      const detail = getErrorMessage(error);
      setNotice(detail ? `${ui.actionError} ${detail}` : ui.actionError);
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
      const detail = getErrorMessage(error);
      setNotice(detail ? `${ui.actionError} ${detail}` : ui.actionError);
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
      const detail = getErrorMessage(error);
      setNotice(detail ? `${ui.actionError} ${detail}` : ui.actionError);
    } finally {
      setBusyId(null);
    }
  }

  async function resolveReport(report: CommunityReport, nextStatus: 'resolved' | 'dismissed') {
    if (!supabase) return;
    setBusyId(`report-${report.id}`);
    try {
      const { error } = await supabase.rpc('admin_resolve_report', {
        report_id: report.id,
        next_status: nextStatus,
        admin_note_text: null,
      });
      if (error) {
        // Fallback: direct update (requires admin RLS UPDATE policy)
        const fallback = await supabase
          .from('community_reports')
          .update({ status: nextStatus, resolved_at: new Date().toISOString() })
          .eq('id', report.id);
        if (fallback.error) throw error;
      }
      setReports((prev) => prev.map((r) => r.id === report.id ? { ...r, status: nextStatus, resolved_at: new Date().toISOString() } : r));
      setStats((prev) => ({ ...prev, reports: Math.max(prev.reports - 1, 0) }));
      setNotice(nextStatus === 'resolved' ? ui.reportResolved : ui.reportDismissed);
      await safeLog(`report_${nextStatus}`, 'community_reports', report.id, report.target_user_id, null);
    } catch (error) {
      console.error('resolveReport failed:', error);
      setNotice(ui.actionError);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteReportedContent(report: CommunityReport) {
    if (!supabase) return;
    const { ok, reason } = await adminConfirm(
      isKo ? '신고된 콘텐츠를 삭제할까요?' : 'Xoá nội dung bị báo cáo?'
    );
    if (!ok) return;
    setBusyId(`report-${report.id}`);
    try {
      if (report.target_type === 'post' && report.target_id) {
        const rpcRes = await supabase.rpc('admin_delete_community_post', { row_id: report.target_id, reason_text: reason || 'Violated report' });
        if (rpcRes.error) {
          await supabase.from('community_posts').delete().eq('id', report.target_id);
        }
      } else if (report.target_type === 'comment' && report.target_id) {
        const rpcRes = await supabase.rpc('admin_delete_community_comment_hard', { row_id: report.target_id, reason_text: reason || 'Violated report' });
        if (rpcRes.error) {
          await supabase.from('community_comments').delete().eq('id', report.target_id);
        }
      } else if (report.target_type === 'review' && report.target_id) {
        await supabase.from('place_reviews').delete().eq('id', report.target_id);
      }
      // Mark report resolved
      await supabase.from('community_reports').update({ status: 'resolved', resolved_at: new Date().toISOString(), admin_note: reason || 'Content deleted' }).eq('id', report.id);
      setReports((prev) => prev.map((r) => r.id === report.id ? { ...r, status: 'resolved' } : r));
      setStats((prev) => ({ ...prev, reports: Math.max(prev.reports - 1, 0) }));
      setNotice(ui.deleted);
      await loadDashboard();
    } catch (error) {
      console.error('deleteReportedContent failed:', error);
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

  // Merge recent activity (posts + reviews + comments) for overview feed
  const activityFeed = useMemo(() => {
    const items = [
      ...posts.map(p => ({ type: 'post' as const, id: p.id, title: p.title, sub: p.display_name, badge: p.category, ts: p.created_at, raw: p })),
      ...reviews.map(r => ({ type: 'review' as const, id: r.id, title: r.place_name, sub: r.display_name, badge: r.category, ts: r.created_at, raw: r })),
      ...comments.map(c => ({ type: 'comment' as const, id: c.id, title: c.content, sub: c.display_name, badge: c.parent_id ? 'reply' : 'comment', ts: c.created_at, raw: c })),
    ];
    return items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 20);
  }, [posts, reviews, comments]);

  const contentCounts: Record<AdminContentView, number> = {
    posts: posts.length,
    reviews: reviews.length,
    comments: comments.length,
  };

  return (
    <section className="admin-screen">
      {/* ── Sidebar shell: hero + tab nav (becomes left sidebar on PC) ── */}
      <div className="admin-sidebar-shell">
        <header className="admin-hero">
          <div className="admin-hero-top">
            <button type="button" className="admin-back-btn" onClick={onBack}>
              <ArrowLeft size={16} />
              {ui.back}
            </button>
            <div className="admin-hero-actions">
              <span className="admin-live-pill"><ShieldCheck size={13} />{ui.online}</span>
              <button type="button" className="admin-refresh-btn" onClick={() => void loadDashboard()} disabled={loading}>
                {loading ? <Loader2 size={15} className="cm-spin" /> : <RefreshCw size={15} />}
              </button>
            </div>
          </div>
          <div className="admin-hero-body">
            <h1>{ui.title}</h1>
            <p>{ui.subtitle}</p>
          </div>

          {/* Metric chips */}
          <div className="admin-metric-strip">
            {([
              { icon: Users,         val: stats.users,           label: ui.stats.users,        color: '#60a5fa', onClick: () => openTab('users') },
              { icon: TrendingUp,    val: stats.newUsersWeek,    label: ui.stats.newUsersWeek, color: '#34d399', onClick: () => openTab('users') },
              { icon: Activity,      val: stats.activeUsersWeek, label: ui.stats.activeWeek,   color: '#06b6d4', onClick: () => openTab('users') },
              { icon: FileText,      val: stats.posts,           label: ui.stats.posts,        color: '#818cf8', onClick: () => { openTab('content'); setContentView('posts'); } },
              { icon: MessageCircle, val: stats.comments,        label: ui.stats.comments,     color: '#f59e0b', onClick: openCommentHistory },
              { icon: Star,          val: stats.reviews,         label: ui.stats.reviews,      color: '#a78bfa', onClick: () => { openTab('content'); setContentView('reviews'); } },
              { icon: AlertTriangle, val: stats.reports,         label: ui.stats.reports,      color: '#f87171', onClick: () => openTab('reports') },
            ] as { icon: typeof ShieldCheck; val: number; label: string; color: string; onClick: () => void }[]).map(({ icon: Ic, val, label, color, onClick: oc }) => (
              <button key={label} type="button" className={`admin-metric-chip${label === ui.stats.reports && val > 0 ? ' has-badge' : ''}`} style={{ '--chip-color': color } as React.CSSProperties} onClick={oc}>
                <Ic size={14} />
                <strong>{val.toLocaleString()}</strong>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </header>

        {/* Tab bar */}
        <nav className="admin-tabbar" aria-label="Admin sections">
          {ADMIN_TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeTab === id ? 'active' : ''}
              onClick={() => openTab(id)}
            >
              <Icon size={15} />
              <span>{ui.tabs[id]}</span>
            </button>
          ))}
        </nav>
      </div>{/* /admin-sidebar-shell */}

      {/* ── Main content area ── */}
      <main className="admin-main-content">
        {notice ? (
          <div className="admin-notice">
            <Bell size={15} />
            <span>{notice}</span>
          </div>
        ) : null}

      {activeTab === 'overview' ? (
        <>
          {/* ── Pending reports urgent banner ── */}
          {stats.reports > 0 ? (
            <button type="button" className="admin-reports-banner" onClick={() => openTab('reports')}>
              <AlertTriangle size={15} />
              <span>
                {isKo
                  ? <><strong>{stats.reports}건</strong>의 신고가 처리를 기다리고 있습니다.</>
                  : <>Có <strong>{stats.reports}</strong> báo cáo đang chờ xử lý</>}
              </span>
              <span className="admin-reports-banner-cta">
                {isKo ? '바로 처리 →' : 'Xử lý ngay →'}
              </span>
            </button>
          ) : null}

          <div className="admin-overview-grid">
            {/* ── KPI strip ── */}
            <div className="admin-kpi-strip">
              {([
                {
                  icon: Users,
                  label: ui.stats.users,
                  val: stats.users,
                  delta: `↑ ${stats.newUsersWeek} ${isKo ? '이번 주' : 'tuần này'}`,
                  color: '#2752ff',
                  bg: 'rgba(39,82,255,0.1)',
                  onClick: () => openTab('users'),
                },
                {
                  icon: FileText,
                  label: ui.stats.posts,
                  val: stats.posts,
                  delta: isKo ? '전체 게시글' : 'tổng bài viết',
                  color: '#10b981',
                  bg: 'rgba(16,185,129,0.1)',
                  onClick: () => { openTab('content'); setContentView('posts'); },
                },
                {
                  icon: MessageCircle,
                  label: ui.stats.comments,
                  val: stats.comments,
                  delta: isKo ? '미확인 댓글' : 'bình luận mới',
                  color: '#f59e0b',
                  bg: 'rgba(245,158,11,0.1)',
                  onClick: openCommentHistory,
                },
                {
                  icon: Activity,
                  label: isKo ? '오늘 방문' : 'Ghé thăm hôm nay',
                  val: visitStats?.sessions_today ?? 0,
                  delta: `${visitStats?.guests_today ?? 0} ${isKo ? '비회원' : 'khách vãng lai'}`,
                  color: '#06b6d4',
                  bg: 'rgba(6,182,212,0.1)',
                  onClick: undefined,
                },
                {
                  icon: AlertTriangle,
                  label: ui.stats.reports,
                  val: stats.reports,
                  delta: isKo ? '처리 대기' : 'chờ xử lý',
                  color: stats.reports > 0 ? '#ef4444' : '#94a3b8',
                  bg: stats.reports > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(148,163,184,0.1)',
                  onClick: () => openTab('reports'),
                  isAlert: stats.reports > 0,
                },
              ] as { icon: typeof ShieldCheck; label: string; val: number; delta: string; color: string; bg: string; onClick?: () => void; isAlert?: boolean }[]).map(
                ({ icon: Ic, label, val, delta, color, bg, onClick, isAlert }) => (
                  <div
                    key={label}
                    className={`admin-kpi-card${onClick ? ' clickable' : ''}${isAlert ? ' is-alert' : ''}`}
                    style={{ '--kpi-color': color, '--kpi-bg': bg } as React.CSSProperties}
                    onClick={onClick}
                    role={onClick ? 'button' : undefined}
                    tabIndex={onClick ? 0 : undefined}
                  >
                    <span className="admin-kpi-icon"><Ic size={15} /></span>
                    <strong className="admin-kpi-value">{val.toLocaleString()}</strong>
                    <span className="admin-kpi-label">{label}</span>
                    <span className={`admin-kpi-delta${isAlert && val > 0 ? ' is-alert' : val === 0 ? ' is-neutral' : ''}`}>
                      {delta}
                    </span>
                  </div>
                )
              )}
            </div>

            {/* ── Activity feed ── */}
            <ContentPanel title={isKo ? '최근 활동' : 'Hoạt động gần đây'} scroll>
              {activityFeed.length === 0 ? <EmptyText text={ui.empty} /> : activityFeed.map((item) => (
                <article key={`${item.type}-${item.id}`} className="admin-feed-row">
                  <span className={`admin-feed-dot admin-feed-dot--${item.type}`} />
                  <div className="admin-feed-body">
                    <div className="admin-feed-top">
                      <span className={`admin-feed-badge admin-feed-badge--${item.type}`}>{item.type}</span>
                      <span className="admin-feed-badge admin-feed-badge--cat">{item.badge}</span>
                      <span className="admin-feed-time">{timeAgo(item.ts)}</span>
                    </div>
                    <p className="admin-feed-title">{item.title.length > 60 ? item.title.slice(0, 60) + '…' : item.title}</p>
                    <span className="admin-feed-sub">{item.sub || ui.unknownUser}</span>
                  </div>
                  <button
                    type="button"
                    className="admin-feed-del"
                    disabled={busyId === `${item.type}-${item.id}`}
                    onClick={() => {
                      if (item.type === 'post')    void deletePost(item.raw as AdminPost);
                      if (item.type === 'review')  void deleteReview(item.raw as AdminReview);
                      if (item.type === 'comment') void deleteComment(item.raw as AdminComment);
                    }}
                  >
                    {busyId === `${item.type}-${item.id}` ? <Loader2 size={14} className="cm-spin" /> : <Trash2 size={14} />}
                  </button>
                </article>
              ))}
            </ContentPanel>

          {/* Visitor stats panel */}
          {visitStats ? (
            <section className="admin-visit-panel" aria-label={isKo ? '방문자 통계' : 'Lượt truy cập'}>
              <h2 className="admin-visit-title">
                <TrendingUp size={16} />
                {isKo ? '방문자 통계' : 'Lượt ghé thăm app'}
              </h2>

              {/* 3 time-range cards */}
              <div className="admin-visit-grid">
                {([
                  {
                    label: isKo ? '오늘' : 'Hôm nay',
                    total: visitStats.sessions_today,
                    guests: visitStats.guests_today,
                    users: visitStats.sessions_today - visitStats.guests_today,
                  },
                  {
                    label: isKo ? '7일' : '7 ngày',
                    total: visitStats.sessions_week,
                    guests: visitStats.guests_week,
                    users: visitStats.sessions_week - visitStats.guests_week,
                  },
                  {
                    label: isKo ? '30일' : '30 ngày',
                    total: visitStats.sessions_month,
                    guests: visitStats.guests_month,
                    users: visitStats.sessions_month - visitStats.guests_month,
                  },
                ]).map(({ label, total, guests, users }) => (
                  <div key={label} className="admin-visit-card">
                    <span className="admin-visit-period">{label}</span>
                    <strong className="admin-visit-total">{total.toLocaleString()}</strong>
                    <div className="admin-visit-breakdown">
                      <span className="admin-visit-guest">
                        {isKo ? '비회원' : 'Khách'} {guests}
                      </span>
                      <span className="admin-visit-member">
                        {isKo ? '회원' : 'Thành viên'} {users}
                      </span>
                    </div>
                    {/* Guest ratio bar */}
                    {total > 0 ? (
                      <div className="admin-visit-bar">
                        <div
                          className="admin-visit-bar-guest"
                          style={{ width: `${Math.round((guests / total) * 100)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* All-time summary */}
              <div className="admin-visit-alltime">
                <span>{isKo ? '누적 방문자' : 'Tổng lượt ghé thăm'}</span>
                <strong>{visitStats.total_sessions_ever.toLocaleString()}</strong>
                <span className="admin-visit-alltime-split">
                  ({isKo ? '비회원' : 'Khách'} {visitStats.total_guests_ever.toLocaleString()}
                  {' · '}
                  {isKo ? '회원' : 'TV'} {visitStats.total_users_ever.toLocaleString()})
                </span>
              </div>

              {/* Bar chart — 14 ngày gần nhất (luôn đủ 14 cột) */}
              <div className="admin-visit-chart" aria-label={isKo ? '14일 방문 추이' : 'Biểu đồ 14 ngày'}>
                {(() => {
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const maxVal = Math.max(...dailyVisits.map(d => d.total_sessions), 1);
                  return dailyVisits.map((d) => {
                    const heightPct = Math.max(Math.round((d.total_sessions / maxVal) * 100), d.total_sessions > 0 ? 6 : 0);
                    const guestPct  = d.total_sessions > 0
                      ? Math.round((d.guest_sessions / d.total_sessions) * 100)
                      : 0;
                    const dateObj   = new Date(d.day + 'T00:00:00');
                    const dayNum    = dateObj.getDate();
                    const monthNum  = dateObj.getMonth() + 1;
                    const isToday   = d.day === todayStr;
                    const titleStr  = isKo
                      ? `${monthNum}월 ${dayNum}일: ${d.total_sessions}회 (비회원 ${d.guest_sessions} · 회원 ${d.total_sessions - d.guest_sessions})`
                      : `${dayNum}/${monthNum}: ${d.total_sessions} lượt (Khách ${d.guest_sessions} · TV ${d.total_sessions - d.guest_sessions})`;
                    return (
                      <div
                        key={d.day}
                        className={`admin-visit-bar-col${isToday ? ' is-today' : ''}`}
                        title={titleStr}
                      >
                        <span className="admin-visit-bar-val">{d.total_sessions > 0 ? d.total_sessions : ''}</span>
                        <div className="admin-visit-bar-col-inner" style={{ height: `${heightPct}%` }}>
                          <div className="admin-visit-bar-col-guest" style={{ height: `${guestPct}%` }} />
                        </div>
                        <span className="admin-visit-bar-label">
                          {isToday ? (isKo ? '오늘' : 'HN') : dayNum}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Monthly breakdown */}
              {monthlyVisits.length > 0 ? (
                <div className="admin-monthly-stats">
                  <div className="admin-monthly-header">
                    <span>{isKo ? '월별 통계' : 'Thống kê theo tháng'}</span>
                  </div>
                  {(() => {
                    const todayMonth = new Date().toISOString().slice(0, 7);
                    const maxMonthTotal = Math.max(...monthlyVisits.map(m => m.total_sessions), 1);
                    return monthlyVisits.slice(0, 6).map(m => {
                      const [year, month] = m.month.split('-');
                      const label = isKo
                        ? `${year}년 ${parseInt(month)}월`
                        : `Th.${parseInt(month)}/${year}`;
                      const barPct = Math.round((m.total_sessions / maxMonthTotal) * 100);
                      const isCurrentMonth = m.month === todayMonth;
                      return (
                        <div key={m.month} className={`admin-monthly-row${isCurrentMonth ? ' is-current' : ''}`}>
                          <span className="admin-monthly-label">{label}</span>
                          <div className="admin-monthly-bar-track">
                            <div className="admin-monthly-bar-fill" style={{ width: `${barPct}%` }} />
                          </div>
                          <strong className="admin-monthly-val">{m.total_sessions.toLocaleString()}</strong>
                          <span className="admin-monthly-sub">
                            {isKo ? '비' : 'K'}&nbsp;{m.guest_sessions}&nbsp;·&nbsp;{isKo ? '회' : 'TV'}&nbsp;{m.user_sessions}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : null}

              <p className="admin-visit-hint">
                {isKo
                  ? '* 1시간마다 1회 기록 (기기 기준)'
                  : '* Ghi nhận tối đa 1 lần/giờ/thiết bị'}
              </p>
            </section>
          ) : null}
          </div>{/* /admin-overview-grid */}
        </>
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
                    <p>{[user.school, user.region].filter(Boolean).join(' · ') || user.id}</p>
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
          {contentFocus === 'comments' ? (
            <ContentPanel id="admin-comments-history" title={ui.commentsHistoryTitle} scroll>
              <HistoryToolbar count={comments.length} label={ui.stats.comments} backLabel={ui.backToContent} onBack={() => setContentFocus(null)} />
              {comments.map((comment) => (
                <ContentRow
                  key={comment.id}
                  title={comment.display_name || ui.unknownUser}
                  meta={`${timeAgo(comment.created_at)} · post ${comment.post_id.slice(0, 8)} · ${comment.likes_count || 0} likes`}
                  body={comment.content}
                  badge={comment.parent_id ? 'reply' : 'comment'}
                  actionLabel={ui.delete}
                  busy={busyId === `comment-${comment.id}`}
                  onAction={() => void deleteComment(comment)}
                />
              ))}
              {comments.length === 0 ? <EmptyText text={ui.empty} /> : null}
            </ContentPanel>
          ) : (
            <>
              <div className="admin-content-switch" role="tablist" aria-label={ui.contentTitle}>
                {([
                  { id: 'posts', label: ui.stats.posts },
                  { id: 'reviews', label: ui.stats.reviews },
                  { id: 'comments', label: ui.stats.comments },
                ] as { id: AdminContentView; label: string }[]).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={contentView === item.id ? 'active' : ''}
                    onClick={() => setContentView(item.id)}
                  >
                    <span>{item.label}</span>
                    <strong>{contentCounts[item.id].toLocaleString()}</strong>
                  </button>
                ))}
              </div>

              {contentView === 'posts' ? (
              <ContentPanel title={ui.contentTitle} scroll>
                {posts.map((post) => (
                  <ContentRow
                    key={post.id}
                    title={post.title}
                    meta={`${post.is_anonymous ? ui.unknownUser : (post.display_name || ui.unknownUser)} · ${timeAgo(post.created_at)} · ${post.comments_count || 0} comments`}
                    body={post.content}
                    badge={post.category}
                    images={post.image_urls}
                    onImageClick={(urls, idx) => setImgLightbox({ urls, idx })}
                    actionLabel={ui.delete}
                    busy={busyId === `post-${post.id}`}
                    onAction={() => void deletePost(post)}
                  />
                ))}
                {posts.length === 0 ? <EmptyText text={ui.empty} /> : null}
              </ContentPanel>
              ) : null}
              {contentView === 'reviews' ? (
              <ContentPanel title={ui.recentReviews} scroll>
                {reviews.map((review) => (
                  <ContentRow
                    key={review.id}
                    title={`${review.place_name} · ${Number(review.rating).toFixed(1)}`}
                    meta={`${review.display_name || ui.unknownUser} · ${timeAgo(review.created_at)} · ${review.upvotes_count || 0}/${review.downvotes_count || 0}`}
                    body={`${review.title} - ${review.content}`}
                    badge={review.category}
                    actionLabel={ui.delete}
                    busy={busyId === `review-${review.id}`}
                    onAction={() => void deleteReview(review)}
                  />
                ))}
                {reviews.length === 0 ? <EmptyText text={ui.empty} /> : null}
              </ContentPanel>
              ) : null}
              {contentView === 'comments' ? (
              <ContentPanel id="admin-comments-history" title={ui.commentsTitle} scroll>
                {comments.map((comment) => (
                  <ContentRow
                    key={comment.id}
                    title={comment.display_name || ui.unknownUser}
                    meta={`${timeAgo(comment.created_at)} · post ${comment.post_id.slice(0, 8)} · ${comment.likes_count || 0} likes`}
                    body={comment.content}
                    badge={comment.parent_id ? 'reply' : 'comment'}
                    actionLabel={ui.delete}
                    busy={busyId === `comment-${comment.id}`}
                    onAction={() => void deleteComment(comment)}
                  />
                ))}
                {comments.length === 0 ? <EmptyText text={ui.empty} /> : null}
              </ContentPanel>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {activeTab === 'reports' ? (
        <div className="admin-panel-stack">
          {/* Reports alert banner nếu có pending */}
          {stats.reports > 0 ? (
            <div className="admin-reports-alert">
              <AlertTriangle size={16} />
              <span>
                {isKo
                  ? `처리 대기 중인 신고 ${stats.reports}건이 있습니다.`
                  : `Có ${stats.reports} báo cáo đang chờ xử lý.`}
              </span>
            </div>
          ) : null}

          {/* Filter bar */}
          <div className="admin-content-switch" role="tablist">
            {([
              { id: 'pending',   label: ui.reportsPending },
              { id: 'resolved',  label: ui.reportsResolved },
              { id: 'dismissed', label: ui.reportsDismissed },
              { id: 'all',       label: ui.reportsAll },
            ] as { id: ReportFilter; label: string }[]).map((item) => (
              <button
                key={item.id}
                type="button"
                className={reportFilter === item.id ? 'active' : ''}
                onClick={() => setReportFilter(item.id)}
              >
                <span>{item.label}</span>
                <strong>
                  {item.id === 'all'
                    ? reports.length
                    : reports.filter(r => r.status === item.id).length}
                </strong>
              </button>
            ))}
          </div>

          <ContentPanel title={ui.reportsTitle} scroll>
            {reports
              .filter(r => reportFilter === 'all' || r.status === reportFilter)
              .map((report) => (
                <article key={report.id} className={`admin-report-row admin-report-row--${report.status}`}>
                  <div className="admin-report-header">
                    <span className={`admin-report-type admin-report-type--${report.target_type}`}>
                      {report.target_type}
                    </span>
                    <span className={`admin-report-status admin-report-status--${report.status}`}>
                      {report.status === 'pending'   ? (isKo ? '대기' : 'Chờ xử lý') :
                       report.status === 'resolved'  ? (isKo ? '완료' : 'Đã xử lý') :
                                                       (isKo ? '무시' : 'Bỏ qua')}
                    </span>
                    <time className="admin-report-time">{timeAgo(report.created_at)}</time>
                  </div>

                  <div className="admin-report-body">
                    {report.target_id ? (
                      <p className="admin-report-target">
                        <span>{ui.reportTarget}:</span>
                        <code>{report.target_id.slice(0, 12)}…</code>
                      </p>
                    ) : null}
                    {report.details ? (
                      <p className="admin-report-detail">
                        <span>{ui.reportDetail}:</span> {report.details}
                      </p>
                    ) : null}
                    {report.admin_note ? (
                      <p className="admin-report-note">Admin: {report.admin_note}</p>
                    ) : null}
                  </div>

                  {report.status === 'pending' ? (
                    <div className="admin-report-actions">
                      {(report.target_type === 'post' || report.target_type === 'comment' || report.target_type === 'review') && report.target_id ? (
                        <button
                          type="button"
                          className="admin-report-btn admin-report-btn--delete"
                          disabled={busyId === `report-${report.id}`}
                          onClick={() => void deleteReportedContent(report)}
                        >
                          {busyId === `report-${report.id}` ? <Loader2 size={13} className="cm-spin" /> : <Trash2 size={13} />}
                          {ui.deleteAndResolve}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="admin-report-btn admin-report-btn--resolve"
                        disabled={busyId === `report-${report.id}`}
                        onClick={() => void resolveReport(report, 'resolved')}
                      >
                        <CheckCircle2 size={13} />
                        {ui.resolveReport}
                      </button>
                      <button
                        type="button"
                        className="admin-report-btn admin-report-btn--dismiss"
                        disabled={busyId === `report-${report.id}`}
                        onClick={() => void resolveReport(report, 'dismissed')}
                      >
                        <ShieldOff size={13} />
                        {ui.dismissReport}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            {reports.filter(r => reportFilter === 'all' || r.status === reportFilter).length === 0 ? (
              <EmptyText text={ui.noReports} />
            ) : null}
          </ContentPanel>
        </div>
      ) : null}

      {activeTab === 'announcements' ? (
        <div className="admin-panel-stack">
          {announcementFocus === 'notifications' ? (
            <ContentPanel id="admin-notifications-history" title={ui.notificationsTitle} scroll>
              <HistoryToolbar count={notifications.length} label={ui.stats.notifications} backLabel={ui.backToAnnouncements} onBack={() => setAnnouncementFocus(null)} />
              {notifications.map((item) => (
                <NotificationRow key={item.id} item={item} lang={lang} />
              ))}
              {notifications.length === 0 ? <EmptyText text={ui.empty} /> : null}
            </ContentPanel>
          ) : (
            <>
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
                  <div className="admin-severity-group">
                    <span className="admin-severity-label">{ui.formSeverity}</span>
                    <div className="admin-severity-options">
                      {([
                        { val: 'info',    label: isKo ? '정보'  : 'Thông tin', color: '#2752ff' },
                        { val: 'success', label: isKo ? '성공'  : 'Thành công', color: '#16a34a' },
                        { val: 'warning', label: isKo ? '경고'  : 'Cảnh báo',  color: '#d97706' },
                        { val: 'danger',  label: isKo ? '위험'  : 'Khẩn cấp',  color: '#dc2626' },
                      ] as { val: AnnouncementSeverity; label: string; color: string }[]).map(({ val, label, color }) => (
                        <button
                          key={val}
                          type="button"
                          className={`admin-severity-btn admin-severity-btn--${val}${announcementSeverity === val ? ' active' : ''}`}
                          style={{ '--sev-color': color } as React.CSSProperties}
                          onClick={() => setAnnouncementSeverity(val)}
                        >
                          <span className="admin-severity-dot" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="submit" disabled={busyId === 'announcement' || !announcementTitle.trim() || !announcementBody.trim()}>
                    {busyId === 'announcement' ? <Loader2 size={16} className="cm-spin" /> : <Megaphone size={16} />}
                    {ui.publish}
                  </button>
                </form>

                <h3 className="admin-section-subtitle">{ui.sentAnnouncements}</h3>
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

              <ContentPanel id="admin-notifications-history" title={ui.notificationsTitle} scroll>
                {notifications.map((item) => (
                  <NotificationRow key={item.id} item={item} lang={lang} />
                ))}
                {notifications.length === 0 ? <EmptyText text={ui.empty} /> : null}
              </ContentPanel>
            </>
          )}
        </div>
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

      </main>{/* /admin-main-content */}

      {/* Image lightbox */}
      {imgLightbox ? (
        <div
          className="admin-lightbox-overlay"
          onClick={() => setImgLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="admin-lightbox-close"
            onClick={() => setImgLightbox(null)}
            aria-label="Đóng"
          >✕</button>
          {imgLightbox.idx > 0 && (
            <button
              type="button"
              className="admin-lightbox-nav admin-lightbox-prev"
              onClick={e => { e.stopPropagation(); setImgLightbox(s => s ? { ...s, idx: s.idx - 1 } : s); }}
            >‹</button>
          )}
          <img
            src={imgLightbox.urls[imgLightbox.idx]}
            alt=""
            className="admin-lightbox-img"
            onClick={e => e.stopPropagation()}
          />
          {imgLightbox.idx < imgLightbox.urls.length - 1 && (
            <button
              type="button"
              className="admin-lightbox-nav admin-lightbox-next"
              onClick={e => { e.stopPropagation(); setImgLightbox(s => s ? { ...s, idx: s.idx + 1 } : s); }}
            >›</button>
          )}
          <span className="admin-lightbox-counter">{imgLightbox.idx + 1} / {imgLightbox.urls.length}</span>
        </div>
      ) : null}

      {/* Styled delete confirm modal */}
      {confirmState ? (
        <div className="admin-confirm-overlay" onClick={() => confirmState.resolve(false, '')}>
          <div className="admin-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-confirm-icon">
              <Trash2 size={22} />
            </div>
            <h3>{confirmState.message}</h3>
            <p>{ui.reasonPrompt}</p>
            <input
              className="admin-confirm-input"
              placeholder={isKo ? '선택 사항' : 'Không bắt buộc'}
              value={confirmReason}
              onChange={e => setConfirmReason(e.target.value)}
              autoFocus
            />
            <div className="admin-confirm-btns">
              <button type="button" className="admin-confirm-cancel" onClick={() => confirmState.resolve(false, '')}>
                {isKo ? '취소' : 'Huỷ'}
              </button>
              <button type="button" className="admin-confirm-ok" onClick={() => confirmState.resolve(true, confirmReason)}>
                <Trash2 size={14} />
                {isKo ? '삭제' : 'Xoá'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof ShieldCheck;
  hint?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <Icon size={17} />
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="admin-stat-card clickable" onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <div className="admin-stat-card">
      {content}
    </div>
  );
}

function ContentPanel({ id, title, children, scroll = false }: { id?: string; title: string; children: React.ReactNode; scroll?: boolean }) {
  return (
    <section id={id} className={`admin-content-panel ${scroll ? 'is-scrollable' : ''}`}>
      <h2>{title}</h2>
      {scroll ? <div className="admin-panel-scroll">{children}</div> : children}
    </section>
  );
}

function HistoryToolbar({ count, label, backLabel, onBack }: { count: number; label: string; backLabel: string; onBack: () => void }) {
  return (
    <div className="admin-history-toolbar">
      <span>{`${count.toLocaleString()} ${label}`}</span>
      <button type="button" onClick={onBack}>
        <ArrowLeft size={14} />
        {backLabel}
      </button>
    </div>
  );
}

function NotificationRow({ item, lang }: { item: AdminNotification; lang: AppLang }) {
  const target = item.post_id ? `post ${item.post_id.slice(0, 8)}` : item.comment_id ? `comment ${item.comment_id.slice(0, 8)}` : '';
  const status = lang === 'ko' ? (item.is_read ? '읽음' : '안 읽음') : item.is_read ? 'đã đọc' : 'chưa đọc';

  return (
    <article className="admin-notification-row">
      <span className="admin-row-badge">{item.type || 'system'}</span>
      <h3>{item.title}</h3>
      <p>{shortText(item.body, 120)}</p>
      <small>{[localTime(item.created_at, lang), status, target].filter(Boolean).join(' · ')}</small>
    </article>
  );
}

function ContentRow({
  title,
  meta,
  body,
  badge,
  images,
  onImageClick,
  actionLabel,
  busy,
  onAction,
}: {
  title: string;
  meta: string;
  body: string;
  badge: string;
  images?: string[] | null;
  onImageClick?: (urls: string[], idx: number) => void;
  actionLabel: string;
  busy: boolean;
  onAction: () => void;
}) {
  const hasImages = images && images.length > 0;
  return (
    <article className="admin-content-row">
      <div className="admin-content-row-body">
        <div className="admin-content-row-text">
          <span className="admin-row-badge">{badge}</span>
          <h3>{title}</h3>
          <p>{shortText(body)}</p>
          <small>{meta}</small>
        </div>
        {hasImages && (
          <div className={`admin-post-thumbs admin-post-thumbs--${Math.min(images.length, 4)}`}>
            {images.slice(0, 4).map((url, i) => (
              <button
                key={i}
                type="button"
                className="admin-post-thumb-btn"
                onClick={() => onImageClick?.(images, i)}
              >
                <img
                  src={url}
                  alt=""
                  className="admin-post-thumb"
                  loading="lazy"
                  onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                />
                {i === 3 && images.length > 4 && (
                  <span className="admin-post-thumb-more">+{images.length - 4}</span>
                )}
              </button>
            ))}
          </div>
        )}
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
