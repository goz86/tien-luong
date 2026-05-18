import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { calculateShiftPay } from '../lib/salary';
import type { Expense, Shift } from '../lib/types';
import { ACHIEVEMENT_CLAIMED_CHANGE_EVENT, loadAchievementClaimed } from '../lib/achievementClaimed';

interface CharacterStage {
  threshold: number;
  imgKey: string;
  name_vi: string;
  name_ko: string;
}

interface CompanionOption {
  key: string;
  imgKey: string | null;
  label_vi: string;
  label_ko: string;
}

interface NetMilestone {
  key: string;
  threshold: number;
  emoji: string;
  label_vi: string;
  label_ko: string;
  color: string;
}

const DEFAULT_COMPANION_KEY = 'journey';
const COMPANION_STORAGE_KEY = 'duhoc-mate-ach-companion';
const COMPANION_CHANGE_EVENT = 'duhoc-mate-ach-companion-change';

const CHARACTER_STAGES: CharacterStage[] = [
  { threshold: 0, imgKey: 'hamster_egg', name_vi: 'Trứng Bí Ẩn', name_ko: '신비한 알' },
  { threshold: 1_000_000, imgKey: 'hamster_baby', name_vi: 'Baby Hamster', name_ko: '아기 햄스터' },
  { threshold: 10_000_000, imgKey: 'hamster_normal', name_vi: 'Hamster Cần Cù', name_ko: '부지런한 햄스터' },
  { threshold: 35_000_000, imgKey: 'hamster_student', name_vi: 'Hamster Sinh Viên', name_ko: '학생 햄스터' },
  { threshold: 80_000_000, imgKey: 'hamster_office', name_vi: 'Hamster Dân Văn Phòng', name_ko: '직장인 햄스터' },
  { threshold: 150_000_000, imgKey: 'hamster_rich', name_vi: 'Hamster Thành Đạt', name_ko: '성공한 햄스터' },
  { threshold: 200_000_000, imgKey: 'hamster_home', name_vi: 'Hamster Trở Về', name_ko: '귀국 햄스터' },
];

const COMPANION_OPTIONS: CompanionOption[] = [
  { key: DEFAULT_COMPANION_KEY, imgKey: null, label_vi: 'Theo cấp', label_ko: '레벨별' },
  { key: 'hamster', imgKey: 'companion_hamster', label_vi: 'Mầm Non ', label_ko: '새싹 저축 친구' },
  { key: 'cat', imgKey: 'companion_cat', label_vi: 'Mèo Thần Tài', label_ko: '당당한 지갑 고양이' },
  { key: 'bunny', imgKey: 'companion_bunny', label_vi: 'Thỏ Tiết Kiệm', label_ko: '저축 항아리 토끼' },
  { key: 'bear', imgKey: 'companion_bear', label_vi: 'Gấu Chăm Chỉ Đi Làm', label_ko: '성실한 알바 곰' },
  { key: 'fox', imgKey: 'companion_fox', label_vi: 'Cáo Nhanh Nhẹn', label_ko: '영리한 계획 여우' },
  { key: 'star', imgKey: 'companion_star', label_vi: 'Sao May Mắn', label_ko: '귀국 행운 별' },
];

