import { useState } from 'react';
import {
  BadgeCheck,
  Bell,
  BookmarkCheck,
  ChevronRight,
  ClipboardList,
  Clock3,
  Flame,
  HelpCircle,
  MapPin,
  MessageCircle,
  Megaphone,
  PenLine,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Star,
  Store,
  Tag,
  ThumbsUp,
  Users,
  type LucideIcon
} from 'lucide-react';
import { CompanionProfile } from '../lib/types';

type CommunityTab = 'feed' | 'friends' | 'market' | 'reviews' | 'qa';
type IconComponent = LucideIcon;

const communityTabs: Array<{ id: CommunityTab; label: string; icon: IconComponent }> = [
  { id: 'feed', label: 'Bảng tin', icon: MessageCircle },
  { id: 'friends', label: 'Bạn bè', icon: Users },
  { id: 'market', label: 'Chợ cũ', icon: ShoppingBag },
  { id: 'reviews', label: 'Review', icon: Star },
  { id: 'qa', label: 'Hỏi đáp', icon: HelpCircle }
];

const shortcuts: Array<{ label: string; icon: IconComponent; tone: string }> = [
  { label: 'Bài của tôi', icon: PenLine, tone: 'ink' },
  { label: 'Bình luận', icon: MessageCircle, tone: 'green' },
  { label: 'Đã lưu', icon: BookmarkCheck, tone: 'blue' },
  { label: 'Đang hot', icon: Flame, tone: 'amber' }
];

const notices = [
  { title: 'Cách ghi phụ cấp ngày lễ vào bảng lương', likes: 41, comments: 35 },
  { title: 'Mẫu hỏi chủ quán khi lương bị trả chậm', likes: 28, comments: 12 }
];

const hotPosts = [
  {
    board: 'Việc làm thêm',
    title: 'Đi làm ca tối ở quán ăn, có cần ghi break time không?',
    excerpt: 'Mình mới đi làm ở Hongdae, chủ bảo nghỉ 30 phút nhưng thực tế vẫn phải dọn bàn...',
    time: '2 giờ trước',
    likes: 18,
    comments: 9
  },
  {
    board: 'Sinh hoạt',
    title: 'Chia tiền nhà với roommate sao cho rõ ngay từ đầu?',
    excerpt: 'Có bạn nào có mẫu note bằng tiếng Hàn để thống nhất tiền nhà, điện, gas không?',
    time: 'Hôm qua',
    likes: 12,
    comments: 17
  }
];

const feedSections = [
  {
    title: 'Bảng tin lương',
    icon: ClipboardList,
    posts: [
      { title: 'Lương tháng này của mình thấp hơn hợp đồng 3 giờ', meta: 'Mới', comments: 4, likes: 6 },
      { title: 'Có ai từng nhận phụ cấp ca đêm ở cửa hàng tiện lợi chưa?', meta: 'Seoul', comments: 11, likes: 15 },
      { title: 'Checklist trước khi ký hợp đồng part-time', meta: 'Ghim', comments: 8, likes: 24 }
    ]
  },
  {
    title: 'Tự do',
    icon: MessageCircle,
    posts: [
      { title: 'Mẹo đi chợ tiết kiệm cho tuần thi TOPIK', meta: 'Mới', comments: 3, likes: 7 },
      { title: 'Xin địa chỉ quán Việt gần Konkuk', meta: 'Konkuk', comments: 6, likes: 5 },
      { title: 'Cách xin đổi lịch làm khi trùng lịch học', meta: 'Hỏi nhanh', comments: 2, likes: 4 }
    ]
  }
];

const marketItems = [
  { title: 'Nồi cơm mini Cuckoo', area: 'Sinchon', price: '30,000원', status: 'Còn hàng', icon: Store },
  { title: 'Bàn học gấp', area: 'Konkuk', price: '15,000원', status: 'Hẹn xem', icon: ClipboardList },
  { title: 'Bộ chăn ga mùa đông', area: 'Suwon', price: '20,000원', status: 'Còn hàng', icon: ShoppingBag },
  { title: 'Sách TOPIK II', area: 'Hongdae', price: '8,000원', status: 'Giá tốt', icon: Tag }
];

