import { type Shift, type Expense } from '../lib/types';
import { type CommunityPost, type CommunityComment } from './communityData';

export interface Badge {
  id: string;
  label_vi: string;
  label_ko: string;
  description_vi: string;
  description_ko: string;
  icon: string;
  color: string;
  border: string;
  requirement: (data: {
    shifts: Shift[];
    expenses: Expense[];
    posts: CommunityPost[];
    comments: CommunityComment[];
    companionsCount: number;
    likesCount: number;
  }) => boolean;
}

export const BADGES: Badge[] = [
  // --- NHÓM LAO ĐỘNG (SHIFTS) ---
  {
    id: 'work_bronze',
    label_vi: 'Lao động',
    label_ko: '노동자',
    description_vi: 'Hoàn thành 10 ca làm việc đầu tiên',
    description_ko: '첫 10회 근무 완료',
    icon: '🥉',
    color: '#fff7ed',
    border: '#fb923c',
    requirement: ({ shifts }) => shifts.length >= 10,
  },
  {
    id: 'work_silver',
    label_vi: 'Chăm chỉ',
    label_ko: '성실함',
    description_vi: 'Hoàn thành 50 ca làm việc',
    description_ko: '50회 근무 완료',
    icon: '🥈',
    color: '#f8fafc',
    border: '#94a3b8',
    requirement: ({ shifts }) => shifts.length >= 50,
  },
  {
    id: 'work_gold',
    label_vi: 'Chiến thần ca làm',
    label_ko: '근무의 신',
    description_vi: 'Hoàn thành 200 ca làm việc nỗ lực',
    description_ko: '200회 근무 완료',
    icon: '🥇',
    color: '#fefce8',
    border: '#eab308',
    requirement: ({ shifts }) => shifts.length >= 200,
  },

  // --- NHÓM THU NHẬP (INCOME) ---
  {
    id: 'income_bronze',
    label_vi: 'Tích lũy 1M',
    label_ko: '백만장자',
    description_vi: 'Kiếm được 1,000,000 KRW tích lũy',
    description_ko: '누적 수입 1,000,000 KRW 달성',
    icon: '💰',
    color: '#ecfdf5',
    border: '#10b981',
    requirement: ({ shifts }) => {
      const total = shifts.reduce((acc, s) => {
        const start = new Date(`2000-01-01T${s.startTime}`).getTime();
        const end = new Date(`2000-01-01T${s.endTime}`).getTime();
        let hours = (end - start) / 3600000;
        if (hours < 0) hours += 24;
        const totalMinutes = hours * 60 - (s.breakMinutes || 0);
        return acc + (totalMinutes / 60 * s.hourlyWage);
      }, 0);
      return total >= 1000000;
    },
  },
  {
    id: 'income_silver',
    label_vi: 'Tích lũy 10M',
    label_ko: '천만장자',
    description_vi: 'Kiếm được 10,000,000 KRW tích lũy',
    description_ko: '누적 수입 10,000,000 KRW 달성',
    icon: '🏦',
    color: '#f0f9ff',
    border: '#0ea5e9',
    requirement: ({ shifts }) => {
      const total = shifts.reduce((acc, s) => {
        const start = new Date(`2000-01-01T${s.startTime}`).getTime();
        const end = new Date(`2000-01-01T${s.endTime}`).getTime();
        let hours = (end - start) / 3600000;
        if (hours < 0) hours += 24;
        const totalMinutes = hours * 60 - (s.breakMinutes || 0);
        return acc + (totalMinutes / 60 * s.hourlyWage);
      }, 0);
      return total >= 10000000;
    },
  },
  {
    id: 'income_gold',
    label_vi: 'Tài phiệt Du học',
    label_ko: '유학 재벌',
    description_vi: 'Kiếm được 50,000,000 KRW tích lũy',
    description_ko: '누적 수입 50,000,000 KRW 달성',
    icon: '💎',
    color: '#faf5ff',
    border: '#a855f7',
    requirement: ({ shifts }) => {
      const total = shifts.reduce((acc, s) => {
        const start = new Date(`2000-01-01T${s.startTime}`).getTime();
        const end = new Date(`2000-01-01T${s.endTime}`).getTime();
        let hours = (end - start) / 3600000;
        if (hours < 0) hours += 24;
        const totalMinutes = hours * 60 - (s.breakMinutes || 0);
        return acc + (totalMinutes / 60 * s.hourlyWage);
      }, 0);
      return total >= 50000000;
    },
  },

  // --- NHÓM CHI TIÊU (EXPENSES) ---
  {
    id: 'expense_bronze',
    label_vi: 'Ghi chép',
    label_ko: '기록가',
    description_vi: 'Ghi lại 20 khoản chi tiêu',
    description_ko: '지출 20회 기록',
    icon: '📝',
    color: '#f1f5f9',
    border: '#64748b',
    requirement: ({ expenses }) => expenses.length >= 20,
  },
  {
    id: 'expense_gold',
    label_vi: 'Bậc thầy chi tiêu',
    label_ko: '지출 마스터',
    description_vi: 'Ghi lại 200 khoản chi tiêu tỉ mỉ',
    description_ko: '지출 200회 기록',
    icon: '⚖️',
    color: '#fff1f2',
    border: '#e11d48',
    requirement: ({ expenses }) => expenses.length >= 200,
  },

  // --- NHÓM CỘNG ĐỒNG (SOCIAL) ---
  {
    id: 'social_bronze',
    label_vi: 'Năng nổ',
    label_ko: '활동가',
    description_vi: 'Bình luận 20 lần trong cộng đồng',
    description_ko: '커뮤니티 댓글 20회 작성',
    icon: '💬',
    color: '#f0fdf4',
    border: '#22c55e',
    requirement: ({ comments }) => comments.length >= 20,
  },
  {
    id: 'social_gold',
    label_vi: 'Người truyền cảm hứng',
    label_ko: '인플루언서',
    description_vi: 'Nhận được 100 lượt thích từ cộng đồng',
    description_ko: '좋아요 100회 획득',
    icon: '✨',
    color: '#fdf2f8',
    border: '#db2777',
    requirement: ({ likesCount }) => likesCount >= 100,
  },

  // --- NHÓM KẾT NỐI (FRIENDS) ---
  {
    id: 'friend_bronze',
    label_vi: 'Bạn bè',
    label_ko: '친구들',
    description_vi: 'Kết nối với 5 người bạn',
    description_ko: '친구 5명 연결',
    icon: '🤝',
    color: '#eff6ff',
    border: '#3b82f6',
    requirement: ({ companionsCount }) => companionsCount >= 5,
  },
  {
    id: 'friend_gold',
    label_vi: 'Siêu kết nối',
    label_ko: '인싸',
    description_vi: 'Kết nối với 50 người bạn',
    description_ko: '친구 50명 연결',
    icon: '🌐',
    color: '#f5f3ff',
    border: '#7c3aed',
    requirement: ({ companionsCount }) => companionsCount >= 50,
  },
];
