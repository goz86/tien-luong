import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
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
  Trash2,
  User,
  Users,
  X,
  MessageSquare,
  Navigation,
} from 'lucide-react';
import { motion, AnimatePresence, animate, useDragControls, useMotionValue } from 'framer-motion';
import { useKakaoPostcodePopup, type Address as KakaoPostcodeAddress } from 'react-daum-postcode';
import type { Session } from '@supabase/supabase-js';
import type { CompanionProfile } from '../lib/types';
import { supabase } from '../lib/supabase';
import { ChatView } from './ChatView';
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
  blockCommunityUser,
  loadCommunityComments,
  loadCommunityState,
  loadBlockedUserIds,
  reportCommunityContent,
  toggleCommentLike as persistCommentLike,
  toggleCommunityBookmark,
  togglePostReaction,
  updateCommunityPost,
} from '../lib/communityStore';
import {
  getGuestSessionId,
  guestExpiresAt,
  addGuestContent,
  upsertGuestPendingLike,
  upsertGuestPendingBookmark,
} from '../lib/guestSession';
import { GuestExpiryTicker } from './shared/GuestExpiryTicker';

type CommunityView = 'feed' | 'detail';
type CategoryFilter = CommunityCategory | 'all';
type FeedFilter = 'all' | 'mine' | 'saved';
type BoardMode = 'feed' | 'friends' | 'reviews';
type AppLang = 'vi' | 'ko';

const LOCAL_COMMUNITY_KEY = 'duhoc-mate-community-local';
const CHAT_READ_STATE_KEY = 'duhoc-mate-chat-read-state';
const COMMUNITY_LOAD_TIMEOUT_MS = 24000;
const FLOATING_SEARCH_TIMEOUT_MS = 6500;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) window.clearTimeout(timer);
  });
}

function getChatReadState(userId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`${CHAT_READ_STATE_KEY}:${userId}`);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function setChatReadState(userId: string, partnerId: string, readAt = new Date().toISOString()) {
  try {
    const current = getChatReadState(userId);
    localStorage.setItem(`${CHAT_READ_STATE_KEY}:${userId}`, JSON.stringify({ ...current, [partnerId]: readAt }));
  } catch {
    // localStorage can be blocked in private contexts; DB read state still handles the main path.
  }
}

const boardTabs: Array<{ id: BoardMode; icon: any }> = [
  { id: 'feed', icon: MessageSquare },
  { id: 'friends', icon: Users },
  { id: 'reviews', icon: Star },
];

type ReviewCategory = 'all' | 'work' | 'housing' | 'food' | 'service' | 'other';
type ReviewVoteType = 'up' | 'down';
type ReviewSortMode = 'trusted' | 'newest' | 'rating';

const REVIEW_CATS: Record<Exclude<ReviewCategory, 'all'>, { label: string; color: string; bg: string }> = {
  work: { label: 'Việc làm', color: '#2563eb', bg: '#dbeafe' },
  housing: { label: 'Nhà ở', color: '#16a34a', bg: '#dcfce7' },
  food: { label: 'Ẩm thực', color: '#ea580c', bg: '#ffedd5' },
  service: { label: 'Dịch vụ', color: '#9333ea', bg: '#f3e8ff' },
  other: { label: 'Khác', color: '#64748b', bg: '#f1f5f9' },
};

const REVIEW_CAT_ICONS: Record<Exclude<ReviewCategory, 'all'>, string> = {
  work: '💼',
  housing: '🏠',
  food: '🍜',
  service: '🛎️',
  other: '📍',
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
  images: string[] | string | null;
  created_at: string;
}

interface PlaceReviewVote {
  review_id: string;
  user_id: string;
  vote_type: ReviewVoteType;
}

const SEOUL_CENTER: [number, number] = [37.5665, 126.978];
const REVIEW_ADMIN_EMAILS = new Set(['michintashop@gmail.com']);
const NAVER_MAP_CLIENT_ID = import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined;
const KAKAO_POSTCODE_SCRIPT_URL = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
const REVIEW_SHEET_EXPANDED_Y = 86;
const REVIEW_SHEET_COLLAPSED_MIN_Y = 210;
const REVIEW_SHEET_COLLAPSED_PEEK = 232;

declare global {
  interface Window {
    naver?: {
      maps?: any;
    };
    __duhocMateNaverMapInit?: () => void;
  }
}

type ReviewMapBounds = {
  contains: (position: [number, number]) => boolean;
};

type ReviewPlaceGroup = {
  lat: number;
  lng: number;
  name: string;
  reviews: PlaceReview[];
};

type ReviewMapMarkerGroup = ReviewPlaceGroup & {
  markerType: 'place' | 'cluster';
  label: string;
  count: number;
  clusterLevel?: 'province' | 'district';
};