const reviewItems = [
  {
    venue: 'Cafe Hollys Sinchon',
    area: 'Seoul',
    rating: 5,
    tags: ['Lương đúng hạn', 'Chủ dễ'],
    review: 'Ca tối hơi đông nhưng đồng nghiệp chỉ việc kỹ, phù hợp bạn mới sang.'
  },
  {
    venue: 'Xưởng đóng gói Incheon',
    area: 'Incheon',
    rating: 3,
    tags: ['Việc nặng', 'Cần hỏi kỹ'],
    review: 'Tiền ổn nhưng lịch đổi nhanh. Nên hỏi rõ break time và tiền tăng ca.'
  },
  {
    venue: 'Quán BBQ Gangnam',
    area: 'Gangnam',
    rating: 4,
    tags: ['Bao ăn', 'Ca tối'],
    review: 'Không khí ổn, cuối tuần đông. Có phụ cấp nếu làm qua 22:00.'
  }
];

const qaItems = [
  { title: 'Visa D-2 được làm tối đa bao nhiêu giờ trong kỳ học?', answers: 6, tag: 'Luật làm thêm' },
  { title: 'Chủ quán giữ lương thử việc thì xử lý thế nào?', answers: 9, tag: 'Lương' },
  { title: 'Có nên mua bảo hiểm điện thoại khi mới sang không?', answers: 3, tag: 'Sinh hoạt' }
];

function renderPostStats(likes: number, comments: number) {
  return (
    <div className="community-post-stats">
      <span>
        <ThumbsUp size={15} />
        {likes}
      </span>
      <span>
        <MessageCircle size={15} />
        {comments}
      </span>
    </div>
  );
}

