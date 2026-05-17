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
import { X, Gift, Map, ChevronRight, Calendar, Sparkles, Trophy } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { calculateShiftPay, formatKrw } from '../lib/salary';
import { supabase } from '../lib/supabase';
import type { Expense, Shift } from '../lib/types';

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

export const MILESTONES: Milestone[] = [
  {
    key: 'tea', threshold: 1_000_000, emoji: '🧋', imgKey: 'badge_tea',
    label_vi: 'Trà Sữa Gang', label_ko: '버블티 부자',
    desc_vi: 'Đủ trà sữa cả tháng rồi!', desc_ko: '한 달 버블티 값이 생겼어요!',
    color: '#ec4899', bgColor: '#fdf2f8',
  },
  {
    key: 'airpods', threshold: 3_000_000, emoji: '🎧', imgKey: 'badge_airpods',
    label_vi: 'AirPods Moment', label_ko: '에어팟 구매 가능',
    desc_vi: 'Flex với bạn bè thôi!', desc_ko: '친구들한테 자랑할 수 있어요!',
    color: '#8b5cf6', bgColor: '#f5f3ff',
  },
  {
    key: 'plane', threshold: 5_000_000, emoji: '✈️', imgKey: 'badge_plane',
    label_vi: 'Vé Về Thăm Nhà', label_ko: '귀국 항공권',
    desc_vi: 'Bay về ôm má một cái!', desc_ko: '엄마한테 돌아갈 수 있어요!',
    color: '#0ea5e9', bgColor: '#f0f9ff',
  },
  {
    key: 'gold', threshold: 10_000_000, emoji: '🏅', imgKey: 'badge_gold',
    label_vi: '1 Cây Vàng!', label_ko: '금 1돈!',
    desc_vi: 'Ông bà tổ tiên phù hộ!', desc_ko: '조상님이 도와주셨어요!',
    color: '#f59e0b', bgColor: '#fffbeb',
  },
  {
    key: 'motorbike', threshold: 20_000_000, emoji: '🛵', imgKey: 'badge_motorbike',
    label_vi: 'Xe Máy Cho Ba', label_ko: '아버지 오토바이',
    desc_vi: 'Quà hiếu thảo số 1!', desc_ko: '최고의 효도 선물!',
    color: '#10b981', bgColor: '#f0fdf4',
  },
  {
    key: 'ring', threshold: 35_000_000, emoji: '💍', imgKey: 'badge_ring',
    label_vi: 'Nhẫn Cầu Hôn', label_ko: '프로포즈 반지',
    desc_vi: 'Thả thính được rồi đó!', desc_ko: '이제 프로포즈해도 돼요!',
    color: '#a855f7', bgColor: '#faf5ff',
  },
  {
    key: 'wedding', threshold: 50_000_000, emoji: '👰', imgKey: 'badge_wedding',
    label_vi: 'Đám Cưới Xịn', label_ko: '결혼식',
    desc_vi: 'Buffet 50 bàn luôn!', desc_ko: '50테이블 뷔페 가능!',
    color: '#f43f5e', bgColor: '#fff1f2',
  },
  {
    key: 'phone', threshold: 80_000_000, emoji: '📱', imgKey: 'badge_phone',
    label_vi: 'iPhone Mới Nhất', label_ko: '최신 아이폰',
    desc_vi: 'Flex không cần filter!', desc_ko: '필터 없이 자랑해요!',
    color: '#3b82f6', bgColor: '#eff6ff',
  },
  {
    key: 'house', threshold: 100_000_000, emoji: '🏠', imgKey: 'badge_house',
    label_vi: 'Cọc Được Nhà', label_ko: '집 계약금',
    desc_vi: 'Ký hợp đồng thôi!', desc_ko: '계약서 사인할 시간!',
    color: '#22c55e', bgColor: '#f0fdf4',
  },
  {
    key: 'car', threshold: 150_000_000, emoji: '🚗', imgKey: 'badge_car',
    label_vi: 'Mua Xe Ô Tô', label_ko: '자동차 구매',
    desc_vi: 'Đón ba má bằng xe riêng!', desc_ko: '부모님을 직접 모시러 가요!',
    color: '#f97316', bgColor: '#fff7ed',
  },
  {
    key: 'vietnam', threshold: 200_000_000, emoji: '🇻🇳', imgKey: 'badge_vietnam',
    label_vi: 'Về Việt Nam Thôi!', label_ko: '베트남으로 귀국!',
    desc_vi: 'Hoàn thành hành trình!', desc_ko: '여정 완료!',
    color: '#ef4444', bgColor: '#fef2f2',
  },
];

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
  { key: 'cat', imgKey: 'companion_cat', label_vi: 'Mèo Thần Tài', label_ko: '당당한 지갑 고양이', desc_vi: 'Đi làm, giữ ví, và luôn có phong thái rất ổn.', desc_ko: '일도 하고 지갑도 챙기는 당당한 친구.' },
  { key: 'bunny', imgKey: 'companion_bunny', label_vi: 'Thỏ Tiết Kiệm', label_ko: '저축 항아리 토끼', desc_vi: 'Mỗi khoản để dành đều được ôm thật cẩn thận.', desc_ko: '모아둔 돈을 소중히 안고 가는 친구.' },
  { key: 'bear', imgKey: 'companion_bear', label_vi: 'Gấu Chăm Chỉ Đi Làm', label_ko: '성실한 알바 곰', desc_vi: 'Bạn đồng hành bền bỉ cho những ngày học và làm.', desc_ko: '공부와 알바를 묵묵히 함께하는 친구.' },
  { key: 'fox', imgKey: 'companion_fox', label_vi: 'Cáo Nhanh Nhẹn', label_ko: '영리한 계획 여우', desc_vi: 'Biết tính toán, biết xoay xở, biết chọn đường lời hơn.', desc_ko: '계산도 빠르고 계획도 영리한 친구.' },
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