type ReviewMapHandle = {
  setView: (center: [number, number], zoom?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

let naverMapsSdkPromise: Promise<any> | null = null;

function loadNaverMapsSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Browser is not available.'));
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  if (!NAVER_MAP_CLIENT_ID) return Promise.reject(new Error('Missing VITE_NAVER_MAP_CLIENT_ID.'));
  if (naverMapsSdkPromise) return naverMapsSdkPromise;

  naverMapsSdkPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('naver-map-sdk') as HTMLScriptElement | null;
    if (existing) {
      if (window.naver?.maps?.jsContentLoaded) {
        resolve(window.naver.maps);
        return;
      }
      window.__duhocMateNaverMapInit = () => resolve(window.naver?.maps);
      existing.addEventListener('error', () => reject(new Error('Unable to load Naver Maps SDK.')));
      return;
    }

    window.__duhocMateNaverMapInit = () => {
      if (window.naver?.maps) resolve(window.naver.maps);
      else reject(new Error('Naver Maps SDK loaded without maps namespace.'));
    };

    const script = document.createElement('script');
    script.id = 'naver-map-sdk';
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(NAVER_MAP_CLIENT_ID)}&submodules=geocoder&callback=__duhocMateNaverMapInit`;
    script.onerror = () => reject(new Error('Unable to load Naver Maps SDK.'));
    document.head.appendChild(script);
  });

  return naverMapsSdkPromise;
}

function buildReviewMarkerHtml(reviews: PlaceReview[], isSelected: boolean) {
  const count = reviews.length;
  const categoryKey = (reviews[0].category as Exclude<ReviewCategory, 'all'>) || 'other';
  const category = REVIEW_CATS[categoryKey as keyof typeof REVIEW_CATS] || REVIEW_CATS.other;
  const icon = REVIEW_CAT_ICONS[categoryKey as keyof typeof REVIEW_CAT_ICONS] || REVIEW_CAT_ICONS.other;
  const color = isSelected ? '#2752ff' : category.color;
  const title = escapeHtml(reviews[0].title || reviews[0].place_name);
  const reviewId = escapeHtml(reviews[0].id);

  return `<div class="rv-title-marker ${isSelected ? 'selected' : ''}" data-review-id="${reviewId}" style="--marker-color: ${color};">
    <div class="rv-title-marker-label">
      <span class="rv-title-marker-icon">${icon}</span>
      <span class="rv-title-marker-text">${title}</span>
      ${count > 1 ? `<span class="rv-title-marker-count">${count}</span>` : ''}
    </div>
    <div class="rv-marker-arrow" style="border-top-color: ${color};"></div>
  </div>`;
}

function buildReviewClusterMarkerHtml(group: ReviewMapMarkerGroup) {
  const label = escapeHtml(group.label);
  const targetZoom = group.clusterLevel === 'province' ? 11 : 14;

  return `<div
    class="rv-cluster-marker rv-cluster-marker--${group.clusterLevel || 'district'}"
    data-cluster-lat="${group.lat}"
    data-cluster-lng="${group.lng}"
    data-cluster-zoom="${targetZoom}"
  >
    <span>${label}</span>
    <strong>${group.count}</strong>
  </div>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeReviewPlaceKey(group: ReviewPlaceGroup) {
  const name = (group.name || group.reviews[0]?.place_name || '').trim().toLowerCase();
  return `${group.lat.toFixed(4)}_${group.lng.toFixed(4)}_${name}`;
}

function getRegionParts(review: PlaceReview) {
  const raw = `${review.place_address || ''}, ${review.place_name || ''}`;
  return raw
    .split(/[,\n]/)
    .flatMap((part) => part.split(/\s+/))
    .map((part) => part.trim())
    .filter((part) => part && part !== '대한민국' && !/^\d/.test(part));
}

function buildKakaoAddress(data: KakaoPostcodeAddress) {
  const baseAddress = data.userSelectedType === 'J'
    ? data.jibunAddress || data.autoJibunAddress || data.address
    : data.roadAddress || data.autoRoadAddress || data.address;
  let extraAddress = '';

  if (data.userSelectedType === 'R' || data.addressType === 'R') {
    if (data.bname) extraAddress += data.bname;
    if (data.buildingName) {
      extraAddress += extraAddress ? `, ${data.buildingName}` : data.buildingName;
    }
  }

  const fullAddress = extraAddress ? `${baseAddress} (${extraAddress})` : baseAddress;
  const displayAddress = data.zonecode ? `${fullAddress}, ${data.zonecode}, 대한민국` : `${fullAddress}, 대한민국`;
  const placeName = data.buildingName || data.roadname || data.bname || data.sigungu || data.sido || fullAddress;

  return { fullAddress, displayAddress, placeName };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getFloatingPlaceTitle(result: any) {
  if (result?.title) return String(result.title);
  const nameKo = result?.namedetails?.name || result?.namedetails?.['name:ko'] || '';
  const nameEn = result?.namedetails?.['name:en'] || '';
  if (nameKo && nameEn && nameKo !== nameEn) return `${nameKo} (${nameEn})`;
  if (nameKo) return nameKo;
  return String(result?.name || result?.display_name || '').split(',')[0].trim();
}

function getFloatingPlaceAddress(result: any) {
  if (result?.formattedAddress) return String(result.formattedAddress);
  const displayName = String(result?.display_name || '').trim();
  const title = getFloatingPlaceTitle(result);
  if (!displayName) return title;
  return displayName.replace(new RegExp(`^${escapeRegExp(title)}\\s*,\\s*`, 'i'), '').trim() || displayName;
}

function compactKoreanAddress(address: string) {
  return address
    .replace(/^대한민국\s+/, '')
    .replace(/^서울특별시\s+/, '서울 ')
    .replace(/^부산광역시\s+/, '부산 ')
    .replace(/^대구광역시\s+/, '대구 ')
    .replace(/^인천광역시\s+/, '인천 ')
    .replace(/^광주광역시\s+/, '광주 ')
    .replace(/^대전광역시\s+/, '대전 ')
    .replace(/^울산광역시\s+/, '울산 ')
    .replace(/^세종특별자치시\s+/, '세종 ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildKoreanAddressTitle(address: string) {
  const compact = compactKoreanAddress(address);
  const parts = compact.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join(' ');
  return compact;
}

function extractKoreanAddressTail(query: string) {
  const match = query.match(/([가-힣]+(?:동|읍|면|리|가))\s*([0-9]+(?:-[0-9]+)?)/);
  return match ? `${match[1]} ${match[2]}` : '';
}

function formatOsmKoreanAddress(result: any) {
  const address = result?.address || {};
  const city = address.city || address.state || address.province || '';
  const district = address.borough || address.city_district || address.county || '';
  const town = address.suburb || address.town || address.village || address.neighbourhood || '';
  const road = address.road || address.pedestrian || '';
  const houseNumber = address.house_number || '';
  const postcode = address.postcode || '';
  const parts = [city, district, town, road, houseNumber].filter(Boolean);
  const formatted = compactKoreanAddress(parts.join(' '));
  const title = [road || town || district, houseNumber || postcode].filter(Boolean).join(' ');
  return {
    title: title || buildKoreanAddressTitle(formatted || String(result?.display_name || '')),
    formattedAddress: formatted || String(result?.display_name || ''),
  };
}

function getLocalKoreanSearchResults(query: string) {
  const normalized = query.trim().toLowerCase();
  const candidates = [
    {
      keywords: ['seoul', '서울', '서울시', '서울특별시'],
      title: '서울',
      formattedAddress: '서울특별시',
      lat: 37.5665,
      lon: 126.978,
    },
    {
      keywords: ['gangnam', '강남', '강남구'],
      title: '강남구',
      formattedAddress: '서울 강남구',
      lat: 37.5172,
      lon: 127.0473,
    },
    {
      keywords: ['nowon', '노원', '노원구'],
      title: '노원구',
      formattedAddress: '서울 노원구',
      lat: 37.6542,
      lon: 127.0568,
    },
  ];

  return candidates
    .filter((item) => item.keywords.some((keyword) => normalized.includes(keyword)))
    .map((item) => ({
      source: 'local',
      title: item.title,
      formattedAddress: item.formattedAddress,
      display_name: item.formattedAddress,
      lat: String(item.lat),
      lon: String(item.lon),
    }));
}

async function searchNaverAddressResults(query: string) {
  let results: any[] = [];

  // 1. Try Naver Geocoding (exact addresses)
  try {
    const maps = await Promise.race([
      loadNaverMapsSdk(),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('SDK timeout')), 4000)),
    ]);

    if (maps?.Service?.geocode) {
      const naverResults = await new Promise<any[]>((resolve) => {
        maps.Service.geocode({ query }, (status: unknown, response: any) => {
          const rows = (response?.v2?.addresses ?? []) as Array<{
            x?: string;
            y?: string;
            roadAddress?: string;
            jibunAddress?: string;
            englishAddress?: string;
          }>;

          if (status !== maps.Service.Status.OK && status !== 'OK' && rows.length === 0) {
            resolve([]);
            return;
          }

          resolve(rows.slice(0, 5).map((row) => {
            const rawAddress = row.jibunAddress || row.roadAddress || row.englishAddress || query;
            const formattedAddress = compactKoreanAddress(rawAddress);
            return {
              source: 'naver',
              title: buildKoreanAddressTitle(rawAddress),
              formattedAddress,
              display_name: formattedAddress,
              lat: row.y,
              lon: row.x,
            };
          }).filter((row) => Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon))));
        });
      });
      results.push(...naverResults);
    }
  } catch {
    // Naver SDK failed or timed out
  }

  // 2. Fallback to Nominatim OSM if we have fewer than 3 results (finds place names)
  if (results.length < 3) {
    try {
      // Use fetch directly without AbortSignal for better compatibility
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=vn,kr`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (response.ok) {
        const nominatimResults = await response.json();
        const osmResults = nominatimResults
          .slice(0, 5)
          .map((item: any) => {
            const title = item.name || (typeof item.display_name === 'string' ? item.display_name.split(',')[0] : item.display_name);
            return {
              source: 'nominatim',
              title,
              formattedAddress: item.display_name || title,
              display_name: item.display_name,
              lat: String(item.lat),
              lon: String(item.lon),
            };
          })
          .filter((row: any) => {
            const lat = Number(row.lat);
            const lon = Number(row.lon);
            return Number.isFinite(lat) && Number.isFinite(lon);
          });

        // Merge, avoiding duplicates by address
        const addressSet = new Set(results.map((r: any) => r.formattedAddress));
        results.push(...osmResults.filter((r: any) => !addressSet.has(r.formattedAddress)));
      }
    } catch (err) {
      // Nominatim failed, return what we have from Naver
      console.debug('Nominatim fallback failed:', err instanceof Error ? err.message : err);
    }
  }

  return results.slice(0, 5);
}

function compactProvinceLabel(value: string) {
  return value
    .replace(/특별자치도$/, '')
    .replace(/특별자치시$/, '')
    .replace(/특별시$/, '')
    .replace(/광역시$/, '')
    .replace(/자치도$/, '')
    .replace(/도$/, '')
    .replace(/시$/, '');
}

function getReviewRegionLabel(review: PlaceReview, level: 'province' | 'district') {
  const parts = getRegionParts(review);
  const province = parts.find((part) => /(특별시|광역시|특별자치시|특별자치도|자치도|도|시)$/.test(part));

  if (level === 'province') {
    return province ? compactProvinceLabel(province) : compactProvinceLabel(parts[0] || review.place_name || '기타');
  }

  const district = parts.find((part) => /(구|군|시)$/.test(part) && part !== province);
  return district || province || parts[0] || review.place_name || '기타';
}

function buildReviewMapMarkerGroups(groups: ReviewPlaceGroup[], zoom: number): ReviewMapMarkerGroup[] {
  if (zoom >= 14) {
    return groups.map((group) => ({
      ...group,
      markerType: 'place',
      label: group.reviews[0]?.title || group.name,
      count: group.reviews.length,
    }));
  }

  const clusterLevel: 'province' | 'district' = zoom >= 10 ? 'district' : 'province';
  const clusters = new Map<string, {
    latTotal: number;
    lngTotal: number;
    places: Set<string>;
    reviews: PlaceReview[];
    label: string;
  }>();

  groups.forEach((group) => {
    const firstReview = group.reviews[0];
    if (!firstReview) return;
    const label = getReviewRegionLabel(firstReview, clusterLevel);
    const key = `${clusterLevel}:${label}`;
    const existing = clusters.get(key) || {
      latTotal: 0,
      lngTotal: 0,
      places: new Set<string>(),
      reviews: [],
      label,
    };
    const placeKey = normalizeReviewPlaceKey(group);
    if (!existing.places.has(placeKey)) {
      existing.latTotal += group.lat;
      existing.lngTotal += group.lng;
      existing.places.add(placeKey);
    }
    existing.reviews.push(...group.reviews);
    clusters.set(key, existing);
  });

  return [...clusters.entries()].map(([key, cluster]) => {
    const count = Math.max(cluster.places.size, 1);
    return {
      lat: cluster.latTotal / count,
      lng: cluster.lngTotal / count,
      name: cluster.label,
      reviews: cluster.reviews,
      markerType: 'cluster',
      clusterLevel,
      label: cluster.label,
      count,
    };
  });
}

function detachNaverMarker(marker: any) {
  try {
    marker?.setMap?.(null);
  } catch {
    // Naver SDK can throw while a failed/half-disposed map instance is being unmounted.
  }
}

const NaverReviewMap = forwardRef<ReviewMapHandle, {
  groups: ReviewPlaceGroup[];
  selectedReviewId: string | null;
  userPos: [number, number] | null;
  onBoundsChange: (bounds: ReviewMapBounds) => void;
  onMarkerClick: (reviewId: string) => void;
}>(({ groups, selectedReviewId, userPos, onBoundsChange, onMarkerClick }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const mapsRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const listenersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const hasFitOnce = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(12);

  const pushBounds = useCallback(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    const bounds = map.getBounds();
    onBoundsChange({
      contains: ([lat, lng]) => {
        if (!bounds) return true;
        const latLng = new maps.LatLng(lat, lng);
        if (typeof bounds.hasLatLng === 'function') return bounds.hasLatLng(latLng);
        if (typeof bounds.hasPoint === 'function') return bounds.hasPoint(latLng);
        return true;
      },
    });
  }, [onBoundsChange]);

  const syncZoomLevel = useCallback(() => {
    const nextZoom = Number(mapRef.current?.getZoom?.() || 12);
    setZoomLevel((current) => (current === nextZoom ? current : nextZoom));
  }, []);

  useEffect(() => {
    const handleMarkerDomClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const cluster = target?.closest?.('.rv-cluster-marker') as HTMLElement | null;
      if (cluster) {
        const maps = mapsRef.current;
        const map = mapRef.current;
        const lat = Number(cluster.dataset.clusterLat);
        const lng = Number(cluster.dataset.clusterLng);
        const targetZoom = Number(cluster.dataset.clusterZoom || 14);
        if (maps && map && Number.isFinite(lat) && Number.isFinite(lng)) {
          event.preventDefault();
          event.stopPropagation();
          map.setCenter(new maps.LatLng(lat, lng));
          map.setZoom(Math.max(Number(map.getZoom?.() || 12) + 1, targetZoom));
          window.setTimeout(() => {
            syncZoomLevel();
            pushBounds();
          }, 180);
        }
        return;
      }

      const marker = target?.closest?.('.rv-title-marker') as HTMLElement | null;
      const reviewId = marker?.dataset.reviewId;
      if (!reviewId) return;
      event.preventDefault();
      event.stopPropagation();
      onMarkerClick(reviewId);
    };

    document.addEventListener('click', handleMarkerDomClick, true);
    return () => document.removeEventListener('click', handleMarkerDomClick, true);
  }, [onMarkerClick, pushBounds, syncZoomLevel]);

  useEffect(() => {
    let disposed = false;

    loadNaverMapsSdk()
      .then((maps) => {
        if (disposed || !containerRef.current) return;
        mapsRef.current = maps;
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(SEOUL_CENTER[0], SEOUL_CENTER[1]),
          zoom: 12,
          minZoom: 6,
          zoomControl: false,
          scaleControl: false,
          mapDataControl: false,
        });
        mapRef.current = map;
        setZoomLevel(Number(map.getZoom?.() || 12));
        listenersRef.current = [
          maps.Event.addListener(map, 'idle', () => {
            syncZoomLevel();
            pushBounds();
          }),
          maps.Event.addListener(map, 'zoom_changed', () => {
            syncZoomLevel();
            pushBounds();
          }),
        ];
        window.setTimeout(pushBounds, 150);
        window.setTimeout(() => {
          const mapText = containerRef.current?.innerText || '';
          if (!disposed && mapText.includes('인증')) {
            setLoadError('Naver Map chưa được cấp quyền cho URL này. Hãy thêm http://127.0.0.1:4173 và http://127.0.0.1:5173 vào Web service URL.');
          }
        }, 1800);
      })
      .catch((error) => {
        console.error('Naver map load failed:', error);
        setLoadError(error instanceof Error ? error.message : 'Unable to load Naver Maps SDK.');
      });

    return () => {
      disposed = true;
      listenersRef.current.forEach((listener) => {
        if (!listener) return;
        try {
          mapsRef.current?.Event?.removeListener?.(listener);
        } catch {
          // Ignore SDK cleanup errors during React remounts.
        }
      });
      markersRef.current.forEach(detachNaverMarker);
      detachNaverMarker(userMarkerRef.current);
      listenersRef.current = [];
      markersRef.current = [];
      mapRef.current = null;
    };
  }, [pushBounds, syncZoomLevel]);

  useImperativeHandle(ref, () => ({
    setView(center, zoom) {
      const maps = mapsRef.current;
      const map = mapRef.current;
      if (!maps || !map) return;
      map.setCenter(new maps.LatLng(center[0], center[1]));
      if (zoom) map.setZoom(zoom);
      window.setTimeout(pushBounds, 120);
    },
    zoomIn() {
      const map = mapRef.current;
      if (!map) return;
      map.setZoom((map.getZoom?.() || 12) + 1);
      window.setTimeout(pushBounds, 120);
    },
    zoomOut() {
      const map = mapRef.current;
      if (!map) return;
      map.setZoom((map.getZoom?.() || 12) - 1);
      window.setTimeout(pushBounds, 120);
    },
  }), [pushBounds]);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    markersRef.current.forEach(detachNaverMarker);
    const markerGroups = buildReviewMapMarkerGroups(groups, zoomLevel);
    markersRef.current = markerGroups.map((group) => {
      const isCluster = group.markerType === 'cluster';
      const isSelected = group.reviews.some((review) => review.id === selectedReviewId);
      const marker = new maps.Marker({
        position: new maps.LatLng(group.lat, group.lng),
        map,
        icon: {
          content: isCluster ? buildReviewClusterMarkerHtml(group) : buildReviewMarkerHtml(group.reviews, isSelected),
          size: isCluster ? new maps.Size(98, 62) : new maps.Size(172, 54),
          anchor: isCluster ? new maps.Point(49, 31) : new maps.Point(86, 50),
        },
      });
      return marker;
    });

    if (!hasFitOnce.current && groups.length > 0) {
      if (groups.length === 1) {
        map.setCenter(new maps.LatLng(groups[0].lat, groups[0].lng));
        map.setZoom(15);
      } else {
        const bounds = new maps.LatLngBounds();
        groups.forEach((group) => bounds.extend(new maps.LatLng(group.lat, group.lng)));
        map.fitBounds(bounds);
      }
      hasFitOnce.current = true;
      window.setTimeout(pushBounds, 220);
    } else {
      window.setTimeout(pushBounds, 80);
    }
  }, [groups, selectedReviewId, onMarkerClick, pushBounds, zoomLevel]);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    if (!userPos) {
      detachNaverMarker(userMarkerRef.current);
      userMarkerRef.current = null;
      return;
    }

    const position = new maps.LatLng(userPos[0], userPos[1]);
    if (!userMarkerRef.current) {
      userMarkerRef.current = new maps.Marker({
        position,
        map,
        icon: {
          content: '<div class="user-marker"><div class="user-dot"></div></div>',
          size: new maps.Size(24, 24),
          anchor: new maps.Point(12, 12),
        },
      });
    } else {
      userMarkerRef.current.setPosition(position);
      userMarkerRef.current.setMap(map);
    }
  }, [userPos]);

  return (
    <div className="rv-naver-map">
      <div ref={containerRef} className="rv-naver-map-canvas" />
      {loadError ? (
        <div className="rv-map-empty rv-map-empty--overlay">
          <MapPin size={32} />
          <span>{loadError}</span>
        </div>
      ) : null}
    </div>
  );
});

NaverReviewMap.displayName = 'NaverReviewMap';

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

function normalizeReviewImages(value: PlaceReview['images']) {
  if (Array.isArray(value)) {
    return value.filter((url): url is string => typeof url === 'string' && url.trim().length > 0);
  }
  if (typeof value !== 'string' || !value.trim()) return [];

  const trimmed = value.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter((url): url is string => typeof url === 'string' && url.trim().length > 0);
    }
  } catch {
    // Supabase normally returns text[] as arrays, but older rows may arrive as Postgres literals.
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((part) => part.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }

  return [trimmed];
}

function getReviewImageStoragePaths(urls: string[]) {
  const marker = '/storage/v1/object/public/review-images/';
  return urls.flatMap((url) => {
    try {
      const parsed = new URL(url);
      const index = parsed.pathname.indexOf(marker);
      if (index === -1) return [];
      return [decodeURIComponent(parsed.pathname.slice(index + marker.length))];
    } catch {
      return [];
    }
  });
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

function communityLocalKey(ownerId?: string | null) {
  return `${LOCAL_COMMUNITY_KEY}:${ownerId || 'guest'}`;
}

function readLocalCommunity(ownerId?: string | null): LocalCommunitySnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(communityLocalKey(ownerId));
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

function writeLocalCommunity(ownerId: string | null | undefined, snapshot: LocalCommunitySnapshot) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(communityLocalKey(ownerId), JSON.stringify(snapshot));
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
  targetPostId,
  onTargetPostConsumed,
  lang = 'vi',
}: {
  companions: CompanionProfile[];
  requested: string[];
  onRequest: (id: string) => void | Promise<void>;
  session: Session | null;
  profile?: { displayName?: string; latitude?: number | null; longitude?: number | null };
  onOpenNotifications: () => void;
  unreadCount: number;
  friendships: any[];
  onNavigateToProfile: () => void;
  targetPostId?: string | null;
  onTargetPostConsumed?: () => void;
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
  const [postReactionBusy, setPostReactionBusy] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncMessage, setSyncMessage] = useState('Đang làm mới');
  const [isLocalMode, setIsLocalMode] = useState(true);
  const [viewProfile, setViewProfile] = useState<CompanionProfile | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [activeChatPartner, setActiveChatPartner] = useState<CompanionProfile | null>(null);
  const [friendFilter, setFriendFilter] = useState<'discovery' | 'chats' | 'unread'>('discovery');
  const [friendActionId, setFriendActionId] = useState<string | null>(null);
  const [optimisticFriendIds, setOptimisticFriendIds] = useState<Set<string>>(new Set());
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const commentInputRef = useRef<HTMLInputElement>(null);

  const currentUserId = session?.user.id ?? '';
  const displayName = session ? (profile?.displayName?.trim() || session.user.email?.split('@')[0] || 'Du học sinh') : 'Du học sinh';

  useEffect(() => {
    if (!currentUserId) {
      setBlockedUserIds(new Set());
      return;
    }
    let alive = true;
    loadBlockedUserIds(currentUserId)
      .then((ids) => {
        if (alive) setBlockedUserIds(new Set(ids));
      })
      .catch((error) => console.warn('Unable to load blocked users:', error));
    return () => {
      alive = false;
    };
  }, [currentUserId]);

  const isFriend = useCallback((id: string) => {
    if (!currentUserId) return false;
    if (optimisticFriendIds.has(id)) return true;
    return friendships.some(f =>
      f.status === 'accepted' &&
      (
        (f.requester_id === currentUserId && f.target_profile_id === id) ||
        (f.requester_id === id && f.target_profile_id === currentUserId)
      )
    );
  }, [currentUserId, friendships, optimisticFriendIds]);

  const hasIncomingRequest = useCallback((id: string) => {
    if (optimisticFriendIds.has(id)) return false;
    return friendships.some(f =>
      f.requester_id === id &&
      f.target_profile_id === currentUserId &&
      f.status === 'pending'
    );
  }, [friendships, currentUserId, optimisticFriendIds]);

  const currentCoords = useMemo(() => {
    if (!validCoordinate(profile?.latitude, profile?.longitude)) return null;
    return { lat: profile!.latitude!, lng: profile!.longitude! };
  }, [profile?.latitude, profile?.longitude]);

  const companionsWithDistance = useMemo(() => {
    return companions.filter((companion) => !blockedUserIds.has(companion.id)).map((companion) => {
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
  }, [blockedUserIds, companions, currentCoords]);

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
    setLikedPosts(new Set());
    setDislikedPosts(new Set());
    setBookmarkedPosts(new Set());
    setLikedComments(new Set());
    setNotifications([]);
    setRecentChats([]);

    loadCommunityState(currentUserId || undefined)
      .then((state) => {
        if (!alive) return;
        const local = readLocalCommunity(currentUserId || null);
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
        const local = readLocalCommunity(currentUserId || null);
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
              bumpVisiblePostCommentCount(newComment.post_id, 1);
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
            const oldRow = payload.old as any;
            setComments((prev) => {
              const existed = prev.some(c => c.id === oldRow.id);
              if (existed && oldRow.post_id) bumpVisiblePostCommentCount(oldRow.post_id, -1);
              return prev.filter(c => c.id !== oldRow.id);
            });
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

  useEffect(() => {
    if (!supabase || !currentUserId) return;

    const applyReactionRow = (row: any, remove = false) => {
      const postId = row?.post_id as string | null | undefined;
      const commentId = row?.comment_id as string | null | undefined;
      const isLike = row?.is_like !== false;

      if (postId) {
        setLikedPosts((current) => {
          const next = new Set(current);
          if (remove || !isLike) next.delete(postId);
          else next.add(postId);
          return next;
        });
        setDislikedPosts((current) => {
          const next = new Set(current);
          if (remove || isLike) next.delete(postId);
          else next.add(postId);
          return next;
        });
      }

      if (commentId) {
        setLikedComments((current) => {
          const next = new Set(current);
          if (remove) next.delete(commentId);
          else next.add(commentId);
          return next;
        });
      }
    };

    const reactionsChannel = supabase
      .channel(`community-reactions:${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_likes', filter: `user_id=eq.${currentUserId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            applyReactionRow(payload.old, true);
          } else {
            applyReactionRow(payload.new, false);
          }
        },
      )
      .subscribe();

    const bookmarksChannel = supabase
      .channel(`community-bookmarks:${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_bookmarks', filter: `user_id=eq.${currentUserId}` },
        (payload) => {
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as any;
          const postId = row?.post_id as string | undefined;
          if (!postId) return;

          setBookmarkedPosts((current) => {
            const next = new Set(current);
            if (payload.eventType === 'DELETE') next.delete(postId);
            else next.add(postId);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(reactionsChannel);
      void supabase?.removeChannel(bookmarksChannel);
    };
  }, [currentUserId]);

  const fetchRecentChats = useCallback(async () => {
    if (!supabase || !currentUserId) return;
    const readState = getChatReadState(currentUserId);

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
          const locallyReadAt = readState[partnerId];
          if (locallyReadAt && new Date(msg.created_at).getTime() <= new Date(locallyReadAt).getTime()) {
            return;
          }
          const current = chatsMap.get(partnerId);
          current.unreadCount += 1;
        }
      });
      setRecentChats(Array.from(chatsMap.values()));
    }
  }, [currentUserId]);

  const markRecentChatRead = useCallback((partnerId: string) => {
    if (currentUserId) setChatReadState(currentUserId, partnerId);
    setRecentChats((current) => current.map((chat) => (
      chat.partnerId === partnerId
        ? { ...chat, unreadCount: 0 }
        : chat
    )));
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

  const reportTarget = useCallback(async (
    targetType: 'post' | 'comment' | 'review' | 'profile' | 'chat',
    targetId: string | null,
    targetUserId?: string | null,
  ) => {
    if (!requireLogin()) return;
    try {
      await reportCommunityContent({
        targetType,
        targetId,
        targetUserId,
        reason: 'user_report',
        details: 'Reported from in-app safety action.',
      });
      setSyncMessage(isKo ? 'Đã gửi báo cáo để admin kiểm tra.' : 'Đã gửi báo cáo để admin kiểm tra.');
    } catch (error) {
      console.error(error);
      setSyncMessage(isKo ? 'Chưa gửi được báo cáo.' : 'Chưa gửi được báo cáo.');
    }
  }, [isKo, requireLogin]);

  const blockTargetUser = useCallback(async (targetUserId?: string | null) => {
    if (!targetUserId || targetUserId === currentUserId) return;
    if (!requireLogin()) return;
    try {
      await blockCommunityUser(targetUserId);
      setBlockedUserIds((current) => new Set(current).add(targetUserId));
      setPosts((current) => current.filter((post) => post.user_id !== targetUserId));
      setComments((current) => current.filter((comment) => comment.user_id !== targetUserId));
      if (selectedPost?.user_id === targetUserId) goBack();
      setSyncMessage(isKo ? 'Đã chặn người dùng này.' : 'Đã chặn người dùng này.');
    } catch (error) {
      console.error(error);
      setSyncMessage(isKo ? 'Chưa chặn được người dùng.' : 'Chưa chặn được người dùng.');
    }
  }, [currentUserId, isKo, requireLogin, selectedPost]);

  const handleFriendAction = useCallback(async (id: string) => {
    if (!requireLogin() || friendActionId) return;
    const accepting = hasIncomingRequest(id);
    setFriendActionId(id);
    try {
      await Promise.resolve(onRequest(id));
      if (accepting) {
        setOptimisticFriendIds((current) => new Set(current).add(id));
      }
      setSyncMessage(accepting
        ? (isKo ? '친구 요청을 수락했습니다.' : 'Đã chấp nhận lời mời kết bạn.')
        : (isKo ? '친구 요청을 보냈습니다.' : 'Đã gửi lời mời kết bạn.'));
    } catch (error) {
      console.error(error);
      setOptimisticFriendIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setSyncMessage(accepting
        ? (isKo ? '친구 요청을 수락하지 못했습니다. Supabase 패치를 확인해주세요.' : 'Chưa chấp nhận được. Hãy chạy lại patch Supabase cho bạn bè.')
        : (isKo ? '친구 요청을 보내지 못했습니다.' : 'Chưa gửi được lời mời kết bạn.'));
    } finally {
      setFriendActionId(null);
    }
  }, [friendActionId, hasIncomingRequest, isKo, onRequest, requireLogin]);

  useEffect(() => {
    if (loading || !isLocalMode) return;
    writeLocalCommunity(currentUserId || null, {
      posts,
      comments,
      likedPostIds: [...likedPosts],
      dislikedPostIds: [...dislikedPosts],
      bookmarkedPostIds: [...bookmarkedPosts],
      likedCommentIds: [...likedComments],
    });
  }, [bookmarkedPosts, comments, currentUserId, dislikedPosts, isLocalMode, likedComments, likedPosts, loading, posts]);

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
      if (post.user_id && blockedUserIds.has(post.user_id)) return false;
      if (activeCategory !== 'all' && post.category !== activeCategory) return false;
      if (feedFilter === 'mine' && post.user_id !== currentUserId) return false;
      if (feedFilter === 'saved' && !bookmarkedPosts.has(post.id)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return post.title.toLowerCase().includes(q) || post.content.toLowerCase().includes(q);
      }

      return true;
    });
  }, [activeCategory, blockedUserIds, bookmarkedPosts, currentUserId, feedFilter, posts, searchQuery]);

  const postCommentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    comments.forEach(c => {
      counts[c.post_id] = (counts[c.post_id] || 0) + 1;
    });
    posts.forEach((post) => {
      counts[post.id] = Math.max(counts[post.id] || 0, post.comments_count || 0);
    });
    return counts;
  }, [comments, posts]);

  const hotPosts = useMemo(
    () => [...posts].filter((post) => !post.user_id || !blockedUserIds.has(post.user_id)).sort((a, b) => {
      const aCount = postCommentCounts[a.id] || 0;
      const bCount = postCommentCounts[b.id] || 0;
      return (b.likes_count + bCount) - (a.likes_count + aCount);
    }).slice(0, 2),
    [blockedUserIds, posts, postCommentCounts]
  );
  const trendingPost = useMemo(
    () => [...posts].filter((post) => !post.user_id || !blockedUserIds.has(post.user_id)).sort((a, b) => {
      const aCount = postCommentCounts[a.id] || 0;
      const bCount = postCommentCounts[b.id] || 0;
      return (bCount + b.views_count) - (aCount + a.views_count);
    })[0],
    [blockedUserIds, posts, postCommentCounts]
  );
  const postComments = selectedPost ? comments.filter((comment) => comment.post_id === selectedPost.id) : [];
  const rootComments = postComments.filter((comment) => !comment.parent_id);

  function updatePost(postId: string, updater: (post: CommunityPost) => CommunityPost) {
    setPosts((current) => current.map((post) => (post.id === postId ? updater(post) : post)));
    setSelectedPost((current) => (current?.id === postId ? updater(current) : current));
  }

  function syncPostCommentCount(postId: string, count: number) {
    updatePost(postId, (post) => ({
      ...post,
      comments_count: Math.max(0, count),
    }));
  }

  function bumpVisiblePostCommentCount(postId: string, delta: number) {
    updatePost(postId, (post) => ({
      ...post,
      comments_count: Math.max(0, (post.comments_count || 0) + delta),
    }));
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
    // Guest được phép mở composer — nội dung sẽ tự xoá sau 3h
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
      void loadCommunityComments(post.id)
        .then((nextComments) => {
          setComments((current) => [
            ...current.filter((comment) => comment.post_id !== post.id),
            ...nextComments,
          ]);
          syncPostCommentCount(post.id, nextComments.length);
        })
        .catch((error) => console.error(error));
    }
  }

  useEffect(() => {
    if (!targetPostId || loading) return;

    const targetPost = posts.find((post) => post.id === targetPostId);
    if (!targetPost) {
      setBoardMode('feed');
      setSyncMessage(isKo ? '게시글을 찾을 수 없습니다.' : 'Không tìm thấy bài viết này.');
      onTargetPostConsumed?.();
      return;
    }

    setBoardMode('feed');
    setActiveCategory('all');
    setFeedFilter('all');
    setSearchQuery('');
    setShowSearch(false);
    openPost(targetPost);
    onTargetPostConsumed?.();
  }, [isKo, loading, onTargetPostConsumed, posts, targetPostId]);

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
    if (postReactionBusy.has(postId)) return;

    const hadLike = likedPosts.has(postId);
    const hadDislike = dislikedPosts.has(postId);
    const nextLikes = new Set(likedPosts);
    const nextDislikes = new Set(dislikedPosts);
    const previousLikes = new Set(likedPosts);
    const previousDislikes = new Set(dislikedPosts);
    const previousPost = posts.find((post) => post.id === postId);
    const previousSelectedPost = selectedPost?.id === postId ? selectedPost : null;
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
    setPostReactionBusy((current) => new Set(current).add(postId));
    updatePost(postId, (post) => ({
      ...post,
      likes_count: Math.max(post.likes_count + likeDelta, 0),
      dislikes_count: Math.max(post.dislikes_count + dislikeDelta, 0),
    }));

    if (!currentUserId || !isUuid(postId)) {
      // Guest: lưu locally + pending sync
      upsertGuestPendingLike(postId, reaction === 'like' ? (nextLikes.has(postId) ? 'like' : null) : (nextDislikes.has(postId) ? 'dislike' : null));
      setSyncMessage('Đã lưu tương tác trên máy. Đăng nhập để đồng bộ.');
      setPostReactionBusy((current) => {
        const next = new Set(current);
        next.delete(postId);
        return next;
      });
      return;
    }

    try {
      await togglePostReaction(currentUserId, postId, reaction);
      if (reaction === 'like' && !hadLike && previousPost?.user_id && previousPost.user_id !== currentUserId) {
        await createCommunityNotification({
          recipientId: previousPost.user_id,
          actorId: currentUserId,
          postId,
          type: 'like',
          title: 'Co luot thich moi',
          body: `${isAnonymous ? 'An danh' : displayName} da thich "${previousPost.title}".`,
        });
      }
      setSyncMessage('Da luu tuong tac vao Supabase');
    } catch (error) {
      console.error(error);
      setLikedPosts(previousLikes);
      setDislikedPosts(previousDislikes);
      if (previousPost) setPosts((current) => current.map((post) => (post.id === postId ? previousPost : post)));
      if (previousSelectedPost) setSelectedPost(previousSelectedPost);
      setSyncMessage('Chua luu duoc tuong tac. Kiem tra ket noi Supabase.');
    } finally {
      setPostReactionBusy((current) => {
        const next = new Set(current);
        next.delete(postId);
        return next;
      });
    }
  }

  async function handleBookmark(postId: string) {
    const next = new Set(bookmarkedPosts);
    const wasSaved = next.has(postId);
    if (wasSaved) next.delete(postId);
    else next.add(postId);
    setBookmarkedPosts(next);

    if (!currentUserId || !isUuid(postId)) {
      // Guest: lưu locally + pending
      upsertGuestPendingBookmark(postId, !wasSaved);
      setSyncMessage(wasSaved ? 'Đã bỏ lưu (trên máy)' : 'Đã lưu bài viết trên máy. Đăng nhập để đồng bộ.');
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
    if (!newComment.trim() || !selectedPost) return;

    const isGuest = !currentUserId;
    const guestSessionId = isGuest ? getGuestSessionId() : undefined;
    const expiresAt = isGuest ? guestExpiresAt() : undefined;
    const commentDisplayName = isAnonymous ? 'Ẩn danh' : displayName;

    const baseComment: CommunityComment = {
      id: crypto.randomUUID(),
      post_id: selectedPost.id,
      parent_id: replyTo,
      user_id: currentUserId || 'guest',
      content: newComment.trim(),
      is_anonymous: isAnonymous,
      display_name: commentDisplayName,
      is_author: selectedPost.user_id === currentUserId,
      likes_count: 0,
      created_at: new Date().toISOString(),
    };

    const canPersist = Boolean(!isGuest && isUuid(selectedPost.id));
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
    } else if (isGuest && isUuid(selectedPost.id)) {
      // Guest: gửi lên Supabase với expires_at
      try {
        savedComment = await createCommunityComment({
          postId: selectedPost.id,
          parentId: replyTo,
          userId: null,
          guestSessionId,
          expiresAt,
          content: baseComment.content,
          isAnonymous: true,
          displayName: 'Khách',
          isAuthor: false,
        });
        addGuestContent({ id: savedComment.id, type: 'comment', expiresAt: expiresAt!, postId: selectedPost.id });
        setSyncMessage('Bình luận sẽ tự xoá sau 3 giờ. Đăng nhập để lưu mãi.');
      } catch (error) {
        console.error(error);
        setSyncMessage('Chưa gửi được bình luận.');
        return;
      }
    } else {
      setSyncMessage('Bình luận đang lưu tạm. Đăng nhập để đồng bộ.');
    }

    setComments((current) => [...current, savedComment]);
    updatePost(selectedPost.id, (post) => ({ ...post, comments_count: post.comments_count + 1 }));
    setNewComment('');
    setReplyTo(null);
  }

  async function addPost() {
    if (!newTitle.trim() || !newContent.trim()) return;

    const isGuest = !currentUserId;
    const guestSessionId = isGuest ? getGuestSessionId() : undefined;
    const expiresAt = isGuest ? guestExpiresAt() : undefined;
    const postDisplayName = isAnonymous ? 'Ẩn danh' : (isGuest ? 'Khách' : displayName);
    const draft = {
      category: newCategory,
      title: newTitle.trim(),
      content: newContent.trim(),
      isAnonymous: isGuest ? true : isAnonymous,
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
          setSyncMessage('Đã cập nhật bài viết');
        } catch (error) {
          console.error(error);
          updatePost(editingPostId, nextPost);
          setSyncMessage('Chưa cập nhật được, đang giữ bản sửa tạm.');
        }
      } else {
        updatePost(editingPostId, nextPost);
        setSyncMessage('Bản sửa đang lưu tạm trên máy');
      }
    } else if (!isGuest) {
      // Người dùng đã đăng nhập
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
      // Guest: gửi lên Supabase với expires_at 3h
      try {
        const saved = await createCommunityPost({
          ...draft,
          userId: null,
          guestSessionId,
          expiresAt,
        });
        addGuestContent({ id: saved.id, type: 'post', expiresAt: expiresAt! });
        setPosts((current) => [saved, ...current]);
        setSyncMessage('Bài viết sẽ tự xoá sau 3 giờ. Đăng nhập để lưu mãi mãi!');
      } catch (error) {
        console.error(error);
        setSyncMessage('Chưa đăng được bài. Vui lòng thử lại.');
      }
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
                <article
                  key={friend.id}
                  className="community-friend-row"
                  onClick={() => {
                    if (chatData && requireLogin()) setActiveChatPartner(friend);
                  }}
                  style={chatData ? { cursor: 'pointer' } : undefined}
                >
                  <div
                    className="community-avatar"
                    onClick={(event) => {
                      event.stopPropagation();
                      setViewProfile(friend);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {avatarLetter}
                  </div>
                  <div className="community-friend-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong
                        onClick={(event) => {
                          event.stopPropagation();
                          setViewProfile(friend);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
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
                          {friendDistance != null ? <span>· {formatDistance(friendDistance)}</span> : null}
                        </div>
                        <span>{friend.school} · {friend.region}</span>
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
                        onClick={() => void handleFriendAction(friend.id)}
                        disabled={friendActionId === friend.id || (requested.includes(friend.id) && !hasIncomingRequest(friend.id))}
                        style={hasIncomingRequest(friend.id) ? { width: 'auto', minWidth: '85px', padding: '0 12px', background: '#4CAF50', color: 'white', whiteSpace: 'nowrap' } : {}}
                      >
                        {friendActionId === friend.id ? (
                          <Loader2 size={16} className="cm-spin" />
                        ) : hasIncomingRequest(friend.id) ? (
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
                        onClick={(event) => {
                          event.stopPropagation();
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
          blockedUserIds={blockedUserIds}
          onReport={reportTarget}
          onBlockUser={blockTargetUser}
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
                <strong>{trendingPost.display_name}</strong> · {timeAgo(trendingPost.created_at)}
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
                    <strong>{post.display_name}</strong> · {timeAgo(post.created_at)}
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
        <header className={`cm-header${boardMode === 'reviews' ? ' cm-header--hidden' : ''}`}>
          {!showSearch ? (
            <>
              <h1 className="cm-wordmark">Duhoc Mate</h1>
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

        {/* Guest expiry ticker — chỉ hiện khi khách đã đăng nội dung */}
        {!session && (
          <GuestExpiryTicker
            lang={lang}
            onLoginClick={() => setShowLoginPrompt(true)}
          />
        )}

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
            onBack={() => {
              markRecentChatRead(activeChatPartner.id);
              setActiveChatPartner(null);
            }}
            onRead={markRecentChatRead}
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
              <>
                <button
                  type="button"
                  className="cm-icon-btn"
                  onClick={() => void reportTarget('post', selectedPost.id, selectedPost.user_id)}
                  aria-label={isKo ? '신고' : 'Báo cáo'}
                >
                  <ShieldCheck size={19} />
                </button>
                {selectedPost.user_id ? (
                  <button
                    type="button"
                    className="cm-icon-btn danger"
                    onClick={() => void blockTargetUser(selectedPost.user_id)}
                    aria-label={isKo ? '차단' : 'Chặn'}
                  >
                    <X size={21} />
                  </button>
                ) : null}
              </>
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
              disabled={postReactionBusy.has(selectedPost.id)}
              onClick={() => void handlePostReaction(selectedPost.id, 'like')}
            >
              <ThumbsUp size={16} /> {selectedPost.likes_count}
            </button>
            <button
              type="button"
              className={`cm-action-btn ${dislikedPosts.has(selectedPost.id) ? 'active dislike' : ''}`}
              disabled={postReactionBusy.has(selectedPost.id)}
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
            onBack={() => {
              markRecentChatRead(activeChatPartner.id);
              setActiveChatPartner(null);
            }}
            onRead={markRecentChatRead}
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
            {viewProfile.school} · {viewProfile.region}
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
              onClick={() => void handleFriendAction(viewProfile.id)}
              disabled={friendActionId === viewProfile.id || (requested.includes(viewProfile.id) && !hasIncomingRequest(viewProfile.id))}
            >
              {friendActionId === viewProfile.id ? (
                <Loader2 size={18} className="cm-spin" />
              ) : hasIncomingRequest(viewProfile.id) ? (
                <>{isKo ? '친구 요청 수락' : 'Chấp nhận kết bạn'}</>
              ) : requested.includes(viewProfile.id) ? (
                <><CheckCircle2 size={18} /> {isKo ? '요청 보냄' : 'Đã gửi lời mời'}</>
              ) : (
                <><Plus size={18} /> {isKo ? '친구 추가' : 'Kết bạn'}</>
              )}
            </button>
          )}
          <div className="cm-profile-safety-actions">
            <button
              type="button"
              onClick={() => void reportTarget('profile', viewProfile.id, viewProfile.id)}
            >
              {isKo ? '신고' : 'Báo cáo'}
            </button>
            <button
              type="button"
              onClick={() => {
                void blockTargetUser(viewProfile.id);
                setViewProfile(null);
              }}
            >
              {isKo ? '차단' : 'Chặn'}
            </button>
          </div>
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

function ReviewBoard({
  session,
  displayName,
  isWriting,
  setIsWriting,
  blockedUserIds,
  onReport,
  onBlockUser,
  lang = 'vi'
}: {
  session: Session | null;
  displayName: string;
  isWriting: boolean;
  setIsWriting: (v: boolean) => void;
  blockedUserIds: Set<string>;
  onReport: (targetType: 'post' | 'comment' | 'review' | 'profile' | 'chat', targetId: string | null, targetUserId?: string | null) => void | Promise<void>;
  onBlockUser: (targetUserId?: string | null) => void | Promise<void>;
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
    voteError: '투표를 저장하지 못했습니다. Supabase에서 community_review_friend_patch.sql을 실행한 뒤 다시 시도해주세요.',
    imageUploadError: '사진을 업로드하지 못했습니다. review-images Storage 정책을 확인해주세요.',
    submitError: '리뷰를 등록하지 못했습니다. Supabase 컬럼과 Storage 설정을 확인해주세요.',
    deleteConfirm: '이 리뷰를 삭제할까요?',
    deleteSuccess: '리뷰를 삭제했습니다.',
    deleteError: '리뷰를 삭제하지 못했습니다. Supabase 권한 패치를 실행해주세요.',
    report: '신고',
    block: '차단',
    sortTrusted: '신뢰순',
    sortNewest: '최신순',
    sortRating: '별점순',
  } : {
    categories: {
      work: 'Việc làm',
      housing: 'Nhà ở',
      food: 'Quán ăn',
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
    voteError: 'Vote chưa lưu được. Bạn hãy chạy file supabase/community_review_friend_patch.sql trong Supabase rồi thử lại.',
    imageUploadError: 'Chưa tải ảnh lên được. Hãy kiểm tra bucket/policy review-images trong Supabase.',
    submitError: 'Chưa đăng được review. Hãy kiểm tra cột images và Storage trong Supabase.',
    deleteConfirm: 'Xoá review này nhé?',
    deleteSuccess: 'Đã xoá review.',
    deleteError: 'Chưa xoá được review. Hãy chạy patch quyền Supabase.',
    report: 'Báo cáo',
    block: 'Chặn',
    sortTrusted: 'Uy tín cao',
    sortNewest: 'Mới nhất',
    sortRating: 'Điểm vote nhiều',
  };
  const [reviews, setReviews] = useState<PlaceReview[]>([]);
  const [reviewVotes, setReviewVotes] = useState<Record<string, ReviewVoteType>>({});
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<ReviewCategory>('all');
  const [sortMode, setSortMode] = useState<ReviewSortMode>('trusted');
  const [activeSafetyReviewId, setActiveSafetyReviewId] = useState<string | null>(null);
  const openKakaoPostcode = useKakaoPostcodePopup(KAKAO_POSTCODE_SCRIPT_URL);
  const currentUserId = session?.user.id ?? null;
  const isReviewAdmin = REVIEW_ADMIN_EMAILS.has((session?.user.email ?? '').toLowerCase());
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const reviewNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showReviewNotice = useCallback((message: string) => {
    setReviewNotice(message);
    if (reviewNoticeTimerRef.current) {
      clearTimeout(reviewNoticeTimerRef.current);
    }
    reviewNoticeTimerRef.current = setTimeout(() => setReviewNotice(null), 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (reviewNoticeTimerRef.current) {
        clearTimeout(reviewNoticeTimerRef.current);
      }
    };
  }, []);

  // Write form state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<{ name: string; address: string; lat: number; lng: number } | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ title: string; formattedAddress: string; lat: string; lon: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fetchingSuggestions, setFetchingSuggestions] = useState(false);
  const [writeCat, setWriteCat] = useState<Exclude<ReviewCategory, 'all'>>('food');
  const [writeRating, setWriteRating] = useState(0);
  const [writeTitle, setWriteTitle] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isAnon, setIsAnon] = useState(false);

  // Address autocomplete: debounced search as user types
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setFetchingSuggestions(false);
      return;
    }
    setFetchingSuggestions(true);
    const timer = setTimeout(() => {
      searchNaverAddressResults(q).then((results) => {
        setAddressSuggestions(results);
        setShowSuggestions(results.length > 0);
        setFetchingSuggestions(false);
      }).catch(() => {
        setAddressSuggestions([]);
        setShowSuggestions(false);
        setFetchingSuggestions(false);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSuggestion = useCallback((s: { title: string; formattedAddress: string; lat: string; lon: string }) => {
    setSelectedPlace({
      name: s.formattedAddress,
      address: s.formattedAddress,
      lat: Number(s.lat),
      lng: Number(s.lon),
    });
    setSearchQuery('');
    setAddressSuggestions([]);
    setShowSuggestions(false);
  }, []);

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
    let cancelled = false;
    setLoading(true);

    withTimeout(
      supabase.from('place_reviews')
        .select('id,user_id,display_name,is_anonymous,place_name,place_address,place_lat,place_lng,category,title,content,rating,helpful_count,upvotes_count,downvotes_count,images,created_at')
        .order('created_at', { ascending: false })
        .limit(120) as unknown as Promise<{ data: PlaceReview[] | null; error: unknown }>,
      COMMUNITY_LOAD_TIMEOUT_MS,
      'Place reviews load timed out',
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('Unable to load place reviews:', error);
          setReviews([]);
          return;
        }
        setReviews(data ?? []);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('Unable to load place reviews:', error);
        setReviews([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
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

  const geocodeKoreanAddress = useCallback(async (address: string) => {
    try {
      const maps = await loadNaverMapsSdk();
      return await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (!maps?.Service?.geocode) {
          resolve(null);
          return;
        }

        maps.Service.geocode({ query: address }, (status: any, response: any) => {
          if (status !== maps.Service.Status.OK) {
            resolve(null);
            return;
          }

          const result = response?.v2?.addresses?.[0];
          const lat = Number(result?.y);
          const lng = Number(result?.x);
          resolve(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null);
        });
      });
    } catch (error) {
      console.warn('Unable to geocode Kakao postcode address:', error);
      return null;
    }
  }, []);

  const handleAddressComplete = useCallback(async (data: KakaoPostcodeAddress) => {
    const address = buildKakaoAddress(data);
    setSearching(true);
    setSearchQuery(address.fullAddress);

    const coords = await geocodeKoreanAddress(address.fullAddress);
    setSearching(false);

    if (!coords) {
      showReviewNotice(isKo
        ? '주소 좌표를 찾지 못했습니다. 다른 주소로 다시 선택해주세요.'
        : 'Chưa lấy được tọa độ địa chỉ. Bạn chọn lại địa chỉ khác nhé.');
      return;
    }

    setSelectedPlace({
      name: address.placeName,
      address: address.displayAddress,
      lat: coords.lat,
      lng: coords.lng,
    });
    setSearchQuery('');
  }, [geocodeKoreanAddress, isKo, showReviewNotice]);

  const openAddressSearch = useCallback(() => {
    void openKakaoPostcode({
      defaultQuery: searchQuery,
      popupTitle: isKo ? '주소 검색' : 'Tìm kiếm địa chỉ',
      onComplete: (data) => void handleAddressComplete(data),
      onError: (error) => {
        console.error('Kakao postcode failed:', error);
        showReviewNotice(isKo
          ? '주소 검색창을 열지 못했습니다. 잠시 후 다시 시도해주세요.'
          : 'Chưa mở được cửa sổ tìm địa chỉ. Bạn thử lại sau nhé.');
      },
    });
  }, [handleAddressComplete, isKo, openKakaoPostcode, searchQuery, showReviewNotice]);

  const handleReviewReaction = async (reviewId: string, type: 'up' | 'down') => {
    if (!session || !supabase) {
      showReviewNotice(reviewUi.loginVote);
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
      showReviewNotice(reviewUi.voteError);
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

  const handleDeleteReview = async (review: PlaceReview) => {
    if (!session || !supabase) {
      showReviewNotice(reviewUi.loginVote);
      return;
    }
    if (review.user_id !== currentUserId && !isReviewAdmin) return;
    if (!window.confirm(reviewUi.deleteConfirm)) return;

    const previousReviews = reviews;
    const imageUrls = normalizeReviewImages(review.images);
    setDeletingReviewId(review.id);
    setReviews((current) => current.filter((item) => item.id !== review.id));

    const { error } = await supabase.from('place_reviews').delete().eq('id', review.id);
    if (error) {
      console.error('Unable to delete review:', error);
      setReviews(previousReviews);
      showReviewNotice(reviewUi.deleteError);
      setDeletingReviewId(null);
      return;
    }

    const storagePaths = getReviewImageStoragePaths(imageUrls);
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage.from('review-images').remove(storagePaths);
      if (storageError) console.warn('Unable to remove review images:', storageError);
    }

    showReviewNotice(reviewUi.deleteSuccess);
    setDeletingReviewId(null);
  };

  const handleSubmitReview = async () => {
    if (!supabase || !session || !selectedPlace || !writeTitle.trim() || !writeContent.trim() || writeRating === 0) return;
    setSubmitting(true);

    const imageUrls: string[] = [];

    // 1. Upload images to Storage
    for (const file of selectedImages) {
      const safeName = file.name.replace(/[^\w.-]+/g, '-').toLowerCase();
      const fileName = `${session.user.id}/${crypto.randomUUID()}-${safeName || 'review.jpg'}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('review-images')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Review image upload failed:', uploadError);
        setSubmitting(false);
        showReviewNotice(reviewUi.imageUploadError);
        return;
      }

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
      const savedReview = data as PlaceReview;
      const savedImages = normalizeReviewImages(savedReview.images);
      setReviews(prev => [{
        ...savedReview,
        images: savedImages.length > 0 ? savedReview.images : imageUrls,
      }, ...prev]);
      closeWriter();
    } else if (error) {
      console.error('Submit error:', error);
      showReviewNotice(reviewUi.submitError);
    }
  };

  const [mapBounds, setMapBounds] = useState<ReviewMapBounds | null>(null);

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
    let result = reviews.filter((review) => !review.user_id || !blockedUserIds.has(review.user_id));

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

    // 3. Smart sort by trust, recency, or rating.
    return [...result].sort((a, b) => {
      if (sortMode === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      if (sortMode === 'rating') {
        const ratingDiff = (Number(b.rating) || 0) - (Number(a.rating) || 0);
        if (ratingDiff !== 0) return ratingDiff;
      }

      const scoreA = (a.upvotes_count || 0) - (a.downvotes_count || 0);
      const scoreB = (b.upvotes_count || 0) - (b.downvotes_count || 0);
      if (scoreA !== scoreB) return scoreB - scoreA;
      const ratingA = Number(a.rating) || 0;
      const ratingB = Number(b.rating) || 0;
      if (ratingA !== ratingB) return ratingB - ratingA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [blockedUserIds, reviews, catFilter, mapBounds, sortMode]);

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length).toFixed(1) : '0';

  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [floatingSearch, setFloatingSearch] = useState('');
  const [floatingResults, setFloatingResults] = useState<any[]>([]);
  const [floatingSelectedAddress, setFloatingSelectedAddress] = useState('');
  const [floatingSearchDone, setFloatingSearchDone] = useState(false);
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const reviewRefs = useRef<Map<string, HTMLElement>>(new Map());
  const skipNextFloatingSearchRef = useRef(false);
  const wasImagePreviewClosedViaBack = useRef(false);

  // Handle physical back button for image preview
  useEffect(() => {
    if (!previewImage) {
      wasImagePreviewClosedViaBack.current = false;
      return;
    }

    const handlePopState = () => {
      wasImagePreviewClosedViaBack.current = true;
      setPreviewImage(null);
    };

    window.history.pushState({ type: 'previewImage' }, '');
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (!wasImagePreviewClosedViaBack.current && window.history.state?.type === 'previewImage') {
        window.history.back();
      }
    };
  }, [previewImage]);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const sheetContentRef = useRef<HTMLDivElement | null>(null);
  const sheetContentDragRef = useRef<{
    pointerId: number;
    startY: number;
    startX: number;
    originY: number;
    startTime: number;
    startScrollTop: number;
    active: boolean;
  } | null>(null);
  const mapRef = useRef<ReviewMapHandle | null>(null);
  const dragControls = useDragControls();
  const sheetY = useMotionValue(520);
  const [sheetBounds, setSheetBounds] = useState({ expanded: REVIEW_SHEET_EXPANDED_Y, collapsed: 520 });

  const measureSheetBounds = useCallback(() => {
    const sheetHeight = sheetRef.current?.offsetHeight || 0;
    if (!sheetHeight) return;
    const nextBounds = {
      expanded: REVIEW_SHEET_EXPANDED_Y,
      collapsed: Math.max(REVIEW_SHEET_COLLAPSED_MIN_Y, sheetHeight - REVIEW_SHEET_COLLAPSED_PEEK),
    };

    setSheetBounds((current) => {
      if (current.expanded === nextBounds.expanded && current.collapsed === nextBounds.collapsed) {
        return current;
      }
      return nextBounds;
    });
  }, []);

  useEffect(() => {
    measureSheetBounds();
    const target = sheetRef.current;
    const observer = typeof ResizeObserver !== 'undefined' && target
      ? new ResizeObserver(measureSheetBounds)
      : null;
    observer?.observe(target!);
    window.addEventListener('resize', measureSheetBounds);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measureSheetBounds);
    };
  }, [measureSheetBounds]);

  useEffect(() => {
    const controls = animate(sheetY, sheetExpanded ? sheetBounds.expanded : sheetBounds.collapsed, {
      type: 'tween',
      duration: 0.18,
      ease: [0.22, 1, 0.36, 1],
    });

    return () => controls.stop();
  }, [sheetBounds, sheetExpanded, sheetY]);

  const startSheetDrag = useCallback((event: PointerEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, textarea, select, a, img')) return;
    const content = target.closest('.rv-sheet-content') as HTMLElement | null;
    if (content) return;
    dragControls.start(event);
  }, [dragControls]);

  const snapSheet = useCallback((expanded: boolean) => {
    setSheetExpanded(expanded);
    animate(sheetY, expanded ? sheetBounds.expanded : sheetBounds.collapsed, {
      type: 'tween',
      duration: 0.18,
      ease: [0.22, 1, 0.36, 1],
    });
  }, [sheetBounds, sheetY]);

  const handleSheetContentPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const isSheetNearExpanded = sheetY.get() <= sheetBounds.expanded + 90;
    if ((!sheetExpanded && !isSheetNearExpanded) || target.closest('button, input, textarea, select, a, img')) return;

    sheetContentDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startX: event.clientX,
      originY: sheetY.get(),
      startTime: performance.now(),
      startScrollTop: event.currentTarget.scrollTop,
      active: false,
    };
  }, [sheetBounds.expanded, sheetExpanded, sheetY]);

  const handleSheetContentPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = sheetContentDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaY = event.clientY - drag.startY;
    const deltaX = event.clientX - drag.startX;

    if (!drag.active) {
      // Use startScrollTop (captured at pointerDown) NOT current scrollTop,
      // because the browser may have micro-scrolled a few px before this event fires.
      // Also allow a generous tolerance (≤8px) so minor scroll drift doesn't block drag.
      const scrolledDown = drag.startScrollTop > 8;

      if (deltaY <= 8 || Math.abs(deltaY) <= Math.abs(deltaX) || scrolledDown) {
        return;
      }
      drag.startY = event.clientY;
      drag.originY = sheetY.get();
      drag.startTime = performance.now();
      drag.active = true;
      event.currentTarget.classList.add('is-sheet-dragging');
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.scrollTop = 0;
    const travel = sheetBounds.collapsed - sheetBounds.expanded;
    const dampedDelta = deltaY > 0 ? deltaY * 0.72 : deltaY * 0.38;
    const nextY = Math.min(sheetBounds.collapsed, Math.max(sheetBounds.expanded, drag.originY + Math.min(dampedDelta, travel)));
    sheetY.set(nextY);
  }, [sheetBounds, sheetY]);

  const finishSheetContentDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = sheetContentDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaY = event.clientY - drag.startY;
    const elapsed = Math.max(performance.now() - drag.startTime, 1);
    const velocity = deltaY / elapsed;
    const midpoint = sheetBounds.expanded + ((sheetBounds.collapsed - sheetBounds.expanded) * 0.42);
    const shouldCollapse = drag.active && (sheetY.get() > midpoint || deltaY > 120 || velocity > 0.9);

    if (drag.active) {
      snapSheet(!shouldCollapse);
      event.currentTarget.classList.remove('is-sheet-dragging');
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    sheetContentDragRef.current = null;
  }, [sheetBounds, sheetY, snapSheet]);

  // Stable refs so touch handlers always see the latest values without re-registering
  const touchSheetBoundsRef = useRef(sheetBounds);
  const touchSnapSheetRef = useRef(snapSheet);
  useEffect(() => { touchSheetBoundsRef.current = sheetBounds; }, [sheetBounds]);
  useEffect(() => { touchSnapSheetRef.current = snapSheet; }, [snapSheet]);

  // Mobile touch handler (non-passive) — fixes drag on real devices/emulation.
  // On touch devices touch-action:pan-y causes the browser to commit to native scroll
  // before pointer events fire, making event.preventDefault() ineffective.
  // Native touch listeners registered with { passive: false } can still preventDefault.
  useEffect(() => {
    const content = sheetContentRef.current;
    if (!content) return;

    let touchStartY = 0;
    let touchStartScrollTop = 0;
    let touchOriginY = 0;
    let touchDragging = false;

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, input, textarea, select, a')) return;
      touchStartY = e.touches[0].clientY;
      touchStartScrollTop = content.scrollTop;
      touchOriginY = sheetY.get();
      touchDragging = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      const deltaY = e.touches[0].clientY - touchStartY;

      if (!touchDragging) {
        // Only intercept clear downward drag when content is at (or near) the top
        if (deltaY > 8 && touchStartScrollTop <= 8) {
          touchDragging = true;
          sheetContentDragRef.current = null; // cancel pointer-event handler
          content.classList.add('is-sheet-dragging');
        } else {
          return;
        }
      }

      e.preventDefault(); // works because this listener is non-passive
      const { expanded, collapsed } = touchSheetBoundsRef.current;
      const travel = collapsed - expanded;
      const nextY = Math.min(collapsed, Math.max(expanded, touchOriginY + Math.min(deltaY * 0.72, travel)));
      sheetY.set(nextY);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchDragging) return;
      touchDragging = false;
      content.classList.remove('is-sheet-dragging');

      const deltaY = e.changedTouches[0].clientY - touchStartY;
      const { expanded, collapsed } = touchSheetBoundsRef.current;
      const midpoint = expanded + ((collapsed - expanded) * 0.42);
      const shouldCollapse = sheetY.get() > midpoint || deltaY > 120;
      touchSnapSheetRef.current(!shouldCollapse);
    };

    content.addEventListener('touchstart', onTouchStart, { passive: true });
    content.addEventListener('touchmove', onTouchMove, { passive: false });
    content.addEventListener('touchend', onTouchEnd, { passive: true });
    content.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      content.removeEventListener('touchstart', onTouchStart);
      content.removeEventListener('touchmove', onTouchMove);
      content.removeEventListener('touchend', onTouchEnd);
      content.removeEventListener('touchcancel', onTouchEnd);
    };
    // sheetY, sheetContentDragRef are stable refs — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search logic for floating bar
  useEffect(() => {
    if (skipNextFloatingSearchRef.current) {
      skipNextFloatingSearchRef.current = false;
      setIsSearchingMap(false);
      setFloatingSearchDone(false);
      return;
    }
    const query = floatingSearch.trim();
    if (query.length < 2) {
      setFloatingResults([]);
      setIsSearchingMap(false);
      setFloatingSearchDone(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearchingMap(true);
      setFloatingSearchDone(false);
      try {
        const localResults = getLocalKoreanSearchResults(query);
        if (localResults.length > 0) {
          setFloatingResults(localResults);
          return;
        }

        const naverResults = await withTimeout(searchNaverAddressResults(query), FLOATING_SEARCH_TIMEOUT_MS, 'Naver search timed out');
        if (naverResults.length > 0) {
          setFloatingResults(naverResults);
          return;
        }

        const abortTimer = window.setTimeout(() => controller.abort(), FLOATING_SEARCH_TIMEOUT_MS);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&namedetails=1&limit=5&countrycodes=kr`, {
            headers: {
              'Accept-Language': 'ko,en;q=0.9',
            },
            signal: controller.signal,
          });
          const data = await res.json();
          if (Array.isArray(data)) {
            const addressTail = extractKoreanAddressTail(query);
            setFloatingResults(data.map((row) => {
              const formatted = formatOsmKoreanAddress(row);
              if (!addressTail) {
                return { ...row, ...formatted };
              }
              const cityDistrict = compactKoreanAddress([
                row?.address?.city || row?.address?.state || row?.address?.province || '',
                row?.address?.borough || row?.address?.city_district || row?.address?.county || '',
              ].filter(Boolean).join(' '));
              return {
                ...row,
                title: addressTail,
                formattedAddress: [cityDistrict, addressTail].filter(Boolean).join(' '),
              };
            }));
          }
        } finally {
          window.clearTimeout(abortTimer);
        }
      } catch (err) {
        const isExpectedTimeout = err instanceof Error && err.message.toLowerCase().includes('timed out');
        if (!(err instanceof DOMException && err.name === 'AbortError') && !isExpectedTimeout) {
          console.error('Search error:', err);
        }
        setFloatingResults([]);
      } finally {
        setIsSearchingMap(false);
        setFloatingSearchDone(true);
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
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
    skipNextFloatingSearchRef.current = true;
    setFloatingSearch(getFloatingPlaceTitle(res));
    setFloatingSelectedAddress(getFloatingPlaceAddress(res));
    setFloatingResults([]);
  };

  const handleMarkerClick = useCallback((reviewId: string) => {
    setSelectedReviewId(reviewId);
    setSheetExpanded(true);
    setTimeout(() => {
      const el = reviewRefs.current.get(reviewId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 520);
  }, []);

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
  const closeWriter = () => {
    setIsWriting(false);
    setSelectedPlace(null);
    setWriteCat('food');
    setWriteRating(0);
    setWriteTitle('');
    setWriteContent('');
    setSearchQuery('');
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setIsAnon(false);
  };

  return (
    <>
      <div className="rv-container">
        <AnimatePresence>
          {reviewNotice ? (
            <motion.div
              className="rv-inline-notice"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {reviewNotice}
            </motion.div>
          ) : null}
        </AnimatePresence>
        {/* Floating Search Bar */}
        <div className="rv-floating-search">
          <div className="rv-search-inner">
            <Search size={18} color="#64748b" />
            <input
              type="text"
              placeholder={reviewUi.searchPlaceholder}
              className="rv-search-input-field"
              value={floatingSearch}
              onChange={e => {
                setFloatingSelectedAddress('');
                setFloatingSearchDone(false);
                setFloatingSearch(e.target.value);
              }}
            />
            {isSearchingMap && <Loader2 size={16} className="cm-spin" color="#2752ff" />}
          </div>
          {floatingSelectedAddress ? (
            <div className="rv-floating-selected-address">
              <MapPin size={13} />
              <span>{floatingSelectedAddress}</span>
            </div>
          ) : null}

          {!isWriting && floatingResults.length > 0 ? (
            <div className="rv-floating-results">
              {floatingResults.map((res, i) => {
                const displayName = getFloatingPlaceTitle(res);
                const address = getFloatingPlaceAddress(res);

                return (
                  <div key={i} className="rv-floating-item" onClick={() => handleFloatingSelect(res)}>
                    <MapPin size={14} />
                    <span className="rv-floating-item-copy">
                      <strong>{displayName}</strong>
                      <small>{address}</small>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : !isWriting && floatingSearchDone && floatingSearch.trim().length >= 2 && !isSearchingMap ? (
            <div className="rv-floating-results rv-floating-results--empty">
              <div className="rv-floating-empty">
                {isKo ? '검색 결과가 없습니다.' : 'Không tìm thấy địa chỉ, thử từ khoá khác nhé.'}
              </div>
            </div>
          ) : null}
        </div>

        {/* Map Background */}
        <div className="rv-map-wrap">
          <NaverReviewMap
            ref={mapRef}
            groups={groupedPlaces}
            selectedReviewId={selectedReviewId}
            userPos={userPos}
            onBoundsChange={setMapBounds}
            onMarkerClick={handleMarkerClick}
          />
          <div className="rv-map-controls" aria-label={isKo ? '지도 조작' : 'Điều khiển bản đồ'}>
            <div className="rv-map-zoom">
              <button type="button" aria-label={isKo ? '확대' : 'Phóng to'} onClick={() => mapRef.current?.zoomIn()}>
                +
              </button>
              <button type="button" aria-label={isKo ? '축소' : 'Thu nhỏ'} onClick={() => mapRef.current?.zoomOut()}>
                −
              </button>
            </div>
            <button type="button" className="rv-map-location" aria-label={isKo ? '내 위치' : 'Vị trí của tôi'} onClick={handleMyLocation}>
              <Navigation size={18} />
            </button>
          </div>
        </div>

        {/* Bottom Sheet Review List */}
        <motion.div
          ref={sheetRef}
          className={`rv-bottom-sheet ${sheetExpanded ? 'is-expanded' : 'is-collapsed'}`}
          style={{ y: sheetY }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: sheetBounds.expanded, bottom: sheetBounds.collapsed }}
          dragElastic={0}
          dragMomentum={false}
          onPointerDownCapture={startSheetDrag}
          onDragEnd={(_, info) => {
            const currentY = sheetY.get();
            const midpoint = sheetBounds.expanded + ((sheetBounds.collapsed - sheetBounds.expanded) * 0.52);
            const dragVelocity = info.velocity.y;

            // Snap through our no-bounce tween so a hard pull cannot leave
            // the sheet feeling like it fell past its resting point.
            if (dragVelocity < -760) {
              snapSheet(true);
            } else if (dragVelocity > 720) {
              snapSheet(false);
            } else if (currentY < midpoint) {
              snapSheet(true);
            } else {
              snapSheet(false);
            }
          }}
        >
          <div
            className="rv-sheet-header"
            style={{ cursor: 'grab' }}
          >
            <div className="rv-sheet-handle" />
            <div className="rv-sheet-title-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3>{mapBounds ? reviewUi.foundPlaces(groupedPlaces.length) : '...'}</h3>
                <span className="rv-avg-score">★ {avgRating}</span>
              </div>
              <button
                type="button"
                className="rv-sheet-write-btn"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setFloatingResults([]);
                  setFloatingSearchDone(false);
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
            <div className="rv-sort-chips" onClick={e => e.stopPropagation()}>
              {([
                ['trusted', reviewUi.sortTrusted],
                ['newest', reviewUi.sortNewest],
                ['rating', reviewUi.sortRating],
              ] as Array<[ReviewSortMode, string]>).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={sortMode === mode ? 'active' : ''}
                  onClick={() => setSortMode(mode)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div
            className="rv-sheet-content"
            ref={sheetContentRef}
            onPointerDown={handleSheetContentPointerDown}
            onPointerMove={handleSheetContentPointerMove}
            onPointerUp={finishSheetContentDrag}
            onPointerCancel={finishSheetContentDrag}
          >
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
                const catIcon = REVIEW_CAT_ICONS[review.category as keyof typeof REVIEW_CAT_ICONS] || REVIEW_CAT_ICONS.other;
                const isSelected = selectedReviewId === review.id;
                const userVote = reviewVotes[review.id];
                const imageUrls = normalizeReviewImages(review.images);
                const canDeleteReview = review.user_id === currentUserId || isReviewAdmin;
                const isSafetyMenuOpen = activeSafetyReviewId === review.id;
                return (
                  <article
                    key={review.id}
                    className={`rv-item-card ${imageUrls.length > 0 ? 'has-image' : ''} ${isSelected ? 'selected' : ''} ${isSafetyMenuOpen ? 'menu-open' : ''}`}
                    ref={el => { if (el) reviewRefs.current.set(review.id, el); }}
                    onClick={() => {
                      setActiveSafetyReviewId(null);
                      setSelectedReviewId(review.id);
                    }}
                  >
                    <div className="rv-item-rank" style={{ background: isSelected ? '#2752ff' : '#94a3b8' }}>
                      {idx + 1}
                    </div>
                    <div className="rv-item-main">
                      <div className="rv-item-info">
                        <div className="rv-item-place-row">
                          <h4 className="rv-item-place">{review.place_name}</h4>
                          <span className="rv-item-cat-label">
                            <span>{catIcon}</span>
                            {reviewUi.categories[review.category as Exclude<ReviewCategory, 'all'>] || cat.label}
                          </span>
                        </div>
                        <p className="rv-item-address">{review.place_address.split(',').slice(0, 2).join(', ')}</p>
                        <div className="rv-item-meta">
                          <span className="rv-item-author">{review.display_name}</span>
                          <span className="rv-item-dot">·</span>
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
                        {canDeleteReview ? (
                          <button
                            type="button"
                            className="rv-review-delete"
                            disabled={deletingReviewId === review.id}
                            aria-label={isKo ? '리뷰 삭제' : 'Xoá review'}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteReview(review);
                            }}
                          >
                            {deletingReviewId === review.id ? (
                              <Loader2 size={14} className="cm-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        ) : null}
                        {!canDeleteReview && review.user_id ? (
                          <div className="rv-review-menu-wrap">
                            <button
                              type="button"
                              className="rv-review-menu-trigger"
                              aria-label={isKo ? '리뷰 메뉴' : 'Tùy chọn review'}
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveSafetyReviewId((current) => current === review.id ? null : review.id);
                              }}
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {isSafetyMenuOpen ? (
                              <div className="rv-review-menu" onClick={(event) => event.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveSafetyReviewId(null);
                                    void onReport('review', review.id, review.user_id);
                                  }}
                                >
                                  {reviewUi.report}
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() => {
                                    setActiveSafetyReviewId(null);
                                    void onBlockUser(review.user_id);
                                  }}
                                >
                                  {reviewUi.block}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="rv-item-body">
                      <h5 className="rv-item-title">{review.title}</h5>
                      <p className="rv-item-text">{shortText(review.content, 120)}</p>

                      {imageUrls.length > 0 && (
                        <div className="rv-review-images">
                          {imageUrls.map((url, i) => (
                            <button
                              key={`${review.id}-image-${i}`}
                              type="button"
                              className="rv-review-image"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPreviewImage(url);
                              }}
                            >
                              <img src={url} alt={review.title} loading="lazy" />
                            </button>
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

      <AnimatePresence>
        {previewImage ? (
          <motion.div
            className="rv-image-preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
          >
            <button type="button" className="rv-image-preview-close" aria-label={isKo ? '닫기' : 'Đóng'}>
              <X size={20} />
            </button>
            <motion.img
              src={previewImage}
              alt={isKo ? '리뷰 이미지' : 'Ảnh review'}
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 12 }}
              transition={{ type: 'spring', damping: 24, stiffness: 260 }}
              onClick={(event) => event.stopPropagation()}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

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
                    placeholder={isKo ? '주소를 검색해주세요' : 'Tìm kiếm địa chỉ tại Hàn Quốc...'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onFocus={() => { if (addressSuggestions.length > 0) setShowSuggestions(true); }}
                    autoComplete="off"
                  />
                  {fetchingSuggestions && <Loader2 size={15} className="cm-spin rv-suggest-spinner" />}
                  {showSuggestions && addressSuggestions.length > 0 && (
                    <ul className="rv-address-suggestions">
                      {addressSuggestions.map((s, i) => (
                        <li
                          key={i}
                          className="rv-address-suggestion-item"
                          onMouseDown={() => handleSelectSuggestion(s)}
                        >
                          <MapPin size={14} className="rv-suggest-pin" />
                          <div className="rv-suggest-texts">
                            <span className="rv-suggest-title">{s.title}</span>
                            <span className="rv-suggest-addr">{s.formattedAddress}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
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

            {/* Images — KakaoTalk-style preview grid */}
            <div className="rv-write-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <label className="rv-write-label" style={{ margin: 0 }}>{isKo ? '🖼️ 사진 (최대 3장)' : '🖼️ Hình ảnh (Tối đa 3)'}</label>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{imagePreviews.length}/3</span>
              </div>
              <div className="rv-image-upload-grid">
                {imagePreviews.map((url, idx) => (
                  <div key={idx} className="rv-img-thumb-wrap">
                    <img src={url} alt={`Ảnh ${idx + 1}`} className="rv-img-thumb" />
                    <button
                      type="button"
                      className="rv-img-remove-btn"
                      onClick={() => removeImage(idx)}
                      aria-label={isKo ? '삭제' : 'Xoá ảnh'}
                    >
                      <X size={13} />
                    </button>
                    <span className="rv-img-order">{idx + 1}</span>
                  </div>
                ))}
                {imagePreviews.length < 3 && (
                  <label className="rv-img-add-btn">
                    {uploading ? (
                      <Loader2 size={24} className="cm-spin" style={{ color: '#2752ff' }} />
                    ) : (
                      <>
                        <div className="rv-img-add-icon"><Plus size={24} strokeWidth={2} /></div>
                        <span className="rv-img-add-text">{isKo ? '사진 추가' : 'Thêm ảnh'}</span>
                      </>
                    )}
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
