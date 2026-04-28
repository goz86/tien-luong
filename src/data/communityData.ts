// Demo data for Community tab — Vietnamese study abroad forum

export type CommunityCategory = 'work' | 'life' | 'study' | 'visa' | 'food' | 'free';

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

export const CATEGORIES: Record<CommunityCategory, { label: string; color: string; bg: string }> = {
  work: { label: 'Việc làm thêm', color: '#2563eb', bg: '#eff6ff' },
  life: { label: 'Sinh hoạt', color: '#059669', bg: '#ecfdf5' },
  study: { label: 'Học tập', color: '#7c3aed', bg: '#f5f3ff' },
  visa: { label: 'Visa & Pháp lý', color: '#dc2626', bg: '#fef2f2' },
  food: { label: 'Ẩm thực', color: '#ea580c', bg: '#fff7ed' },
  free: { label: 'Tự do', color: '#64748b', bg: '#f8fafc' },
};

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600000).toISOString();
}

export const demoPosts: CommunityPost[] = [
  {
    id: 'post-1',
    user_id: 'demo-user-1',
    category: 'work',
    title: 'Đi làm ca tối ở quán ăn, có cần ghi break time không?',
    content: 'Mình mới đi làm ở Hongdae, chủ bảo nghỉ 30 phút nhưng thực tế vẫn phải dọn bàn và rửa bát trong thời gian đó. Mình có nên ghi break time hay tính luôn vào giờ làm? Mọi người ở đây xử lý thế nào?',
    is_anonymous: true,
    display_name: 'Ẩn danh',
    likes_count: 18,
    dislikes_count: 0,
    comments_count: 9,
    views_count: 231,
    created_at: hoursAgo(2),
  },
  {
    id: 'post-2',
    user_id: 'demo-user-2',
    category: 'life',
    title: 'Chia tiền nhà với roommate sao cho rõ ngay từ đầu?',
    content: 'Có bạn nào có mẫu note bằng tiếng Hàn để ghi thống nhất tiền nhà, điện, gas, nước, internet không? Mình mới dọn vào ở chung với 2 bạn Hàn, sợ sau này phát sinh vấn đề.\n\nMình đang nghĩ là dùng app chia tiền nhưng các bạn HQ hay dùng 카카오페이 để chuyển. Có cách nào quản lý cho gọn không?',
    is_anonymous: true,
    display_name: 'Ẩn danh',
    likes_count: 24,
    dislikes_count: 1,
    comments_count: 7,
    views_count: 412,
    created_at: hoursAgo(5),
  },
  {
    id: 'post-3',
    user_id: 'demo-user-3',
    category: 'work',
    title: 'Cách ghi phụ cấp ngày lễ vào bảng lương',
    content: 'Mình làm ở quán cà phê, cuối tuần và ngày lễ được trả thêm 50% nhưng không biết ghi vào app tính lương kiểu gì. Có bạn nào biết cách tính 주휴수당 (phụ cấp ngày nghỉ hàng tuần) cho chính xác không?\n\nTheo mình tìm hiểu thì nếu làm đủ 15 giờ/tuần thì được hưởng, nhưng quán mình tính khác.',
    is_anonymous: true,
    display_name: 'Ẩn danh',
    likes_count: 41,
    dislikes_count: 0,
    comments_count: 35,
    views_count: 890,
    created_at: hoursAgo(8),
  },
  {
    id: 'post-4',
    user_id: 'demo-user-4',
    category: 'visa',
    title: 'Mẫu hỏi chủ quán khi lương bị trả chậm',
    content: 'Chủ quán nợ lương mình 2 tháng rồi, mỗi lần hỏi đều bảo "tuần sau trả". Mình muốn gửi tin nhắn chính thức bằng tiếng Hàn để có bằng chứng. Có bạn nào có mẫu không?\n\nMình đang tính gọi 1345 (đường dây hỗ trợ lao động nước ngoài) nhưng muốn thử nói chuyện với chủ trước.',
    is_anonymous: true,
    display_name: 'Ẩn danh',
    likes_count: 28,
    dislikes_count: 0,
    comments_count: 12,
    views_count: 567,
    created_at: hoursAgo(12),
  },
  {
    id: 'post-5',
    user_id: 'demo-user-5',
    category: 'study',
    title: 'TOPIK II: Chia sẻ tài liệu ôn thi cấp 4',
    content: 'Mình vừa thi TOPIK II đợt tháng 4 xong, đạt cấp 4. Chia sẻ mọi người bộ tài liệu mình dùng:\n\n1. 한국어능력시험 TOPIK II 쓰기 (viết) — cuốn này rất hay\n2. App "TOPIK ONE" trên Android\n3. Kênh YouTube "한국어 패치" \n4. Đề thi thử trên topik.go.kr\n\nAi cần file PDF thì inbox mình nhé!',
    is_anonymous: false,
    display_name: 'Minh Anh',
    likes_count: 56,
    dislikes_count: 0,
    comments_count: 22,
    views_count: 1203,
    created_at: hoursAgo(24),
  },
  {
    id: 'post-6',
    user_id: 'demo-user-6',
    category: 'food',
    title: 'Ở đâu mua nước mắm và gia vị Việt rẻ nhất Seoul?',
    content: 'Mình ở khu Sinchon, muốn tìm chỗ mua nước mắm, sa tế, bột ngọt giá rẻ. Mấy cửa hàng ở Dongdaemun bán đắt quá 😭\n\nCó bạn nào biết chỗ nào ở Seoul bán đồ Việt Nam giá hợp lý không? Đặc biệt là nước mắm Phú Quốc và mì gói Hảo Hảo.',
    is_anonymous: true,
    display_name: 'Ẩn danh',
    likes_count: 33,
    dislikes_count: 0,
    comments_count: 15,
    views_count: 678,
    created_at: hoursAgo(36),
  },
  {
    id: 'post-7',
    user_id: 'demo-user-7',
    category: 'life',
    title: 'Bảo hiểm sức khoẻ du học sinh — nên mua gói nào?',
    content: 'Mình sắp hết hạn bảo hiểm của trường, cần mua 국민건강보험 (bảo hiểm quốc gia). Phí mỗi tháng khoảng bao nhiêu? Có ai biết cách đăng ký online không?\n\nVà nếu mình đi khám bệnh thì được hỗ trợ bao nhiêu %?',
    is_anonymous: true,
    display_name: 'Ẩn danh',
    likes_count: 19,
    dislikes_count: 0,
    comments_count: 8,
    views_count: 345,
    created_at: hoursAgo(48),
  },
  {
    id: 'post-8',
    user_id: 'demo-user-8',
    category: 'free',
    title: 'Cuối tuần ai muốn đi Bukhansan leo núi không?',
    content: 'Thứ 7 tuần này mình định đi 북한산 (Bukhansan), xuất phát từ ga Gupabal lúc 9h sáng. Ai muốn đi chung thì comment nhé!\n\nMình sẽ chuẩn bị kimbap và nước. Leo đường Baegundae, khoảng 3-4 tiếng khứ hồi.\n\nP/S: Mang giày thể thao nhé, đừng mang dép 😅',
    is_anonymous: false,
    display_name: 'Tuấn',
    likes_count: 15,
    dislikes_count: 0,
    comments_count: 11,
    views_count: 289,
    created_at: hoursAgo(72),
  },
];

