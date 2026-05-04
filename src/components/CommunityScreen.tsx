import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  Bell,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  Flame,
  Loader2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Star,
  ThumbsDown,
  ThumbsUp,
  User,
  Users,
  X,
  MessageSquare,
  Navigation,
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import type { Session } from '@supabase/supabase-js';
import type { CompanionProfile } from '../lib/types';
import { supabase } from '../lib/supabase';
import { Logo } from './shared/Logo';
import { ChatView } from './ChatView';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CATEGORIES,
  type CommunityCategory,
  type CommunityComment,
  type CommunityNotification,
  type CommunityPost,
  timeAgo,
} from '../data/communityData';
import {
  createCommunityComment,
  createCommunityNotification,
  createCommunityPost,
  deleteCommunityPost,
  incrementPostView,
  loadCommunityState,
  toggleCommentLike as persistCommentLike,
  toggleCommunityBookmark,
  togglePostReaction,
  updateCommunityPost,
} from '../lib/communityStore';

type CommunityView = 'feed' | 'detail';
type CategoryFilter = CommunityCategory | 'all';
type FeedFilter = 'all' | 'mine' | 'saved';
type BoardMode = 'feed' | 'friends' | 'reviews';
type AppLang = 'vi' | 'ko';

const LOCAL_COMMUNITY_KEY = 'duhoc-mate-community-local';

const boardTabs: Array<{ id: BoardMode; icon: any }> = [
  { id: 'feed', icon: MessageSquare },
  { id: 'friends', icon: Users },
  { id: 'reviews', icon: Star },
];

type ReviewCategory = 'all' | 'work' | 'housing' | 'food' | 'service' | 'other';
type ReviewVoteType = 'up' | 'down';

const REVIEW_CATS: Record<Exclude<ReviewCategory, 'all'>, { label: string; color: string; bg: string }> = {
  work: { label: 'Việc làm', color: '#2563eb', bg: '#dbeafe' },
  housing: { label: 'Nhà ở', color: '#16a34a', bg: '#dcfce7' },
  food: { label: 'Ẩm thực', color: '#ea580c', bg: '#ffedd5' },
  service: { label: 'Dịch vụ', color: '#9333ea', bg: '#f3e8ff' },
  other: { label: 'Khác', color: '#64748b', bg: '#f1f5f9' },
};

interface PlaceReview {
  id: string;
  user_id: string;
  display_name: string;
  is_anonymous: boolean;
  place_name: string;
  place_address: string;
  place_lat: number | null;
  place_lng: number | null;
  category: string;
  title: string;
  content: string;
  rating: number;
  helpful_count: number;
  upvotes_count: number;
  downvotes_count: number;
  images: string[] | null;
  created_at: string;
}