const REWARD_POOL = [
  '⭐', '🌟', '💫', '✨', '🎖️', '🏆', '🎀', '🌸',
  '🦋', '🌈', '🎵', '🍀', '🌙', '☀️', '🎊', '💎',
  '🌺', '🦄', '🔮', '🌠',
];

const NET_WORTH_MILESTONES: Milestone[] = [
  { key: 'start', threshold: 0, emoji: '🌱', imgKey: 'net_start', label_vi: 'Lv.0: Sang Hàn Làm Lại Từ Đầu', label_ko: 'Lv.0: 한국에서 다시 시작', desc_vi: 'Từ con số nhỏ, mình bắt đầu giữ lại từng đồng ròng.', desc_ko: '작은 금액부터 차곡차곡 모으는 시작점.', color: '#14b8a6', bgColor: '#f0fdfa' },
  { key: 'smart_food', threshold: 5_000_000, emoji: '🍱', imgKey: 'net_smart_food', label_vi: 'Ăn Uống Biết Tính Toán', label_ko: '식비 관리 시작', desc_vi: 'Sinh hoạt vẫn ổn, ví cũng bắt đầu ấm lên.', desc_ko: '생활도 챙기고 지갑도 조금 따뜻해졌어요.', color: '#10b981', bgColor: '#ecfdf5' },
  { key: 'gold_chi', threshold: 18_000_000, emoji: '🪙', imgKey: 'net_gold_chi', label_vi: 'Chỉ Vàng Đầu Tiên', label_ko: '첫 금 한 돈', desc_vi: 'Thu nhập ròng đã có hình hài của tài sản thật.', desc_ko: '순수입이 진짜 자산의 형태를 갖기 시작했어요.', color: '#f59e0b', bgColor: '#fffbeb' },
  { key: 'seoul', threshold: 50_000_000, emoji: '🏙️', imgKey: 'net_seoul', label_vi: 'Khám Phá Seoul Không Run Ví', label_ko: '서울 탐방, 지갑 안 떨림', desc_vi: 'Có thể đi chơi một chút mà vẫn không lệch kế hoạch.', desc_ko: '조금 즐겨도 계획이 흔들리지 않는 구간.', color: '#0ea5e9', bgColor: '#f0f9ff' },
  { key: 'emergency', threshold: 100_000_000, emoji: '🛡️', imgKey: 'net_emergency', label_vi: 'Quỹ Dự Phòng Ổn Áp', label_ko: '든든한 비상금', desc_vi: 'Có biến cũng đỡ hoảng, vì mình đã có lớp đệm.', desc_ko: '예상 못 한 일이 와도 버틸 여유가 생겼어요.', color: '#2563eb', bgColor: '#eff6ff' },
  { key: 'gold_luong', threshold: 165_000_000, emoji: '🏅', imgKey: 'net_gold_luong', label_vi: 'Múc Được 1 Lượng Vàng', label_ko: '금 한 냥 클리어', desc_vi: 'Mốc vàng đúng nghĩa: nhìn lại thấy mình đi xa thật.', desc_ko: '말 그대로 골드 마일스톤, 꽤 멀리 왔어요.', color: '#d97706', bgColor: '#fff7ed' },
  { key: 'wedding_net', threshold: 250_000_000, emoji: '💍', imgKey: 'net_wedding', label_vi: 'Đủ Làm Đám Cưới :D', label_ko: '결혼식도 가능 :D', desc_vi: 'Không cần quá phô, đủ để làm một ngày thật đáng nhớ.', desc_ko: '과하지 않아도 기억에 남을 하루를 만들 수 있어요.', color: '#f43f5e', bgColor: '#fff1f2' },
  { key: 'car_loading', threshold: 450_000_000, emoji: '🚗', imgKey: 'net_car_loading', label_vi: 'Xe Ô Tô Loading...', label_ko: '첫 차 로딩 중...', desc_vi: 'Một chiếc xe bình dân bắt đầu bước vào vùng có thể nghĩ tới.', desc_ko: '첫 차를 현실적으로 생각해볼 수 있는 구간.', color: '#6366f1', bgColor: '#eef2ff' },
  { key: 'vietkieu', threshold: 650_000_000, emoji: '💼', imgKey: 'net_vietkieu', label_vi: 'Việt Kiều Pro VIP', label_ko: '프로 유학생 모드', desc_vi: 'Không chỉ đi làm thêm nữa, đây là cấp độ biết tích sản.', desc_ko: '알바를 넘어 자산을 쌓는 단계.', color: '#8b5cf6', bgColor: '#f5f3ff' },
  { key: 'return_plan', threshold: 800_000_000, emoji: '🧭', imgKey: 'net_return_plan', label_vi: 'Hồi Hương Có Kế Hoạch', label_ko: '계획 있는 귀국', desc_vi: 'Nếu về nước, bạn về bằng một kế hoạch chứ không phải cảm tính.', desc_ko: '감정이 아니라 계획으로 돌아갈 수 있어요.', color: '#0f766e', bgColor: '#f0fdfa' },
  { key: 'home_free', threshold: 1_000_000_000, emoji: '🇻🇳', imgKey: 'net_home_free', label_vi: 'Về Nhà Trong Thế Chủ Động', label_ko: '당당하게 집으로', desc_vi: '1 tỷ thu nhập ròng: hành trình về nhà đã có hình hài.', desc_ko: '순수입 10억 VND, 돌아갈 길이 보이기 시작했어요.', color: '#ef4444', bgColor: '#fef2f2' },
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
  return `${import.meta.env.BASE_URL}icon/${name}.png`;
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

  const handleTap = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('shaking');
    setTimeout(() => {
      const r = REWARD_POOL[Math.floor(Math.random() * REWARD_POOL.length)];
      setReward(r);
      setPhase('opened');
      onClaim(r);
    }, 700);
  }, [phase, onClaim]);

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
            >
              <img src={iconUrl('box_closed')} alt="gift box" className="ach-gift-box-img" />
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
            <img src={iconUrl('box_open')} alt="opened box" className="ach-gift-box-img" />
            <div className="ach-gift-reward-emoji">{reward}</div>
            <div className="ach-gift-title">{isKo ? '축하해요! 🎉' : 'Chúc mừng! 🎉'}</div>
            <div className="ach-gift-subtitle">
              {isKo ? '새 아이콘을 획득했어요!' : 'Bạn nhận được icon đặc biệt!'}
            </div>
            <div className="ach-gift-reward-label">
              {isKo ? '획득한 아이콘:' : 'Icon vừa nhận:'} <strong>{reward}</strong>
            </div>
            <button type="button" className="ach-gift-done-btn" onClick={onClose}>
              {isKo ? '닫기 ✓' : 'Đóng ✓'}
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
  const { shifts, expenses, rate, session } = useAppStore();
  const uid = session?.user.id ?? null;

  const [claimed, setClaimed] = useState<string[]>(() => loadClaimed(uid));
  const [giftMilestone, setGiftMilestone] = useState<Milestone | null>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [showBillionCelebration, setShowBillionCelebration] = useState(false);
  const [showTotalKrw, setShowTotalKrw] = useState(false);
  const { selectedKey, selectedCompanion, selectCompanion } = useCompanionChoice();

  // ── Compute net income from all shifts ──
  const totalKrw = useMemo(() => calculateNetIncomeKrw(shifts, expenses), [expenses, shifts]);
  const totalVnd = useMemo(() => totalKrw * rate.value, [rate.value, totalKrw]);

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
                aria-label={isKo ? '누적 순수입 VND/KRW 전환' : 'Đổi hiển thị thu nhập ròng tích lũy giữa VND và KRW'}
              >
                <div className="ach-char-total-label">{isKo ? '누적 순수입' : 'Thu nhập ròng tích lũy'}</div>
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
                    <div key={m.key} className={`ach-ms ${reached ? 'ach-ms--reached' : ''} ${isCurrentPos ? 'ach-ms--current' : ''}`}>
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
                : '💡 Thu nhập ròng tích lũy = tổng lương đã nhập - chi tiêu đã ghi nhận, sau đó quy đổi sang VND.'}
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
              <span>{isKo ? '나의 여정' : 'Hành Trình Của Tôi'}</span>
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