export const demoComments: CommunityComment[] = [
  // Comments for post-1 (Break time)
  {
    id: 'cmt-1-1',
    post_id: 'post-1',
    parent_id: null,
    user_id: 'demo-user-9',
    content: 'Nếu bạn vẫn phải làm việc trong giờ nghỉ thì đó không phải break time. Theo luật lao động HQ, break time là thời gian bạn được tự do hoàn toàn.',
    is_anonymous: true,
    display_name: 'Ẩn danh 1',
    is_author: false,
    likes_count: 8,
    created_at: hoursAgo(1.5),
  },
  {
    id: 'cmt-1-2',
    post_id: 'post-1',
    parent_id: null,
    user_id: 'demo-user-1',
    content: 'Cảm ơn bạn! Vậy mình sẽ nói với chủ và ghi lại đầy đủ giờ làm thực tế.',
    is_anonymous: true,
    display_name: 'Ẩn danh (Tác giả)',
    is_author: true,
    likes_count: 3,
    created_at: hoursAgo(1),
  },
  {
    id: 'cmt-1-3',
    post_id: 'post-1',
    parent_id: 'cmt-1-1',
    user_id: 'demo-user-10',
    content: 'Đúng rồi, nếu 4 tiếng liên tục thì phải có 30 phút nghỉ, 8 tiếng thì 1 tiếng. Nếu chủ bắt làm trong giờ nghỉ thì ghi nhận hết.',
    is_anonymous: true,
    display_name: 'Ẩn danh 2',
    is_author: false,
    likes_count: 5,
    created_at: hoursAgo(1.2),
  },
  {
    id: 'cmt-1-4',
    post_id: 'post-1',
    parent_id: null,
    user_id: 'demo-user-11',
    content: 'Mình cũng làm quán ăn ở Hongdae, chủ quán mình rất ok, cho nghỉ đúng 30 phút và không phải làm gì. Bạn nên nói rõ với chủ nhé.',
    is_anonymous: true,
    display_name: 'Ẩn danh 3',
    is_author: false,
    likes_count: 2,
    created_at: hoursAgo(0.8),
  },

  // Comments for post-2 (Chia tiền nhà)
  {
    id: 'cmt-2-1',
    post_id: 'post-2',
    parent_id: null,
    user_id: 'demo-user-12',
    content: 'Mình dùng app Splitwise, rất tiện! Hỗ trợ nhiều đơn vị tiền tệ. Mỗi tháng chỉ cần ghi 1 lần là tự chia đều.',
    is_anonymous: true,
    display_name: 'Ẩn danh 1',
    is_author: false,
    likes_count: 11,
    created_at: hoursAgo(4),
  },
  {
    id: 'cmt-2-2',
    post_id: 'post-2',
    parent_id: 'cmt-2-1',
    user_id: 'demo-user-2',
    content: 'Mình thử xem. Cảm ơn bạn nhiều!',
    is_anonymous: true,
    display_name: 'Ẩn danh (Tác giả)',
    is_author: true,
    likes_count: 1,
    created_at: hoursAgo(3.5),
  },
  {
    id: 'cmt-2-3',
    post_id: 'post-2',
    parent_id: null,
    user_id: 'demo-user-13',
    content: 'Kinh nghiệm của mình: ghi rõ ràng trên giấy ngay từ đầu, ai trả bao nhiêu, deadline ngày mấy. Tránh bị hiểu lầm sau này.',
    is_anonymous: true,
    display_name: 'Ẩn danh 2',
    is_author: false,
    likes_count: 7,
    created_at: hoursAgo(3),
  },

  // Comments for post-3 (Phụ cấp ngày lễ)
  {
    id: 'cmt-3-1',
    post_id: 'post-3',
    parent_id: null,
    user_id: 'demo-user-14',
    content: '주휴수당 tính bằng: (giờ làm/tuần ÷ 5) × lương giờ. Ví dụ làm 20h/tuần, lương 11,000₩/h thì 주휴수당 = 4h × 11,000 = 44,000₩/tuần.',
    is_anonymous: true,
    display_name: 'Ẩn danh 1',
    is_author: false,
    likes_count: 25,
    created_at: hoursAgo(7),
  },
  {
    id: 'cmt-3-2',
    post_id: 'post-3',
    parent_id: 'cmt-3-1',
    user_id: 'demo-user-3',
    content: 'Cảm ơn bạn giải thích rõ quá! Vậy mình làm đủ 15h/tuần là được hưởng rồi nhỉ?',
    is_anonymous: true,
    display_name: 'Ẩn danh (Tác giả)',
    is_author: true,
    likes_count: 3,
    created_at: hoursAgo(6.5),
  },
  {
    id: 'cmt-3-3',
    post_id: 'post-3',
    parent_id: 'cmt-3-1',
    user_id: 'demo-user-15',
    content: 'Đúng rồi, 15h/tuần trở lên là đủ điều kiện. Nhớ check hợp đồng lao động nữa nhé.',
    is_anonymous: true,
    display_name: 'Ẩn danh 2',
    is_author: false,
    likes_count: 9,
    created_at: hoursAgo(6),
  },

  // Comments for post-4 (Lương bị trả chậm)
  {
    id: 'cmt-4-1',
    post_id: 'post-4',
    parent_id: null,
    user_id: 'demo-user-16',
    content: 'Gọi ngay 1345 đi bạn ơi! Đường dây này có phiên dịch tiếng Việt. Nợ 2 tháng là nghiêm trọng rồi.',
    is_anonymous: true,
    display_name: 'Ẩn danh 1',
    is_author: false,
    likes_count: 15,
    created_at: hoursAgo(11),
  },
  {
    id: 'cmt-4-2',
    post_id: 'post-4',
    parent_id: null,
    user_id: 'demo-user-17',
    content: 'Mẫu tin nhắn tiếng Hàn: "사장님, 안녕하세요. X월, Y월 급여가 아직 지급되지 않았습니다. 빠른 시일 내에 지급 부탁드리겠습니다. 미지급 시 고용노동부에 신고할 수밖에 없는 점 양해 부탁드립니다."',
    is_anonymous: true,
    display_name: 'Ẩn danh 2',
    is_author: false,
    likes_count: 22,
    created_at: hoursAgo(10),
  },

  // Comments for post-8 (Leo núi)
  {
    id: 'cmt-8-1',
    post_id: 'post-8',
    parent_id: null,
    user_id: 'demo-user-18',
    content: 'Mình muốn đi! Ở Sinchon thì ra ga Gupabal mất khoảng 30 phút. Comment để đăng ký nha 🙋‍♀️',
    is_anonymous: false,
    display_name: 'Linh',
    is_author: false,
    likes_count: 4,
    created_at: hoursAgo(60),
  },
  {
    id: 'cmt-8-2',
    post_id: 'post-8',
    parent_id: null,
    user_id: 'demo-user-19',
    content: 'Leo Baegundae hơi khó nha. Ai mới leo lần đầu nên chọn đường Bibong, dễ hơn nhiều.',
    is_anonymous: true,
    display_name: 'Ẩn danh 1',
    is_author: false,
    likes_count: 6,
    created_at: hoursAgo(58),
  },
  {
    id: 'cmt-8-3',
    post_id: 'post-8',
    parent_id: 'cmt-8-2',
    user_id: 'demo-user-8',
    content: 'Cảm ơn bạn góp ý! Mình sẽ hỏi ý kiến mọi người rồi quyết định đường nào nhé 😄',
    is_anonymous: false,
    display_name: 'Tuấn (Tác giả)',
    is_author: true,
    likes_count: 2,
    created_at: hoursAgo(55),
  },
];

export function timeAgo(dateString: string): string {
  const now = Date.now();
  const past = new Date(dateString).getTime();
  const diff = now - past;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
  return new Date(dateString).toLocaleDateString('vi-VN');
}
