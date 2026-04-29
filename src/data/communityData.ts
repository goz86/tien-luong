export type CommunityCategory = 'work' | 'life' | 'study' | 'visa' | 'food' | 'free';

export type CommunityReactionType = 'like' | 'dislike';

export interface CommunityPost {
  id: string;
  user_id: string;
  category: CommunityCategory;
  title: string;
  content: string;
  is_anonymous: boolean;
  display_name: string;
  likes_count: number;
  dislikes_count: number;
  comments_count: number;
  views_count: number;
  created_at: string;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  is_anonymous: boolean;
  display_name: string;
  is_author: boolean;
  likes_count: number;
  created_at: string;
}

export interface CommunityNotification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  type: 'like' | 'comment' | 'reply' | 'system';
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export const CATEGORIES: Record<CommunityCategory, { label: string; color: string; bg: string }> = {
  work: { label: 'Việc làm thêm', color: '#2563eb', bg: '#eff6ff' },
  life: { label: 'Sinh hoạt', color: '#059669', bg: '#ecfdf5' },
  study: { label: 'Học tập', color: '#7c3aed', bg: '#f5f3ff' },
  visa: { label: 'Visa & pháp lý', color: '#dc2626', bg: '#fef2f2' },
  food: { label: 'Ẩm thực', color: '#ea580c', bg: '#fff7ed' },
  free: { label: 'Tự do', color: '#64748b', bg: '#f8fafc' },
};



export function timeAgo(dateString: string): string {
  const past = new Date(dateString).getTime();
  if (Number.isNaN(past)) return '';

  const diff = Date.now() - past;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
  return new Date(dateString).toLocaleDateString('vi-VN');
}
