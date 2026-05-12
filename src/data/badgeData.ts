import { type Shift, type Expense } from '../lib/types';
import { type CommunityPost, type CommunityComment } from './communityData';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond';
export type BadgeCategory = 'work' | 'income' | 'expense' | 'social' | 'friend';

export interface Badge {
  id: string;
  label_vi: string;
  label_ko: string;
  description_vi: string;
  description_ko: string;
  icon: string;
  tier: BadgeTier;
  category: BadgeCategory;
  color: string;
  border: string;
  glow: string;
  requirement: (data: BadgeData) => boolean;
  getProgress: (data: BadgeData) => { current: number; target: number };
}

export type BadgeData = {
  shifts: Shift[];
  expenses: Expense[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  companionsCount: number;
  likesCount: number;
};

export const BADGE_CATEGORY_META: Record<BadgeCategory, { label_vi: string; label_ko: string; icon: string }> = {
  work:    { label_vi: 'Ca làm việc',  label_ko: '근무',     icon: '💼' },
  income:  { label_vi: 'Thu nhập',     label_ko: '수입',     icon: '💰' },
  expense: { label_vi: 'Chi tiêu',     label_ko: '지출',     icon: '📒' },
  social:  { label_vi: 'Cộng đồng',   label_ko: '커뮤니티', icon: '💬' },
  friend:  { label_vi: 'Kết nối',      label_ko: '친구',     icon: '🤝' },
};

export const TIER_META: Record<BadgeTier, { label_vi: string; label_ko: string }> = {
  bronze:  { label_vi: 'Đồng',    label_ko: '브론즈' },
  silver:  { label_vi: 'Bạc',     label_ko: '실버'   },
  gold:    { label_vi: 'Vàng',    label_ko: '골드'   },
  diamond: { label_vi: 'Kim Cương', label_ko: '다이아' },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function calcTotalIncome(shifts: Shift[]): number {
  return shifts.reduce((acc, s) => {
    const start = new Date(`2000-01-01T${s.startTime}`).getTime();
    const end   = new Date(`2000-01-01T${s.endTime}`).getTime();
    let hours = (end - start) / 3_600_000;
    if (hours < 0) hours += 24;
    return acc + ((hours * 60 - (s.breakMinutes || 0)) / 60 * s.hourlyWage);
  }, 0);
}

function getNightShifts(shifts: Shift[]): number {
  return shifts.filter(s => {
    const h = parseInt(s.startTime.split(':')[0], 10);
    return h >= 21 || h < 5;
  }).length;
}

function getMaxConsecutiveDays(shifts: Shift[]): number {
  if (!shifts.length) return 0;
  const days = [...new Set(shifts.map(s => s.date))].sort();
  let max = 1, streak = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86_400_000;
    streak = diff === 1 ? streak + 1 : 1;
    if (streak > max) max = streak;
  }
  return max;
}

// ── Badge Definitions ──────────────────────────────────────────────────────

export const BADGES: Badge[] = [

  // ════════════════════════════════════════
  //  CA LÀM VIỆC
  // ════════════════════════════════════════
  {
    id: 'work_bronze',
    label_vi: 'Lính mới',        label_ko: '신병',
    description_vi: 'Hoàn thành 10 ca làm đầu tiên',
    description_ko: '첫 10회 근무 완료',
    icon: '⚡',
    tier: 'bronze', category: 'work',
    color: '#fff7ed', border: '#fb923c', glow: 'rgba(251,146,60,0.25)',
    requirement: ({ shifts }) => shifts.length >= 10,
    getProgress: ({ shifts }) => ({ current: Math.min(shifts.length, 10), target: 10 }),
  },
  {
    id: 'work_silver',
    label_vi: 'Chuyên nghiệp',   label_ko: '전문가',
    description_vi: 'Hoàn thành 100 ca làm việc',
    description_ko: '100회 근무 완료',
    icon: '🔥',
    tier: 'silver', category: 'work',
    color: '#fff1f2', border: '#f43f5e', glow: 'rgba(244,63,94,0.2)',
    requirement: ({ shifts }) => shifts.length >= 100,
    getProgress: ({ shifts }) => ({ current: Math.min(shifts.length, 100), target: 100 }),
  },
  {
    id: 'work_gold',
    label_vi: 'Chiến thần ca làm', label_ko: '근무의 신',
    description_vi: 'Kiên trì 500 ca lao động',
    description_ko: '500회 근무 완료',
    icon: '👑',
    tier: 'gold', category: 'work',
    color: '#fefce8', border: '#eab308', glow: 'rgba(234,179,8,0.25)',
    requirement: ({ shifts }) => shifts.length >= 500,
    getProgress: ({ shifts }) => ({ current: Math.min(shifts.length, 500), target: 500 }),
  },
  {
    id: 'work_streak',
    label_vi: 'Không ngày nghỉ',  label_ko: '무결근',
    description_vi: 'Làm việc 30 ngày liên tiếp không nghỉ',
    description_ko: '30일 연속 근무',
    icon: '🗓️',
    tier: 'gold', category: 'work',
    color: '#ecfdf5', border: '#059669', glow: 'rgba(5,150,105,0.2)',
    requirement: ({ shifts }) => getMaxConsecutiveDays(shifts) >= 30,
    getProgress: ({ shifts }) => ({ current: Math.min(getMaxConsecutiveDays(shifts), 30), target: 30 }),
  },
  {
    id: 'work_night',
    label_vi: 'Cú đêm',           label_ko: '야행성',
    description_vi: '30 ca làm sau 21:00 giờ tối',
    description_ko: '21시 이후 30회 야간 근무',
    icon: '🦉',
    tier: 'silver', category: 'work',
    color: '#f5f3ff', border: '#7c3aed', glow: 'rgba(124,58,237,0.2)',
    requirement: ({ shifts }) => getNightShifts(shifts) >= 30,
    getProgress: ({ shifts }) => ({ current: Math.min(getNightShifts(shifts), 30), target: 30 }),
  },

  // ════════════════════════════════════════
  //  THU NHẬP
  // ════════════════════════════════════════
  {
    id: 'income_bronze',
    label_vi: 'Tích lũy 1M',     label_ko: '백만 달성',
    description_vi: 'Tích lũy 1,000,000 ₩ từ lao động',
    description_ko: '누적 수입 1,000,000 KRW 달성',
    icon: '💵',
    tier: 'bronze', category: 'income',
    color: '#ecfdf5', border: '#10b981', glow: 'rgba(16,185,129,0.2)',
    requirement: ({ shifts }) => calcTotalIncome(shifts) >= 1_000_000,
    getProgress: ({ shifts }) => ({ current: Math.min(Math.round(calcTotalIncome(shifts)), 1_000_000), target: 1_000_000 }),
  },
  {
    id: 'income_silver',
    label_vi: 'Triệu phú',       label_ko: '부자',
    description_vi: 'Tích lũy 10,000,000 ₩',
    description_ko: '누적 수입 10,000,000 KRW 달성',
    icon: '💰',
    tier: 'silver', category: 'income',
    color: '#f0fdf4', border: '#22c55e', glow: 'rgba(34,197,94,0.2)',
    requirement: ({ shifts }) => calcTotalIncome(shifts) >= 10_000_000,
    getProgress: ({ shifts }) => ({ current: Math.min(Math.round(calcTotalIncome(shifts)), 10_000_000), target: 10_000_000 }),
  },
  {
    id: 'income_gold',
    label_vi: 'Tài phiệt Du học', label_ko: '유학 재벌',
    description_vi: 'Tích lũy 50,000,000 ₩',
    description_ko: '누적 수입 50,000,000 KRW 달성',
    icon: '💎',
    tier: 'gold', category: 'income',
    color: '#faf5ff', border: '#a855f7', glow: 'rgba(168,85,247,0.25)',
    requirement: ({ shifts }) => calcTotalIncome(shifts) >= 50_000_000,
    getProgress: ({ shifts }) => ({ current: Math.min(Math.round(calcTotalIncome(shifts)), 50_000_000), target: 50_000_000 }),
  },
  {
    id: 'income_diamond',
    label_vi: 'Đế chế Du học',   label_ko: '유학 제국',
    description_vi: '🔥 Huyền thoại: Tích lũy 100,000,000 ₩',
    description_ko: '전설: 누적 수입 1억 KRW 달성',
    icon: '🏆',
    tier: 'diamond', category: 'income',
    color: '#fffbeb', border: '#f59e0b', glow: 'rgba(245,158,11,0.3)',
    requirement: ({ shifts }) => calcTotalIncome(shifts) >= 100_000_000,
    getProgress: ({ shifts }) => ({ current: Math.min(Math.round(calcTotalIncome(shifts)), 100_000_000), target: 100_000_000 }),
  },

  // ════════════════════════════════════════
  //  CHI TIÊU
  // ════════════════════════════════════════
  {
    id: 'expense_bronze',
    label_vi: 'Ghi chép',        label_ko: '기록가',
    description_vi: 'Ghi lại 20 khoản chi tiêu',
    description_ko: '지출 20회 기록',
    icon: '📓',
    tier: 'bronze', category: 'expense',
    color: '#f1f5f9', border: '#64748b', glow: 'rgba(100,116,139,0.2)',
    requirement: ({ expenses }) => expenses.length >= 20,
    getProgress: ({ expenses }) => ({ current: Math.min(expenses.length, 20), target: 20 }),
  },
  {
    id: 'expense_silver',
    label_vi: 'Kế toán gia',     label_ko: '회계사',
    description_vi: 'Ghi lại 100 khoản chi tiêu tỉ mỉ',
    description_ko: '지출 100회 기록',
    icon: '📊',
    tier: 'silver', category: 'expense',
    color: '#fdf4ff', border: '#c026d3', glow: 'rgba(192,38,211,0.2)',
    requirement: ({ expenses }) => expenses.length >= 100,
    getProgress: ({ expenses }) => ({ current: Math.min(expenses.length, 100), target: 100 }),
  },

  // ════════════════════════════════════════
  //  CỘNG ĐỒNG
  // ════════════════════════════════════════
  {
    id: 'social_bronze',
    label_vi: 'Năng nổ',         label_ko: '활동가',
    description_vi: 'Bình luận 30 lần trong cộng đồng',
    description_ko: '커뮤니티 댓글 30회 작성',
    icon: '💬',
    tier: 'bronze', category: 'social',
    color: '#f0fdf4', border: '#22c55e', glow: 'rgba(34,197,94,0.2)',
    requirement: ({ comments }) => comments.length >= 30,
    getProgress: ({ comments }) => ({ current: Math.min(comments.length, 30), target: 30 }),
  },
  {
    id: 'social_silver',
    label_vi: 'Người chia sẻ',   label_ko: '리뷰어',
    description_vi: 'Đăng 10 bài review nhà hàng, quán ăn',
    description_ko: '음식점 리뷰 10건 작성',
    icon: '📍',
    tier: 'silver', category: 'social',
    color: '#fff7ed', border: '#f97316', glow: 'rgba(249,115,22,0.2)',
    requirement: ({ posts }) => posts.filter(p => p.category === 'food').length >= 10,
    getProgress: ({ posts }) => ({
      current: Math.min(posts.filter(p => p.category === 'food').length, 10),
      target: 10,
    }),
  },
  {
    id: 'social_gold',
    label_vi: 'Người truyền cảm hứng', label_ko: '인플루언서',
    description_vi: 'Nhận 100 lượt thích từ cộng đồng',
    description_ko: '좋아요 100회 획득',
    icon: '✨',
    tier: 'gold', category: 'social',
    color: '#fdf2f8', border: '#db2777', glow: 'rgba(219,39,119,0.2)',
    requirement: ({ likesCount }) => likesCount >= 100,
    getProgress: ({ likesCount }) => ({ current: Math.min(likesCount, 100), target: 100 }),
  },

  // ════════════════════════════════════════
  //  KẾT NỐI
  // ════════════════════════════════════════
  {
    id: 'friend_bronze',
    label_vi: 'Bạn bè',          label_ko: '친구들',
    description_vi: 'Kết nối với 5 người bạn cùng hội',
    description_ko: '친구 5명 연결',
    icon: '🤝',
    tier: 'bronze', category: 'friend',
    color: '#eff6ff', border: '#3b82f6', glow: 'rgba(59,130,246,0.2)',
    requirement: ({ companionsCount }) => companionsCount >= 5,
    getProgress: ({ companionsCount }) => ({ current: Math.min(companionsCount, 5), target: 5 }),
  },
  {
    id: 'friend_gold',
    label_vi: 'Siêu kết nối',    label_ko: '인싸',
    description_vi: 'Xây dựng mạng lưới 30 người bạn',
    description_ko: '친구 30명 연결',
    icon: '🌐',
    tier: 'silver', category: 'friend',
    color: '#f5f3ff', border: '#7c3aed', glow: 'rgba(124,58,237,0.2)',
    requirement: ({ companionsCount }) => companionsCount >= 30,
    getProgress: ({ companionsCount }) => ({ current: Math.min(companionsCount, 30), target: 30 }),
  },
];