const NET_WORTH_MILESTONES: NetMilestone[] = [
  { key: 'start', threshold: 0, emoji: '🌱', label_vi: 'Lv.0: Sang Hàn Làm Lại Từ Đầu', label_ko: 'Lv.0: 한국에서 다시 시작', color: '#14b8a6' },
  { key: 'smart_food', threshold: 5_000_000, emoji: '🍱', label_vi: 'Tiết kiệm là chân ái', label_ko: '식비 관리 시작', color: '#10b981' },
  { key: 'gold_chi', threshold: 18_000_000, emoji: '🪙', label_vi: 'Mua Chỉ Vàng Đầu Tiên', label_ko: '첫 금 한 돈', color: '#f59e0b' },
  { key: 'seoul', threshold: 50_000_000, emoji: '🏙️', label_vi: 'Vui Seoul Không Run Ví', label_ko: '서울 탐방, 지갑 안 떨림', color: '#0ea5e9' },
  { key: 'emergency', threshold: 100_000_000, emoji: '🛡️', label_vi: 'Quỹ Dự Phòng Ổn Áp', label_ko: '든든한 비상금', color: '#2563eb' },
  { key: 'gold_luong', threshold: 165_000_000, emoji: '🏅', label_vi: 'Múc Được 1 Lượng Vàng', label_ko: '금 한 냥 클리어', color: '#d97706' },
  { key: 'wedding_net', threshold: 250_000_000, emoji: '💍', label_vi: 'Đủ Làm Đám Cưới :D', label_ko: '결혼식도 가능 :D', color: '#f43f5e' },
  { key: 'car_loading', threshold: 450_000_000, emoji: '🚗', label_vi: 'Đủ mua Xe Ô Tô', label_ko: '첫 차 로딩 중...', color: '#6366f1' },
  { key: 'vietkieu', threshold: 650_000_000, emoji: '💼', label_vi: 'Việt Kiều Pro VIP', label_ko: '프로 유학생 모드', color: '#8b5cf6' },
  { key: 'return_plan', threshold: 800_000_000, emoji: '🧭', label_vi: 'Lên kế hoạch làm ăn', label_ko: '계획 있는 귀국', color: '#0f766e' },
  { key: 'home_free', threshold: 1_000_000_000, emoji: '🇻🇳', label_vi: 'Tôi đã trở thành tỷ phú.', label_ko: '당당하게 집으로', color: '#ef4444' },
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

function iconUrl(name: string) {
  return `${import.meta.env.BASE_URL}icon/${name}.png?v=20260518-ach`;
}

function calculateNetIncomeVnd(shifts: Shift[], expenses: Expense[], rateValue: number) {
  const grossKrw = shifts.reduce((sum, s) => sum + calculateShiftPay(s).total, 0);
  const expenseKrw = expenses.reduce((sum, e) => sum + e.amount, 0);
  return Math.max(0, (grossKrw - expenseKrw) * rateValue);
}

function getCompanionOption(key: string | null): CompanionOption {
  return COMPANION_OPTIONS.find(option => option.key === key) ?? COMPANION_OPTIONS[0];
}

function loadCompanionKey(): string {
  if (typeof window === 'undefined') return DEFAULT_COMPANION_KEY;
  return getCompanionOption(window.localStorage.getItem(COMPANION_STORAGE_KEY)).key;
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

  return {
    selectedCompanion: getCompanionOption(selectedKey),
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

function useClaimedMilestones(userId?: string | null) {
  const [claimed, setClaimed] = useState<string[]>(() => loadAchievementClaimed(userId));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setClaimed(loadAchievementClaimed(userId));
    window.addEventListener('storage', sync);
    window.addEventListener(ACHIEVEMENT_CLAIMED_CHANGE_EVENT, sync);
    sync();
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(ACHIEVEMENT_CLAIMED_CHANGE_EVENT, sync);
    };
  }, [userId]);

  return claimed;
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
  const stage = useMemo(() => [...CHARACTER_STAGES].reverse().find(s => totalVnd >= s.threshold) ?? CHARACTER_STAGES[0], [totalVnd]);
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
    <button type="button" className="home-companion-nudge" onClick={handleClick} aria-label={`${label}: ${message}`} title={label}>
      <img src={iconUrl(avatarImgKey)} alt="" className="home-companion-img" />
      <span className="home-companion-bubble">{message}</span>
    </button>
  );
}

export function AchievementBanner({
  isKo = false,
  onClick,
  allShifts,
  expenses,
  rateValue,
  compact = false,
  userId = null,
}: {
  isKo?: boolean;
  onClick: () => void;
  allShifts: Shift[];
  expenses: Expense[];
  rateValue: number;
  compact?: boolean;
  userId?: string | null;
}) {
  const { selectedCompanion } = useCompanionChoice();
  const totalVnd = useMemo(() => calculateNetIncomeVnd(allShifts, expenses, rateValue), [allShifts, expenses, rateValue]);
  const stage = useMemo(() => [...CHARACTER_STAGES].reverse().find(s => totalVnd >= s.threshold) ?? CHARACTER_STAGES[0], [totalVnd]);
  const avatarImgKey = selectedCompanion.imgKey ?? stage.imgKey;
  const avatarAlt = selectedCompanion.imgKey ? (isKo ? selectedCompanion.label_ko : selectedCompanion.label_vi) : stage.name_vi;
  const displayName = selectedCompanion.imgKey ? (isKo ? selectedCompanion.label_ko : selectedCompanion.label_vi) : (isKo ? stage.name_ko : stage.name_vi);
  const nextMilestone = useMemo(() => NET_WORTH_MILESTONES.find(m => totalVnd < m.threshold) ?? null, [totalVnd]);
  const claimed = useClaimedMilestones(userId);
  const progressPct = useMemo(() => {
    if (!nextMilestone) return 100;
    const idx = NET_WORTH_MILESTONES.indexOf(nextMilestone);
    const prevThreshold = idx > 0 ? NET_WORTH_MILESTONES[idx - 1].threshold : 0;
    const range = nextMilestone.threshold - prevThreshold;
    const done = Math.max(0, totalVnd - prevThreshold);
    return Math.min(100, (done / range) * 100);
  }, [totalVnd, nextMilestone]);
  const unclaimedCount = useMemo(() => {
    return NET_WORTH_MILESTONES.filter(m => totalVnd >= m.threshold && !claimed.includes(m.key)).length;
  }, [totalVnd, claimed]);

  return (
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
              <div className="ach-banner-fill" style={{ width: `${progressPct}%`, background: nextMilestone.color }} />
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
  );
}
