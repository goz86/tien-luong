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
  {
    id: 'newcomer',
    label_vi: 'Người mới',
    label_ko: '신입생',
    description_vi: 'Tham gia cộng đồng Duhoc Mate',
    description_ko: '두혹메이트 커뮤니티 가입',
    icon: '👋',
    color: '#f3f4f6',
    border: '#94a3b8',
    requirement: () => true, // Always true if logged in
  },
  {
    id: 'hardworking',
    label_vi: 'Chăm chỉ',
    label_ko: '열심히',
    description_vi: 'Ghi ít nhất 5 ca làm việc',
    description_ko: '최소 5개의 근무 기록 작성',
    icon: '🔥',
    color: '#ffedd5',
    border: '#f97316',
    requirement: ({ shifts }) => shifts.length >= 5,
  },
  {
    id: 'saver',
    label_vi: 'Tiết kiệm',
    label_ko: '절약왕',
    description_vi: 'Ghi ít nhất 3 khoản chi tiêu',
    description_ko: '최소 3개의 지출 기록 작성',
    icon: '💰',
    color: '#dcfce7',
    border: '#22c55e',
    requirement: ({ expenses }) => expenses.length >= 3,
  },
  {
    id: 'community',
    label_vi: 'Cộng đồng',
    label_ko: '커뮤니티',
    description_vi: 'Bình luận 3 lần trong cộng đồng',
    description_ko: '커뮤니티에서 3번 댓글 작성',
    icon: '💬',
    color: '#dbeafe',
    border: '#3b82f6',
    requirement: ({ comments }) => comments.length >= 3,
  },
  {
    id: 'expert_spending',
    label_vi: 'Chi tiêu giỏi',
    label_ko: '소비왕',
    description_vi: 'Ghi nhận trên 10 khoản chi tiêu',
    description_ko: '10개 이상의 지출 기록 작성',
    icon: '💎',
    color: '#f1f5f9',
    border: '#64748b',
    requirement: ({ expenses }) => expenses.length >= 10,
  },
  {
    id: 'leader',
    label_vi: 'Thủ lĩnh',
    label_ko: '리더',
    description_vi: 'Có ít nhất 5 người bạn kết nối',
    description_ko: '최소 5명의 친구와 연결',
    icon: '👑',
    color: '#fef9c3',
    border: '#eab308',
    requirement: ({ companionsCount }) => companionsCount >= 5,
  },
  {
    id: 'influencer',
    label_vi: 'Người truyền cảm hứng',
    label_ko: '인플루언서',
    description_vi: 'Nhận được tổng cộng 10 lượt thích',
    description_ko: '총 10개의 좋아요 획득',
    icon: '✨',
    color: '#fdf2f8',
    border: '#db2777',
    requirement: ({ likesCount }) => likesCount >= 10,
  },
  {
    id: 'millionaire',
    label_vi: 'Triệu phú',
    label_ko: '백만장자',
    description_vi: 'Kiếm được trên 1,000,000 KRW trong một tháng',
    description_ko: '한 달에 1,000,000 KRW 이상 수입',
    icon: '💸',
    color: '#ecfdf5',
    border: '#059669',
    requirement: ({ shifts }) => {
      // Simplification: just check if total pay of all shifts > 1M
      // In a real app we'd check per month
      const total = shifts.reduce((acc, s) => {
        const hours = (new Date(`2000-01-01T${s.endTime}`).getTime() - new Date(`2000-01-01T${s.startTime}`).getTime()) / 3600000;
        return acc + (hours * s.hourlyWage);
      }, 0);
      return total >= 1000000;
    },
  },
];