export function CommunityScreen({
  companions,
  requested,
  onRequest
}: {
  companions: CompanionProfile[];
  requested: string[];
  onRequest: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<CommunityTab>('feed');

  return (
    <>
      <header className="community-header">
        <div>
          <p className="community-eyebrow">Duhoc Mate</p>
          <h1>Cộng đồng</h1>
        </div>
        <div className="community-header-actions">
          <button type="button" className="community-icon-button" aria-label="Tìm kiếm">
            <Search size={21} />
          </button>
          <button type="button" className="community-icon-button muted" aria-label="Thông báo">
            <Bell size={21} />
          </button>
        </div>
      </header>

      <section className="community-shortcuts" aria-label="Lối tắt cộng đồng">
        {shortcuts.map(({ label, icon: Icon, tone }) => (
          <button key={label} type="button" className="community-shortcut">
            <span className={`community-shortcut-icon ${tone}`}>
              <Icon size={23} />
            </span>
            <strong>{label}</strong>
          </button>
        ))}
      </section>

      <section className="community-panel">
        <button type="button" className="community-panel-title">
          <span>
            <Megaphone size={20} />
            Thông báo
          </span>
          <ChevronRight size={20} />
        </button>
        <div className="community-compact-list">
          {notices.map((notice) => (
            <article key={notice.title} className="community-compact-row">
              <p>{notice.title}</p>
              {renderPostStats(notice.likes, notice.comments)}
            </article>
          ))}
        </div>
      </section>

      <section className="community-panel community-hot-panel">
        <div className="community-section-head">
          <div>
            <p>Đang hot</p>
            <h2>Bài đang nổi</h2>
          </div>
          <Flame size={22} />
        </div>
        <div className="community-hot-list">
          {hotPosts.map((post) => (
            <article key={post.title} className="community-hot-post">
              <span>{post.board}</span>
              <h3>{post.title}</h3>
              <p>{post.excerpt}</p>
              <footer>
                <small>{post.time}</small>
                {renderPostStats(post.likes, post.comments)}
              </footer>
            </article>
          ))}
        </div>
      </section>

      <div className="community-subtabs" role="tablist" aria-label="Mục cộng đồng">
        {communityTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={activeTab === id ? 'active' : ''}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div className="community-tab-body">
        {activeTab === 'feed' ? (
          <div className="community-board-stack">
            {feedSections.map(({ title, icon: Icon, posts }) => (
              <section key={title} className="community-board-section">
                <button type="button" className="community-panel-title">
                  <span>
                    <Icon size={19} />
                    {title}
                  </span>
                  <ChevronRight size={20} />
                </button>
                <div className="community-thread-list">
                  {posts.map((post) => (
                    <article key={post.title} className="community-thread-row">
                      <span className="community-new-badge">{post.meta}</span>
                      <p>{post.title}</p>
                      {renderPostStats(post.likes, post.comments)}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {activeTab === 'friends' ? (
          <div className="community-friend-list">
            {companions.map((companion) => {
              const sent = requested.includes(companion.id);
              return (
                <article key={companion.id} className="community-friend-row">
                  <div className="community-avatar">{companion.displayName.slice(0, 1)}</div>
                  <div className="community-friend-main">
                    <div>
                      <strong>{companion.displayName}</strong>
                      <span>{companion.school}</span>
                    </div>
                    <p>{companion.focus}</p>
                    <div className="community-chip-row">
                      <span>
                        <MapPin size={13} />
                        {companion.region}
                      </span>
                      <span>
                        <Clock3 size={13} />
                        {companion.availability ?? 'Sau giờ học'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={sent ? 'community-request sent' : 'community-request'}
                    onClick={() => onRequest(companion.id)}
                    aria-label={sent ? `Đã gửi lời mời cho ${companion.displayName}` : `Kết nối với ${companion.displayName}`}
                  >
                    {sent ? <BadgeCheck size={18} /> : <Send size={18} />}
                  </button>
                </article>
              );
            })}
          </div>
        ) : null}

        {activeTab === 'market' ? (
          <div className="community-market-grid">
            {marketItems.map(({ title, area, price, status, icon: Icon }) => (
              <article key={title} className="community-market-card">
                <div className="community-market-thumb">
                  <Icon size={30} />
                </div>
                <div>
                  <strong>{title}</strong>
                  <span>{area}</span>
                </div>
                <footer>
                  <b>{price}</b>
                  <small>{status}</small>
                </footer>
              </article>
            ))}
          </div>
        ) : null}

        {activeTab === 'reviews' ? (
          <div className="community-review-list">
            {reviewItems.map((item) => (
              <article key={item.venue} className="community-review-card">
                <header>
                  <div>
                    <strong>{item.venue}</strong>
                    <span>
                      <MapPin size={13} />
                      {item.area}
                    </span>
                  </div>
                  <div className="community-stars" aria-label={`${item.rating} trên 5 sao`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star key={index} size={14} fill={index < item.rating ? 'currentColor' : 'none'} />
                    ))}
                  </div>
                </header>
                <p>{item.review}</p>
                <div className="community-chip-row">
                  {item.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {activeTab === 'qa' ? (
          <div className="community-qa-list">
            {qaItems.map((item) => (
              <article key={item.title} className="community-qa-row">
                <div>
                  <span>{item.tag}</span>
                  <strong>{item.title}</strong>
                </div>
                <p>{item.answers} trả lời</p>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <button type="button" className="community-compose-button">
        <Plus size={22} />
        {activeTab === 'market'
          ? 'Đăng bán'
          : activeTab === 'reviews'
            ? 'Viết review'
            : activeTab === 'friends'
              ? 'Tìm bạn'
              : activeTab === 'qa'
                ? 'Đặt câu hỏi'
                : 'Viết bài'}
      </button>
    </>
  );
}