interface PlaceReviewVote {
  review_id: string;
  user_id: string;
  vote_type: ReviewVoteType;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const SEOUL_CENTER: [number, number] = [37.5665, 126.978];

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ positions, totalCount }: { positions: [number, number][], totalCount: number }) {
  const map = useMap();
  const hasFitOnce = useRef(false);

  useEffect(() => {
    if (positions.length === 0 || hasFitOnce.current) return;
    if (positions.length === 1) {
      map.setView(positions[0], 15);
    } else {
      const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
    hasFitOnce.current = true;
  }, [map, totalCount]); // Only fit once based on total count
  return null;
}

type LocalCommunitySnapshot = {
  posts: CommunityPost[];
  comments: CommunityComment[];
  likedPostIds: string[];
  dislikedPostIds: string[];
  bookmarkedPostIds: string[];
  likedCommentIds: string[];
};

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function shortText(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length).trim()}...` : value;
}

const NEARBY_RADIUS_KM = 3;
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function validCoordinate(lat?: number | null, lng?: number | null) {
  return typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function isOnlineNow(lastSeenAt?: string | null, fallback?: boolean) {
  if (fallback) return true;
  if (!lastSeenAt) return false;
  const timestamp = new Date(lastSeenAt).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= ONLINE_WINDOW_MS;
}

function readLocalCommunity(): LocalCommunitySnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_COMMUNITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalCommunitySnapshot>;
    if (!Array.isArray(parsed.posts) || !Array.isArray(parsed.comments)) return null;
    return {
      posts: parsed.posts,
      comments: parsed.comments,
      likedPostIds: Array.isArray(parsed.likedPostIds) ? parsed.likedPostIds : [],
      dislikedPostIds: Array.isArray(parsed.dislikedPostIds) ? parsed.dislikedPostIds : [],
      bookmarkedPostIds: Array.isArray(parsed.bookmarkedPostIds) ? parsed.bookmarkedPostIds : [],
      likedCommentIds: Array.isArray(parsed.likedCommentIds) ? parsed.likedCommentIds : [],
    };
  } catch {
    return null;
  }
}

function writeLocalCommunity(snapshot: LocalCommunitySnapshot) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_COMMUNITY_KEY, JSON.stringify(snapshot));
}

export function CommunityScreen({
  companions,
  requested,
  onRequest,
  session,
  profile,
  onOpenNotifications,
  unreadCount,
  friendships,
  onNavigateToProfile,
  lang = 'vi',
}: {
  companions: CompanionProfile[];
  requested: string[];
  onRequest: (id: string) => void;
  session: Session | null;
  profile?: { displayName?: string; latitude?: number | null; longitude?: number | null };
  onOpenNotifications: () => void;
  unreadCount: number;
  friendships: any[];
  onNavigateToProfile: () => void;
  lang?: AppLang;
}) {
  const isKo = lang === 'ko';
  const ui = isKo ? {
    search: '검색',
    myPosts: '내 글',
    savedPosts: '저장한 글',
    notifications: '알림',
    searchPlaceholder: '게시글, 질문, 리뷰 검색...',
    communityArea: '커뮤니티 영역',
    tabs: { feed: '피드', friends: '친구', reviews: '리뷰' },
    writeReview: '리뷰 쓰기',
    writePost: '글쓰기',
    connect: '연결',
    nearbyFriends: '내 주변 친구',
    discovery: '찾아보기',
    all: '전체',
    unread: '안 읽음',
    noUnread: '읽지 않은 메시지가 없습니다',
    noNearby: `반경 ${NEARBY_RADIUS_KM}km 안에 친구가 없습니다`,
    enableLocation: '위치 권한을 켜면 반경 3km 안의 친구를 찾을 수 있어요',
    noChats: '대화가 없습니다',
    you: '나: ',
    online: '온라인',
    activeAgo: (value: string) => `${value} 활동`,
    noOnline: '온라인 정보 없음',
    accept: '수락',
    loadingPosts: '게시글을 불러오는 중...',
    emptyFeed: '필터를 바꾸거나 첫 글을 작성해보세요.',
    loginNeeded: '댓글, 좋아요, 내 글 공유 등 커뮤니티 기능을 사용하려면 로그인해주세요.',
    categories: { work: '아르바이트', life: '생활', study: '학업', visa: '비자/법률', food: '맛집', free: '자유' } as Record<CommunityCategory, string>,
  } : {
    search: 'Tìm kiếm',
    myPosts: 'Bài của tôi',
    savedPosts: 'Bài đã lưu',
    notifications: 'Thông báo',
    searchPlaceholder: 'Tìm bài viết, câu hỏi, review...',
    communityArea: 'Khu vực cộng đồng',
    tabs: { feed: 'Bảng tin', friends: 'Bạn bè', reviews: 'Review' },
    writeReview: 'Viết Review',
    writePost: 'Viết bài',
    connect: 'Kết nối',
    nearbyFriends: 'Bạn bè quanh bạn',
    discovery: 'Khám phá',
    all: 'Tất cả',
    unread: 'Chưa đọc',
    noUnread: 'Không có tin nhắn chưa đọc',
    noNearby: `Chưa có bạn nào trong bán kính ${NEARBY_RADIUS_KM}km`,
    enableLocation: 'Bật quyền vị trí để tìm bạn gần bạn trong bán kính 3km',
    noChats: 'Chưa có cuộc hội thoại nào',
    you: 'Bạn: ',
    online: 'Đang online',
    activeAgo: (value: string) => `Hoạt động ${value}`,
    noOnline: 'Chưa cập nhật online',
    accept: 'Chấp nhận',
    loadingPosts: 'Đang tải bài viết...',
    emptyFeed: 'Đổi bộ lọc hoặc viết bài đầu tiên cho chủ đề này.',
    loginNeeded: 'Bạn cần đăng nhập để thực hiện các tương tác như bình luận, thích bài viết hoặc chia sẻ bài đăng của riêng mình.',
    categories: { work: 'Việc làm thêm', life: 'Sinh hoạt', study: 'Học tập', visa: 'Visa & pháp lý', food: 'Ẩm thực', free: 'Tự do' } as Record<CommunityCategory, string>,
  };
  const [view, setView] = useState<CommunityView>('feed');
  const [boardMode, setBoardMode] = useState<BoardMode>('feed');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [isWritingPost, setIsWritingPost] = useState(false);
  const [isWritingReview, setIsWritingReview] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<CommunityCategory>('free');
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [dislikedPosts, setDislikedPosts] = useState<Set<string>>(new Set());
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncMessage, setSyncMessage] = useState('Đang làm mới');
  const [isLocalMode, setIsLocalMode] = useState(true);
  const [viewProfile, setViewProfile] = useState<CompanionProfile | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [activeChatPartner, setActiveChatPartner] = useState<CompanionProfile | null>(null);
  const [friendFilter, setFriendFilter] = useState<'discovery' | 'chats' | 'unread'>('discovery');
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const currentUserId = session?.user.id ?? '';
  const displayName = session ? (profile?.displayName?.trim() || session.user.email?.split('@')[0] || 'Du học sinh') : 'Du học sinh';

  const isFriend = useCallback((id: string) => {
    if (!currentUserId) return false;
    return friendships.some(f =>
      f.status === 'accepted' &&
      (
        (f.requester_id === currentUserId && f.target_profile_id === id) ||
        (f.requester_id === id && f.target_profile_id === currentUserId)
      )
    );
  }, [currentUserId, friendships]);

  const hasIncomingRequest = useCallback((id: string) => {
    return friendships.some(f =>
      f.requester_id === id &&
      f.target_profile_id === currentUserId &&
      f.status === 'pending'
    );
  }, [friendships, currentUserId]);

  const currentCoords = useMemo(() => {
    if (!validCoordinate(profile?.latitude, profile?.longitude)) return null;
    return { lat: profile!.latitude!, lng: profile!.longitude! };
  }, [profile?.latitude, profile?.longitude]);

  const companionsWithDistance = useMemo(() => {
    return companions.map((companion) => {
      const companionCoordsReady = validCoordinate(companion.latitude, companion.longitude);
      const computedDistance = currentCoords && companionCoordsReady
        ? distanceKm(currentCoords.lat, currentCoords.lng, companion.latitude!, companion.longitude!)
        : null;

      return {
        ...companion,
        distanceKm: computedDistance,
        isOnline: isOnlineNow(companion.lastSeenAt, companion.isOnline),
      };
    });
  }, [companions, currentCoords]);

  const nearbyCompanions = useMemo(() => {
    return companionsWithDistance
      .filter((companion) => typeof companion.distanceKm === 'number' && companion.distanceKm <= NEARBY_RADIUS_KM)
      .sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER);
      });
  }, [companionsWithDistance]);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    loadCommunityState(currentUserId || undefined)
      .then((state) => {
        if (!alive) return;
        const local = readLocalCommunity();
        const useLocalSnapshot = state.source !== 'supabase' && local && local.posts.length > 0;

        setPosts(useLocalSnapshot ? local.posts : state.posts);
        setComments(useLocalSnapshot ? local.comments : state.comments);
        setLikedPosts(new Set(useLocalSnapshot ? local.likedPostIds : state.likedPostIds));
        setDislikedPosts(new Set(useLocalSnapshot ? local.dislikedPostIds : state.dislikedPostIds));
        setBookmarkedPosts(new Set(useLocalSnapshot ? local.bookmarkedPostIds : state.bookmarkedPostIds));
        setLikedComments(new Set(useLocalSnapshot ? local.likedCommentIds : state.likedCommentIds));
        setNotifications(state.notifications);
        setIsLocalMode(state.source !== 'supabase');
        setSyncMessage(
          state.source === 'supabase'
            ? 'Đang trực tuyến'
            : currentUserId
              ? 'Chưa có dữ liệu Supabase'
              : 'Đăng nhập để đồng bộ bài viết'
        );
      })
      .catch((error) => {
        console.error(error);
        if (!alive) return;
        const local = readLocalCommunity();
        if (local) {
          setPosts(local.posts);
          setComments(local.comments);
          setLikedPosts(new Set(local.likedPostIds));
          setDislikedPosts(new Set(local.dislikedPostIds));
          setBookmarkedPosts(new Set(local.bookmarkedPostIds));
          setLikedComments(new Set(local.likedCommentIds));
        }
        setSyncMessage('Không tải được, đang lưu tạm trên máy');
        setIsLocalMode(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [currentUserId]);

  // Realtime subscription for posts and comments
  useEffect(() => {
    if (!supabase) {
      console.warn('Supabase client not available for Realtime');
      return;
    }

    console.log('Setting up Realtime subscriptions...');

    const postsChannel = supabase
      .channel('community-posts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_posts' },
        (payload) => {
          console.log('Realtime POST change:', payload);
          if (payload.eventType === 'INSERT') {
            const row = payload.new as any;
            const newPost: CommunityPost = {
              id: row.id,
              user_id: row.user_id ?? '',
              category: (row.category ?? 'free') as CommunityCategory,
              title: row.title ?? '',
              content: row.content ?? '',
              is_anonymous: row.is_anonymous ?? true,
              display_name: row.display_name ?? 'Ẩn danh',
              likes_count: Number(row.likes_count ?? 0),
              dislikes_count: Number(row.dislikes_count ?? 0),
              comments_count: Number(row.comments_count ?? 0),
              views_count: Number(row.views_count ?? 0),
              created_at: row.created_at ?? new Date().toISOString(),
            };
            setPosts((prev) => {
              if (prev.some(p => p.id === newPost.id)) return prev;
              return [newPost, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as any;
            setPosts((prev) => prev.map(p => p.id === row.id ? {
              ...p,
              category: (row.category ?? p.category) as CommunityCategory,
              title: row.title ?? p.title,
              content: row.content ?? p.content,
              likes_count: Number(row.likes_count ?? p.likes_count),
              dislikes_count: Number(row.dislikes_count ?? p.dislikes_count),
              comments_count: Number(row.comments_count ?? p.comments_count),
              views_count: Number(row.views_count ?? p.views_count),
            } : p));
          } else if (payload.eventType === 'DELETE') {
            setPosts((prev) => prev.filter(p => p.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Posts Realtime Status:', status);
      });

    const commentsChannel = supabase
      .channel('community-comments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_comments' },
        (payload) => {
          console.log('Realtime COMMENT change:', payload);
          if (payload.eventType === 'INSERT') {
            const row = payload.new as any;
            const newComment: CommunityComment = {
              id: row.id,
              post_id: row.post_id,
              parent_id: row.parent_id ?? null,
              user_id: row.user_id ?? row.author_id ?? '',
              content: row.content ?? '',
              is_anonymous: row.is_anonymous ?? true,
              display_name: row.display_name ?? 'Ẩn danh',
              is_author: row.is_author ?? false,
              likes_count: Number(row.likes_count ?? 0),
              created_at: row.created_at ?? new Date().toISOString(),
            };
            setComments((prev) => {
              if (prev.some(c => c.id === newComment.id)) return prev;
              return [...prev, newComment];
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as any;
            setComments((prev) => prev.map(c => c.id === row.id ? {
              ...c,
              content: row.content ?? c.content,
              likes_count: Number(row.likes_count ?? c.likes_count),
            } : c));
          } else if (payload.eventType === 'DELETE') {
            setComments((prev) => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Comments Realtime Status:', status);
      });

    return () => {
      supabase?.removeChannel(postsChannel);
      supabase?.removeChannel(commentsChannel);
    };
  }, []);

  const fetchRecentChats = useCallback(async () => {
    if (!supabase || !currentUserId) return;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('sender_id, receiver_id, created_at, content, is_read')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const chatsMap = new Map<string, any>();
      data.forEach((msg) => {
        const partnerId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
        if (!chatsMap.has(partnerId)) {
          chatsMap.set(partnerId, {
            partnerId,
            lastMessage: msg.content,
            lastMessageAt: msg.created_at,
            unreadCount: 0,
            isMe: msg.sender_id === currentUserId
          });
        }
        if (!msg.is_read && msg.receiver_id === currentUserId) {
          const current = chatsMap.get(partnerId);
          current.unreadCount += 1;
        }
      });
      setRecentChats(Array.from(chatsMap.values()));
    }
  }, [currentUserId]);

  useEffect(() => {
    if (boardMode === 'friends') {
      fetchRecentChats();
    }
  }, [boardMode, fetchRecentChats]);

  useEffect(() => {
    if (!supabase || !currentUserId) return;

    const channel = supabase
      .channel(`chat-list:${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, (payload) => {
        const row = ((payload as any).new ?? (payload as any).old) as any;
        if (row?.sender_id === currentUserId || row?.receiver_id === currentUserId) {
          void fetchRecentChats();
        }
      })
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [currentUserId, fetchRecentChats]);

  const requireLogin = useCallback(() => {
    if (!session) {
      setShowLoginPrompt(true);
      return false;
    }
    return true;
  }, [session]);

  useEffect(() => {
    if (loading || !isLocalMode) return;
    writeLocalCommunity({
      posts,
      comments,
      likedPostIds: [...likedPosts],
      dislikedPostIds: [...dislikedPosts],
      bookmarkedPostIds: [...bookmarkedPosts],
      likedCommentIds: [...likedComments],
    });
  }, [bookmarkedPosts, comments, dislikedPosts, isLocalMode, likedComments, likedPosts, loading, posts]);

  useEffect(() => {
    const handlePopState = () => {
      if (isWritingPost || isWritingReview) {
        setIsWritingPost(false);
        setIsWritingReview(false);
        return;
      }


      if (view === 'detail') {
        goBack();
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isWritingPost, isWritingReview, view]);


  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (activeCategory !== 'all' && post.category !== activeCategory) return false;
      if (feedFilter === 'mine' && post.user_id !== currentUserId) return false;
      if (feedFilter === 'saved' && !bookmarkedPosts.has(post.id)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return post.title.toLowerCase().includes(q) || post.content.toLowerCase().includes(q);
      }

      return true;
    });
  }, [activeCategory, bookmarkedPosts, currentUserId, feedFilter, posts, searchQuery]);

  const postCommentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    comments.forEach(c => {
      counts[c.post_id] = (counts[c.post_id] || 0) + 1;
    });
    return counts;
  }, [comments]);

  const hotPosts = useMemo(
    () => [...posts].sort((a, b) => {
      const aCount = postCommentCounts[a.id] || 0;
      const bCount = postCommentCounts[b.id] || 0;
      return (b.likes_count + bCount) - (a.likes_count + aCount);
    }).slice(0, 2),
    [posts, postCommentCounts]
  );
  const trendingPost = useMemo(
    () => [...posts].sort((a, b) => {
      const aCount = postCommentCounts[a.id] || 0;
      const bCount = postCommentCounts[b.id] || 0;
      return (bCount + b.views_count) - (aCount + a.views_count);
    })[0],
    [posts, postCommentCounts]
  );
  const postComments = selectedPost ? comments.filter((comment) => comment.post_id === selectedPost.id) : [];
  const rootComments = postComments.filter((comment) => !comment.parent_id);

  function updatePost(postId: string, updater: (post: CommunityPost) => CommunityPost) {
    setPosts((current) => current.map((post) => (post.id === postId ? updater(post) : post)));
    setSelectedPost((current) => (current?.id === postId ? updater(current) : current));
  }

  function closeComposer() {
    setIsWritingPost(false);
    setIsWritingReview(false);
    setEditingPostId(null);

    setNewTitle('');
    setNewContent('');
    setNewCategory('free');
    setIsAnonymous(true);
  }

  function openComposer() {
    if (!requireLogin()) return;
    setIsWritingPost(true);
    setEditingPostId(null);
  }



  function openPost(post: CommunityPost) {
    const nextPost = { ...post, views_count: post.views_count + 1 };
    updatePost(post.id, () => nextPost);
    setSelectedPost(nextPost);
    setView('detail');
    setReplyTo(null);
    history.pushState({ communityView: 'detail' }, '');

    if (isUuid(post.id)) {
      void incrementPostView(post.id).catch((error) => console.error(error));
    }
  }

  function goBack() {
    setView('feed');
    setSelectedPost(null);
    setReplyTo(null);
  }

  async function handleConfirmDelete() {
    const postId = showDeleteConfirm;
    if (!postId) return;
    setShowDeleteConfirm(null);

    const shouldPersist = Boolean(currentUserId && isUuid(postId));
    if (shouldPersist) {
      try {
        await deleteCommunityPost(postId);
      } catch (error) {
        console.error(error);
        setSyncMessage('Chưa xóa được trên Supabase. Vui lòng thử lại.');
        return;
      }
    }

    setPosts((current) => current.filter((post) => post.id !== postId));
    setComments((current) => current.filter((comment) => comment.post_id !== postId));
    if (view === 'detail') goBack();
  }

  async function handlePostReaction(postId: string, reaction: 'like' | 'dislike') {
    if (!requireLogin()) return;
    const hadLike = likedPosts.has(postId);
    const hadDislike = dislikedPosts.has(postId);
    const nextLikes = new Set(likedPosts);
    const nextDislikes = new Set(dislikedPosts);
    let likeDelta = 0;
    let dislikeDelta = 0;

    if (reaction === 'like') {
      if (hadLike) {
        nextLikes.delete(postId);
        likeDelta = -1;
      } else {
        nextLikes.add(postId);
        likeDelta = 1;
        if (hadDislike) {
          nextDislikes.delete(postId);
          dislikeDelta = -1;
        }
      }
    } else if (hadDislike) {
      nextDislikes.delete(postId);
      dislikeDelta = -1;
    } else {
      nextDislikes.add(postId);
      dislikeDelta = 1;
      if (hadLike) {
        nextLikes.delete(postId);
        likeDelta = -1;
      }
    }

    setLikedPosts(nextLikes);
    setDislikedPosts(nextDislikes);
    updatePost(postId, (post) => ({
      ...post,
      likes_count: Math.max(post.likes_count + likeDelta, 0),
      dislikes_count: Math.max(post.dislikes_count + dislikeDelta, 0),
    }));

    if (!currentUserId || !isUuid(postId)) {
      setSyncMessage('Tương tác đang lưu tạm trên máy');
      return;
    }

    try {
      await togglePostReaction(currentUserId, postId, reaction);
      const targetPost = posts.find((post) => post.id === postId);
      if (reaction === 'like' && !hadLike && targetPost?.user_id && targetPost.user_id !== currentUserId) {
        await createCommunityNotification({
          recipientId: targetPost.user_id,
          actorId: currentUserId,
          postId,
          type: 'like',
          title: 'Có lượt thích mới',
          body: `${isAnonymous ? 'Ẩn danh' : displayName} đã thích "${targetPost.title}".`,
        });
      }
      setSyncMessage('Đã lưu tương tác vào Supabase');
    } catch (error) {
      console.error(error);
      setSyncMessage('Chưa lưu được tương tác. Kiểm tra kết nối Supabase.');
    }
  }

  async function handleBookmark(postId: string) {
    if (!requireLogin()) return;
    const next = new Set(bookmarkedPosts);
    const wasSaved = next.has(postId);
    if (wasSaved) next.delete(postId);
    else next.add(postId);
    setBookmarkedPosts(next);

    if (!currentUserId || !isUuid(postId)) {
      setSyncMessage('Bài lưu đang được giữ tạm trên máy');
      return;
    }

    try {
      await toggleCommunityBookmark(currentUserId, postId);
      setSyncMessage(wasSaved ? 'Đã bỏ lưu bài viết' : 'Đã lưu bài viết vào Supabase');
    } catch (error) {
      console.error(error);
      setSyncMessage('Chưa lưu được bookmark. Vui lòng thử lại.');
    }
  }

  async function handleCommentLike(commentId: string) {
    if (!requireLogin()) return;
    const next = new Set(likedComments);
    const hadLiked = next.has(commentId);
    if (hadLiked) next.delete(commentId);
    else next.add(commentId);

    setLikedComments(next);
    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId ? { ...comment, likes_count: Math.max(comment.likes_count + (hadLiked ? -1 : 1), 0) } : comment
      )
    );

    if (!currentUserId || !isUuid(commentId)) return;

    try {
      await persistCommentLike(currentUserId, commentId);
    } catch (error) {
      console.error(error);
      setSyncMessage('Chưa lưu được like bình luận.');
    }
  }

  async function addComment() {
    if (!requireLogin()) return;
    if (!newComment.trim() || !selectedPost) return;

    const commentDisplayName = isAnonymous ? 'Ẩn danh' : displayName;
    const baseComment: CommunityComment = {
      id: crypto.randomUUID(),
      post_id: selectedPost.id,
      parent_id: replyTo,
      user_id: currentUserId || 'local-user',
      content: newComment.trim(),
      is_anonymous: isAnonymous,
      display_name: commentDisplayName,
      is_author: selectedPost.user_id === currentUserId,
      likes_count: 0,
      created_at: new Date().toISOString(),
    };

    const canPersist = Boolean(currentUserId && isUuid(selectedPost.id));
    let savedComment = baseComment;

    if (canPersist) {
      try {
        savedComment = await createCommunityComment({
          postId: selectedPost.id,
          parentId: replyTo,
          userId: currentUserId,
          content: baseComment.content,
          isAnonymous,
          displayName: commentDisplayName,
          isAuthor: selectedPost.user_id === currentUserId,
          recipientId: selectedPost.user_id,
          postTitle: selectedPost.title,
        });
        setSyncMessage('Đã lưu bình luận');
      } catch (error) {
        console.error(error);
        setSyncMessage('Chưa gửi được bình luận. Đang giữ tạm trên máy.');
      }
    } else {
      setSyncMessage('Bình luận đang lưu tạm. Đăng nhập để đồng bộ dữ liệu.');
    }

    setComments((current) => [...current, savedComment]);
    updatePost(selectedPost.id, (post) => ({ ...post, comments_count: post.comments_count + 1 }));
    setNewComment('');
    setReplyTo(null);
  }

  async function addPost() {
    if (!requireLogin()) return;
    if (!newTitle.trim() || !newContent.trim()) return;

    const postDisplayName = isAnonymous ? 'Ẩn danh' : displayName;
    const draft = {
      category: newCategory,
      title: newTitle.trim(),
      content: newContent.trim(),
      isAnonymous,
      displayName: postDisplayName,
    };

    if (editingPostId) {
      const nextPost = (post: CommunityPost): CommunityPost => ({
        ...post,
        category: draft.category,
        title: draft.title,
        content: draft.content,
        is_anonymous: draft.isAnonymous,
        display_name: draft.displayName,
      });

      if (currentUserId && isUuid(editingPostId)) {
        try {
          const saved = await updateCommunityPost(editingPostId, draft);
          updatePost(editingPostId, () => saved);
          setSyncMessage('Đã cập nhật bài viết ');
        } catch (error) {
          console.error(error);
          updatePost(editingPostId, nextPost);
          setSyncMessage('Chưa cập nhật được , đang giữ bản sửa tạm.');
        }
      } else {
        updatePost(editingPostId, nextPost);
        setSyncMessage('Bản sửa đang lưu tạm trên máy');
      }
    } else if (currentUserId) {
      try {
        const saved = await createCommunityPost({ ...draft, userId: currentUserId });
        setPosts((current) => [saved, ...current]);
        setIsLocalMode(false);
        setSyncMessage('Bài viết đã được lưu');
      } catch (error) {
        console.error(error);
        const localPost = makeLocalPost(draft);
        setPosts((current) => [localPost, ...current]);
        setIsLocalMode(true);
        setSyncMessage('Chưa lưu được dữ liệu, bài viết đang lưu tạm trên máy.');
      }
    } else {
      const localPost = makeLocalPost(draft);
      setPosts((current) => [localPost, ...current]);
      setSyncMessage('Bài viết đang lưu tạm. Đăng nhập để đồng bộ Supabasedữ liệu.');
    }

    setIsWritingPost(false);
    setIsWritingReview(false);
    setEditingPostId(null);
  }

  function makeLocalPost(draft: Omit<Parameters<typeof createCommunityPost>[0], 'userId'>): CommunityPost {
    return {
      id: crypto.randomUUID(),
      user_id: currentUserId || 'local-user',
      category: draft.category,
      title: draft.title,
      content: draft.content,
      is_anonymous: draft.isAnonymous,
      display_name: draft.displayName,
      likes_count: 0,
      dislikes_count: 0,
      comments_count: 0,
      views_count: 0,
      created_at: new Date().toISOString(),
    };
  }


  function startEditing(post: CommunityPost) {
    setEditingPostId(post.id);
    setNewTitle(post.title);
    setNewContent(post.content);
    setNewCategory(post.category);
    setIsAnonymous(post.is_anonymous);
    openComposer();
  }

  function getReplies(parentId: string) {
    return postComments.filter((comment) => comment.parent_id === parentId);
  }

  function renderBoardBody() {
    if (boardMode === 'friends') {
      const displayList = friendFilter === 'discovery'
        ? nearbyCompanions
        : recentChats
          .filter(c => friendFilter === 'chats' || (friendFilter === 'unread' && c.unreadCount > 0))
          .map(c => {
            const profile = companionsWithDistance.find(p => p.id === c.partnerId);
            return profile ? { ...profile, lastMessage: c.lastMessage, unreadCount: c.unreadCount, isMe: c.isMe } : null;
          })
          .filter(Boolean) as (CompanionProfile & { lastMessage: string, unreadCount: number, isMe: boolean })[];
      const emptyMessage = friendFilter === 'unread'
        ? ui.noUnread
        : friendFilter === 'discovery'
          ? currentCoords
            ? ui.noNearby
            : ui.enableLocation
          : ui.noChats;

      return (
        <section className="cm-service-panel">
          <div className="cm-service-head">
            <div>
              <p>{ui.connect}</p>
              <h2>{ui.nearbyFriends}</h2>
            </div>
            <Users size={22} />
          </div>

          <div className="rv-cat-chips" style={{ padding: '0 20px 15px', borderBottom: 'none', gap: '8px' }}>
            <button
              type="button"
              className={`rv-cat-chip ${friendFilter === 'discovery' ? 'active' : ''}`}
              onClick={() => setFriendFilter('discovery')}
              style={{ fontSize: '13px', padding: '6px 14px' }}
            >
              {ui.discovery}
            </button>
            <button
              type="button"
              className={`rv-cat-chip ${friendFilter === 'chats' ? 'active' : ''}`}
              onClick={() => setFriendFilter('chats')}
              style={{ fontSize: '13px', padding: '6px 14px' }}
            >
              {ui.all}
            </button>
            <button
              type="button"
              className={`rv-cat-chip ${friendFilter === 'unread' ? 'active' : ''}`}
              onClick={() => setFriendFilter('unread')}
              style={{ fontSize: '13px', padding: '6px 14px', position: 'relative' }}
            >
              {ui.unread}
              {recentChats.some(c => c.unreadCount > 0) && (
                <span style={{
                  position: 'absolute', top: -2, right: -2, width: 8, height: 8,
                  background: '#ff4b4b', borderRadius: '50%', border: '2px solid white'
                }} />
              )}
            </button>
          </div>
          <div className="community-friend-list">
            {displayList.length === 0 ? (
              <div className="rv-empty" style={{ padding: '40px 20px' }}>
                <Users size={40} style={{ opacity: 0.3 }} />
                <p style={{ marginTop: 12, color: 'var(--text-soft)' }}>
                  {emptyMessage}
                </p>
              </div>
            ) : displayList.map((friend) => {
              const nameParts = friend.displayName.trim().split(' ');
              const avatarLetter = (nameParts[nameParts.length - 1] || 'U').slice(0, 1).toUpperCase();
              const displayStr = friend.displayName;
              const chatData = friendFilter !== 'discovery' ? (friend as any) : null;
              const rawDistance = (friend as any).distanceKm;
              const friendDistance = typeof rawDistance === 'number' ? rawDistance : null;
              const friendOnline = Boolean((friend as any).isOnline);

              return (
                <article key={friend.id} className="community-friend-row">
                  <div className="community-avatar" onClick={() => setViewProfile(friend)} style={{ cursor: 'pointer' }}>
                    {avatarLetter}
                  </div>
                  <div className="community-friend-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong onClick={() => setViewProfile(friend)} style={{ cursor: 'pointer' }}>
                        {displayStr}
                      </strong>
                      {chatData?.unreadCount > 0 && (
                        <span style={{
                          background: '#2752ff', color: 'white', fontSize: '10px',
                          padding: '1px 6px', borderRadius: '10px', fontWeight: 'bold'
                        }}>
                          {chatData.unreadCount}
                        </span>
                      )}
                    </div>

                    {chatData ? (
                      <p style={{
                        color: chatData.unreadCount > 0 ? 'var(--text-main)' : 'var(--text-soft)',
                        fontWeight: chatData.unreadCount > 0 ? '600' : '400',
                        fontSize: '13px',
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '200px'
                      }}>
                        {chatData.isMe ? ui.you : ''}{chatData.lastMessage}
                      </p>
                    ) : (
                      <>
                        <div className="community-nearby-meta">
                          <span className={`community-presence-dot ${friendOnline ? 'online' : ''}`} />
                          <span>{friendOnline ? ui.online : friend.lastSeenAt ? ui.activeAgo(timeAgo(friend.lastSeenAt)) : ui.noOnline}</span>
                          {friendDistance != null ? <span>• {formatDistance(friendDistance)}</span> : null}
                        </div>
                        <span>{friend.school} • {friend.region}</span>
                        <p>{friend.focus}</p>
                        <div className="community-chip-row">
                          {friend.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {!isFriend(friend.id) ? (
                      <button
                        type="button"
                        className={`community-request ${requested.includes(friend.id) ? 'sent' : ''} ${hasIncomingRequest(friend.id) ? 'incoming' : ''}`}
                        onClick={() => {
                          if (requireLogin()) onRequest(friend.id);
                        }}
                        disabled={requested.includes(friend.id) && !hasIncomingRequest(friend.id)}
                        style={hasIncomingRequest(friend.id) ? { width: 'auto', minWidth: '85px', padding: '0 12px', background: '#4CAF50', color: 'white', whiteSpace: 'nowrap' } : {}}
                      >
                        {hasIncomingRequest(friend.id) ? (
                          <span style={{ fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{ui.accept}</span>
                        ) : requested.includes(friend.id) ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <Plus size={18} />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="community-request"
                        style={{ background: '#2752ff', color: 'white' }}
                        onClick={() => {
                          if (requireLogin()) setActiveChatPartner(friend);
                        }}
                      >
                        <MessageSquare size={18} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      );
    }

    if (boardMode === 'reviews') {
      return (
        <ReviewBoard
          session={session}
          displayName={displayName}
          isWriting={isWritingReview}
          setIsWriting={setIsWritingReview}
          lang={lang}
        />
      );
    }

    return (
      <>
        {trendingPost ? (
          <section className="cm-trending" onClick={() => openPost(trendingPost)}>
            <div className="cm-trending-head">
              <div>
                <p className="cm-trending-kicker">{isKo ? '인기' : 'Đang hot'}</p>
                <h2 className="cm-trending-title">{isKo ? '인기 게시글' : 'Bài đang nổi'}</h2>
              </div>
              <Flame size={24} color="#64748b" />
            </div>
            <span
              className="cm-cat-badge"
              style={{ color: CATEGORIES[trendingPost.category].color, background: CATEGORIES[trendingPost.category].bg }}
            >
              {ui.categories[trendingPost.category]}
            </span>
            <h3 className="cm-trending-post-title">{trendingPost.title}</h3>
            <p className="cm-trending-preview">{shortText(trendingPost.content, 110)}</p>
            <div className="cm-trending-footer">
              <span className="cm-time">
                <strong>{trendingPost.display_name}</strong> • {timeAgo(trendingPost.created_at)}
              </span>
              <div className="cm-post-stats">
                <span><ThumbsUp size={14} /> {trendingPost.likes_count}</span>
                <span><MessageCircle size={14} /> {postCommentCounts[trendingPost.id] || 0}</span>
              </div>
            </div>
          </section>
        ) : null}

        <div className="cm-category-tabs">
          <button
            type="button"
            className={activeCategory === 'all' ? 'active' : ''}
            onClick={() => setActiveCategory('all')}
          >
            {ui.all}
          </button>
          {(Object.keys(CATEGORIES) as CommunityCategory[]).map((category) => (
            <button
              key={category}
              type="button"
              className={activeCategory === category ? 'active' : ''}
              onClick={() => setActiveCategory(category)}
            >
              {ui.categories[category]}
            </button>
          ))}
        </div>

        <div className="cm-post-list">
          {loading ? (
            <div className="cm-empty-state">
              <Loader2 size={26} className="cm-spin" />
                <p>{ui.loadingPosts}</p>
            </div>
          ) : filteredPosts.length ? (
            filteredPosts.map((post) => (
              <article key={post.id} className="cm-post-card" onClick={() => openPost(post)}>
                <span
                  className="cm-cat-badge"
                  style={{ color: CATEGORIES[post.category].color, background: CATEGORIES[post.category].bg }}
                >
                  {ui.categories[post.category]}
                </span>
                <h3 className="cm-post-title">{post.title}</h3>
                <p className="cm-post-preview">{shortText(post.content, 90)}</p>
                <div className="cm-post-footer">
                  <span className="cm-time">
                    <strong>{post.display_name}</strong> • {timeAgo(post.created_at)}
                  </span>
                  <div className="cm-post-stats">
                    <span><ThumbsUp size={14} /> {post.likes_count}</span>
                    <span><MessageCircle size={14} /> {postCommentCounts[post.id] || 0}</span>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="cm-empty-state">
              <MessageCircle size={30} />
              <strong>{isKo ? '조건에 맞는 글이 없습니다' : 'Chưa có bài phù hợp'}</strong>
              <p>{ui.emptyFeed}</p>
            </div>
          )}
        </div>
      </>
    );
  }

  if (view === 'feed') {
    return (
      <>
        <header className="cm-header">
          {!showSearch ? (
            <>
              <Logo />
              <div className="cm-header-actions">
                <button type="button" className="cm-icon-btn" onClick={() => setShowSearch(true)} aria-label={ui.search}>
                  <Search size={20} />
                </button>
                <button
                  type="button"
                  className={`cm-icon-btn ${feedFilter === 'mine' ? 'active' : ''}`}
                  aria-label={ui.myPosts}
                  onClick={() => setFeedFilter(feedFilter === 'mine' ? 'all' : 'mine')}
                >
                  <PenLine size={19} />
                </button>
                <button
                  type="button"
                  className={`cm-icon-btn ${feedFilter === 'saved' ? 'active' : ''}`}
                  aria-label={ui.savedPosts}
                  onClick={() => setFeedFilter(feedFilter === 'saved' ? 'all' : 'saved')}
                >
                  <BookmarkCheck size={19} />
                </button>
                <button type="button" className="cm-icon-btn" aria-label={ui.notifications} onClick={onOpenNotifications}>
                  <Bell size={22} color="#64748b" />
                  {unreadCount > 0 ? <span className="cm-notification-badge">{unreadCount}</span> : null}
                </button>
              </div>
            </>
          ) : (
            <div className="cm-search-bar">
              <Search size={18} className="cm-search-icon" />
              <input
                autoFocus
                type="text"
                className="cm-search-input"
                placeholder={ui.searchPlaceholder}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onBlur={() => {
                  if (!searchQuery) setShowSearch(false);
                }}
              />
              <button
                type="button"
                className="cm-search-close"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
              >
                <X size={18} />
              </button>
            </div>
          )}
        </header>

        <div className="cm-sync-strip">
          <span className={isLocalMode ? 'local' : 'live'} />
          {syncMessage}
        </div>

        <div className="cm-board-tabs" role="tablist" aria-label={ui.communityArea}>
          {boardTabs.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={boardMode === id}
              className={boardMode === id ? 'active' : ''}
              onClick={() => setBoardMode(id)}
            >
              <Icon size={15} />
              {ui.tabs[id]}
            </button>
          ))}
        </div>

        {renderBoardBody()}

        <div className="cm-write-bar">
          <button
            type="button"
            className="cm-write-bar-btn"
            onClick={boardMode === 'reviews' ? () => { if (requireLogin()) setIsWritingReview(true); } : openComposer}
          >
            <Plus size={18} />
            {boardMode === 'reviews' ? ui.writeReview : ui.writePost}
          </button>
        </div>




        {isWritingPost ? renderComposer() : null}
        {showDeleteConfirm ? renderDeleteConfirm() : null}
        {viewProfile ? renderProfileModal() : null}
        {showLoginPrompt ? renderLoginPrompt() : null}
        {activeChatPartner && session && (
          <ChatView
            session={session}
            partner={activeChatPartner}
            senderName={displayName}
            onBack={() => setActiveChatPartner(null)}
          />
        )}
      </>
    );
  }

  if (view === 'detail' && selectedPost) {
    const category = CATEGORIES[selectedPost.category];

    const anonMap = new Map<string, string>();
    let anonCounter = 1;
    postComments.forEach((c) => {
      if (c.user_id === selectedPost.user_id) {
        anonMap.set(c.user_id, 'Ẩn danh (Tác giả)');
      } else if (!anonMap.has(c.user_id)) {
        anonMap.set(c.user_id, `Ẩn danh ${anonCounter++}`);
      }
    });

    const getDisplayName = (c: CommunityComment) => {
      if (!c.is_anonymous) return c.display_name;
      return anonMap.get(c.user_id) || 'Ẩn danh';
    };

    return (
      <div className="cm-detail-screen">
        <header className="cm-detail-header">
          <button type="button" onClick={goBack} className="cm-icon-btn" aria-label="Quay lại">
            <ArrowLeft size={22} />
          </button>
          <span className="cm-detail-cat">{ui.categories[selectedPost.category]}</span>
          <div className="cm-detail-actions">
            {selectedPost.user_id === (currentUserId || 'local-user') ? (
              <>
                <button type="button" className="cm-icon-btn" onClick={() => startEditing(selectedPost)} aria-label={isKo ? '글 수정' : 'Sửa bài'}>
                  <PenLine size={18} />
                </button>
                <button
                  type="button"
                  className="cm-icon-btn danger"
                  onClick={() => setShowDeleteConfirm(selectedPost.id)}
                  aria-label={isKo ? '글 삭제' : 'Xóa bài'}
                >
                  <X size={22} />
                </button>
              </>
            ) : (
              <button type="button" className="cm-icon-btn" aria-label="Tùy chọn">
                <MoreHorizontal size={22} />
              </button>
            )}
          </div>
        </header>

        <div className="cm-detail-body">
          <div className="cm-detail-meta">
            <strong>
              <User size={14} /> {selectedPost.display_name}
            </strong>
            <span>{new Date(selectedPost.created_at).toLocaleDateString('vi-VN')}</span>
            <span><Eye size={13} /> {selectedPost.views_count}</span>
          </div>

          <h1 className="cm-detail-title">{selectedPost.title}</h1>

          <div className="cm-detail-content">
            {selectedPost.content.split('\n').map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div className="cm-action-bar">
            <button
              type="button"
              className={`cm-action-btn ${likedPosts.has(selectedPost.id) ? 'active' : ''}`}
              onClick={() => void handlePostReaction(selectedPost.id, 'like')}
            >
              <ThumbsUp size={16} /> {selectedPost.likes_count}
            </button>
            <button
              type="button"
              className={`cm-action-btn ${dislikedPosts.has(selectedPost.id) ? 'active dislike' : ''}`}
              onClick={() => void handlePostReaction(selectedPost.id, 'dislike')}
            >
              <ThumbsDown size={16} /> {selectedPost.dislikes_count}
            </button>
            <button
              type="button"
              className={`cm-action-btn bookmark ${bookmarkedPosts.has(selectedPost.id) ? 'active' : ''}`}
              onClick={() => void handleBookmark(selectedPost.id)}
            >
              <Bookmark size={16} /> {isKo ? '저장' : 'Lưu'}
            </button>
          </div>

          <div className="cm-comments-section">
            <div className="cm-comments-header">
              <strong>{isKo ? `댓글 ${postComments.length}` : `Bình luận ${postComments.length}`}</strong>
            </div>

            {rootComments.length === 0 ? (
              <p className="cm-no-comments">{isKo ? '아직 댓글이 없습니다. 첫 댓글을 남겨보세요.' : 'Chưa có bình luận nào. Hãy mở màn trước nhé.'}</p>
            ) : (
              rootComments.map((comment) => {
                const replies = getReplies(comment.id);
                return (
                  <div key={comment.id} className="cm-comment-thread">
                    <CommentItem
                      comment={{ ...comment, display_name: getDisplayName(comment) }}
                      liked={likedComments.has(comment.id)}
                      onLike={() => void handleCommentLike(comment.id)}
                      onReply={() => {
                        setReplyTo(comment.id);
                        commentInputRef.current?.focus();
                      }}
                    />

                    {replies.map((reply) => (
                      <div key={reply.id} className="cm-comment cm-reply">
                        <div className="cm-reply-indicator">↳</div>
                        <div className="cm-reply-body">
                          <CommentItem
                            comment={{ ...reply, display_name: getDisplayName(reply) }}
                            liked={likedComments.has(reply.id)}
                            onLike={() => void handleCommentLike(reply.id)}
                            onReply={() => {
                              setReplyTo(comment.id);
                              commentInputRef.current?.focus();
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="cm-comment-input-bar">
          <div className="cm-comment-topline">
            <button
              type="button"
              className={`cm-comment-anon-toggle ${isAnonymous ? 'active' : ''}`}
              onClick={() => setIsAnonymous((value) => !value)}
            >
              <span className="cm-comment-switch" />
              <span className="cm-comment-anon-text">
                {isAnonymous ? <><ShieldCheck size={12} /> {isKo ? '익명' : 'Ẩn danh'}</> : <><User size={12} /> {displayName}</>}
              </span>
            </button>
            {replyTo ? (
              <div className="cm-replying-to">
                <span>Đang trả lời...</span>
                <button type="button" onClick={() => setReplyTo(null)} aria-label={isKo ? '답글 취소' : 'Hủy trả lời'}>
                  <X size={14} />
                </button>
              </div>
            ) : null}
          </div>
          <div className="cm-comment-input-row">
            <input
              ref={commentInputRef}
              type="text"
              className="cm-comment-input"
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              placeholder={isKo ? '댓글을 입력하세요...' : 'Viết bình luận...'}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void addComment();
              }}
            />
            <button type="button" className="cm-send-btn" onClick={() => void addComment()} disabled={!newComment.trim()}>
              <Send size={18} />
            </button>
          </div>
        </div>

        {isWritingPost ? renderComposer() : null}
        {showDeleteConfirm ? renderDeleteConfirm() : null}
        {showLoginPrompt ? renderLoginPrompt() : null}
        {activeChatPartner && session && (
          <ChatView
            session={session}
            partner={activeChatPartner}
            senderName={displayName}
            onBack={() => setActiveChatPartner(null)}
          />
        )}
      </div>
    );
  }

  return null;

  function renderComposer() {
    return (
      <div className="cm-write-fullscreen">
        <header className="cm-write-fs-header">
          <button type="button" onClick={closeComposer} className="cm-icon-btn" aria-label={isKo ? '닫기' : 'Đóng'}>
            <X size={22} />
          </button>
          <span className="cm-write-fs-title">{editingPostId ? (isKo ? '글 수정' : 'Sửa bài viết') : (isKo ? '글 작성' : 'Tạo bài viết')}</span>
          <button
            type="button"
            className="cm-write-fs-submit"
            onClick={() => void addPost()}
            disabled={!newTitle.trim() || !newContent.trim()}
          >
            {isKo ? '등록' : 'Đăng'}
          </button>
        </header>

        <div className="cm-write-fs-body">
          <div className="cm-write-fs-cats">
            {(Object.keys(CATEGORIES) as CommunityCategory[]).map((category) => (
              <button
                key={category}
                type="button"
                className={newCategory === category ? 'active' : ''}
                onClick={() => setNewCategory(category)}
                style={{ '--cat-color': CATEGORIES[category].color, '--cat-bg': CATEGORIES[category].bg } as CSSProperties}
              >
                {ui.categories[category]}
              </button>
            ))}
          </div>

          <input
            className="cm-write-fs-title-input"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder={isKo ? '글 제목' : 'Tiêu đề bài viết'}
            maxLength={100}
          />

          <div className="cm-write-fs-divider" />

          <textarea
            className="cm-write-fs-content"
            value={newContent}
            onChange={(event) => setNewContent(event.target.value)}
            placeholder={isKo ? '경험, 질문, 주의할 점, 유용한 리뷰를 커뮤니티에 공유해보세요...' : 'Chia sẻ kinh nghiệm, câu hỏi, cảnh báo hoặc review hữu ích cho cộng đồng...'}
            maxLength={2000}
          />

          <div className="cm-write-fs-footer">
            <button
              type="button"
              className={`cm-write-fs-anon-toggle ${isAnonymous ? 'active' : ''}`}
              onClick={() => setIsAnonymous((value) => !value)}
            >
              <span className="cm-write-fs-switch" />
              <span className="cm-write-fs-anon-label">
                <span className="cm-write-fs-anon-title">
                  {isAnonymous ? <><ShieldCheck size={14} /> {isKo ? '익명으로 등록' : 'Đăng ẩn danh'}</> : <><User size={14} /> {displayName}</>}
                </span>
                {isAnonymous ? <span className="cm-write-fs-anon-subtitle">{isKo ? '내 정보가 공개되지 않습니다' : 'Danh tính của bạn được giữ kín'}</span> : null}
              </span>
            </button>
            <span className="cm-write-fs-count">{newContent.length}/2000</span>
          </div>
        </div>
      </div>
    );
  }

  function renderDeleteConfirm() {
    return (
      <div className="custom-confirm-overlay" onClick={() => setShowDeleteConfirm(null)}>
        <div className="custom-confirm-card" onClick={(event) => event.stopPropagation()}>
          <h3>{isKo ? '삭제 확인' : 'Xác nhận xóa'}</h3>
          <p>{isKo ? '게시글과 모든 댓글이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.' : 'Bài viết và toàn bộ bình luận sẽ bị xóa. Hành động này không thể hoàn tác.'}</p>
          <div className="custom-confirm-actions">
            <button type="button" className="confirm-btn-cancel" onClick={() => setShowDeleteConfirm(null)}>{isKo ? '취소' : 'Hủy'}</button>
            <button type="button" className="confirm-btn-delete" onClick={() => void handleConfirmDelete()}>{isKo ? '삭제' : 'Xóa ngay'}</button>
          </div>
        </div>
      </div>
    );
  }

  function renderProfileModal() {
    if (!viewProfile) return null;
    const nameParts = viewProfile.displayName.trim().split(' ');
    const avatarLetter = (nameParts[nameParts.length - 1] || 'U').slice(0, 1).toUpperCase();

    return (
      <div className="custom-confirm-overlay" onClick={() => setViewProfile(null)}>
        <div className="custom-confirm-card" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '400px', padding: '24px', textAlign: 'center', position: 'relative' }}>
          <button type="button" onClick={() => setViewProfile(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="#64748b" />
          </button>

          <div style={{ width: 80, height: 80, borderRadius: 40, background: 'linear-gradient(135deg, #2752ff, #2146d9)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, margin: '0 auto 16px' }}>
            {avatarLetter}
          </div>

          <h2 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 22 }}>
            {viewProfile.displayName}
          </h2>

          <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 14 }}>
            {viewProfile.school} • {viewProfile.region}
          </p>

          <p style={{ margin: '0 0 20px', color: '#334155', fontSize: 15, lineHeight: 1.5 }}>
            {viewProfile.focus}
          </p>

          {viewProfile.tags && viewProfile.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
              {viewProfile.tags.map(tag => (
                <span key={tag} style={{ background: 'rgba(39, 82, 255, 0.08)', color: '#2752ff', padding: '6px 12px', borderRadius: 14, fontSize: 13, fontWeight: 600 }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {isFriend(viewProfile.id) ? (
            <button
              type="button"
              className="community-request"
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, background: '#2752ff', color: 'white' }}
              onClick={() => {
                if (requireLogin()) {
                  setActiveChatPartner(viewProfile);
                  setViewProfile(null);
                }
              }}
            >
              <MessageSquare size={18} /> Nhắn tin
            </button>
          ) : (
            <button
              type="button"
              className={`community-request ${requested.includes(viewProfile.id) ? 'sent' : ''} ${hasIncomingRequest(viewProfile.id) ? 'incoming' : ''}`}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15,
                background: hasIncomingRequest(viewProfile.id) ? '#4CAF50' : (requested.includes(viewProfile.id) ? '#f1f5f9' : '#2752ff'),
                color: hasIncomingRequest(viewProfile.id) || !requested.includes(viewProfile.id) ? 'white' : '#64748b'
              }}
              onClick={() => {
                onRequest(viewProfile.id);
              }}
              disabled={requested.includes(viewProfile.id) && !hasIncomingRequest(viewProfile.id)}
            >
              {hasIncomingRequest(viewProfile.id) ? (
                <>{isKo ? '친구 요청 수락' : 'Chấp nhận kết bạn'}</>
              ) : requested.includes(viewProfile.id) ? (
                <><CheckCircle2 size={18} /> {isKo ? '요청 보냄' : 'Đã gửi lời mời'}</>
              ) : (
                <><Plus size={18} /> {isKo ? '친구 추가' : 'Kết bạn'}</>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderLoginPrompt() {
    return (
      <div className="custom-confirm-overlay" onClick={() => setShowLoginPrompt(false)}>
        <div className="custom-confirm-card" onClick={(event) => event.stopPropagation()} style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: 'rgba(39, 82, 255, 0.1)', color: '#2752ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <User size={32} />
          </div>
          <h3 style={{ fontSize: 20, marginBottom: 12, color: '#0f172a' }}>{isKo ? '로그인이 필요합니다' : 'Yêu cầu đăng nhập'}</h3>
          <p style={{ color: '#64748b', marginBottom: 28, lineHeight: 1.5 }}>
            {ui.loginNeeded}
          </p>
          <div className="custom-confirm-actions" style={{ flexDirection: 'column', gap: 12 }}>
            <button
              type="button"
              className="confirm-btn-delete"
              style={{ background: '#2752ff', width: '100%', margin: 0 }}
              onClick={() => {
                setShowLoginPrompt(false);
                onNavigateToProfile();
              }}
            >
              Đến trang hồ sơ
            </button>
            <button
              type="button"
              className="confirm-btn-cancel"
              style={{ width: '100%', margin: 0, border: '1px solid #e2e8f0' }}
              onClick={() => setShowLoginPrompt(false)}
            >
              Để sau
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/* ============================================ */
/* ReviewBoard - Standalone component           */
/* ============================================ */

function MapEvents({ setMapBounds }: { setMapBounds: (bounds: L.LatLngBounds) => void }) {
  const map = useMap();
  
  useEffect(() => {
    // Initial bounds
    setMapBounds(map.getBounds());
  }, [map, setMapBounds]);

  useMapEvents({
    moveend: () => {
      setMapBounds(map.getBounds());
    },
    zoomend: () => {
      setMapBounds(map.getBounds());
    },
  });
  return null;
}

function ReviewBoard({
  session,
  displayName,
  isWriting,
  setIsWriting,
  lang = 'vi'
}: {
  session: Session | null;
  displayName: string;
  isWriting: boolean;
  setIsWriting: (v: boolean) => void;
  lang?: AppLang;
}) {
  const isKo = lang === 'ko';
  const reviewUi = isKo ? {
    categories: {
      work: '일자리',
      housing: '주거',
      food: '맛집',
      service: '서비스',
      other: '기타',
    } as Record<Exclude<ReviewCategory, 'all'>, string>,
    searchPlaceholder: '가게, 주소 검색...',
    emptyMap: '지도에 표시할 리뷰가 없습니다',
    foundPlaces: (count: number) => `${count}곳 발견`,
    writeReview: '리뷰 쓰기',
    all: '전체',
    loading: '불러오는 중...',
    empty: '이 카테고리에 리뷰가 없습니다',
    loginVote: '리뷰에 투표하려면 로그인해주세요.',
    voteError: '투표를 저장하지 못했습니다. Supabase에서 review_votes_patch.sql을 실행한 뒤 다시 시도해주세요.',
  } : {
    categories: {
      work: 'Việc làm',
      housing: 'Nhà ở',
      food: 'Ẩm thực',
      service: 'Dịch vụ',
      other: 'Khác',
    } as Record<Exclude<ReviewCategory, 'all'>, string>,
    searchPlaceholder: 'Tìm tên quán, địa chỉ...',
    emptyMap: 'Chưa có review nào trên bản đồ',
    foundPlaces: (count: number) => `Tìm thấy ${count} địa điểm`,
    writeReview: 'Viết review',
    all: 'Tất cả',
    loading: 'Đang tải...',
    empty: 'Chưa có review nào trong danh mục này',
    loginVote: 'Bạn cần đăng nhập để vote review.',
    voteError: 'Vote chưa lưu được. Bạn hãy chạy file supabase/review_votes_patch.sql trong Supabase rồi thử lại.',
  };
  const [reviews, setReviews] = useState<PlaceReview[]>([]);
  const [reviewVotes, setReviewVotes] = useState<Record<string, ReviewVoteType>>({});
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<ReviewCategory>('all');
  const currentUserId = session?.user.id ?? null;

  // Write form state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<{ name: string; address: string; lat: number; lng: number } | null>(null);
  const [writeCat, setWriteCat] = useState<Exclude<ReviewCategory, 'all'>>('food');
  const [writeRating, setWriteRating] = useState(0);
  const [writeTitle, setWriteTitle] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isAnon, setIsAnon] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Image compression utility
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1080;
          const MAX_HEIGHT = 1080;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob failed'));
          }, 'image/jpeg', 0.7);
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Limit to 3 images
    const totalCount = selectedImages.length + files.length;
    if (totalCount > 3) {
      alert('Chỉ có thể chọn tối đa 3 ảnh');
      return;
    }

    setUploading(true);
    const newPreviews = [...imagePreviews];
    const newFiles = [...selectedImages];

    for (const file of files) {
      try {
        const compressedBlob = await compressImage(file);
        const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
        newFiles.push(compressedFile);
        newPreviews.push(URL.createObjectURL(compressedBlob));
      } catch (err) {
        console.error('Compression failed:', err);
      }
    }

    setSelectedImages(newFiles);
    setImagePreviews(newPreviews);
    setUploading(false);
  };

  const removeImage = (index: number) => {
    const newFiles = [...selectedImages];
    const newPreviews = [...imagePreviews];
    URL.revokeObjectURL(newPreviews[index]);
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);
    setSelectedImages(newFiles);
    setImagePreviews(newPreviews);
  };

  // Fetch reviews
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.from('place_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setReviews(data as PlaceReview[]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!supabase || !currentUserId) {
      setReviewVotes({});
      return;
    }

    let cancelled = false;

    supabase
      .from('place_review_votes')
      .select('review_id, user_id, vote_type')
      .eq('user_id', currentUserId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('Unable to load review votes:', error);
          setReviewVotes({});
          return;
        }

        const nextVotes: Record<string, ReviewVoteType> = {};
        (data as PlaceReviewVote[] | null)?.forEach((vote) => {
          if (vote.vote_type === 'up' || vote.vote_type === 'down') {
            nextVotes[vote.review_id] = vote.vote_type;
          }
        });
        setReviewVotes(nextVotes);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('place-reviews-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'place_reviews' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const review = payload.new as PlaceReview;
          setReviews((current) => current.some((item) => item.id === review.id) ? current : [review, ...current]);
        } else if (payload.eventType === 'UPDATE') {
          const review = payload.new as PlaceReview;
          setReviews((current) => current.map((item) => item.id === review.id ? review : item));
        } else if (payload.eventType === 'DELETE') {
          setReviews((current) => current.filter((item) => item.id !== (payload.old as Partial<PlaceReview>).id));
        }
      })
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!supabase || !currentUserId) return;

    const channel = supabase
      .channel(`place-review-votes-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'place_review_votes' }, (payload) => {
        const nextRow = payload.new as Partial<PlaceReviewVote>;
        const oldRow = payload.old as Partial<PlaceReviewVote>;
        const rowUserId = nextRow.user_id ?? oldRow.user_id;
        if (rowUserId !== currentUserId) return;

        const reviewId = nextRow.review_id ?? oldRow.review_id;
        if (!reviewId) return;

        setReviewVotes((current) => {
          const next = { ...current };
          if (payload.eventType === 'DELETE') {
            delete next[reviewId];
          } else if (nextRow.vote_type === 'up' || nextRow.vote_type === 'down') {
            next[reviewId] = nextRow.vote_type;
          }
          return next;
        });
      })
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [currentUserId]);

  // Nominatim search with debounce
  const searchPlaces = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=kr&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'ko,vi,en' } }
        );
        const data: NominatimResult[] = await res.json();
        setSearchResults(data);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 500);
  }, []);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    searchPlaces(val);
  };

  const selectPlace = (result: NominatimResult) => {
    const parts = result.display_name.split(',');
    setSelectedPlace({
      name: parts[0]?.trim() || result.display_name,
      address: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleReviewReaction = async (reviewId: string, type: 'up' | 'down') => {
    if (!session || !supabase) {
      alert(reviewUi.loginVote);
      return;
    }
    const target = reviews.find(r => r.id === reviewId);
    if (!target) return;
    const previousVote = reviewVotes[reviewId];

    const upDelta = (type === 'up' ? 1 : 0) - (previousVote === 'up' ? 1 : 0);
    const downDelta = (type === 'down' ? 1 : 0) - (previousVote === 'down' ? 1 : 0);

    setReviewVotes(prev => ({ ...prev, [reviewId]: type }));
    if (previousVote !== type) {
      setReviews(prev => prev.map(r => r.id === reviewId ? {
        ...r,
        upvotes_count: Math.max(0, (r.upvotes_count || 0) + upDelta),
        downvotes_count: Math.max(0, (r.downvotes_count || 0) + downDelta)
      } : r));
    }

    const { data, error } = await supabase.rpc('set_review_vote', { row_id: reviewId, next_vote: type });
    if (error) {
      console.error('Unable to save review vote:', error);
      setReviewVotes(prev => {
        const next = { ...prev };
        if (previousVote) next[reviewId] = previousVote;
        else delete next[reviewId];
        return next;
      });
      if (previousVote !== type) {
        setReviews(prev => prev.map(r => r.id === reviewId ? {
          ...r,
          upvotes_count: target.upvotes_count || 0,
          downvotes_count: target.downvotes_count || 0
        } : r));
      }
      alert(reviewUi.voteError);
      return;
    }

    const updated = Array.isArray(data) ? data[0] : data;
    if (updated) {
      setReviews(prev => prev.map(r => r.id === reviewId ? {
        ...r,
        upvotes_count: Number(updated.upvotes_count) || 0,
        downvotes_count: Number(updated.downvotes_count) || 0,
      } : r));
      if (updated.vote_type === 'up' || updated.vote_type === 'down') {
        setReviewVotes(prev => ({ ...prev, [reviewId]: updated.vote_type }));
      }
    }
  };

  const handleSubmitReview = async () => {
    if (!supabase || !session || !selectedPlace || !writeTitle.trim() || !writeContent.trim() || writeRating === 0) return;
    setSubmitting(true);
    
    const imageUrls: string[] = [];

    // 1. Upload images to Storage
    for (const file of selectedImages) {
      const fileName = `${session.user.id}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('review-images')
        .upload(fileName, file);
      
      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from('review-images')
          .getPublicUrl(fileName);
        imageUrls.push(publicUrl);
      }
    }

    // 2. Insert to DB
    const { data, error } = await supabase.from('place_reviews').insert({
      user_id: session.user.id,
      display_name: isAnon ? 'Ẩn danh' : displayName,
      is_anonymous: isAnon,
      place_name: selectedPlace.name,
      place_address: selectedPlace.address,
      place_lat: selectedPlace.lat,
      place_lng: selectedPlace.lng,
      category: writeCat,
      title: writeTitle.trim(),
      content: writeContent.trim(),
      rating: writeRating,
      images: imageUrls,
    }).select().single();

    setSubmitting(false);
    if (!error && data) {
      setReviews(prev => [data as PlaceReview, ...prev]);
      closeWriter();
    } else if (error) {
      console.error('Submit error:', error);
      alert(isKo ? '리뷰 등록 중 오류가 발생했습니다. images 컬럼 구성을 확인해주세요.' : 'Có lỗi xảy ra khi đăng review. Vui lòng kiểm tra cấu trúc bảng images.');
    }
  };

  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };


  const filtered = useMemo(() => {
    let result = reviews;

    // 1. Filter by category
    if (catFilter !== 'all') {
      result = result.filter(r => r.category === catFilter);
    }

    // 2. Filter by map view (Dynamic Discovery)
    if (mapBounds) {
      result = result.filter(r => {
        if (!r.place_lat || !r.place_lng) return false;
        return mapBounds.contains([r.place_lat, r.place_lng]);
      });
    }

    // 3. Smart Sort by popularity (Upvotes - Downvotes)
    return [...result].sort((a, b) => {
      const scoreA = (a.upvotes_count || 0) - (a.downvotes_count || 0);
      const scoreB = (b.upvotes_count || 0) - (b.downvotes_count || 0);
      if (scoreA !== scoreB) return scoreB - scoreA;
      const ratingA = Number(a.rating) || 0;
      const ratingB = Number(b.rating) || 0;
      if (ratingA !== ratingB) return ratingB - ratingA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [reviews, catFilter, mapBounds]);

  const mapPositions: [number, number][] = filtered
    .filter(r => r.place_lat != null && r.place_lng != null)
    .map(r => [r.place_lat!, r.place_lng!]);

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length).toFixed(1) : '0';

  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [floatingSearch, setFloatingSearch] = useState('');
  const [floatingResults, setFloatingResults] = useState<any[]>([]);
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const reviewRefs = useRef<Map<string, HTMLElement>>(new Map());
  const mapRef = useRef<L.Map | null>(null);
  const dragControls = useDragControls();

  // Search logic for floating bar
  useEffect(() => {
    if (floatingSearch.length < 1) {
      setFloatingResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingMap(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(floatingSearch)}&addressdetails=1&namedetails=1&limit=5&countrycodes=kr`, {
          headers: {
            'Accept-Language': 'ko,en;q=0.9',
          }
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setFloatingResults(data);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearchingMap(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [floatingSearch]);

  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setUserPos(coords);
      // Zoom into the location (level 14 is ~3-5km radius view)
      mapRef.current?.setView(coords, 14);
    }, (err) => {
      console.error('GPS Error:', err);
    }, { enableHighAccuracy: true });
  };

  const handleFloatingSelect = (res: any) => {
    const lat = parseFloat(res.lat);
    const lon = parseFloat(res.lon);
    mapRef.current?.setView([lat, lon], 16);
    setFloatingSearch(res.display_name);
    setFloatingResults([]);
  };

  const handleMarkerClick = (reviewId: string) => {
    setSelectedReviewId(reviewId);
    setSheetExpanded(true);
    setTimeout(() => {
      const el = reviewRefs.current.get(reviewId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  };

  // Group reviews by place (address or coords)
  const groupedPlaces = useMemo(() => {
    const groups: Record<string, { lat: number, lng: number, name: string, reviews: PlaceReview[] }> = {};
    filtered.forEach(r => {
      if (r.place_lat && r.place_lng) {
        const key = `${r.place_lat.toFixed(4)}_${r.place_lng.toFixed(4)}`;
        if (!groups[key]) {
          groups[key] = { lat: r.place_lat, lng: r.place_lng, name: r.place_name, reviews: [] };
        }
        groups[key].reviews.push(r);
      }
    });
    return Object.values(groups);
  }, [filtered]);

  const createGroupIcon = (reviews: PlaceReview[], isSelected: boolean) => {
    const avg = (reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length).toFixed(1);
    const count = reviews.length;
    const cat = reviews[0].category;
    const category = REVIEW_CATS[cat as keyof typeof REVIEW_CATS] || REVIEW_CATS.other;

    return L.divIcon({
      className: `rv-custom-marker ${isSelected ? 'selected' : ''}`,
      html: `<div class="rv-marker-inner" style="background-color: ${isSelected ? '#2752ff' : category.color}; width: 44px; height: 44px;">
              <div class="rv-marker-group-info">
                <span class="avg">${avg}</span>
                ${count > 1 ? `<span class="count">${count}</span>` : ''}
              </div>
             </div><div class="rv-marker-arrow" style="border-top-color: ${isSelected ? '#2752ff' : category.color};"></div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 44],
    });
  };

  const closeWriter = () => {
    setIsWriting(false);
    setSelectedPlace(null);
    setWriteCat('food');
    setWriteRating(0);
    setWriteTitle('');
    setWriteContent('');
    setSearchQuery('');
    setSearchResults([]);
    setIsAnon(false);
  };

  return (
    <>
      <div className="rv-container">
        {/* Floating Search Bar */}
        <div className="rv-floating-search">
          <div className="rv-search-inner">
            <Search size={18} color="#64748b" />
            <input
              type="text"
              placeholder={reviewUi.searchPlaceholder}
              className="rv-search-input-field"
              value={floatingSearch}
              onChange={e => setFloatingSearch(e.target.value)}
            />
            {isSearchingMap && <Loader2 size={16} className="cm-spin" color="#2752ff" />}
          </div>

          {floatingResults.length > 0 && (
            <div className="rv-floating-results">
              {floatingResults.map((res, i) => {
                const nameKo = res.namedetails?.name || res.namedetails?.['name:ko'] || '';
                const nameEn = res.namedetails?.['name:en'] || '';
                const displayName = nameKo && nameEn && nameKo !== nameEn
                  ? `${nameKo} (${nameEn})`
                  : res.display_name;

                return (
                  <div key={i} className="rv-floating-item" onClick={() => handleFloatingSelect(res)}>
                    <MapPin size={14} />
                    <span>{displayName}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Map Background */}
        <div className="rv-map-wrap">
          {reviews.length > 0 ? (
            <MapContainer
              center={SEOUL_CENTER}
              zoom={12}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
              ref={mapRef}
            >
              <TileLayer
                attribution='&copy; <a href="https://osm.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapEvents setMapBounds={setMapBounds} />
              <FitBounds 
                positions={mapPositions.length > 0 ? mapPositions : [SEOUL_CENTER]} 
                totalCount={reviews.length} 
              />

              {userPos && (
                <Marker position={userPos} icon={L.divIcon({ className: 'user-marker', html: '<div class="user-dot"></div>' })} />
              )}

              {groupedPlaces.map((group, idx) => {
                const isSelected = group.reviews.some(r => r.id === selectedReviewId);
                return (
                  <Marker
                    key={idx}
                    position={[group.lat, group.lng]}
                    icon={createGroupIcon(group.reviews, isSelected)}
                    eventHandlers={{
                      click: () => handleMarkerClick(group.reviews[0].id)
                    }}
                  >
                    <Popup className="rv-map-popup">
                      <div className="rv-popup-content">
                        <strong>{group.name}</strong>
                        <div className="rv-popup-meta">
                          <span>{group.reviews.length} {isKo ? '개 리뷰' : 'đánh giá'}</span>
                          <span>★ {(group.reviews.reduce((s, r) => s + Number(r.rating), 0) / group.reviews.length).toFixed(1)}</span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          ) : (
            <div className="rv-map-empty">
              <MapPin size={32} />
              <span>{reviewUi.emptyMap}</span>
            </div>
          )}
        </div>

        {/* Bottom Sheet Review List */}
        <motion.div
          className="rv-bottom-sheet"
          initial={{ y: '58%' }}
          animate={{ y: sheetExpanded ? '6%' : '58%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 180 }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 600 }}
          dragElastic={0.1}
          onDragEnd={(_, info) => {
            const dragDistance = info.offset.y;
            const dragVelocity = info.velocity.y;

            if (dragDistance < -50 || dragVelocity < -300) {
              setSheetExpanded(true);
            } else if (dragDistance > 50 || dragVelocity > 300) {
              setSheetExpanded(false);
            }
          }}
        >
          {/* GPS Button attached to the sheet */}
          <button type="button" className="rv-gps-btn" onClick={handleMyLocation}>
            <Navigation size={20} />
          </button>

          <div
            className="rv-sheet-header"
            onPointerDown={(event) => dragControls.start(event)}
            onClick={() => setSheetExpanded(!sheetExpanded)}
            style={{ cursor: 'grab' }}
          >
            <div className="rv-sheet-handle" />
            <div className="rv-sheet-title-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3>{reviewUi.foundPlaces(filtered.length)}</h3>
                <span className="rv-avg-score">★ {avgRating}</span>
              </div>
              <button
                type="button"
                className="rv-sheet-write-btn"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setIsWriting(true);
                }}
              >
                <PenLine size={14} />
                {reviewUi.writeReview}
              </button>
            </div>

            {/* Categories inside the sheet */}
            <div
              className="rv-sheet-categories"
              onPointerDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                className={`rv-cat-chip ${catFilter === 'all' ? 'active' : ''}`}
                onClick={() => setCatFilter('all')}
              >
                {reviewUi.all}
              </button>
              {(Object.keys(REVIEW_CATS) as Exclude<ReviewCategory, 'all'>[]).map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`rv-cat-chip ${catFilter === cat ? 'active' : ''}`}
                  onClick={() => setCatFilter(cat)}
                >
                  {reviewUi.categories[cat]}
                </button>
              ))}
            </div>
          </div>

          <div className="rv-sheet-content">
            {loading ? (
              <div className="rv-sheet-loading">
                <Loader2 size={24} className="cm-spin" />
                <p>{reviewUi.loading}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rv-sheet-empty">
                <Star size={32} />
                <p>{reviewUi.empty}</p>
              </div>
            ) : (
              filtered.map((review, idx) => {
                const cat = REVIEW_CATS[review.category as keyof typeof REVIEW_CATS] || REVIEW_CATS.other;
                const isSelected = selectedReviewId === review.id;
                const userVote = reviewVotes[review.id];
                return (
                  <article
                    key={review.id}
                    className={`rv-item-card ${isSelected ? 'selected' : ''}`}
                    ref={el => { if (el) reviewRefs.current.set(review.id, el); }}
                    onClick={() => setSelectedReviewId(review.id)}
                  >
                    <div className="rv-item-rank" style={{ background: isSelected ? '#2752ff' : '#94a3b8' }}>
                      {idx + 1}
                    </div>
                    <div className="rv-item-main">
                      <div className="rv-item-info">
                        <div className="rv-item-place-row">
                          <h4 className="rv-item-place">{review.place_name}</h4>
                          <span className="rv-item-cat-label">{reviewUi.categories[review.category as Exclude<ReviewCategory, 'all'>] || cat.label}</span>
                        </div>
                        <p className="rv-item-address">{review.place_address.split(',').slice(0, 2).join(', ')}</p>
                        <div className="rv-item-meta">
                          <span className="rv-item-author">{review.display_name}</span>
                          <span className="rv-item-dot">•</span>
                          <span className="rv-item-time">{timeAgo(review.created_at)}</span>
                        </div>
                      </div>
                      <div className="rv-item-side">
                        <div className="rv-item-price-val" style={{ color: isSelected ? '#2752ff' : '#ea580c' }}>
                          ★ {Number(review.rating).toFixed(1)}
                        </div>
                        <div className="rv-item-votes">
                          <button 
                            type="button" 
                            className={`rv-vote-btn up ${userVote === 'up' ? 'active' : ''}`}
                            aria-pressed={userVote === 'up'}
                            onClick={(e) => { e.stopPropagation(); handleReviewReaction(review.id, 'up'); }}
                          >
                            <ChevronUp size={16} strokeWidth={2.8} />
                            <span>{review.upvotes_count || 0}</span>
                          </button>
                          <button 
                            type="button" 
                            className={`rv-vote-btn down ${userVote === 'down' ? 'active' : ''}`}
                            aria-pressed={userVote === 'down'}
                            onClick={(e) => { e.stopPropagation(); handleReviewReaction(review.id, 'down'); }}
                          >
                            <ChevronDown size={16} strokeWidth={2.8} />
                            <span>{review.downvotes_count || 0}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="rv-item-body">
                      <h5 className="rv-item-title">{review.title}</h5>
                      <p className="rv-item-text">{shortText(review.content, 120)}</p>
                      
                      {review.images && review.images.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
                          {review.images.map((url, i) => (
                            <div key={i} style={{ flex: '0 0 100px', height: 100, borderRadius: 8, overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                              <img src={url} alt="Review" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* Write FAB removed - now using unified cm-write-bar */}

      {/* Write Review Fullscreen */}
      {isWriting && (
        <div className="rv-write-overlay">
          <header className="rv-write-header">
            <button type="button" className="cm-icon-btn" onClick={closeWriter}><X size={22} /></button>
            <span className="rv-write-header-title">{reviewUi.writeReview}</span>
            <button
              type="button"
              className="rv-write-submit"
              disabled={!selectedPlace || !writeTitle.trim() || !writeContent.trim() || writeRating === 0 || submitting}
              onClick={() => void handleSubmitReview()}
            >
              {submitting ? (isKo ? '등록 중...' : 'Đang đăng...') : (isKo ? '등록' : 'Đăng')}
            </button>
          </header>

          <div className="rv-write-body">
            {/* Place search */}
            <div className="rv-write-section">
              <label className="rv-write-label">{isKo ? '📍 장소' : '📍 Địa điểm'}</label>
              {selectedPlace ? (
                <div className="rv-write-place-selected">
                  <MapPin size={20} color="#2752ff" />
                  <div className="place-info">
                    <div className="place-name">{selectedPlace.name}</div>
                    <div className="place-addr">{selectedPlace.address.split(',').slice(0, 3).join(', ')}</div>
                  </div>
                  <button type="button" className="cm-icon-btn" onClick={() => setSelectedPlace(null)}>
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="rv-search-wrap">
                  <Search size={16} className="rv-search-icon" />
                  <input
                    className="rv-search-input"
                    placeholder={isKo ? '한국 내 장소 검색...' : 'Tìm kiếm địa điểm tại Hàn Quốc...'}
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                  />
                  {(searchResults.length > 0 || searching) && (
                    <div className="rv-search-results">
                      {searching ? (
                        <div className="rv-search-loading">{isKo ? '검색 중...' : 'Đang tìm kiếm...'}</div>
                      ) : (
                        searchResults.map(result => (
                          <div key={result.place_id} className="rv-search-item" onClick={() => selectPlace(result)}>
                            <MapPin size={16} />
                            <span>{result.display_name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Category */}
            <div className="rv-write-section">
              <label className="rv-write-label">{isKo ? '🏷️ 카테고리' : '🏷️ Danh mục'}</label>
              <div className="rv-cat-chips">
                {(Object.keys(REVIEW_CATS) as Exclude<ReviewCategory, 'all'>[]).map(cat => (
                  <button key={cat} type="button" className={`rv-cat-chip ${writeCat === cat ? 'active' : ''}`} onClick={() => setWriteCat(cat)}>
                    {reviewUi.categories[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* Star Rating */}
            <div className="rv-write-section">
              <label className="rv-write-label">⭐ Đánh giá</label>
              <div className="rv-star-row">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} type="button" className={`rv-star-btn ${writeRating >= star ? 'filled' : ''}`} onClick={() => setWriteRating(star)}>
                    <Star size={28} fill={writeRating >= star ? '#f59e0b' : 'none'} />
                  </button>
                ))}
                {writeRating > 0 && <span className="rv-star-label">{writeRating}.0</span>}
              </div>
            </div>

            {/* Title */}
            <div className="rv-write-section">
              <label className="rv-write-label">{isKo ? '✏️ 제목' : '✏️ Tiêu đề'}</label>
              <input
                className="rv-write-input"
                placeholder={isKo ? '경험을 한 줄로 요약해주세요' : 'Tóm tắt trải nghiệm của bạn'}
                value={writeTitle}
                onChange={e => setWriteTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* Content */}
            <div className="rv-write-section">
              <label className="rv-write-label">{isKo ? '📝 상세 내용' : '📝 Nội dung chi tiết'}</label>
              <textarea
                className="rv-write-textarea"
                placeholder={isKo ? '품질, 가격, 서비스 태도, 유학생에게 줄 팁 등 실제 경험을 자세히 공유해주세요...' : 'Chia sẻ chi tiết trải nghiệm thực tế: chất lượng, giá cả, thái độ phục vụ, lời khuyên cho du học sinh...'}
                value={writeContent}
                onChange={e => setWriteContent(e.target.value)}
                maxLength={2000}
              />
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                {writeContent.length}/2000
              </div>
            </div>

            {/* Images */}
            <div className="rv-write-section">
              <label className="rv-write-label">{isKo ? '🖼️ 사진 (최대 3장)' : '🖼️ Hình ảnh (Tối đa 3)'}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                {imagePreviews.map((url, idx) => (
                  <div key={idx} style={{ width: 80, height: 80, borderRadius: 12, overflow: 'hidden', position: 'relative', border: '1px solid #e2e8f0' }}>
                    <img src={url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      onClick={() => removeImage(idx)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {imagePreviews.length < 3 && (
                  <label style={{ width: 80, height: 80, borderRadius: 12, border: '2px dashed #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8' }}>
                    {uploading ? <Loader2 size={20} className="cm-spin" /> : <Plus size={20} />}
                    <input type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
            </div>

            {/* Anonymous toggle */}
            <div className="rv-write-section">
              <button
                type="button"
                className={`cm-write-fs-anon-toggle ${isAnon ? 'active' : ''}`}
                onClick={() => setIsAnon(v => !v)}
              >
                <span className="cm-write-fs-switch" />
                <span className="cm-write-fs-anon-label">
                  <span className="cm-write-fs-anon-title">
                    {isAnon ? <><ShieldCheck size={14} /> {isKo ? '익명으로 등록' : 'Đăng ẩn danh'}</> : <><User size={14} /> {displayName}</>}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CommentItem({
  comment,
  liked,
  onLike,
  onReply,
}: {
  comment: CommunityComment;
  liked: boolean;
  onLike: () => void;
  onReply: () => void;
}) {
  return (
    <div className="cm-comment">
      <div className="cm-comment-head">
        <strong className={comment.is_author ? 'cm-comment-author' : ''}>{comment.display_name}</strong>
        <span className="cm-comment-time">{timeAgo(comment.created_at)}</span>
      </div>
      <p className="cm-comment-body">{comment.content}</p>
      <div className="cm-comment-actions">
        <button type="button" className="cm-reply-btn" onClick={onReply}>Trả lời</button>
        <button type="button" className={`cm-like-btn ${liked ? 'active' : ''}`} onClick={onLike}>
          <ThumbsUp size={13} /> {comment.likes_count}
        </button>
      </div>
    </div>
  );
}
