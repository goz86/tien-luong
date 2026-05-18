/**
 * AchievementScreen — Hành Trình / 나의 여정
 *
 * Supabase table required:
 * ---------------------------------------------------
 * create table public.admin_events (
 *   id          uuid primary key default gen_random_uuid(),
 *   title       text not null,
 *   description text,
 *   reward_emoji text default '🎁',
 *   start_date  date not null,
 *   end_date    date not null,
 *   active      boolean default true,
 *   created_at  timestamptz default now()
 * );
 * alter table public.admin_events enable row level security;
 * create policy "public read" on public.admin_events for select using (true);
 * create policy "admin insert" on public.admin_events for all using (auth.role() = 'authenticated');
 * ---------------------------------------------------
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Gift, Map, ChevronRight, Calendar, Sparkles, Trophy, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { calculateShiftPay, formatKrw } from '../lib/salary';
import { supabase } from '../lib/supabase';
import type { Expense, Shift, PersonalGoal } from '../lib/types';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

interface AdminEvent {
  id: string;
  title: string;
  description: string | null;
  reward_emoji: string;
  start_date: string;
  end_date: string;
}

interface Milestone {
  key: string;
  threshold: number; // VND
  emoji: string;
  imgKey: string;    // for future image replacement
  label_vi: string;
  label_ko: string;
  desc_vi: string;
  desc_ko: string;
  color: string;
  bgColor: string;
}

interface CharacterStage {
  threshold: number;
  emoji: string;
  imgKey: string;
  name_vi: string;
  name_ko: string;
  desc_vi: string;
  desc_ko: string;
}

interface CompanionOption {
  key: string;
  imgKey: string | null;
  label_vi: string;
  label_ko: string;
  desc_vi: string;
  desc_ko: string;
}

// ─────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────

const CHARACTER_STAGES: CharacterStage[] = [
  {
    threshold: 0, emoji: '🥚', imgKey: 'hamster_egg',
    name_vi: 'Trứng Bí Ẩn', name_ko: '신비한 알',
    desc_vi: 'Hành trình bắt đầu từ đây...', desc_ko: '여정이 시작됩니다...',
  },
  {
    threshold: 1_000_000, emoji: '🐣', imgKey: 'hamster_baby',
    name_vi: 'Baby Hamster', name_ko: '아기 햄스터',
    desc_vi: 'Mới bắt đầu kiếm tiền!', desc_ko: '이제 막 돈을 벌기 시작했어요!',
  },
  {
    threshold: 10_000_000, emoji: '🐹', imgKey: 'hamster_normal',
    name_vi: 'Hamster Cần Cù', name_ko: '부지런한 햄스터',
    desc_vi: 'Đang trên đường thành công!', desc_ko: '성공을 향해 가는 중!',
  },
  {
    threshold: 35_000_000, emoji: '🐹🎓', imgKey: 'hamster_student',
    name_vi: 'Hamster Sinh Viên', name_ko: '학생 햄스터',
    desc_vi: 'Tích lũy kinh nghiệm & tiền!', desc_ko: '경험과 돈을 쌓고 있어요!',
  },
  {
    threshold: 80_000_000, emoji: '🐹💼', imgKey: 'hamster_office',
    name_vi: 'Hamster Dân Văn Phòng', name_ko: '직장인 햄스터',
    desc_vi: 'Chuyên nghiệp rồi đó!', desc_ko: '이제 프로가 됐어요!',
  },
  {
    threshold: 150_000_000, emoji: '🐹👑', imgKey: 'hamster_rich',
    name_vi: 'Hamster Thành Đạt', name_ko: '성공한 햄스터',
    desc_vi: 'Gần về nhà rồi!', desc_ko: '거의 다 왔어요!',
  },
  {
    threshold: 200_000_000, emoji: '🏆', imgKey: 'hamster_home',
    name_vi: 'Hamster Trở Về', name_ko: '귀국 햄스터',
    desc_vi: 'Hoàn thành hành trình!', desc_ko: '여정 완료!',
  },
];

const DEFAULT_COMPANION_KEY = 'journey';
const COMPANION_STORAGE_KEY = 'duhoc-mate-ach-companion';
const COMPANION_CHANGE_EVENT = 'duhoc-mate-ach-companion-change';

const COMPANION_OPTIONS: CompanionOption[] = [
  { key: DEFAULT_COMPANION_KEY, imgKey: null, label_vi: 'Theo cấp', label_ko: '레벨별', desc_vi: '', desc_ko: '' },
  { key: 'hamster', imgKey: 'companion_hamster', label_vi: 'Mầm Non ', label_ko: '새싹 저축 친구', desc_vi: 'Nhỏ xíu nhưng ngày nào cũng lớn thêm một chút.', desc_ko: '작지만 매일 조금씩 자라는 동반자.' },
  { key: 'cat', imgKey: 'companion_cat', label_vi: 'Mèo Thần Tài', label_ko: '당당한 지갑 고양이', desc_vi: 'Mèo cam, bảo vệ chủ nhân, và luôn có tinh thần tốt.', desc_ko: '일도 하고 지갑도 챙기는 당당한 친구.' },
  { key: 'bunny', imgKey: 'companion_bunny', label_vi: 'Thỏ Tiết Kiệm', label_ko: '저축 항아리 토끼', desc_vi: 'Tiết kiệm để thành phú bà.', desc_ko: '모아둔 돈을 소중히 안고 가는 친구.' },
  { key: 'bear', imgKey: 'companion_bear', label_vi: 'Gấu Chăm Chỉ Đi Làm', label_ko: '성실한 알바 곰', desc_vi: 'Đi làm chăm chỉ để có tiền cưới vợ.', desc_ko: '공부와 알바를 묵묵히 함께하는 친구.' },
  { key: 'fox', imgKey: 'companion_fox', label_vi: 'Cáo Nhanh Nhẹn', label_ko: '영리한 계획 여우', desc_vi: 'Cần cù thì bù thông minh,nhớ chưa.', desc_ko: '계산도 빠르고 계획도 영리한 친구.' },
  { key: 'star', imgKey: 'companion_star', label_vi: 'Sao May Mắn', label_ko: '귀국 행운 별', desc_vi: 'Luôn nhắc mình kiếm tiền là để sống chủ động hơn.', desc_ko: '돈을 모으는 이유를 반짝이며 알려주는 친구.' },
];

const COMPANION_MOTIVATIONS = [
  '힘내세요',
  '화이팅!',
  '잘하고 있어요',
  '천천히 가요',
  '오늘도 굿!',
  '수고했어요',
  '괜찮아요',
];

const GOAL_PRESETS = [
  { icon: '✈️', title_vi: 'Vé máy bay về nhà', title_ko: '귀국 항공권', amount: 8_000_000, currency: 'VND' as const },
  { icon: '📱', title_vi: 'iPhone mới', title_ko: '새 아이폰', amount: 1_500_000, currency: 'KRW' as const },
  { icon: '🏠', title_vi: 'Tiền nhà 1 tháng', title_ko: '한 달 월세', amount: 500_000, currency: 'KRW' as const },
  { icon: '💌', title_vi: 'Gửi về gia đình', title_ko: '가족에게 송금', amount: 10_000_000, currency: 'VND' as const },
];

const MOTIVATION_POOL = {
  vi: [
    'Bạn đang đi xa hơn mình nghĩ.',
    'Mỗi ca làm hôm nay là một bước gần hơn tới mục tiêu.',
    'Chậm cũng được, miễn là bạn vẫn tiếp tục.',
    'Tiền tiết kiệm nhỏ hôm nay sẽ thành lựa chọn lớn ngày mai.',
    'Bạn không bắt đầu lại từ đầu, bạn bắt đầu từ kinh nghiệm.',
    'Một ngày chăm chỉ nữa đã được cộng vào hành trình của bạn.',
    'Giữ nhịp này, phiên bản tự do hơn của bạn đang tới.',
    'Tự hào vì bạn vẫn cố gắng, kể cả những ngày mệt.',
  ],
  ko: [
    '생각보다 더 멀리 오고 있어요.',
    '오늘의 한 시간이 목표에 더 가까워지는 한 걸음이에요.',
    '천천히 가도 괜찮아요. 계속 가고 있으니까요.',
    '오늘의 작은 저축이 내일의 큰 선택지가 돼요.',
    '처음부터 다시가 아니라, 경험 위에서 다시 시작하는 거예요.',
    '오늘의 노력도 당신의 여정에 더해졌어요.',
  ],
};

const NET_WORTH_MILESTONES: Milestone[] = [
  { key: 'start', threshold: 0, emoji: '🌱', imgKey: 'net_start', label_vi: 'Lv.0: Sang Hàn Làm Lại Từ Đầu', label_ko: 'Lv.0: 한국에서 다시 시작', desc_vi: 'Từ con số nhỏ, mình bắt đầu giữ lại từng đồng ròng.', desc_ko: '작은 금액부터 차곡차곡 모으는 시작점.', color: '#14b8a6', bgColor: '#f0fdfa' },
  { key: 'smart_food', threshold: 5_000_000, emoji: '🍱', imgKey: 'net_smart_food', label_vi: 'Tiết kiệm là chân ái', label_ko: '식비 관리 시작', desc_vi: 'Sinh hoạt vẫn ổn, ví cũng bắt đầu ấm lên.', desc_ko: '생활도 챙기고 지갑도 조금 따뜻해졌어요.', color: '#10b981', bgColor: '#ecfdf5' },
  { key: 'gold_chi', threshold: 18_000_000, emoji: '🪙', imgKey: 'net_gold_chi', label_vi: 'Mua Chỉ Vàng Đầu Tiên', label_ko: '첫 금 한 돈', desc_vi: 'Thu nhập ròng đã có hình hài của tài sản thật.', desc_ko: '순수입이 진짜 자산의 형태를 갖기 시작했어요.', color: '#f59e0b', bgColor: '#fffbeb' },
  { key: 'seoul', threshold: 50_000_000, emoji: '🏙️', imgKey: 'net_seoul', label_vi: 'Vui Seoul Không Run Ví', label_ko: '서울 탐방, 지갑 안 떨림', desc_vi: 'Có thể đi chơi một chút mà vẫn không lệch kế hoạch.', desc_ko: '조금 즐겨도 계획이 흔들리지 않는 구간.', color: '#0ea5e9', bgColor: '#f0f9ff' },
  { key: 'emergency', threshold: 100_000_000, emoji: '🛡️', imgKey: 'net_emergency', label_vi: 'Quỹ Dự Phòng Ổn Áp', label_ko: '든든한 비상금', desc_vi: 'Có biến cũng đỡ hoảng, vì mình đã có lớp đệm.', desc_ko: '예상 못 한 일이 와도 버틸 여유가 생겼어요.', color: '#2563eb', bgColor: '#eff6ff' },
  { key: 'gold_luong', threshold: 165_000_000, emoji: '🏅', imgKey: 'net_gold_luong', label_vi: 'Múc Được 1 Lượng Vàng', label_ko: '금 한 냥 클리어', desc_vi: 'Mốc vàng đúng nghĩa: nhìn lại thấy mình đi xa thật.', desc_ko: '말 그대로 골드 마일스톤, 꽤 멀리 왔어요.', color: '#d97706', bgColor: '#fff7ed' },
  { key: 'wedding_net', threshold: 250_000_000, emoji: '💍', imgKey: 'net_wedding', label_vi: 'Đủ Làm Đám Cưới :D', label_ko: '결혼식도 가능 :D', desc_vi: 'Không cần quá phô, đủ để làm một ngày thật đáng nhớ.', desc_ko: '과하지 않아도 기억에 남을 하루를 만들 수 있어요.', color: '#f43f5e', bgColor: '#fff1f2' },
  { key: 'car_loading', threshold: 450_000_000, emoji: '🚗', imgKey: 'net_car_loading', label_vi: 'Đủ mua Xe Ô Tô', label_ko: '첫 차 로딩 중...', desc_vi: 'Một chiếc xe bình dân bắt đầu bước vào vùng có thể nghĩ tới.', desc_ko: '첫 차를 현실적으로 생각해볼 수 있는 구간.', color: '#6366f1', bgColor: '#eef2ff' },
  { key: 'vietkieu', threshold: 650_000_000, emoji: '💼', imgKey: 'net_vietkieu', label_vi: 'Việt Kiều Pro VIP', label_ko: '프로 유학생 모드', desc_vi: 'Không chỉ đi làm thêm nữa, đây là cấp độ biết tích sản.', desc_ko: '알바를 넘어 자산을 쌓는 단계.', color: '#8b5cf6', bgColor: '#f5f3ff' },
  { key: 'return_plan', threshold: 800_000_000, emoji: '🧭', imgKey: 'net_return_plan', label_vi: 'Lên kế hoạch làm ăn', label_ko: '계획 있는 귀국', desc_vi: 'Nếu về nước, bạn về bằng một kế hoạch chứ không phải cảm tính.', desc_ko: '감정이 아니라 계획으로 돌아갈 수 있어요.', color: '#0f766e', bgColor: '#f0fdfa' },
  { key: 'home_free', threshold: 1_000_000_000, emoji: '🇻🇳', imgKey: 'net_home_free', label_vi: 'Tôi đã trở thành tỷ phú.', label_ko: '당당하게 집으로', desc_vi: '1 tỷ thu nhập ròng: hành trình về nhà đã có hình hài.', desc_ko: '순수입 10억 VND, 돌아갈 길이 보이기 시작했어요.', color: '#ef4444', bgColor: '#fef2f2' },
];

const FINAL_NET_MILESTONE = NET_WORTH_MILESTONES[NET_WORTH_MILESTONES.length - 1];
const BILLION_CELEBRATION_KEY = 'duhoc-mate-billion-net-celebrated';

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

function fmtVnd(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString('vi-VN');
}

function fmtKrwCompact(n: number): string {
  if (n >= 100_000_000) {
    const eok = n / 100_000_000;
    return `${Number(eok.toFixed(eok >= 10 ? 0 : 1)).toLocaleString('ko-KR')}억 원`;
  }
  return formatKrw(n);
}

function formatGoalMoney(value: number, currency: PersonalGoal['currency']) {
  if (currency === 'KRW') return value >= 100_000_000 ? fmtKrwCompact(value) : formatKrw(value);
  return fmtVnd(value);
}

function calculateNetIncomeKrw(shifts: Shift[], expenses: Expense[]) {
  const grossKrw = shifts.reduce((sum, s) => sum + calculateShiftPay(s).total, 0);
  const expenseKrw = expenses.reduce((sum, e) => sum + e.amount, 0);
  return Math.max(0, grossKrw - expenseKrw);
}

function calculateNetIncomeVnd(shifts: Shift[], expenses: Expense[], rateValue: number) {
  return calculateNetIncomeKrw(shifts, expenses) * rateValue;
}

function hasCelebratedBillion() {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(BILLION_CELEBRATION_KEY) === '1';
}

function markBillionCelebrated() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BILLION_CELEBRATION_KEY, '1');
}

function iconUrl(name: string) {
  return `${import.meta.env.BASE_URL}icon/${name}.png?v=20260518-ach`;
}

function faceImg(progressPct: number, hasUnclaimed: boolean, totalVnd: number): string {
  if (totalVnd === 0) return 'face_sad';
  if (hasUnclaimed) return 'face_shock';
  if (progressPct >= 90) return 'face_proud';
  if (progressPct >= 60) return 'face_excited';
  if (progressPct >= 20) return 'face_happy';
  return 'face_sleepy';
}

function claimedKey(uid?: string | null) {
  return `ach-claimed-${uid ?? 'guest'}`;
}
function loadClaimed(uid?: string | null): string[] {
  try { return JSON.parse(localStorage.getItem(claimedKey(uid)) ?? '[]'); }
  catch { return []; }
}
function saveClaimed(keys: string[], uid?: string | null) {
  localStorage.setItem(claimedKey(uid), JSON.stringify(keys));
}

function getCompanionOption(key: string | null): CompanionOption {
  return COMPANION_OPTIONS.find(option => option.key === key) ?? COMPANION_OPTIONS[0];
}

function loadCompanionKey(): string {
  if (typeof window === 'undefined') return DEFAULT_COMPANION_KEY;
  return getCompanionOption(window.localStorage.getItem(COMPANION_STORAGE_KEY)).key;
}

function saveCompanionKey(key: string) {
  if (typeof window === 'undefined') return;
  const nextKey = getCompanionOption(key).key;
  window.localStorage.setItem(COMPANION_STORAGE_KEY, nextKey);
  window.dispatchEvent(new CustomEvent(COMPANION_CHANGE_EVENT, { detail: nextKey }));
}

function useCompanionChoice() {
  const [selectedKey, setSelectedKey] = useState(() => loadCompanionKey());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setSelectedKey(loadCompanionKey());
    const syncCustom = (event: Event) => {
      setSelectedKey(getCompanionOption((event as CustomEvent<string>).detail).key);
    };
    window.addEventListener('storage', sync);
    window.addEventListener(COMPANION_CHANGE_EVENT, syncCustom);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(COMPANION_CHANGE_EVENT, syncCustom);
    };
  }, []);

  const selectCompanion = useCallback((key: string) => {
    const nextKey = getCompanionOption(key).key;
    setSelectedKey(nextKey);
    saveCompanionKey(nextKey);
  }, []);

  return {
    selectedKey,
    selectedCompanion: getCompanionOption(selectedKey),
    selectCompanion,
  };
}

function pickMotivation(exclude?: string) {
  if (COMPANION_MOTIVATIONS.length <= 1) return COMPANION_MOTIVATIONS[0];
  let next = COMPANION_MOTIVATIONS[Math.floor(Math.random() * COMPANION_MOTIVATIONS.length)];
  if (exclude && next === exclude) {
    const currentIndex = COMPANION_MOTIVATIONS.indexOf(next);
    next = COMPANION_MOTIVATIONS[(currentIndex + 1) % COMPANION_MOTIVATIONS.length];
  }
  return next;
}

// ─────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────

type GiftIconKey = 'vn_flag' | 'vn_nonla' | 'vn_pho' | 'vn_lotus' | 'kr_lotto' | 'kr_kimchi' | 'kr_hanbok';

const GIFT_ICON_POOL: GiftIconKey[] = ['vn_flag', 'vn_nonla', 'vn_pho', 'vn_lotus', 'kr_lotto', 'kr_kimchi', 'kr_hanbok'];

function pickGiftIcon(exclude?: GiftIconKey): GiftIconKey {
  if (GIFT_ICON_POOL.length <= 1) return GIFT_ICON_POOL[0];
  let next = GIFT_ICON_POOL[Math.floor(Math.random() * GIFT_ICON_POOL.length)];
  if (exclude && next === exclude) {
    const currentIndex = GIFT_ICON_POOL.indexOf(next);
    next = GIFT_ICON_POOL[(currentIndex + 1) % GIFT_ICON_POOL.length];
  }
  return next;
}

function GiftRewardIcon({ icon }: { icon: GiftIconKey }) {
  const isVietnam = icon.startsWith('vn_');

  return (
    <svg className={`ach-gift-reward-mark ach-gift-reward-mark--${isVietnam ? 'vn' : 'kr'}`} viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="achGiftVnBg" x1="14" y1="10" x2="82" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff7ed" />
          <stop offset="0.52" stopColor="#fee2e2" />
          <stop offset="1" stopColor="#dcfce7" />
        </linearGradient>
        <linearGradient id="achGiftKrBg" x1="14" y1="10" x2="82" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#eff6ff" />
          <stop offset="0.5" stopColor="#f8fafc" />
          <stop offset="1" stopColor="#fef3c7" />
        </linearGradient>
        <linearGradient id="achGiftLotus" x1="30" y1="48" x2="66" y2="78" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="0.54" stopColor="#f97316" />
          <stop offset="1" stopColor="#facc15" />
        </linearGradient>
        <linearGradient id="achGiftHanbok" x1="28" y1="31" x2="70" y2="78" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f9a8d4" />
          <stop offset="0.48" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#fde68a" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="84" height="84" rx="28" fill={isVietnam ? 'url(#achGiftVnBg)' : 'url(#achGiftKrBg)'} />

      {icon === 'vn_flag' && (
        <g className="ach-gift-icon-shape">
          <path d="M25 25v45" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
          <path d="M29 24c14-7 27 8 42 1v31c-15 7-28-8-42-1Z" fill="#dc2626" />
          <polygon points="50,34 53.5,42 62,42.5 55.6,47.8 57.6,56 50,51.6 42.4,56 44.4,47.8 38,42.5 46.5,42" fill="#facc15" />
          <path d="M25 72h26" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}

      {icon === 'vn_nonla' && (
        <g className="ach-gift-icon-shape">
          <path d="M18 58c14-22 45-30 60 0-16 12-43 12-60 0Z" fill="#fde68a" />
          <path d="M28 57c12-10 28-16 40 0" fill="none" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
          <path d="M48 30v31" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
          <path d="M38 64c7 6 14 6 21 0" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
          <path d="M25 72c12 5 33 5 46 0" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}

      {icon === 'vn_pho' && (
        <g className="ach-gift-icon-shape">
          <path d="M30 30c-7 9 6 11 0 20M48 26c-8 9 7 12 0 21M66 30c-7 8 5 10 0 19" fill="none" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
          <path d="M22 50h52c-2 18-12 27-26 27S24 68 22 50Z" fill="#fff7ed" stroke="#0f172a" strokeWidth="3" />
          <path d="M29 55c8 7 30 7 39 0" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />
          <path d="M34 62c8 4 20 4 28 0" fill="none" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
          <path d="M64 43l17-13M68 48l18-14" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
          <circle cx="39" cy="56" r="3" fill="#22c55e" />
          <circle cx="57" cy="56" r="3" fill="#22c55e" />
        </g>
      )}

      {icon === 'vn_lotus' && (
        <g className="ach-gift-icon-shape">
          <path d="M48 27c8 8 12 25 0 42-12-17-8-34 0-42Z" fill="url(#achGiftLotus)" />
          <path d="M32 39c12 2 20 11 16 30-15-6-21-16-16-30Z" fill="#fb7185" />
          <path d="M64 39c-12 2-20 11-16 30 15-6 21-16 16-30Z" fill="#f97316" />
          <path d="M21 56c13-3 25 1 27 14-15 4-25-1-27-14Z" fill="#facc15" />
          <path d="M75 56c-13-3-25 1-27 14 15 4 25-1 27-14Z" fill="#22c55e" />
          <path d="M30 76h36" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}

      {icon === 'kr_lotto' && (
        <g className="ach-gift-icon-shape">
          <path d="M25 28h46a7 7 0 0 1 7 7v11a8 8 0 0 0 0 16v7a7 7 0 0 1-7 7H25a7 7 0 0 1-7-7v-7a8 8 0 0 0 0-16V35a7 7 0 0 1 7-7Z" fill="#fff" stroke="#0f172a" strokeWidth="3" />
          <circle cx="34" cy="43" r="7" fill="#ef4444" />
          <circle cx="50" cy="43" r="7" fill="#2563eb" />
          <circle cx="66" cy="43" r="7" fill="#facc15" />
          <circle cx="42" cy="61" r="7" fill="#22c55e" />
          <circle cx="58" cy="61" r="7" fill="#f97316" />
          <path d="M27 70h42" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 5" />
        </g>
      )}

      {icon === 'kr_kimchi' && (
        <g className="ach-gift-icon-shape">
          <path d="M31 38h34l-4 36H35Z" fill="#fff7ed" stroke="#0f172a" strokeWidth="3" />
          <path d="M35 31h26l5 9H30Z" fill="#ef4444" stroke="#0f172a" strokeWidth="3" strokeLinejoin="round" />
          <path d="M38 49c8-10 21-8 23 5-8-2-16 1-23-5Z" fill="#f97316" />
          <path d="M38 61c7-7 18-8 23 2-8 0-14 5-23-2Z" fill="#dc2626" />
          <path d="M43 48c-2 9 2 16 12 22" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="32" r="4" fill="#facc15" />
        </g>
      )}

      {icon === 'kr_hanbok' && (
        <g className="ach-gift-icon-shape">
          <circle cx="48" cy="27" r="9" fill="#f8d8b8" stroke="#0f172a" strokeWidth="3" />
          <path d="M31 44c9-15 25-15 34 0l9 32H22Z" fill="url(#achGiftHanbok)" stroke="#0f172a" strokeWidth="3" strokeLinejoin="round" />
          <path d="M39 43l9 12 9-12" fill="#fff" stroke="#0f172a" strokeWidth="3" strokeLinejoin="round" />
          <path d="M48 55v20" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
          <path d="M30 55c10 7 25 7 36 0" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
          <path d="M40 22c3-7 13-7 16 0" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

function GiftBoxIcon({ open, className }: { open?: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="achGiftBoxBody" x1="26" y1="34" x2="104" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff7db" />
          <stop offset="0.5" stopColor="#f6e8bf" />
          <stop offset="1" stopColor="#d9c08c" />
        </linearGradient>
        <linearGradient id="achGiftBoxRibbon" x1="40" y1="22" x2="88" y2="106" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="0.55" stopColor="#d97706" />
          <stop offset="1" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="achGiftBoxGlow" x1="18" y1="12" x2="112" y2="118" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.96" />
          <stop offset="1" stopColor="#fef3c7" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {open ? (
        <g className="ach-gift-box-svg-open">
          <ellipse cx="64" cy="111" rx="31" ry="7" fill="rgba(8,22,43,0.1)" />
          <path d="M29 60 64 78v34L29 94Z" fill="url(#achGiftBoxBody)" stroke="#8a6b32" strokeWidth="3" strokeLinejoin="round" />
          <path d="M64 78 99 60v34l-35 18Z" fill="#ead39c" stroke="#8a6b32" strokeWidth="3" strokeLinejoin="round" />
          <path d="M55 74 73 64v38l-18 9Z" fill="url(#achGiftBoxRibbon)" opacity="0.9" />
          <path d="M30 51 64 33l34 18-34 18Z" fill="#fff2c8" stroke="#8a6b32" strokeWidth="3" strokeLinejoin="round" />
          <path d="M33 36c11-14 23-8 31 9-17 2-28-2-31-9Z" fill="#f7d56c" stroke="#8a6b32" strokeWidth="3" />
          <path d="M95 36c-11-14-23-8-31 9 17 2 28-2 31-9Z" fill="#f7d56c" stroke="#8a6b32" strokeWidth="3" />
          <path d="M45 25c8 2 15 8 19 21" fill="none" stroke="url(#achGiftBoxRibbon)" strokeWidth="7" strokeLinecap="round" />
          <path d="M83 25c-8 2-15 8-19 21" fill="none" stroke="url(#achGiftBoxRibbon)" strokeWidth="7" strokeLinecap="round" />
          <circle cx="64" cy="47" r="7" fill="#f59e0b" stroke="#8a6b32" strokeWidth="3" />
        </g>
      ) : (
        <g className="ach-gift-box-svg-closed">
          <ellipse cx="64" cy="113" rx="38" ry="8" fill="rgba(8,22,43,0.12)" />
          <path d="M25 56h78v51a8 8 0 0 1-8 8H33a8 8 0 0 1-8-8Z" fill="url(#achGiftBoxBody)" stroke="#8a6b32" strokeWidth="3" strokeLinejoin="round" />
          <path d="M20 43h88v20H20Z" fill="#fff2c8" stroke="#8a6b32" strokeWidth="3" strokeLinejoin="round" />
          <path d="M56 43h17v72H56Z" fill="url(#achGiftBoxRibbon)" />
          <path d="M20 52h88" stroke="url(#achGiftBoxGlow)" strokeWidth="6" strokeLinecap="round" opacity="0.65" />
          <path d="M31 31c11-17 24-9 31 13-18 1-30-4-31-13Z" fill="#f7d56c" stroke="#8a6b32" strokeWidth="3" />
          <path d="M93 31c-11-17-24-9-31 13 18 1 30-4 31-13Z" fill="#f7d56c" stroke="#8a6b32" strokeWidth="3" />
          <path d="M43 20c9 1 16 8 20 24" fill="none" stroke="url(#achGiftBoxRibbon)" strokeWidth="7" strokeLinecap="round" />
          <path d="M85 20c-9 1-16 8-21 24" fill="none" stroke="url(#achGiftBoxRibbon)" strokeWidth="7" strokeLinecap="round" />
          <circle cx="64" cy="44" r="8" fill="#f59e0b" stroke="#8a6b32" strokeWidth="3" />
        </g>
      )}
    </svg>
  );
}

function GiftModal({
  milestone,
  isKo,
  onClose,
  onClaim,
}: {
  milestone: Milestone;
  isKo: boolean;
  onClose: () => void;
  onClaim: (reward: string) => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'shaking' | 'opened'>('idle');
  const [reward, setReward] = useState('');
  const [rewardIcon, setRewardIcon] = useState<GiftIconKey>(() => pickGiftIcon());

  const handleTap = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('shaking');
    setTimeout(() => {
      const pool = isKo ? MOTIVATION_POOL.ko : MOTIVATION_POOL.vi;
      const r = pool[Math.floor(Math.random() * pool.length)];
      const nextIcon = pickGiftIcon(rewardIcon);
      setReward(r);
      setRewardIcon(nextIcon);
      setPhase('opened');
      onClaim(r);
    }, 700);
  }, [phase, isKo, onClaim, rewardIcon]);

  return createPortal(
    <div className="ach-gift-overlay" onClick={phase === 'opened' ? onClose : undefined}>
      <div className="ach-gift-modal" onClick={e => e.stopPropagation()}>
        {phase !== 'opened' ? (
          <>
            <div className="ach-gift-milestone-badge" style={{ background: milestone.bgColor, color: milestone.color }}>
              {milestone.emoji} {isKo ? milestone.label_ko : milestone.label_vi}
            </div>
            <div className="ach-gift-title">{isKo ? '🎁 선물 상자!' : '🎁 Hộp Quà!'}</div>
            <div className="ach-gift-hint">{isKo ? '상자를 눌러서 열어보세요!' : 'Nhấn vào hộp để mở!'}</div>
            <button
              type="button"
              className={`ach-gift-box-btn ${phase === 'shaking' ? 'shaking' : ''}`}
              onClick={handleTap}
              disabled={phase === 'shaking'}
              aria-label={isKo ? '선물 상자 열기' : 'Mở hộp quà'}
            >
              <GiftBoxIcon className="ach-gift-box-img" />
            </button>
            {phase === 'idle' && (
              <p className="ach-gift-tap-hint">{isKo ? '👆 탭하기' : '👆 Nhấn vào đây'}</p>
            )}
          </>
        ) : (
          <>
            <div className="ach-gift-confetti">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} className="ach-confetti-dot" style={{
                  '--i': i,
                  '--color': ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'][i % 6],
                } as React.CSSProperties} />
              ))}
            </div>
            <GiftBoxIcon open className="ach-gift-box-img opened" />
            <div className="ach-gift-motivation-icon" aria-hidden="true">
              <GiftRewardIcon icon={rewardIcon} />
            </div>
            <div className="ach-gift-title">{isKo ? '오늘의 응원' : 'Một lời nhắn cho bạn'}</div>
            <div className="ach-gift-subtitle">
              {isKo ? '선물 상자에서 작은 동기부여를 찾았어요.' : 'Hộp quà này gửi bạn một chút động lực.'}
            </div>
            <blockquote className="ach-gift-motivation-quote">{reward}</blockquote>
            <button type="button" className="ach-gift-done-btn" onClick={onClose}>
              {isKo ? '닫기' : 'Đóng'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function BillionCelebration({ isKo, onClose }: { isKo: boolean; onClose: () => void }) {
  const petals = Array.from({ length: 42 }, (_, i) => i);
  return createPortal(
    <div className="ach-billion-bloom" onClick={onClose}>
      <div className="ach-billion-petals" aria-hidden="true">
        {petals.map((item) => (
          <span
            key={item}
            style={{
              left: `${(item * 19) % 100}%`,
              animationDelay: `${(item % 11) * 0.12}s`,
              ['--drift' as string]: `${((item % 7) - 3) * 18}px`,
              ['--spin' as string]: `${item % 2 ? 1 : -1}`,
            }}
          />
        ))}
      </div>
      <div className="ach-billion-card">
        <div className="ach-billion-kicker">{isKo ? '10억 VND 달성' : 'Chạm mốc 1 tỷ'}</div>
        <h2>{isKo ? '당당하게 집으로' : 'Về Nhà Trong Thế Chủ Động'}</h2>
        <p>
          {isKo
            ? '순수입 여정이 큰 마일스톤을 넘었어요. 이건 진짜 멋진 기록입니다.'
            : 'Thu nhập ròng của bạn đã vượt một cột mốc rất lớn. Hành trình về nhà đã có hình hài.'}
        </p>
        <button type="button">{isKo ? '계속 보기' : 'Tiếp tục'}</button>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────

interface AchievementScreenProps {
  onClose?: () => void;
  isKo?: boolean;
  inline?: boolean;
}

export function AchievementScreen({ onClose, isKo = false, inline = false }: AchievementScreenProps) {
  const {
    shifts,
    expenses,
    rate,
    session,
    personalGoals,
    currencyMode,
    addPersonalGoal,
    removePersonalGoal,
    togglePersonalGoalDone,
  } = useAppStore();
  const uid = session?.user.id ?? null;

  const [claimed, setClaimed] = useState<string[]>(() => loadClaimed(uid));
  const [giftMilestone, setGiftMilestone] = useState<Milestone | null>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [showBillionCelebration, setShowBillionCelebration] = useState(false);
  const [showTotalKrw, setShowTotalKrw] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [goalCurrency, setGoalCurrency] = useState<PersonalGoal['currency']>('VND');
  const [goalIcon, setGoalIcon] = useState('🎯');
  const { selectedKey, selectedCompanion, selectCompanion } = useCompanionChoice();

  // ── Compute net income from all shifts ──
  const rawNetAmount = useMemo(() => calculateNetIncomeKrw(shifts, expenses), [expenses, shifts]);
  const totalKrw = useMemo(
    () => currencyMode === 'krw-vnd' ? rawNetAmount : rawNetAmount / Math.max(rate.value, 1),
    [currencyMode, rate.value, rawNetAmount],
  );
  const totalVnd = useMemo(
    () => currencyMode === 'krw-vnd' ? rawNetAmount * rate.value : rawNetAmount,
    [currencyMode, rate.value, rawNetAmount],
  );

  // ── Current character stage ──
  const stage = useMemo(() => {
    return [...CHARACTER_STAGES].reverse().find(s => totalVnd >= s.threshold) ?? CHARACTER_STAGES[0];
  }, [totalVnd]);
  const avatarImgKey = selectedCompanion.imgKey ?? stage.imgKey;
  const avatarAlt = selectedCompanion.imgKey
    ? (isKo ? selectedCompanion.label_ko : selectedCompanion.label_vi)
    : stage.name_vi;
  const displayName = selectedCompanion.imgKey
    ? (isKo ? selectedCompanion.label_ko : selectedCompanion.label_vi)
    : (isKo ? stage.name_ko : stage.name_vi);
  const displayDesc = selectedCompanion.imgKey
    ? (isKo ? selectedCompanion.desc_ko : selectedCompanion.desc_vi)
    : (isKo ? stage.desc_ko : stage.desc_vi);

  // ── Next milestone ──
  const nextMilestone = useMemo(() => NET_WORTH_MILESTONES.find(m => totalVnd < m.threshold) ?? null, [totalVnd]);

  // ── Progress % to next milestone ──
  const progressPct = useMemo(() => {
    if (!nextMilestone) return 100;
    const idx = NET_WORTH_MILESTONES.indexOf(nextMilestone);
    const prevThreshold = idx > 0 ? NET_WORTH_MILESTONES[idx - 1].threshold : 0;
    const range = nextMilestone.threshold - prevThreshold;
    const done = Math.max(0, totalVnd - prevThreshold);
    return Math.min(100, (done / range) * 100);
  }, [totalVnd, nextMilestone]);

  // ── Unclaimed but reached milestones ──
  const unclaimedCount = NET_WORTH_MILESTONES.filter(m => totalVnd >= m.threshold && !claimed.includes(m.key)).length;

  useEffect(() => {
    if (totalVnd < FINAL_NET_MILESTONE.threshold || hasCelebratedBillion()) return;
    markBillionCelebrated();
    setShowBillionCelebration(true);
    const timer = window.setTimeout(() => setShowBillionCelebration(false), 5200);
    return () => window.clearTimeout(timer);
  }, [totalVnd]);

  // ── Load admin events ──
  useEffect(() => {
    if (!supabase) { setEventsLoading(false); return; }
    const today = new Date().toISOString().slice(0, 10);
    void supabase
      .from('admin_events')
      .select('id,title,description,reward_emoji,start_date,end_date')
      .eq('active', true)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .then(({ data }) => {
        setEvents((data ?? []) as AdminEvent[]);
        setEventsLoading(false);
      });
  }, []);

  const handleClaim = useCallback((milestone: Milestone) => {
    setGiftMilestone(milestone);
  }, []);

  const handleGiftCollect = useCallback((reward: string) => {
    if (!giftMilestone) return;
    const nextClaimed = [...claimed, giftMilestone.key];
    setClaimed(nextClaimed);
    saveClaimed(nextClaimed, uid);
    void reward;
  }, [giftMilestone, claimed, uid]);

  const handleAddGoal = useCallback(() => {
    const amount = Number(goalAmount.replace(/\D/g, ''));
    if (!goalTitle.trim() || !Number.isFinite(amount) || amount <= 0) return;
    addPersonalGoal({
      title: goalTitle.trim(),
      amount,
      currency: goalCurrency,
      icon: goalIcon,
      completedAt: null,
    });
    setGoalTitle('');
    setGoalAmount('');
    setGoalCurrency('VND');
    setGoalIcon('🎯');
  }, [addPersonalGoal, goalAmount, goalCurrency, goalIcon, goalTitle]);

  const applyGoalPreset = useCallback((preset: typeof GOAL_PRESETS[number]) => {
    setGoalIcon(preset.icon);
    setGoalTitle(isKo ? preset.title_ko : preset.title_vi);
    setGoalAmount(String(preset.amount));
    setGoalCurrency(preset.currency);
  }, [isKo]);

  const bodyContent = (
    <div className="ach-body">

            {/* Character Card */}
            <div className="ach-char-card">
              <div className="ach-char-card-top">
                <div className="ach-char-avatar-wrap">
                  <img src={iconUrl(avatarImgKey)} alt={avatarAlt} className="ach-char-avatar-img" />
                  {selectedCompanion.key === DEFAULT_COMPANION_KEY && (
                    <img
                      src={iconUrl(faceImg(progressPct, unclaimedCount > 0, totalVnd))}
                      alt="face"
                      className="ach-char-face-img"
                    />
                  )}
                  <div className="ach-char-glow" />
                </div>
                <div className="ach-char-meta">
                  <div className="ach-char-name">{displayName}</div>
                  <div className="ach-char-desc">{displayDesc}</div>
                </div>
              </div>
              <div className="ach-companion-picker" aria-label={isKo ? '동반자 선택' : 'Chọn bạn đồng hành'}>
                {COMPANION_OPTIONS.map(option => {
                  const optionImgKey = option.imgKey ?? stage.imgKey;
                  const optionLabel = isKo ? option.label_ko : option.label_vi;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`ach-companion-option ${selectedKey === option.key ? 'ach-companion-option--active' : ''}`}
                      aria-label={optionLabel}
                      aria-pressed={selectedKey === option.key}
                      title={optionLabel}
                      onClick={() => selectCompanion(option.key)}
                    >
                      <img src={iconUrl(optionImgKey)} alt="" />
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="ach-char-total ach-char-total--toggle"
                onClick={() => setShowTotalKrw(value => !value)}
                title={isKo ? 'VND/KRW 전환' : 'Nhấn để đổi VND/KRW'}
                aria-label={isKo ? '누적 순수입 VND/KRW 전환' : 'Đổi hiển thị thu nhập giữa VND và KRW'}
              >
                <div className="ach-char-total-label">{isKo ? '누적 순수입' : 'Thu nhập'}</div>
                <div className="ach-char-total-amount">
                  <div className="ach-char-total-value">
                    {showTotalKrw ? fmtKrwCompact(totalKrw) : fmtVnd(totalVnd)}
                  </div>
                  <div className="ach-char-total-sub">{showTotalKrw ? 'KRW' : 'VND'}</div>
                </div>
              </button>
            </div>

            {/* Progress bar to next milestone */}
            {nextMilestone && (
              <div className="ach-progress-card">
                <div className="ach-progress-head">
                  <span className="ach-progress-label">
                    {isKo ? '다음 목표' : 'Mục tiêu kế tiếp'}
                  </span>
                  <span className="ach-progress-next" style={{ color: nextMilestone.color }}>
                    {nextMilestone.emoji} {isKo ? nextMilestone.label_ko : nextMilestone.label_vi}
                  </span>
                  <span className="ach-progress-pct">{Math.round(progressPct)}%</span>
                </div>
                <div className="ach-progress-track">
                  <div
                    className="ach-progress-fill"
                    style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${nextMilestone.color}99, ${nextMilestone.color})` }}
                  />
                </div>
                <div className="ach-progress-remain">
                  {isKo
                    ? `${fmtVnd(nextMilestone.threshold - totalVnd)} 더 필요해요`
                    : `Còn ${fmtVnd(nextMilestone.threshold - totalVnd)} nữa là mở mốc tiếp theo`}
                </div>
              </div>
            )}
            {!nextMilestone && (
              <div className="ach-completed-banner">
                <Trophy size={18} />
                {isKo ? '모든 목표를 달성했어요! 🏆' : 'Bạn đã chinh phục toàn bộ hành trình! 🏆'}
              </div>
            )}

            {/* Personal Goals */}
            <div className="ach-section">
              <div className="ach-section-title">
                {isKo ? '나만의 목표' : 'Mục tiêu cá nhân'}
              </div>
              <div className="ach-goal-panel">
                <div className="ach-goal-presets" aria-label={isKo ? '목표 빠른 선택' : 'Chọn nhanh mục tiêu'}>
                  {GOAL_PRESETS.map((preset) => (
                    <button
                      key={`${preset.icon}-${preset.amount}`}
                      type="button"
                      className="ach-goal-preset"
                      onClick={() => applyGoalPreset(preset)}
                    >
                      <span>{preset.icon}</span>
                      {isKo ? preset.title_ko : preset.title_vi}
                    </button>
                  ))}
                </div>

                <div className="ach-goal-form">
                  <button type="button" className="ach-goal-icon-btn" onClick={() => {
                    const icons = ['🎯', '✈️', '📱', '🏠', '💌', '💍', '🚗', '🪙'];
                    const next = icons[(icons.indexOf(goalIcon) + 1) % icons.length] ?? icons[0];
                    setGoalIcon(next);
                  }}>
                    {goalIcon}
                  </button>
                  <input
                    value={goalTitle}
                    onChange={(event) => setGoalTitle(event.target.value)}
                    placeholder={isKo ? '목표 이름' : 'Tên mục tiêu'}
                    className="ach-goal-input"
                  />
                  <input
                    value={goalAmount ? Number(goalAmount).toLocaleString('en-US') : ''}
                    onChange={(event) => setGoalAmount(event.target.value.replace(/\D/g, ''))}
                    placeholder={isKo ? '금액' : 'Số tiền'}
                    inputMode="numeric"
                    className="ach-goal-amount-input"
                  />
                  <div className="ach-goal-currency">
                    <button type="button" className={goalCurrency === 'VND' ? 'active' : ''} onClick={() => setGoalCurrency('VND')}>VND</button>
                    <button type="button" className={goalCurrency === 'KRW' ? 'active' : ''} onClick={() => setGoalCurrency('KRW')}>KRW</button>
                  </div>
                  <button type="button" className="ach-goal-add-btn" onClick={handleAddGoal} aria-label={isKo ? '목표 추가' : 'Thêm mục tiêu'}>
                    <Plus size={16} />
                  </button>
                </div>

                <div className="ach-goal-list">
                  {personalGoals.length === 0 ? (
                    <p className="ach-goal-empty">
                      {isKo
                        ? '항공권, 월세, 가족 송금처럼 나만의 목표를 만들어보세요.'
                        : 'Hãy tạo một mục tiêu riêng cho bạn nhé .'}
                    </p>
                  ) : personalGoals.map((goal) => {
                    const current = goal.currency === 'KRW' ? totalKrw : totalVnd;
                    const pct = Math.min(100, (current / Math.max(goal.amount, 1)) * 100);
                    const reached = pct >= 100 || Boolean(goal.completedAt);
                    return (
                      <article key={goal.id} className={`ach-goal-item ${reached ? 'ach-goal-item--done' : ''}`}>
                        <div className="ach-goal-item-icon">{goal.icon}</div>
                        <div className="ach-goal-item-main">
                          <div className="ach-goal-item-top">
                            <strong>{goal.title}</strong>
                            <span>{Math.round(pct)}%</span>
                          </div>
                          <div className="ach-goal-mini-track">
                            <span style={{ width: `${pct}%` }} />
                          </div>
                          <div className="ach-goal-item-meta">
                            {formatGoalMoney(current, goal.currency)} / {formatGoalMoney(goal.amount, goal.currency)}
                          </div>
                        </div>
                        <div className="ach-goal-actions">
                          <button type="button" onClick={() => togglePersonalGoalDone(goal.id)} aria-label={isKo ? '완료 표시' : 'Đánh dấu hoàn thành'}>
                            <CheckCircle2 size={15} />
                          </button>
                          <button type="button" onClick={() => removePersonalGoal(goal.id)} aria-label={isKo ? '삭제' : 'Xóa'}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Admin Events */}
            {!eventsLoading && events.length > 0 && (
              <div className="ach-section">
                <div className="ach-section-title">
                  <Sparkles size={14} />
                  {isKo ? '진행 중인 이벤트' : 'Sự kiện đang diễn ra'}
                </div>
                <div className="ach-events-list">
                  {events.map(ev => (
                    <div key={ev.id} className="ach-event-card">
                      <div className="ach-event-emoji">{ev.reward_emoji}</div>
                      <div className="ach-event-body">
                        <div className="ach-event-title">{ev.title}</div>
                        {ev.description && <div className="ach-event-desc">{ev.description}</div>}
                        <div className="ach-event-dates">
                          <Calendar size={10} />
                          {ev.start_date} → {ev.end_date}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Milestone Map */}
            <div className="ach-section">
              <div className="ach-section-title">
                <Map size={14} />
                {isKo ? '순수입 여정 지도' : 'Bản Đồ Thu Nhập Ròng'}
              </div>
              <div className="ach-map-wrap">
                <img src={iconUrl('map_background')} alt="" className="ach-map-bg" aria-hidden="true" />
              <div className="ach-map">
                {NET_WORTH_MILESTONES.map((m, idx) => {
                  const reached = totalVnd >= m.threshold;
                  const isClaimed = claimed.includes(m.key);
                  const isCurrentPos = nextMilestone?.key === m.key
                    ? false
                    : (idx === NET_WORTH_MILESTONES.length - 1 && !nextMilestone)
                      ? true
                      : nextMilestone && NET_WORTH_MILESTONES[NET_WORTH_MILESTONES.indexOf(nextMilestone) - 1]?.key === m.key;
                  const canClaim = reached && !isClaimed;

                  return (
                    <div key={m.key} className={`ach-ms ${reached ? 'ach-ms--reached' : ''} ${canClaim ? 'ach-ms--ready' : ''} ${isCurrentPos ? 'ach-ms--current' : ''}`}>
                      {/* Left: icon + connector */}
                      <div className="ach-ms-left">
                        <div
                          className="ach-ms-node"
                          style={reached ? { boxShadow: `0 0 0 3px ${m.color}33` } : {}}
                        >
                          <img
                            src={iconUrl(m.imgKey)}
                            alt={m.label_vi}
                            className="ach-ms-badge-img"
                            style={!reached ? { filter: 'grayscale(1)', opacity: 0.3 } : {}}
                          />
                          {isCurrentPos && (
                            <img src={iconUrl(avatarImgKey)} alt="you are here" className="ach-hamster-badge-img" />
                          )}
                        </div>
                        {idx < NET_WORTH_MILESTONES.length - 1 && (
                          <div className={`ach-ms-line ${reached ? 'ach-ms-line--reached' : ''}`}
                            style={reached ? { background: `linear-gradient(to bottom, ${m.color}88, #e2e8f0)` } : {}}
                          />
                        )}
                      </div>

                      {/* Right: info */}
                      <div className="ach-ms-right">
                        <div className="ach-ms-info">
                          <div className="ach-ms-label" style={reached ? { color: 'var(--text-main)' } : {}}>
                            {isKo ? m.label_ko : m.label_vi}
                          </div>
                          <div className="ach-ms-amount" style={reached ? { color: m.color } : {}}>
                            {fmtVnd(m.threshold)}
                          </div>
                          {reached && (
                            <div className="ach-ms-desc">{isKo ? m.desc_ko : m.desc_vi}</div>
                          )}
                        </div>

                        <div className="ach-ms-action">
                          {canClaim ? (
                            <button
                              type="button"
                              className="ach-claim-btn"
                              style={{ background: m.bgColor, color: m.color, borderColor: `${m.color}44` }}
                              onClick={() => handleClaim(m)}
                            >
                              <Gift size={13} />
                              {isKo ? '열기' : 'Mở'}
                            </button>
                          ) : isClaimed ? (
                            <span className="ach-status-chip ach-status-chip--done">✅</span>
                          ) : reached ? (
                            <span className="ach-status-chip ach-status-chip--done">✅</span>
                          ) : (
                            <span className="ach-status-chip">🔒</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>{/* /ach-map-wrap */}
            </div>

            {/* Footer hint */}
            <p className="ach-footer-hint">
              {isKo
                ? '💡 누적 순수입은 전체 근무 수입에서 기록한 지출을 뺀 뒤 VND로 환산합니다.'
                : '💡 Thu nhập = tổng lương đã nhập - chi tiêu đã ghi nhận, sau đó quy đổi sang VND.'}
            </p>
          </div>
  );

  const giftModal = giftMilestone ? (
    <GiftModal
      milestone={giftMilestone}
      isKo={isKo}
      onClose={() => setGiftMilestone(null)}
      onClaim={handleGiftCollect}
    />
  ) : null;

  if (inline) {
    return (
      <>
        {bodyContent}
        {giftModal}
        {showBillionCelebration && (
          <BillionCelebration isKo={isKo} onClose={() => setShowBillionCelebration(false)} />
        )}
      </>
    );
  }

  return createPortal(
    <>
      <div className="ach-overlay" onClick={onClose}>
        <div className="ach-sheet" onClick={e => e.stopPropagation()}>
          <div className="ach-drag-bar" />
          <div className="ach-header">
            <div className="ach-header-left">
              <Map size={18} />
              <span>{isKo ? '나의 여정' : 'Hành Trình kiếm 1 tỷ đầu tiên'}</span>
              {unclaimedCount > 0 && <span className="ach-unclaimed-badge">{unclaimedCount}</span>}
            </div>
            <button type="button" className="ach-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          {bodyContent}
        </div>
      </div>
      {giftModal}
      {showBillionCelebration && (
        <BillionCelebration isKo={isKo} onClose={() => setShowBillionCelebration(false)} />
      )}
    </>,
    document.body,
  );
}

export function AchievementCompanionNudge({
  allShifts,
  expenses,
  rateValue,
  onClick,
}: {
  allShifts: Shift[];
  expenses: Expense[];
  rateValue: number;
  onClick: () => void;
}) {
  const { selectedCompanion } = useCompanionChoice();
  const [message, setMessage] = useState(() => pickMotivation());
  const totalVnd = useMemo(() => calculateNetIncomeVnd(allShifts, expenses, rateValue), [allShifts, expenses, rateValue]);
  const stage = useMemo(() => {
    return [...CHARACTER_STAGES].reverse().find(s => totalVnd >= s.threshold) ?? CHARACTER_STAGES[0];
  }, [totalVnd]);
  const avatarImgKey = selectedCompanion.imgKey ?? stage.imgKey;
  const label = selectedCompanion.imgKey ? selectedCompanion.label_vi : stage.name_vi;
  useEffect(() => {
    setMessage(current => pickMotivation(current));
  }, [selectedCompanion.key]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessage(current => pickMotivation(current));
    }, 9000);
    return () => window.clearInterval(timer);
  }, []);

  const handleClick = () => {
    setMessage(current => pickMotivation(current));
    onClick();
  };

  return (
    <button
      type="button"
      className="home-companion-nudge"
      onClick={handleClick}
      aria-label={`${label}: ${message}`}
      title={label}
    >
      <img src={iconUrl(avatarImgKey)} alt="" className="home-companion-img" />
      <span className="home-companion-bubble">{message}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────
// Entry Banner (rendered inside HomeScreen)
// ─────────────────────────────────────────────────────

export function AchievementBanner({
  isKo = false,
  onClick,
  allShifts,
  expenses,
  rateValue,
  compact = false,
}: {
  isKo?: boolean;
  onClick: () => void;
  allShifts: Shift[];
  expenses: Expense[];
  rateValue: number;
  compact?: boolean;
}) {
  const [showBillionCelebration, setShowBillionCelebration] = useState(false);
  const { selectedCompanion } = useCompanionChoice();
  const totalVnd = useMemo(() => calculateNetIncomeVnd(allShifts, expenses, rateValue), [allShifts, expenses, rateValue]);

  const stage = useMemo(() => {
    return [...CHARACTER_STAGES].reverse().find(s => totalVnd >= s.threshold) ?? CHARACTER_STAGES[0];
  }, [totalVnd]);
  const avatarImgKey = selectedCompanion.imgKey ?? stage.imgKey;
  const avatarAlt = selectedCompanion.imgKey
    ? (isKo ? selectedCompanion.label_ko : selectedCompanion.label_vi)
    : stage.name_vi;
  const displayName = selectedCompanion.imgKey
    ? (isKo ? selectedCompanion.label_ko : selectedCompanion.label_vi)
    : (isKo ? stage.name_ko : stage.name_vi);

  const nextMilestone = useMemo(() => NET_WORTH_MILESTONES.find(m => totalVnd < m.threshold) ?? null, [totalVnd]);

  const progressPct = useMemo(() => {
    if (!nextMilestone) return 100;
    const idx = NET_WORTH_MILESTONES.indexOf(nextMilestone);
    const prevThreshold = idx > 0 ? NET_WORTH_MILESTONES[idx - 1].threshold : 0;
    const range = nextMilestone.threshold - prevThreshold;
    const done = Math.max(0, totalVnd - prevThreshold);
    return Math.min(100, (done / range) * 100);
  }, [totalVnd, nextMilestone]);

  const unclaimedCount = useMemo(() => {
    const claimed = loadClaimed(null);
    return NET_WORTH_MILESTONES.filter(m => totalVnd >= m.threshold && !claimed.includes(m.key)).length;
  }, [totalVnd]);

  useEffect(() => {
    if (totalVnd < FINAL_NET_MILESTONE.threshold || hasCelebratedBillion()) return;
    markBillionCelebrated();
    setShowBillionCelebration(true);
    const timer = window.setTimeout(() => setShowBillionCelebration(false), 5200);
    return () => window.clearTimeout(timer);
  }, [totalVnd]);

  return (
    <>
      <button type="button" className={`ach-banner ${compact ? 'ach-banner--compact' : ''}`} onClick={onClick}>
        <img src={iconUrl(avatarImgKey)} alt={avatarAlt} className="ach-banner-char-img" />
        <div className="ach-banner-body">
          <div className="ach-banner-top">
            <span className="ach-banner-name">{displayName}</span>
            {unclaimedCount > 0 && (
              <span className="ach-banner-dot">{unclaimedCount} {isKo ? '개 선물' : 'quà'}</span>
            )}
          </div>
          {nextMilestone ? (
            <>
              <div className="ach-banner-track">
                <div
                  className="ach-banner-fill"
                  style={{ width: `${progressPct}%`, background: nextMilestone.color }}
                />
              </div>
              <div className="ach-banner-sub">
                {nextMilestone.emoji} {isKo ? nextMilestone.label_ko : nextMilestone.label_vi} - {Math.round(progressPct)}%
              </div>
            </>
          ) : (
            <div className="ach-banner-sub">🏆 {isKo ? '모든 목표 달성!' : 'Đã chinh phục tất cả!'}</div>
          )}
        </div>
        <ChevronRight size={16} className="ach-banner-arrow" />
      </button>
      {showBillionCelebration && (
        <BillionCelebration isKo={isKo} onClose={() => setShowBillionCelebration(false)} />
      )}
    </>
  );
}
